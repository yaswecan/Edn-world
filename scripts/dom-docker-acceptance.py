"""Synthetic DOM acceptance through the actual Docker broker, without its HTTP server."""
import importlib.util, json, os, pathlib, subprocess, time

root = pathlib.Path(__file__).resolve().parents[1]
image = subprocess.check_output(['docker', 'image', 'inspect', 'tweenteach-dom:quality-v2', '--format', '{{.Id}}'], text=True).strip()
os.environ['TWEEN_DOM_IMAGE'] = image
spec = importlib.util.spec_from_file_location('broker', root / 'labs/broker.py')
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)
report = {'image': image, 'topology': 'Actual broker render_dom; Docker Desktop; synthetic code only', 'status': 'FAIL', 'checks': []}
original_docker = broker.docker

def capture_docker(*args, data=None, timeout=20, discard=False):
    # Retain bounded launch diagnostics for this synthetic test only. Never weaken sandbox flags.
    if args[0] != 'run':
        return original_docker(*args, data=data, timeout=timeout, discard=discard)
    report['launchArguments'] = list(args)
    result = subprocess.run(['docker', *args], input=data, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(result.stderr.decode(errors='replace')[-4000:])
    return result.stdout

broker.docker = capture_docker
files = [
    {'path': 'index.html', 'content': '<!doctype html><html lang="fr"><meta charset="utf-8"><button>Compter</button><output>0</output><script src="/main.js"></script></html>'},
    {'path': 'main.js', 'content': 'let n=0;document.querySelector("button").onclick=()=>{document.querySelector("output").textContent=++n;console.log(n)}'},
    {'path': 'style.css', 'content': 'body{font:20px sans-serif}'},
]
tests = [{'invoke': 'dom-behavior', 'argsJSON': json.dumps({'label': 'Deux clics', 'steps': [{'action': 'click', 'selector': 'button'}, {'action': 'click', 'selector': 'button'}, {'action': 'text', 'selector': 'output', 'value': '2'}]}), 'expectedJSON': 'true'}]

def run(code=None, checks=tests):
    current = [dict(f) for f in files]
    if code is not None:
        current[1]['content'] = code
    return broker.render_dom({'files': current, **({'tests': checks} if checks else {})})

def passed(name):
    report['checks'].append({'id': name, 'status': 'PASS'})

try:
    result = run()
    assert result['ok'] and '2' in '\n'.join(result['logs'])
    report['runtime'] = result['runtime']
    passed('sandboxed-browser-clicks-and-console')
    assert not run('document.querySelector("button").onclick=()=>document.querySelector("output").textContent=1')['ok']
    passed('plausible-error-rejected')
    assert run('document.querySelector("button").onclick=()=>{const o=document.querySelector("output");o.textContent=Number(o.textContent)+1}')['ok']
    passed('alternative-accepted')
    result = run('fetch("https://example.com/").catch(()=>console.log("network-blocked"))', [])
    assert 'network-blocked' in '\n'.join(result['logs'])
    passed('external-network-denied')
    started = time.monotonic()
    try:
        run('while(true){}', [])
        raise AssertionError('Unbounded loop returned as a valid render')
    except (RuntimeError, subprocess.TimeoutExpired):
        assert time.monotonic() - started < 26
    name = report['launchArguments'][report['launchArguments'].index('--name') + 1]
    assert subprocess.run(['docker', 'inspect', name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0
    passed('infinite-loop-terminated-and-container-removed')
    report['status'] = 'PASS'
except Exception as error:
    report['error'] = str(error)
finally:
    destination = root / 'docs/quality/evidence-v2/dom/docker.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'launchArguments'}, ensure_ascii=False))
raise SystemExit(0 if report['status'] == 'PASS' else 1)
