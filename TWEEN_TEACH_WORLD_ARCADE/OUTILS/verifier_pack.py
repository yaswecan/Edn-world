#!/usr/bin/env python3
"""Contrôle local du pack. Aucun réseau, aucune mutation du dépôt hôte.

Usage: python3 OUTILS/verifier_pack.py [--report /chemin/hors/inventaire/resultat.json]
Les vérifications de base utilisent la bibliothèque standard. Le schéma complet est aussi
validé si jsonschema est installé ; son absence est rapportée, jamais présentée comme un succès.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
checks: list[dict] = []

def check(label: str, condition: bool, detail: str = '') -> None:
    checks.append({'check': label, 'status': 'passed' if condition else 'failed', 'detail': detail})

def within(relative: str) -> Path:
    path = (ROOT / relative).resolve()
    if not path.is_relative_to(ROOT):
        raise ValueError('Path outside package: ' + relative)
    return path

def load(relative: str):
    return json.loads(within(relative).read_text(encoding='utf-8'))

def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    try:
        for name in [
            '00_LIRE_DABORD.md', 'DEMARRER_DANS_CODEX.txt', '01_PROMPT_CODEX_INTEGRATION.md',
            '02_SPECIFICATION_COMPLETE.md', '03_PLAN_IMPLEMENTATION_ET_RECETTE.md',
            '04_AUDIT_FRONT_FOURNI.md', '05_SOURCES_ET_PROVENANCE.md', '06_PROMPT_CODEX_REVIEW.md',
            'AGENTS.md', 'CONTRATS/arcade-host-contract.ts', 'CONTRATS/launcher-bridge.mjs',
            'FRONT_REFERENCE/WORLD_ARCADE_AUTONOME.html']:
            check('required:' + name, within(name).is_file())
        manifest = load('CORPUS/manifest.json')
        for key in ['entryPrompt','specification','recipe','sourceAudit','reviewPrompt','corpus',
                    'corpusSchema','assetManifest','referenceSourceManifest','referenceEntry','standalonePreview']:
            check('manifest-link:' + key, within(manifest[key]).is_file())
        for relative in manifest['contracts']:
            check('contract-link:' + relative, within(relative).is_file())
        corpus = load(manifest['corpus'])
        check('corpus is explicitly not runtime config', corpus['meta']['notRuntimeConfiguration'] is True)
        check('host inspection not claimed', corpus['meta']['hostRepositoryInspected'] is False)
        check('two exact game ids', [g['id'] for g in corpus['games']] == ['code-station','cyber-funk'])
        check('routes not guessed', all(g['runtimeBinding']['route'] is None and
                                       g['runtimeBinding']['hostGameId'] is None for g in corpus['games']))
        check('production demo fallback prohibited', all(g['runtimeBinding']['demoFallbackInProduction'] is False
                                                       for g in corpus['games']))
        rr = corpus['rankReference']
        check('reference grade proposal labeled', rr['status'] == 'visual_proposal_not_validated_business_rules')
        check('nine distinct reference grades', len(rr['ranks']) == 9 and len({r['id'] for r in rr['ranks']}) == 9)
        check('Rookie and Explorer present', {'rookie','explorer'}.issubset({r['id'] for r in rr['ranks']}))
        check('no invented thresholds', all(r['xpThreshold'] is None for r in rr['ranks']))
        check('no automatic grade promotion', rr['automaticPromotionEnabled'] is False)
        check('leaderboard limited to five', corpus['policies']['leaderboard']['maxRows'] == 5)
        check('public school directory prohibited', corpus['policies']['privacy']['publicSchoolDirectory'] is False)
        check('public opening not automatic', corpus['policies']['activation']['newPublicRegistrationDefault'] is False)
        check('demo not production mode', corpus['policies']['activation']['productionDemoModeAllowed'] is False)
        screenids = [s['id'] for s in corpus['screenFlow']['screens']]
        check('ten unique screens', len(screenids) == 10 and len(set(screenids)) == 10)
        def key_exists(d, dotted):
            try:
                for k in dotted.split('.'): d = d[k]
                return isinstance(d,str) and bool(d)
            except (KeyError,TypeError): return False
        check('all screen actions resolve to UI labels', all(key_exists(corpus['ui'],s['mainAction'])
                                                           for s in corpus['screenFlow']['screens']))
        assets = load('CORPUS/assets.manifest.json')['assets']
        assetids = {a['id'] for a in assets}
        check('eighteen distinct WebP assets', len(assets) == 18 and len(assetids) == 18)
        check('fifteen illustrated avatars', sum(a['usage']=='illustrated_avatar' for a in assets) == 15)
        check('game asset references resolve', all(g['imageAssetId'] in assetids for g in corpus['games']))
        for a in assets:
            p = within(a['path'])
            check('asset:' + a['id'], p.is_file() and p.stat().st_size == a['bytes'] and digest(p) == a['sha256'])
        original = load('CORPUS/reference-source.manifest.json')
        for entry in original['files']:
            p = within(entry['path'])
            check('original-copy:' + entry['path'], p.is_file() and p.stat().st_size == entry['bytes'] and
                  digest(p) == entry['sha256'])
        binaries = [p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*')
                    if p.is_file() and p.suffix.lower() in {'.ttf','.otf','.woff','.woff2','.eot'}]
        check('no font binaries', not binaries, ', '.join(binaries))
        check('no node_modules or .git bundled', not any(p.name in {'node_modules','.git'} for p in ROOT.rglob('*')))
        try:
            import jsonschema
        except ImportError:
            checks.append({'check':'complete JSON Schema validation','status':'not_run',
                           'detail':'jsonschema unavailable; standard-library integrity checks executed.'})
        else:
            schema = load(manifest['corpusSchema'])
            jsonschema.Draft202012Validator.check_schema(schema)
            errors = sorted(jsonschema.Draft202012Validator(schema).iter_errors(corpus), key=lambda e:str(e.path))
            check('complete JSON Schema validation', not errors, '; '.join(e.message for e in errors))
        delivery_manifest = ROOT / 'MANIFEST_FICHIERS.json'
        if delivery_manifest.exists():
            inventory = json.loads(delivery_manifest.read_text(encoding='utf-8'))
            bad=[]
            for entry in inventory['files']:
                p=within(entry['path'])
                if not p.is_file() or digest(p)!=entry['sha256']: bad.append(entry['path'])
            check('delivery inventory hashes', not bad, '; '.join(bad))
        else:
            checks.append({'check':'delivery inventory hashes','status':'not_run','detail':'Final inventory not generated yet.'})
    except Exception as error:
        checks.append({'check':'validation execution','status':'failed','detail':str(error)})
    report={'scope':'pack_integrity_and_corpus_only_not_host_integration',
            'passed':sum(x['status']=='passed' for x in checks),
            'failed':sum(x['status']=='failed' for x in checks),
            'not_run':sum(x['status']=='not_run' for x in checks),'checks':checks}
    for c in checks:
        print(c['status'].upper()+': '+c['check']+(' — '+c['detail'] if c['detail'] else ''))
    print(f"\n{report['passed']} passed; {report['failed']} failed; {report['not_run']} not run.")
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return 1 if report['failed'] else 0

if __name__ == '__main__':
    sys.exit(main())
