"""Parcours HTTP réel : cours initial, bonus, rechargement natif et export.
Prérequis : npm start (API Neon configurée, ou double local de test), Playwright et un navigateur autorisé.
EDEN_TEST_URL peut viser une URL locale/publiée et EDEN_CHROMIUM un binaire.
Ne désactive aucune politique de sécurité. Voir enseignant/CONTROLES.md.
"""
import json, os, re
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from e2e import exercise

OUT = Path(os.getenv('EDEN_TEST_OUTPUT', 'test-results/simulator-http'))

def run_bonus(page):
    def action(name, extra=''):
        page.locator(f'[data-sim="{name}"]{extra}').first.click()
    def state():
        return page.evaluate('''() => {
          const key=Object.keys(localStorage).find(k=>k.startsWith('eden:bios-os-mardi-v1:'));
          return key ? JSON.parse(localStorage.getItem(key)).simulator : null;
        }''')
    expect(page.locator('[data-sim="power"]')).to_be_disabled()
    page.locator('[data-sim="select-part"][data-part="board"]').drag_to(page.locator('[data-slot="plateau"]'))
    for part in ['cpu','ram','ssd','psu','gpu','screen','keyboard','mouse']:
        action('select-part',f'[data-part="{part}"]');action('slot',f'[data-part="{part}"]')
    for cable in ['atx','eps','sata-power','sata-data','video','keyboard-usb','mouse-usb']:
        action('select-cable',f'[data-cable="{cable}"]')
        ports=page.locator('[data-sim="port"]');ports.nth(0).click();ports.nth(1).click()
    page.locator('[data-sim-input="fast"]').check()
    action('power');expect(page.locator('[data-sim="login"]')).to_be_visible(timeout=7000);action('login')
    assert state()['baseline']
    # Reprise réelle du stockage du Hub, pas une injection d’état.
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('[data-sim="next-case"]')).to_be_visible()
    assert state()['baseline']
    page.locator('[data-sim-input="fast"]').check()
    for _ in range(4):
        action('next-case');action('power')
        expect(page.locator('[data-sim="diagnose"]').first).to_be_visible(timeout=7000)
        s=state();case=s['caseOrder'][s['caseIndex']]
        layer={'ram-missing':'post','ssd-missing':'boot','loader-missing':'loader','os-missing':'os'}[case]
        action('diagnose',f'[data-layer="{layer}"]')
        if case in ['ram-missing','ssd-missing']:
            action('off');part=case.split('-')[0]
            action('select-part',f'[data-part="{part}"]');action('slot',f'[data-part="{part}"]')
        else:
            action('repair-loader' if case=='loader-missing' else 'repair-os')
        action('power');expect(page.locator('[data-sim="login"]')).to_be_visible(timeout=7000);action('login')
    page.locator('#sim-transfer').select_option('not-bootable')
    page.locator('#sim-explanation').fill('J’ai observé le chargeur absent, restauré le chargeur et vérifié le retour à la session.')
    action('finish');expect(page.locator('.sim-success')).to_contain_text('bouclé la chaîne')
    assert state()['phase']=='complete'
    with page.expect_download() as dl:
        action('report')
    dl.value.save_as(OUT/'bilan-bonus.html')
    assert 'Bonus facultatif' in (OUT/'bilan-bonus.html').read_text()
    page.reload(wait_until='domcontentloaded')
    expect(page.locator('.sim-success')).to_contain_text('bouclé la chaîne')
    page.screenshot(path=str(OUT/'bonus-termine-http.png'),full_page=True)
    return state()['solved']

def main():
    OUT.mkdir(parents=True,exist_ok=True)
    with sync_playwright() as p:
        launch={'headless':True}
        if os.getenv('EDEN_CHROMIUM'): launch['executable_path']=os.environ['EDEN_CHROMIUM']
        browser=p.chromium.launch(**launch)
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        page=context.new_page();errors=[]
        page.on('pageerror',lambda err:errors.append(str(err)))
        base=os.getenv('EDEN_TEST_URL','http://127.0.0.1:4173/')
        try:
            page.goto(base,wait_until='domcontentloaded')
            page.locator('#alias').wait_for()
            # Accès direct au bonus refusé avant le cours.
            page.goto(base.rstrip('/')+'/#bonus-pc',wait_until='domcontentloaded')
            expect(page.locator('[data-sim="power"]')).to_have_count(0)
            visited=exercise(page,capture=False)
            page.locator('[data-action="open-simulator"]').click()
            expect(page).to_have_url(re.compile('#bonus-pc$'))
            cases=run_bonus(page)
            assert not errors,errors
            (OUT/'resultats.json').write_text(json.dumps({'transport':'HTTP réel','cours':visited,'cases':cases,'native_reload':True,'download':True,'errors':errors},ensure_ascii=False,indent=2))
        finally:
            browser.close()
    print('Cours, bonus, reprise et export HTTP réussis.')

if __name__=='__main__': main()
