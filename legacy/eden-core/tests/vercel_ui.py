"""Browser + HTTP API using tests/mock-server.mjs only; NOT a live Neon test.
Run: node tests/mock-server.mjs, then npm run test:e2e:api.
No production credentials are included. Do not run against a real class server.
"""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from e2e import exercise
from simulator_e2e import run_bonus
OUT=Path(os.getenv('EDEN_TEST_OUTPUT','test-results/vercel-ui'))

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    base=os.getenv('EDEN_TEST_URL','http://127.0.0.1:4173/').rstrip('/')
    if not (base.startswith('http://127.0.0.1:') or base.startswith('http://localhost:')):
        raise RuntimeError('Ce test utilise un double mémoire local, pas un site réel.')
    with sync_playwright() as p:
        launch={'headless':True}
        if os.getenv('EDEN_CHROMIUM'):launch['executable_path']=os.environ['EDEN_CHROMIUM']
        browser=p.chromium.launch(**launch)
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(base,wait_until='domcontentloaded')
        visited=exercise(page,False)
        page.locator('[data-action="open-simulator"]').click()
        page.locator('[data-sim="sync"]').click()
        page.locator('#sync-class-code').fill('test-classe-12345')
        page.locator('[data-action="connect-sync"]').click()
        expect(page.locator('#modal')).to_contain_text('Connecté comme',timeout=20000)
        page.locator('[data-action="close-modal"]').click()
        cases=run_bonus(page)
        page.locator('[data-sim="sync"]').click()
        page.locator('[data-action="retry-sync"]').click()
        expect(page.locator('#sync-dialog-state')).to_contain_text('Reçu',timeout=20000)
        page.locator('[data-action="close-modal"]').click()
        teacher=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        prof=teacher.new_page();prof.on('pageerror',lambda e:errors.append(str(e)))
        prof.goto(base+'/prof.html',wait_until='domcontentloaded')
        prof.locator('#live-password').fill('test-professeur-vercel-12345')
        prof.locator('[data-live="login"]').click()
        expect(prof.locator('.live-table')).to_contain_text('Alex test',timeout=20000)
        expect(prof.locator('.live-table')).to_contain_text('4/4')
        expect(prof.locator('.live-table')).to_contain_text('36 / 36')
        prof.locator('[data-live="detail"]').first.click()
        expect(prof.locator('#live-detail')).to_contain_text('chargeur absent')
        prof.locator('#live-validation').select_option('valide')
        prof.locator('#live-note').fill('Bonne démarche : indice, réparation et vérification.')
        prof.locator('[data-live="validate"]').click()
        expect(prof.locator('#live-message')).to_contain_text('Validation enregistrée',timeout=10000)
        prof.screenshot(path=str(OUT/'prof-suivi-recu.png'),full_page=True)
        with prof.expect_download() as dl:prof.locator('[data-live="export"]').click()
        dl.value.save_as(OUT/'suivi-test.json')
        report=json.loads((OUT/'suivi-test.json').read_text())
        assert report['learner']['validation']=='valide'
        assert len(report['learner']['summary']['solved'])==4
        assert 'token' not in json.dumps(report).lower()
        prof.reload(wait_until='domcontentloaded')
        expect(prof.locator('.live-table')).to_contain_text('Alex test',timeout=10000)
        prof.locator('[data-live="detail"]').first.click()
        expect(prof.locator('#live-validation')).to_have_value('valide')
        prof.on('dialog',lambda d:d.accept())
        prof.locator('[data-live="delete"]').click()
        expect(prof.locator('.live-table')).to_contain_text('Aucun élève connecté',timeout=10000)
        prof.locator('[data-live="logout"]').click()
        expect(prof.locator('#live-password')).to_be_visible()
        assert not errors,errors
        (OUT/'resultats-ui-api.json').write_text(json.dumps({'mode':'Navigateur Chromium + API HTTP + double mémoire (pas Neon)',
            'cours':len(visited)+1,'pannes':cases,'sync_ack':True,'prof_login':True,'teacher_validation':True,
            'export':True,'native_reload':True,'delete':True,'logout':True,'errors':errors},ensure_ascii=False,indent=2))
        browser.close()
    print('UI élève, cours complet, 4 pannes, synchronisation API, validation prof, export et suppression : OK (double local).')

if __name__=='__main__':main()
