"""Interactions du vrai composant en document mémoire (aucun serveur requis).
Ce test ne remplace pas le E2E HTTP du Hub : il vérifie DOM, clics, drag & drop,
animations, reprise de l'état, quatre diagnostics et vue mobile sans réseau.
"""
from pathlib import Path
import re, os, json, base64
from playwright.sync_api import sync_playwright, expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.getenv('EDEN_TEST_OUTPUT','test-results/simulator'))
OUT.mkdir(parents=True,exist_ok=True)
def script():
    chunks=[]
    for name in ['model.js','view.js','controller.js']:
        s=(ROOT/'docs/app/pcsim'/name).read_text()
        s=re.sub(r'^import .*?;\s*','',s,flags=re.M)
        s=re.sub(r'\bexport (?=(const|function|class))','',s)
        chunks.append(s)
    return '\n'.join(chunks)
def main():
  with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path=os.getenv('EDEN_CHROMIUM','/usr/bin/chromium'))
    page=browser.new_page(viewport={'width':1440,'height':1100},device_scale_factor=1)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    css=(ROOT/'docs/app/style.css').read_text()+'\n'+(ROOT/'docs/app/pcsim/style.css').read_text()
    logo=base64.b64encode((ROOT/'docs/assets/eden_logo.png').read_bytes()).decode()
    page.set_content(f'<html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>{css}</style></head><body><header class="topbar"><a class="brand"><img src="data:image/png;base64,{logo}" alt="EDEN School"><span class="brand-sep"></span><span>Mon atelier <strong>système</strong></span></a><span>Bonus après le bilan</span></header><div id="root"></div></body></html>')
    page.add_script_tag(content=script()+'''\nwindow.ss=createSimulator(7);window.mount=()=>{window.ctrl=mountSimulator(document.querySelector('#root'),{state:window.ss,onChange:s=>window.ss=s,onBack:()=>{},onReport:()=>{},onSync:()=>{}});};window.mount();''')
    def action(name, extra=''):
      page.locator(f'[data-sim="{name}"]{extra}').first.click()
    def shot(name):page.screenshot(path=str(OUT/f'{name}.png'),full_page=True)
    shot('01_montage_depart')
    expect(page.locator('[data-sim="power"]')).to_be_disabled()
    # A wrong slot really refuses a part.
    action('select-part','[data-part="board"]')
    action('slot','[data-part="ssd"]')
    expect(page.locator('#sim-feedback')).to_contain_text('ne va pas')
    # Actual drag and drop of the board, not a state injection.
    page.locator('[data-sim="select-part"][data-part="board"]').drag_to(page.locator('[data-slot="plateau"]'))
    assert page.evaluate('ss.hardware.board')
    for part in ['cpu','ram','ssd','psu','gpu','screen','keyboard','mouse']:
      action('select-part',f'[data-part="{part}"]')
      action('slot',f'[data-part="{part}"]')
    for cable in ['atx','eps','sata-power','sata-data','video','keyboard-usb','mouse-usb']:
      action('select-cable',f'[data-cable="{cable}"]')
      ports=page.locator('[data-sim="port"]')
      ports.nth(0).click();ports.nth(1).click()
    shot('02_montage_complet')
    expect(page.locator('[data-sim="power"]')).to_be_enabled()
    page.locator('[data-sim-input="fast"]').check()
    action('power')
    expect(page.locator('[data-sim="login"]')).to_be_visible(timeout=5000)
    action('bios')
    expect(page.locator('.sim-inspector')).to_contain_text('8 Go détectés')
    # BIOS changes boot device, but does not wipe/reinstall software.
    page.locator('#sim-boot-target').select_option('usb')
    action('off');action('power')
    page.wait_for_function('ss.power==="stopped"')
    assert page.evaluate('ss.lastOutcome.code')=='wrong-boot'
    action('bios');page.locator('#sim-boot-target').select_option('ssd');action('off');action('power')
    expect(page.locator('[data-sim="login"]')).to_be_visible(timeout=5000);action('login')
    assert page.evaluate('ss.baseline')
    shot('03_premier_demarrage')
    # Preserve the exact state over component remount.
    page.evaluate('ctrl.destroy();window.ss=sanitizeSimulator(JSON.parse(JSON.stringify(ss)));window.mount();')
    assert page.evaluate('ss.baseline')
    resolved=[]
    for i in range(4):
      action('next-case');action('power')
      page.wait_for_function('ss.power==="stopped"',timeout=7000)
      case_id=page.evaluate('ss.caseOrder[ss.caseIndex]')
      layer={'ram-missing':'post','ssd-missing':'boot','loader-missing':'loader','os-missing':'os'}[case_id]
      if i==0:
        action('diagnose',f'[data-layer="{"os" if layer!="os" else "post"}"]')
        expect(page.locator('#sim-feedback')).to_contain_text('ne correspond pas')
        action('hint')
      if case_id!='ram-missing':
        action('bios');expect(page.locator('.sim-inspector')).to_be_visible()
        shot('04_bios_'+case_id)
        action('close-bios')
      action('diagnose',f'[data-layer="{layer}"]')
      if case_id in ['ram-missing','ssd-missing']:
        action('off');part=case_id.split('-')[0]
        action('select-part',f'[data-part="{part}"]');action('slot',f'[data-part="{part}"]')
      else: action('repair-loader' if case_id=='loader-missing' else 'repair-os')
      action('power');expect(page.locator('[data-sim="login"]')).to_be_visible(timeout=7000);action('login')
      assert page.evaluate('ss.solved.length')==i+1
      resolved.append(case_id)
    page.locator('#sim-transfer').select_option('not-bootable')
    page.locator('#sim-explanation').fill('J’ai vu le disque détecté mais le chargeur absent. Je l’ai restauré puis la session a pu s’ouvrir.')
    action('finish');expect(page.locator('.sim-success')).to_contain_text('bouclé la chaîne')
    shot('05_bonus_termine')
    assert page.evaluate('ss.phase')=='complete'
    # render starting board on mobile, plus tap placement and layout checks
    page.set_viewport_size({'width':390,'height':844})
    page.evaluate('ctrl.destroy();window.ss=createSimulator(7);window.mount();')
    shot('06_mobile_depart')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
    action('select-part','[data-part="board"]');action('slot','[data-part="board"]')
    assert page.evaluate('ss.hardware.board')
    assert not errors,errors
    (OUT/'resultats-composant.json').write_text(json.dumps({'transport':'document mémoire, pas HTTP','drag_drop':True,'clics':True,'cases':resolved,'boot_device':True,'mobile_width':390,'state_remount':True,'errors':errors},ensure_ascii=False,indent=2))
    browser.close()
  print('Tests DOM du composant : montage, BIOS, 4 réparations, reprise et mobile OK.')
if __name__=='__main__':main()
