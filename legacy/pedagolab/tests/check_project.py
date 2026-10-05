from pathlib import Path
import json, py_compile, subprocess

ROOT=Path(__file__).resolve().parents[1]
py_compile.compile(str(ROOT/'server.py'), doraise=True)
res=json.loads((ROOT/'public/data/resources.json').read_text(encoding='utf-8'))
cur=json.loads((ROOT/'public/data/curriculum-a1.json').read_text(encoding='utf-8'))
assert len(res['units']) == 140
assert len(res['blocks']) == 16
assert len({u['code'] for u in res['units']}) == 140
assert cur['meta']['n2Count'] == 48
assert cur['meta']['n3Count'] == 106
assert cur['meta']['evaluationCount'] == 63
assert cur['meta']['sessionCount'] == 142
assert len(cur['criteria']) == 106
assert len(cur['evaluations']) == 63
assert any(c['code']=='BC05-C1-3' for c in cur['criteria'])
assert any(e['type']=='Évaluation officielle' for e in cur['evaluations'])
for f in ['public/index.html','public/app.css','public/app.js','requirements.txt','vercel.json','db/schema.sql','curriculum/source/Planification_A1_2026-2027.xlsx']:
    assert (ROOT/f).exists(), f
subprocess.run(['node','--check',str(ROOT/'public/app.js')],check=True)
print('PASS: server syntax, JS syntax, 16 blocks, 140 resources, 48 N2, 106 N3, 63 evaluations, 142 sessions')
