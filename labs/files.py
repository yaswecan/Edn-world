"""Runs inside the read-only lab image. No evaluation rules or secrets live here."""
import base64, json, os, pathlib, stat, subprocess, sys
root = pathlib.Path('/workspace')
request = json.load(sys.stdin)
def safe_path(value):
    p = pathlib.PurePosixPath(value)
    if p.is_absolute() or '..' in p.parts or not p.parts: raise ValueError('Invalid relative path')
    target = root.joinpath(p)
    current = root
    for part in p.parts:
        current = current / part
        if current.is_symlink(): raise ValueError('Symbolic links cannot be edited or restored')
    return target
if request['action'] == 'write':
    target = safe_path(request['path'])
    content = base64.b64decode(request['base64'],validate=True) if 'base64' in request else request['content'].encode()
    if len(content) > 65536: raise ValueError('File too large')
    target.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as output: output.write(content)
    print(json.dumps({'saved': True}))
else:
    files, total = [], 0
    for directory, dirs, names in os.walk(root, followlinks=False):
        dirs[:] = [d for d in dirs if not pathlib.Path(directory, d).is_symlink()]
        for name in names:
            path = pathlib.Path(directory, name)
            if path.is_symlink() or not stat.S_ISREG(path.stat().st_mode): continue
            if path.stat().st_size > 65536: raise ValueError('Snapshot file exceeds 64 KiB')
            with open(path, 'rb') as source: data = source.read(65537)
            import base64
            total += len(data)
            if total > 512000 or len(files) >= 1000: raise ValueError('Snapshot exceeds quota')
            files.append({'path': str(path.relative_to(root)), 'base64': base64.b64encode(data).decode()})
    tracked, committed = [], []
    if (root / '.git').is_dir() and not (root / '.git').is_symlink():
        result = subprocess.run(['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'ls-files', '-z'], cwd=root, capture_output=True, timeout=3)
        if result.returncode == 0: tracked = result.stdout.decode(errors='replace').split('\0')
        result = subprocess.run(['/usr/bin/git', '--no-optional-locks', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'ls-tree', '-r', '--name-only', '-z', 'HEAD'], cwd=root, capture_output=True, timeout=3)
        if result.returncode == 0: committed = result.stdout.decode(errors='replace').split('\0')
    print(json.dumps({'files': files, 'tracked': tracked, 'committed': committed}))
