"""Teacher DOM component with explicit in-memory fetch fixtures, not live authentication.
No network navigation or browser policy change. Complements, not replaces, HTTP tests.
"""
import os,re,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parent.parent
OUT=Path(os.getenv('EDEN_TEST_OUTPUT','test-results/teacher-component'))
FIXTURE=r'''
const e=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.fixture={logged:false,deleted:false,lastValidation:null,requests:[]};
const learner={id:'aabbcc112233',alias:'A17 test',updated:Date.now(),core_completed:36,validation:'a-valider',teacher_note:'',summary:{runId:'partie-test',revision:42,baseline:true,solved:['ram-missing','ssd-missing','loader-missing','os-missing'],errors:2,attempts:6,hints:1,lastStop:'loader-missing',explanation:'J’ai observé le chargeur absent, restauré le chargeur puis vérifié la session.',completedAt:Date.now()}};
window.fetch=async(url,options={})=>{
 const path=new URL(url).pathname,method=options.method||'GET';fixture.requests.push({path,method});
 const result=(status,data)=>Promise.resolve({status,ok:status<400,json:async()=>structuredClone(data)});
 if(path==='/api/config')return result(200,{enabled:true,retentionDays:30});
 if(path==='/api/teacher/login'){
  if(JSON.parse(options.body).password!=='test-password')return result(403,{error:'Connexion refusée.'});
  fixture.logged=true;return result(200,{ok:true});
 }
 if(!fixture.logged)return result(401,{error:'Connexion requise.'});
 if(path==='/api/teacher/logout'){fixture.logged=false;return result(200,{ok:true});}
 if(path==='/api/teacher/learners')return result(200,{learners:fixture.deleted?[]:[learner],retentionDays:30,totalSteps:36});
 if(path==='/api/teacher/learner/aabbcc112233'){
  if(method==='POST'){const data=JSON.parse(options.body);fixture.lastValidation=data;
    if(data.expectedRevision!==42||data.expectedRunId!=='partie-test')return result(409,{error:'Preuve modifiée.'});
    learner.validation=data.validation;learner.teacher_note=data.note;return result(200,{ok:true});}
  if(method==='DELETE'){fixture.deleted=true;return result(200,{ok:true});}
  return result(200,{learner,events:[{type:'diagnosis-correct',caseId:'loader-missing',message:'Chargeur à examiner.',receivedAt:Date.now()}]});
 }
 return result(404,{error:'Route inconnue.'});
};
'''

def main():
 OUT.mkdir(parents=True,exist_ok=True)
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path=os.getenv('EDEN_CHROMIUM','/usr/bin/chromium'))
  page=browser.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  css=(ROOT/'docs/app/style.css').read_text()+(ROOT/'docs/app/pcsim/style.css').read_text()
  page.set_content('<html lang="fr"><head><style>'+css+'</style></head><body><main class="teacher-page"><h1>Suivi professeur</h1><section class="teacher-box" id="teacher-live"></section></main></body></html>')
  source=(ROOT/'docs/app/pcsim/teacher-live.js').read_text()
  source=re.sub(r'^import .*?;\s*','',source,flags=re.M).replace('import.meta.url','"https://test.invalid/app/pcsim/teacher-live.js"')
  page.add_script_tag(content=FIXTURE+source)
  expect(page.locator('#live-password')).to_be_visible()
  page.locator('#live-password').fill('bad');page.locator('[data-live="login"]').click()
  expect(page.locator('#live-message')).to_contain_text('Connexion refusée')
  page.locator('#live-password').fill('test-password');page.locator('[data-live="login"]').click()
  expect(page.locator('.live-table')).to_contain_text('36 / 36')
  expect(page.locator('.live-table')).to_contain_text('4/4')
  page.locator('[data-live="detail"]').click()
  expect(page.locator('#live-detail')).to_contain_text('chargeur absent')
  page.locator('#live-validation').select_option('valide');page.locator('#live-note').fill('Explication claire.')
  page.locator('[data-live="validate"]').click()
  expect(page.locator('#live-message')).to_contain_text('Validation enregistrée')
  assert page.evaluate('fixture.lastValidation.expectedRevision')==42
  assert page.evaluate('fixture.lastValidation.expectedRunId')=='partie-test'
  expect(page.locator('#live-note')).to_have_value('Explication claire.')
  page.screenshot(path=str(OUT/'prof-composant.png'),full_page=True)
  page.set_viewport_size({'width':390,'height':844})
  page.screenshot(path=str(OUT/'prof-mobile.png'),full_page=True)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.on('dialog',lambda d:d.accept())
  page.locator('[data-live="delete"]').click()
  expect(page.locator('.live-table')).to_contain_text('Aucun élève connecté')
  page.locator('[data-live="logout"]').click()
  expect(page.locator('#live-password')).to_be_visible()
  assert not errors,errors
  (OUT/'resultats-prof-composant.json').write_text(json.dumps({'transport':'document mémoire, fetch simulé; pas API réelle','login_ui':True,'invalid_password_ui':True,'detail':True,'versioned_validation':True,'delete_ui':True,'logout_ui':True,'mobile_width':390,'errors':errors},ensure_ascii=False,indent=2))
  browser.close()
 print('Composant professeur : connexion UI, compteur, lecture, validation versionnée, suppression, déconnexion et 390 px OK (fetch simulé).')
if __name__=='__main__':main()
