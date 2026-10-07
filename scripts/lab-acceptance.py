"""Real Docker shell/Git checks in disposable, resource-limited lab containers."""
import hashlib, json, os, pathlib, runpy, time, select

config = json.loads(pathlib.Path('.data/quality-v2/lab.json').read_text())
os.environ.update(TWEEN_LAB_TOKEN=config['EDEN_LAB_TOKEN'], TWEEN_LAB_IMAGE=config['EDEN_LAB_SHELL_IMAGE'], TWEEN_LAB_STATE=str(pathlib.Path('.data/quality-v2/lab-check-state').resolve()))
lab = runpy.run_path('labs/broker.py')
lab['STATE'].mkdir(parents=True, exist_ok=True)
report = {'runtime': config['EDEN_LAB_SHELL_IMAGE'], 'checks': [], 'simulation': False}
sessions = []
def check(name, action):
    started = time.monotonic()
    try:
        action()
        report['checks'].append({'id':name,'status':'PASS','durationMs':round((time.monotonic()-started)*1000)})
    except Exception as error:
        report['checks'].append({'id':name,'status':'FAIL','error':str(error)})
def assert_true(value):
    if not value: raise AssertionError('Expected condition was not observed')
def new_session(index):
    identity=hashlib.sha256(('quality-v2-acceptance-'+str(index)).encode()).hexdigest()
    session=lab['provision'](identity,[{'path':'brouillon/notes.txt','content':'trace\n'}]);sessions.append(session);return session
def command(session,code):
    return lab['docker']('exec','-i',session['container'],'bash','--noprofile','--norc',data=code.encode(),timeout=5)
def file_test(path,content):
    return {'invoke':'file','argsJSON':json.dumps({'path':path,'content':content}),'expectedJSON':'true'}
try:
    first,second=new_session(0),new_session(1)
    checks=[file_test('projet/notes.txt','trace\n'),{'invoke':'absent','argsJSON':json.dumps({'path':'brouillon/notes.txt'}),'expectedJSON':'true'}]
    check('wrong-state-rejected',lambda:assert_true(not lab['evaluate'](first,checks)['ok']))
    command(first,'mkdir projet; cp brouillon/notes.txt projet/notes.txt; rm brouillon/notes.txt\n')
    check('alternative-correct-method',lambda:assert_true(lab['evaluate'](first,checks)['ok']))
    check('two-students-isolated',lambda:assert_true(not lab['evaluate'](second,checks)['ok']))
    command(first,'git init -q; git add projet/notes.txt; git -c user.name=Test -c user.email=test@example.invalid commit -qm trace\n')
    check('real-git-commit',lambda:assert_true(lab['evaluate'](first,[{'invoke':'git-committed','argsJSON':json.dumps({'path':'projet/notes.txt'}),'expectedJSON':'true'}])['ok']))
    check('private-network-and-no-host-mounts',lambda:assert_true(command(first,'test ! -S /var/run/docker.sock && test ! -e /app && test "$(id -u)" = 1000 && echo isolated\n').strip()==b'isolated'))
    before=lab['snapshot'](first);lab['persist'](first);lab['retire'](first);sessions.remove(first)
    restored=lab['provision'](first['id'],[]);sessions.append(restored)
    check('restart-restores-files-and-git',lambda:assert_true(lab['snapshot'](restored)['hash']==before['hash']))
    def interrupt():
        os.write(second['master'],b'while true; do :; done\n');time.sleep(.3);os.write(second['master'],b'\x03');time.sleep(.2);os.write(second['master'],b'echo INTERRUPTED_OK\n');time.sleep(.4)
        output=b''
        while select.select([second['master']],[],[],.1)[0]: output+=os.read(second['master'],65536)
        assert_true(b'INTERRUPTED_OK' in output)
    check('pty-interrupt-and-reuse',interrupt)
    def bounded():
        info=json.loads(lab['docker']('inspect',second['container']))[0]['HostConfig']
        assert_true(info['NetworkMode']=='none' and info['ReadonlyRootfs'] and info['PidsLimit']==64 and info['Memory']==192*1024*1024 and not info['Privileged'] and info['CapDrop']==['ALL'])
    check('runtime-resource-and-privilege-limits',bounded)
    def capacity():
        for i in range(2,18):new_session(i)
        assert_true(len(lab['SESSIONS'])==18)
        for s in sessions:assert_true(command(s,'printf active').decode()=='active')
        try:new_session(19)
        except RuntimeError:return
        raise AssertionError('Admission exceeded 18 labs')
    check('18-active-shells-and-admission-limit',capacity)
finally:
    for session in sessions:
        try:lab['retire'](session,save=False)
        except Exception:pass
    path=pathlib.Path('docs/quality/evidence-v2/labs.json');path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps(report))
if any(c['status']=='FAIL' for c in report['checks']):raise SystemExit(1)
