"""Dedicated lab host only. Never run on the application/production host.

An authenticated HTTP adapter owns resource-limited, networkless Docker labs.
The application never receives Docker access. This is a pilot, not a claim of
container escape resistance; deploy inside a disposable dedicated VM.
"""
import base64, fcntl, hashlib, hmac, http.server, json, os, pathlib, pty, re, select, signal, struct, subprocess, termios, threading, time
TOKEN = os.environ.get('TWEEN_LAB_TOKEN', '')
IMAGE = os.environ.get('TWEEN_LAB_IMAGE', '')
DOM_IMAGE = os.environ.get('TWEEN_DOM_IMAGE', '')
DOM_SECCOMP = os.environ.get('TWEEN_DOM_SECCOMP', '')
STATE = pathlib.Path(os.environ.get('TWEEN_LAB_STATE', '.lab-data')).resolve()
SESSIONS = {}
LOCK = threading.RLock()
STARTS = threading.BoundedSemaphore(2)
MAX_ACTIVE = 18
MAX_OUTPUT = 262144
def docker(*args, data=None, timeout=20, discard=False):
    result = subprocess.run(['docker', *args], input=data, stdout=subprocess.DEVNULL if discard else subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=timeout)
    if result.returncode: raise RuntimeError('Docker operation unavailable')
    if result.stdout and len(result.stdout) > 1500000: raise ValueError('Output quota exceeded')
    return result.stdout or b''
def helper(session, payload):
    return json.loads(docker('exec', '-i', session['container'], '/usr/bin/python3', '-I', '/opt/tween-files.py', data=json.dumps(payload).encode()))
def snapshot(session):
    value = helper(session, {'action': 'list'})
    value['hash'] = hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()
    return value
def persist(session):
    value = {k:session[k] for k in ['id','container','files','last']}
    value['snapshot'] = snapshot(session)
    temporary = STATE / (session['id'] + '.tmp')
    temporary.write_text(json.dumps(value)); temporary.replace(STATE / (session['id'] + '.json'))
def start_terminal(session):
    master, slave = pty.openpty()
    process = subprocess.Popen(['docker','exec','-it',session['container'],'/bin/bash','--noprofile','--norc'], stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
    os.close(slave); os.set_blocking(master, False)
    session.update(master=master, process=process, output=b'', offset=0)
def provision(identity, files):
    if not re.fullmatch('[a-f0-9]{64}', identity): raise ValueError('Invalid identity')
    with LOCK:
        if identity in SESSIONS:
            session = SESSIONS[identity]; session['last'] = time.time()
            if session['process'].poll() is not None: os.close(session['master']); start_terminal(session)
            return session
        if len(SESSIONS) >= MAX_ACTIVE: raise RuntimeError('Concurrent lab limit reached')
        with STARTS:
            name = 'tween-lab-' + identity
            saved_path = STATE / (identity+'.json')
            saved = json.loads(saved_path.read_text()) if saved_path.exists() else None
            # Only a fixed digest chosen by the lab administrator can execute.
            docker('rm','-f',name) if subprocess.run(['docker','inspect',name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0 else None
            docker('run','-d','--name',name,'--label','tween.lab=1','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=192m','--memory-swap=192m','--cpus=0.5','--ulimit','nofile=128:128','--log-driver=none','--tmpfs','/tmp:rw,noexec,nosuid,size=8m','--tmpfs','/workspace:rw,nosuid,nodev,noexec,size=32m,uid=1000,gid=1000','--user','1000:1000',IMAGE)
            session = {'id':identity,'container':name,'files':saved['files'] if saved else files,'last':time.time(),'created':time.time(),'checkpoint':time.time()}
            try:
                restore = saved['snapshot']['files'] if saved else files
                for file in restore: helper(session, {'action':'write', **file})
                start_terminal(session); SESSIONS[identity]=session; persist(session)
            except Exception:
                docker('rm','-f',name); raise
            return session
def retire(session, save=True):
    try:
        if save: persist(session)
    finally:
        session['process'].terminate(); os.close(session['master']); docker('rm','-f',session['container']); SESSIONS.pop(session['id'],None)
def evaluate(session, tests):
    if not isinstance(tests,list) or not 1 <= len(tests) <= 50: raise ValueError('Invalid tests')
    state = snapshot(session); files = {f['path']:base64.b64decode(f['base64']) for f in state['files']}; checks=[]
    for test in tests:
        rule=json.loads(test['argsJSON']); path=rule.get('path','')
        if test['invoke']=='file': ok=path in files and (rule.get('content') is None or files[path].decode(errors='replace')==rule['content'])
        elif test['invoke']=='absent': ok=path not in files
        elif test['invoke']=='git-tracked': ok=path in state['tracked']
        elif test['invoke']=='git-committed': ok=path in state['committed']
        else: raise ValueError('Unsupported validation rule')
        checks.append({'label':rule.get('label',path),'ok':ok})
    return {'ok':all(c['ok'] for c in checks),'checks':checks,'snapshotHash':state['hash'],'runtime':IMAGE}
def render_dom(data):
    if not re.fullmatch(r'(?:sha256:|[^\s]+@sha256:)[a-f0-9]{64}',DOM_IMAGE): raise ValueError('DOM image digest not configured')
    # Chromium keeps its own sandbox. No --no-sandbox, SYS_ADMIN or host IPC.
    # An administrator may supply the audited Playwright user-namespace profile.
    security = ['--security-opt=seccomp='+DOM_SECCOMP] if DOM_SECCOMP else []
    name='tween-dom-'+hashlib.sha256(os.urandom(32)).hexdigest()
    try:
        raw=docker('run','--rm','-i','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges',*security,'--pids-limit=128','--memory=512m','--memory-swap=512m','--cpus=0.5','--ulimit','nofile=512:512','--log-driver=none','--tmpfs','/tmp:rw,nosuid,nodev,size=64m,uid=1000,gid=1000','--shm-size=64m','--user','1000:1000',DOM_IMAGE,data=json.dumps(data).encode(),timeout=15)
        result=json.loads(raw);result['runtime']=DOM_IMAGE+' '+result['runtime'];return result
    finally:
        subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
CAPABILITY_CACHE = {}
def runtime_capabilities(requested):
    if not isinstance(requested,list) or not requested or any(p not in ['shell-git','dom'] for p in requested):
        raise ValueError('Unsupported capability')
    result = {'probeVersion':1}
    for profile in set(requested):
        image = IMAGE if profile == 'shell-git' else DOM_IMAGE
        cached = CAPABILITY_CACHE.get((profile,image))
        if cached and time.time()-cached['at'] < 60:
            if cached['ok']: result[profile] = image
            continue
        ok = False
        try:
            if profile == 'dom':
                # Application-owned inert health document, never archive code.
                render_dom({'files':[{'path':'index.html','content':'<!doctype html><p>Ready</p>'},{'path':'style.css','content':''},{'path':'main.js','content':''}]})
            else:
                name = 'tween-probe-' + hashlib.sha256(os.urandom(32)).hexdigest()
                try:
                    docker('run','--rm','--name',name,'--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--pids-limit=64','--memory=192m','--memory-swap=192m','--cpus=0.5','--user','1000:1000',image,'/bin/bash','-c','git --version >/dev/null',timeout=10,discard=True)
                finally:
                    subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=10)
            ok = True
            result[profile] = image
        except Exception:
            pass
        CAPABILITY_CACHE[(profile,image)] = {'at':time.time(),'ok':ok}
    return result

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        if not hmac.compare_digest(self.headers.get('Authorization',''), 'Bearer '+TOKEN): self.send_error(401);return
        try:
            length=int(self.headers.get('Content-Length','0'))
            if not 0 < length <= 1000000: raise ValueError('Request too large')
            data=json.loads(self.rfile.read(length))
            with LOCK:
                if self.path=='/capabilities':
                    result=runtime_capabilities(data.get('profiles',['shell-git','dom']))
                elif self.path=='/dom': result=render_dom(data)
                elif self.path=='/reference':
                    identity=hashlib.sha256(os.urandom(32)).hexdigest()
                    session=provision(identity,data.get('files',[]))
                    try:
                        code=data.get('code','')
                        if not isinstance(code,str) or len(code)>10000: raise ValueError('Reference too large')
                        docker('exec','-i',session['container'],'/bin/bash','--noprofile','--norc',data=code.encode(),timeout=5,discard=True)
                        result=evaluate(session,data['tests'])
                    finally:
                        retire(session,save=False)
                        (STATE/(identity+'.json')).unlink(missing_ok=True)
                elif self.path=='/sessions':
                    if data.get('profile')!='shell-git': raise ValueError('Unsupported profile')
                    session=provision(data['key'],data.get('files',[])); result={'id':session['id'],'runtime':IMAGE}
                else:
                    match=re.fullmatch('/sessions/([a-f0-9]{64})/(io|files|check|snapshot|reset)',self.path)
                    if not match or match[1] not in SESSIONS: raise ValueError('Session expired; reconnect')
                    session=SESSIONS[match[1]]; session['last']=time.time(); action=match[2]
                    if action=='io':
                        text=data.get('input','')
                        if not isinstance(text,str) or len(text)>8192: raise ValueError('Input quota')
                        cols=max(20,min(200,int(data.get('cols',80))));rows=max(5,min(80,int(data.get('rows',24))))
                        fcntl.ioctl(session['master'],termios.TIOCSWINSZ,struct.pack('HHHH',rows,cols,0,0));os.killpg(session['process'].pid,signal.SIGWINCH)
                        if text: os.write(session['master'],text.encode())
                        for _ in range(16):
                            if not select.select([session['master']],[],[],0)[0]: break
                            chunk=os.read(session['master'],16384)
                            if not chunk: break
                            session['output']+=chunk
                            if len(session['output'])>MAX_OUTPUT:
                                drop=len(session['output'])-MAX_OUTPUT; session['offset']+=drop;session['output']=session['output'][drop:]
                        cursor=int(data.get('cursor',0)); start=max(0,cursor-session['offset'])
                        result={'output':session['output'][start:].decode(errors='replace'),'cursor':session['offset']+len(session['output'])}
                    elif action=='files': result=helper(session,data)
                    elif action=='check': result=evaluate(session,data['tests'])
                    elif action=='snapshot': result=snapshot(session);persist(session)
                    else:
                        identity=session['id'];files=session['files'];persist(session)
                        path=STATE/(identity+'.json'); backup=STATE/(identity+'-before-reset.json');path.replace(backup)
                        retire(session,save=False);provision(identity,files);result={'reset':True}
            raw=json.dumps(result).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        except Exception:
            self.send_error(503,'Lab unavailable; no learning judgment')
def maintain():
    while True:
        time.sleep(30)
        with LOCK:
            for session in list(SESSIONS.values()):
                try:
                    if time.time()-session['last']>1200 or time.time()-session['created']>5400: retire(session)
                    else: persist(session)
                except Exception: pass
if __name__=='__main__':
    if len(TOKEN)<32 or not re.fullmatch(r'(?:sha256:|[^\s]+@sha256:)[a-f0-9]{64}',IMAGE): raise SystemExit('Set a 32+ character token and immutable image digest')
    STATE.mkdir(mode=0o700,parents=True,exist_ok=True)
    threading.Thread(target=maintain,daemon=True).start()
    http.server.ThreadingHTTPServer((os.environ.get('TWEEN_LAB_HOST','127.0.0.1'),int(os.environ.get('TWEEN_LAB_PORT','4182'))),Handler).serve_forever()
