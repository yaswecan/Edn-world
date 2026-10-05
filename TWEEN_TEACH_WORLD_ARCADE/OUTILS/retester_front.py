#!/usr/bin/env python3
"""Relance les tests du prototype sur une copie temporaire, sans retoucher la référence.
N'exécute pas de tests du backend Tween Teach. Nécessite Playwright et un Chromium installé.
"""
from pathlib import Path
import argparse
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--chromium', help='Chemin optionnel vers Chromium déjà installé')
    parser.add_argument('--output',type=Path,default=ROOT/'SUIVI/RETEST_FRONT_REFERENCE')
    args=parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='world-arcade-retest-') as tmp:
        temp=Path(tmp)
        front=temp/'World_Arcade_Frontend'
        shutil.copytree(ROOT/'FRONT_REFERENCE/World_Arcade_Frontend',front)
        shutil.copy2(ROOT/'FRONT_REFERENCE/WORLD_ARCADE_AUTONOME.html',temp/'WORLD_ARCADE_AUTONOME.html')
        command=[sys.executable,str(front/'tests/smoke_test.py')]
        if args.chromium: command += ['--chromium',args.chromium]
        try:
            result=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=90)
        except (OSError,subprocess.TimeoutExpired) as exc:
            print(f'Retest non abouti : {exc}',file=sys.stderr)
            return 1
        args.output.mkdir(parents=True,exist_ok=True)
        (args.output/'execution.log').write_text(result.stdout,encoding='utf-8')
        print(result.stdout)
        if result.returncode==0:
            shutil.copy2(front/'tests/results.json',args.output/'results.json')
            shutil.copytree(front/'previews',args.output/'previews',dirs_exist_ok=True)
        print('Rapport de référence uniquement :',args.output)
        return result.returncode
if __name__=='__main__':
    raise SystemExit(main())
