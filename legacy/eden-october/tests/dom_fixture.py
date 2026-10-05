"""DOM fixture only: no browser navigation/network; Python bridge calls real local API with a memory store."""
from browser_fixture import load, ROOT
from playwright.sync_api import sync_playwright
import urllib.request,urllib.error,http.cookiejar,json,itertools,time,zipfile,io
from pathlib import Path
D=Path(__file__).resolve().parent/'results-dom';D.mkdir(exist_ok=True)
DATA=json.loads((ROOT/'app/lesson.json').read_text());report=[];errors=[]
def check(ok,msg):
 if not ok: raise AssertionError(msg)
 report.append(msg)
def api_bridge(page):
 jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
 def api(path,options):
  url='http://127.0.0.1:4181/'+path.removeprefix('./').lstrip('/')
  headers={'Content-Type':'application/json','Origin':'http://127.0.0.1:4181',**options.get('headers',{})}
  req=urllib.request.Request(url,method=options.get('method','GET'),headers=headers,data=options.get('body','').encode() if options.get('body') else None)
  try:
   with opener.open(req,timeout=10) as r:return {'status':r.status,'body':json.load(r)}
  except urllib.error.HTTPError as e:return {'status':e.code,'body':json.load(e)}
 page.expose_function('__api',api);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
def expected(mode,vs):
 if mode=='AND':return vs[0] and vs[1]
 if mode=='OR':return vs[0] or vs[1]
 if mode=='NOT':return not vs[0]
 return (vs[0] or vs[1]) and not vs[2]
def answer(page,key,value):
 elems=page.locator('input[data-field="'+key+'"]')
 for i in range(elems.count()):
  if elems.nth(i).get_attribute('value')==value:elems.nth(i).check();return
 raise AssertionError('answer missing '+key+' '+value)
FUNCTIONS={'diag-demarrer':'function annoncerDepart(){console.log("La partie commence");}\nannoncerDepart();','diag-doubler':'function doubler(nombre){return nombre*2;}\nconst scoreDouble=doubler(6);console.log(scoreDouble);','diag-saluer':'function saluer(prenom){console.log("Bonjour " + prenom);}\nsaluer("Nora");\nsaluer("Sami");','diag-retour':'function additionner(a,b){return a+b;}\nconst total=additionner(2,3);\nconst totalSuivant=additionner(total,4);console.log(total);console.log(totalSuivant);',
'entrainement-1':'function estMajeur(age){return age>=18;}\nconsole.log(estMajeur(18));',
'entrainement-2':'function peutJouer(age,aAccord){return age>=14&&aAccord;}\nconst acces=peutJouer(14,true);console.log(acces);',
'entrainement-3':'function peutEntrer(ticket,invite,ferme){return (ticket||invite)&&!ferme;}',
'defi-plus-loin':'function accesParc(age,ticket,accompagne,ferme){return ticket&&!ferme&&(age>=14||accompagne);}'}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 pupil=browser.new_page(viewport={'width':1440,'height':1050});api_bridge(pupil);load(pupil,'index.html','app/app.js')
 check(pupil.locator('#start-form button').is_visible(),'Accueil : commencer visible');pupil.screenshot(path=str(D/'01_accueil.png'),full_page=True)
 pupil.locator('#alias').fill('DEMO DOM');pupil.locator('#class-code-start').fill('TEST-CLASS-261001');pupil.locator('#start-form button').click();pupil.locator('#next').wait_for()
 check(pupil.locator('#next').is_disabled(),'Diagnostic : poursuivre impossible sans réponses')
 for step in DATA['steps']:
  check(pupil.locator('.mission h1').inner_text()==step['title'],'Écran '+step['id']+' : titre correct')
  kind=step['kind']
  if kind=='quiz':
   diag={'param':'nombre','argument':'6','count':'1','receive':'9','display':'12','stored':'12'}
   for q in step['questions']:answer(pupil,q['id'],diag[q['id']] if step['block']=='diagnostic' else q['answer'])
  elif kind in ['write','debrief']:
   pupil.locator('textarea[data-field="trace"]').fill('Je teste le seuil exact. Avec 14 et un accord, le résultat est vrai. Sans accord, il est faux : les deux conditions sont nécessaires.')
  elif kind=='function-code':
   if step['id']=='diag-doubler':
    pupil.locator('[data-field="code"]').fill('function doubler(nombre){console.log(nombre*2);}\nconst scoreDouble=doubler(6);console.log(scoreDouble);'.replace('\n','\n'))
    pupil.locator('#run-function').click();check('undefined' in pupil.locator('#function-console').inner_text(),'Retour absent visible dans la console')
    pupil.locator('#check').click();check(pupil.locator('#next').is_disabled(),'Une fonction qui affiche sans renvoyer reste à reprendre')
    check(pupil.locator('.test-row.is-fail').count()>0,'Les écarts attendu / obtenu sont affichés')
    pupil.locator('#code-hint').click();check('return' in pupil.locator('#code-hint-text').inner_text(),'Indice ciblé sur le retour')
   pupil.locator('[data-field="code"]').fill(FUNCTIONS[step['id']]);pupil.locator('#run-function').click()
   if step['id']=='diag-doubler':
    check('12' in pupil.locator('#code-preview').inner_text(),'Valeur 12 réellement visualisée')
    pupil.locator('.watch-card summary').click();check('scoreDouble' in pupil.locator('#code-watch').inner_text(),'Variables inspectables')
    pupil.locator('.custom-test summary').click();pupil.locator('[data-custom-arg="0"]').fill('9');pupil.locator('#custom-run').click();check('18' in pupil.locator('#custom-result').inner_text(),'Appel personnel avec 9 renvoie 18')
    pupil.screenshot(path=str(D/'02b_diagnostic_retour.png'),full_page=True)
   if step['id']=='diag-saluer':
    check('Bonjour Nora' in pupil.locator('#function-console').inner_text(),'Console saluer réellement exécutée');pupil.screenshot(path=str(D/'02_diagnostic_code.png'),full_page=True)
  elif kind=='submit-diagnostic':
   pupil.locator('#remettre-diagnostic').click();pupil.wait_for_function("document.querySelector('#next') && !document.querySelector('#next').disabled")
   check('reçu' in pupil.locator('#feedback').inner_text().lower(),'Remise diagnostique confirmée par le serveur')
  elif kind=='truth':
   for i,vs in enumerate(itertools.product([False,True],repeat=len(step['inputs']))):pupil.locator(f'select[data-field="r{i}"]').select_option(str(expected(step['mode'],vs)).lower())
  elif kind=='circuit':
   pupil.locator('#test-circuit').click();check('Prévois' in pupil.locator('#feedback').inner_text(),'Prédiction avant circuit '+step['id'])
   for vs in itertools.product([False,True],repeat=len(step['inputs'])):
    for i,v in enumerate(vs):
     toggle=pupil.locator(f'[data-toggle="{i}"]')
     if (toggle.get_attribute('aria-pressed')=='true')!=v:toggle.click()
    answer(pupil,'prediction',str(expected(step['mode'],vs)).lower());pupil.locator('#test-circuit').click()
  elif kind=='code':
   cond={'combined':'(aTicket || estInvite) && !estFerme','and':'aCarte && aReserve','threshold':'points >= 14 && aAutorisation'}[step['exercise']]
   pupil.locator('[data-field="code"]').fill('if ('+cond+') { console.log("OK"); } else { console.log("REFUS"); }')
  elif kind=='report':
   pupil.locator('#save-copy').click();pupil.wait_for_timeout(400);check('Copie reçue' in pupil.locator('#feedback').inner_text(),'Sauvegarde explicite datée reçue');pupil.screenshot(path=str(D/'03_bilan.png'),full_page=True)
  elif kind=='bonus':
   for vals in [('OR','yes','AND'),('AND','no','OR')]:
    for k,v in zip(['gate1','invert','gate2'],vals):pupil.locator(f'select[data-field="{k}"]').select_option(v)
    pupil.locator('#test-bonus').click()
   pupil.locator('[data-field="trace"]').fill('Première règle : une possibilité et non fermé. Deuxième règle : les deux, ou une autorisation C.')
  if kind not in ('pause','report','submit-diagnostic'):
   pupil.locator('#check').click();check(not pupil.locator('#next').is_disabled(),'Validation et suite '+step['id'])
  pupil.locator('#next').click()
 pupil.wait_for_timeout(2000)
 store=pupil.evaluate('globalThis.__testStore');state=json.loads(store['eden:261001:progress:v2']);check(all(x['done'] for x in state['responses'].values()),'Toutes les étapes achevées et bonus inclus')
 check(state['responses']['diag-doubler']['practice']['firstAttempt']['code'].find('console.log(nombre*2)')>=0,'Premier code fautif conservé séparément du dernier')
 check(state['responses']['diag-doubler']['hints']==1,'Nombre d’indices sauvegardé')
 # Reprise with an independent test DOM/storage; not a claim about browser storage under a hosting policy.
 reprise=browser.new_page(viewport={'width':1440,'height':1000});api_bridge(reprise);load(reprise,'index.html','app/app.js',store=store);check('Défi' in reprise.locator('.mission h1').inner_text(),'Reprise sur le dernier écran');reprise.close()
 teacher=browser.new_page(viewport={'width':1440,'height':1050});api_bridge(teacher);load(teacher,'prof.html','app/teacher.js')
 check(teacher.locator('a[href="presentation.html"]').count()==1,'Présentation prof accessible');teacher.locator('#teacher-password').fill('TEST-only-teacher-password-123');teacher.locator('#login-form button').click();teacher.locator('[data-learner]').first.wait_for(timeout=10000)
 teacher.screenshot(path=str(D/'04_prof_liste.png'),full_page=True);teacher.locator('[data-learner]').filter(has_text='DEMO DOM').first.click();teacher.locator('#review-form').wait_for();check('20/20' in teacher.locator('#grade-total').inner_text(),'Pré-correction de la copie complète 20/20')
 check('Premier essai' in teacher.locator('#detail').inner_text(),'Lecture du premier essai depuis l’espace professeur')
 teacher.locator('[data-point="1.1"]').select_option('0');teacher.locator('[data-comment="1.1"]').fill('Point corrigé après relecture pédagogique.');teacher.locator('#review-note').fill('Tu sais appeler les fonctions. Reprends la déclaration.');teacher.locator('#review-status').select_option('valide');teacher.locator('#save-review').click();teacher.wait_for_timeout(400);check('enregistrée' in teacher.locator('#review-message').inner_text(),'Relecture et commentaire persistés');teacher.screenshot(path=str(D/'05_correction.png'),full_page=True)
 teacher.locator('#download-one').click();teacher.wait_for_function('globalThis.__downloads.length>0');item=teacher.evaluate('globalThis.__downloads.at(-1)');data=bytes(item['text']);(D/'export_demo.zip').write_bytes(data)
 z=zipfile.ZipFile(io.BytesIO(data));assert z.testzip() is None
 xlsxname=next(n for n in z.namelist() if n.endswith('.xlsx'));(D/'exemple_correction.xlsx').write_bytes(z.read(xlsxname));xml=zipfile.ZipFile(io.BytesIO(z.read(xlsxname))).read('xl/worksheets/sheet1.xml').decode();check('>19</' in xml,'Excel exporté avec note manuelle 19/20');check(any('premiers_essais/diag-doubler.js' in n for n in z.namelist()),'Premier code exporté séparément');check(any(n.endswith('evaluation/essais_et_tests.json') for n in z.namelist()),'Journal et tests dans le dossier élève');check(any(n.endswith('rendu_original.json') for n in z.namelist()),'Copie originale dans le dossier élève')
 teacher.locator('#detail-close').click();teacher.locator('#export-class').click();teacher.wait_for_function('globalThis.__downloads.length>1');check('Archive préparée' in teacher.locator('#export-status').inner_text(),'Export groupé complet disponible')
 mobile=browser.new_page(viewport={'width':390,'height':844});api_bridge(mobile);load(mobile,'index.html','app/app.js');check(mobile.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'Accueil mobile sans débordement');mobile.locator('#alias').fill('DEMO MOBILE');mobile.locator('#class-code-start').fill('TEST-CLASS-261001');mobile.locator('#start-form button').click();mobile.locator('#next').wait_for();check(mobile.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'Diagnostic mobile sans débordement');mobile.screenshot(path=str(D/'06_mobile.png'),full_page=True)
 slide=browser.new_page(viewport={'width':1440,'height':1050});api_bridge(slide);load(slide,'presentation.html','app/slides.js');check(slide.locator('.slide-notes').count()==0,'Notes professeur masquées en projection');slide.screenshot(path=str(D/'07_presentation.png'),full_page=True)
 check(not errors,'Aucune erreur JavaScript dans la fixture');browser.close()
(D/'rapport-dom.json').write_text(json.dumps({'method':'DOM injecté, stockage simulé, pont Python vers API HTTP mémoire. Pas de navigation HTTP Chromium ni de connexion Neon réelle.','checks':len(report),'passed':report,'errors':errors},ensure_ascii=False,indent=2))
print(len(report),'contrôles DOM/API/exports réussis')
