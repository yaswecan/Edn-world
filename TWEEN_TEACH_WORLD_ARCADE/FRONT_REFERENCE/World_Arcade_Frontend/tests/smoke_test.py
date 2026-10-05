"""Browser smoke tests for the standalone front end.
Run: pip install playwright && playwright install chromium
     python tests/smoke_test.py [--chromium /path/to/chromium]
The tests inject HTML into about:blank, without network. An in-memory localStorage
adapter is used because opaque origins cannot access browser-native localStorage.
This tests application serialization, not the browser's native file:// persistence.
"""
from pathlib import Path
import argparse
import json
import sys
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
HTML=ROOT.parent/'WORLD_ARCADE_AUTONOME.html'
SHOTS=ROOT/'previews'
SHOTS.mkdir(exist_ok=True)
checks=[]
errors=[]

def check(name,condition):
    if not condition: raise AssertionError(name)
    checks.append(name)
    print('PASS',name,flush=True)

def load(page, html):
    # No outside requests are required by this build; typography has system fallbacks.
    page.route('**/*',lambda route:route.abort())
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.evaluate('''() => {const values={};window.__testValues=values;Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>values[k]??null,setItem:(k,v)=>values[k]=String(v),removeItem:k=>delete values[k],clear:()=>Object.keys(values).forEach(k=>delete values[k])}});}''')
    page.set_content(html,wait_until='domcontentloaded')
    page.wait_for_timeout(180)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--chromium',default=None);args=parser.parse_args()
    html=HTML.read_text(encoding='utf-8')
    with sync_playwright() as p:
        launch={'headless':True,'args':['--no-sandbox']}
        if args.chromium:launch['executable_path']=args.chromium
        browser=p.chromium.launch(**launch)
        page=browser.new_page(viewport={'width':1440,'height':1050})
        load(page,html)
        check('Entrée visible, salle masquée',page.locator('#splash').is_visible() and not page.locator('#app').is_visible())
        page.screenshot(path=str(SHOTS/'01_accueil_desktop.png'),full_page=True)
        page.locator('#start-button').click();page.wait_for_timeout(100)
        check('Commencer ouvre les deux jeux',page.locator('.cabinet').count()==2 and page.locator('#app').is_visible())
        check('Top 5 limité à cinq joueurs',page.locator('.leaderboard-list li').count()==5)
        check('18 joueurs dans les données',page.evaluate('ArcadeData.players.length')==18)
        check('Images intégrées chargées',page.evaluate("[...document.querySelectorAll('#main-content img')].every(i=>i.complete&&i.naturalWidth>0)"))
        week=page.locator('.leaderboard-list').inner_text()
        page.locator('[data-action="period"][data-value="month"]').click()
        check('Filtre de période modifie les scores',week!=page.locator('.leaderboard-list').inner_text())
        page.locator('[data-action="period"][data-value="week"]').click()
        page.screenshot(path=str(SHOTS/'02_arcade_desktop.png'),full_page=True)
        page.locator('.main-nav [data-route="joueurs"]').click();page.wait_for_timeout(120)
        check('Galerie complète',page.locator('.player-card').count()==18)
        page.locator('#player-search').fill('Nova')
        check('Recherche de joueur',page.locator('.player-card').count()==1)
        page.locator('.player-card').click()
        check('Fiche joueur fonctionnelle',page.locator('#modal').is_visible() and 'Nova' in page.locator('#modal').text_content())
        page.keyboard.press('Escape');check('Échap ferme la fiche',not page.locator('#modal').is_visible())
        page.locator('#player-search').fill('introuvable')
        check('Recherche vide explicite',page.locator('.empty-state').is_visible())
        page.locator('#player-search').fill('')
        page.locator('#roster-scope').select_option('class')
        check('Filtre de groupe',page.locator('.player-card').count()==12)
        page.locator('#roster-scope').select_option('all')
        page.screenshot(path=str(SHOTS/'03_joueurs_desktop.png'),full_page=True)
        page.locator('.main-nav [data-route="classement"]').click();page.wait_for_timeout(120)
        check('Classement étendu uniquement cinq joueurs',page.locator('.podium-card').count()+page.locator('.expanded-ranking li').count()==5)
        page.locator('#ranking-world').select_option('cyber-funk')
        check('Filtre de jeu conserve cinq places',page.locator('.podium-card').count()+page.locator('.expanded-ranking li').count()==5)
        page.locator('.main-nav [data-route="badges"]').click();page.wait_for_timeout(120)
        check('Neuf grades et 27 divisions',page.locator('.rank-card').count()==9 and page.locator('.rank-divisions span').count()==27)
        check('Explorer présent, Scout absent','Explorer' in page.locator('#main-content').text_content() and 'Scout' not in page.locator('#main-content').text_content())
        page.screenshot(path=str(SHOTS/'04_grades_desktop.png'),full_page=True)
        page.locator('.main-nav [data-route="profil"]').click();page.wait_for_timeout(120)
        page.locator('[data-action="auth"][data-tab="register"]').click()
        page.locator('#auth-nickname').fill('Neo')
        page.locator('#auth-email').fill('neo@example.test')
        page.locator('#auth-password').fill('demo-secret-not-stored-42')
        page.locator('[name="demo-consent"]').check()
        page.screenshot(path=str(SHOTS/'05_inscription_desktop.png'),full_page=True)
        page.locator('#auth-form [type="submit"]').click()
        check('Inscription ouvre un profil local',page.locator('.profile-hero h2').text_content()=='Neo')
        persisted=page.evaluate("localStorage.getItem('eden.world-arcade.front.v1')")
        check('Ni e-mail ni mot de passe persisté','neo@example.test' not in persisted and 'demo-secret-not-stored-42' not in persisted and 'password' not in persisted)
        page.locator('[data-action="edit-profile"]').click()
        page.locator('[data-action="choose-avatar"][data-id="3"]').click()
        page.locator('#profile-form [type="submit"]').click()
        check('Choix avatar conservé',page.evaluate('WorldArcade.getDemoState().profile.avatar')==3)
        page.locator('.main-nav [data-route="reglages"]').click();page.wait_for_timeout(120)
        page.locator('[data-action="preference"][data-id="reducedMotion"]').click()
        check('Réduction des animations',page.locator('body').evaluate("e=>e.classList.contains('reduce-motion')"))
        page.locator('[data-action="preference"][data-id="crt"]').click()
        check('Effet CRT désactivable',page.locator('body').evaluate("e=>e.classList.contains('no-crt')"))
        page.locator('.main-nav [data-route="arcade"]').click();page.wait_for_timeout(120)
        page.locator('[data-action="play"][data-id="code-station"]').click()
        check('Code Station ouvre le canvas',page.locator('#game-modal').is_visible() and page.locator('#game-canvas').is_visible())
        page.locator('[data-station-interact]').click()
        check('Interaction terminal',page.locator('[data-station-choice]').count()==3)
        page.locator('[data-station-choice="1"]').click()
        check('Erreur pédagogique utile',bool(page.locator('#terminal-feedback').inner_text()))
        page.locator('[data-station-choice="0"]').click()
        check('Bonne réponse répare un terminal','1 / 3' in page.locator('#mission-panel').inner_text())
        page.screenshot(path=str(SHOTS/'06_code_station_demo.png'),full_page=True)
        page.keyboard.press('p');check('Pause',page.locator('#game-pause').is_visible())
        page.locator('[data-action="resume-game"]').click();check('Reprise',not page.locator('#game-pause').is_visible())
        page.locator('[data-action="close-game"]').click()
        page.locator('[data-action="play"][data-id="cyber-funk"]').click()
        check('Cyber Funk ouvre un jeu distinct','NEON RUN' in page.locator('#mission-panel').inner_text())
        before=page.locator('#game-canvas').evaluate('e=>e.toDataURL()')
        page.keyboard.down('ArrowRight');page.wait_for_timeout(500);page.keyboard.up('ArrowRight')
        after=page.locator('#game-canvas').evaluate('e=>e.toDataURL()')
        check('Canvas animé et déplacement actif',before!=after)
        page.screenshot(path=str(SHOTS/'07_cyber_funk_demo.png'),full_page=True)
        page.keyboard.press('Escape');check('Échap quitte le jeu',not page.locator('#game-modal').is_visible())
        page.locator('[data-action="home"]').click();check('Retour accueil',page.locator('#splash').is_visible())
        page.keyboard.press('Enter');page.wait_for_timeout(120);check('Entrée clavier ouvre la salle',page.locator('#app').is_visible())
        check('Aucune erreur JavaScript',not errors)
        check('Pas de débordement desktop',page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        mobile=browser.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
        load(mobile,html)
        mobile.screenshot(path=str(SHOTS/'08_accueil_mobile.png'),full_page=True)
        mobile.locator('#start-button').click();mobile.wait_for_timeout(80)
        check('Pas de débordement mobile',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        check('Deux bornes visibles sur mobile',mobile.locator('.cabinet').count()==2)
        mobile.screenshot(path=str(SHOTS/'09_arcade_mobile.png'),full_page=True)
        for route in ['joueurs','classement','profil','badges']:
            mobile.locator(f'.main-nav [data-route="{route}"]').click();mobile.wait_for_timeout(120)
            check('Mobile sans débordement : '+route,mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
        mobile.locator('.main-nav [data-route="arcade"]').click();mobile.wait_for_timeout(120)
        mobile.locator('[data-action="play"][data-id="cyber-funk"]').click()
        check('Commandes tactiles présentes',mobile.locator('.touch-controls').is_visible())
        mobile.screenshot(path=str(SHOTS/'10_jeu_mobile.png'),full_page=True)
        check('Aucune erreur JavaScript après parcours mobile',not errors)
        browser.close()
    report={'checks_passed':len(checks),'checks':checks,'js_errors':errors,'render_engine':'Chromium','viewports':['1440×1050','390×844'],'method':'Standalone HTML injected into about:blank; external requests blocked; localStorage replaced by in-memory adapter for serialization tests. Native file-origin persistence, actual network auth, server APIs and real-device Safari are not tested.'}
    (ROOT/'tests/results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'\n{len(checks)} checks passed. Screenshots: {SHOTS}')

if __name__=='__main__':main()
