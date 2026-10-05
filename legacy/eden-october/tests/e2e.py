"""Native browser smoke test, opt-in on an authorized local workstation.
Unlike dom_fixture.py, this loads the real pages/modules and uses real cookies/storage.
Uses ONLY the local memory API; never points at the class database.
"""
from pathlib import Path
import atexit, json, os, shutil, socket, subprocess, time, zipfile
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tests/results-browser'
OUT.mkdir(exist_ok=True)
BASE = 'http://127.0.0.1:4181/'
checks, errors = [], []
def check(condition, label):
    if not condition:
        raise AssertionError(label)
    checks.append(label)
try:
    with socket.create_connection(('127.0.0.1', 4181), timeout=.4):
        pass
except OSError:
    proc = subprocess.Popen(['node', 'tests/mock-server.mjs'], cwd=ROOT,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    atexit.register(proc.terminate)
    time.sleep(.8)
with sync_playwright() as pw:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    options = dict(headless=True)
    if executable:
        options['executable_path'] = executable
    browser = pw.chromium.launch(**options)
    student_context = browser.new_context(accept_downloads=True)
    page = student_context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(BASE, wait_until='networkidle')
    check(page.locator('#start-form button').is_visible(), 'Accueil chargé avec les vrais modules')
    alias = 'TEST NATIF ' + str(int(time.time()))
    page.locator('#alias').fill(alias)
    page.locator('#class-code-start').fill('TEST-CLASS-261001')
    page.locator('#start-form button').click()
    page.locator('#next').wait_for()
    sources = [
        'function annoncerDepart(){console.log("La partie commence");}annoncerDepart();',
        'function saluer(prenom){console.log("Bonjour " + prenom);}saluer("Nora");saluer("Sami");',
        'function doubler(n){return n*2;}const scoreDouble=doubler(6);console.log(scoreDouble);',
        'function additionner(a,b){return a+b;}const total=additionner(2,3);const totalSuivant=additionner(total,4);console.log(total);console.log(totalSuivant);'
    ]
    for n, source in enumerate(sources, 1):
        page.locator('[data-field="code"]').fill(source)
        page.locator('#run-function').click()
        check(bool(page.locator('#function-console').inner_text()), 'Console défi '+str(n))
        page.locator('#check').click()
        check(not page.locator('#next').is_disabled(), 'Tests défi '+str(n))
        page.locator('#next').click()
    page.locator('#remettre-diagnostic').click()
    page.wait_for_function("document.querySelector('#next') && !document.querySelector('#next').disabled")
    check('reçu' in page.locator('#feedback').inner_text().lower(), 'Copie diagnostique reçue par API mémoire')
    page.locator('#next').click()
    page.wait_for_timeout(500)
    page.reload(wait_until='networkidle')
    check('Diagnostic reçu' not in page.locator('.mission h1').inner_text(), 'Reprise après rechargement')
    teacher_context = browser.new_context(accept_downloads=True)
    teacher = teacher_context.new_page()
    teacher.on('pageerror', lambda e: errors.append(str(e)))
    teacher.goto(BASE+'prof.html', wait_until='networkidle')
    teacher.locator('#teacher-password').fill('TEST-only-teacher-password-123')
    teacher.locator('#login-form button').click()
    teacher.locator('[data-learner]').filter(has_text=alias).first.wait_for()
    check(bool(teacher_context.cookies()), 'Session professeur transmise par cookie natif')
    teacher.locator('[data-learner]').filter(has_text=alias).first.click()
    teacher.locator('#review-form').wait_for()
    check('20/20' in teacher.locator('#grade-total').inner_text(), 'Pré-correction complète à 20/20')
    teacher.locator('#review-status').select_option('valide')
    teacher.locator('#review-note').fill('Validation de test sur une copie fictive.')
    teacher.locator('#save-review').click()
    teacher.wait_for_timeout(500)
    check('enregistrée' in teacher.locator('#review-message').inner_text(), 'Correction enregistrée')
    with teacher.expect_download() as event:
        teacher.locator('#download-one').click()
    download = event.value
    archive = OUT/'rendu_natif.zip'
    download.save_as(archive)
    with zipfile.ZipFile(archive) as z:
        check(z.testzip() is None, 'ZIP navigateur intègre')
        check(any(n.endswith('.xlsx') for n in z.namelist()), 'Grille Excel présente')
        check(any(n.endswith('rendu_original.json') for n in z.namelist()), 'Original conservé dans le dossier')
    check(not errors, 'Aucune erreur JavaScript non traitée')
    browser.close()
(OUT/'rapport.json').write_text(json.dumps({'method':'HTTP local réel + API mémoire, pas Neon', 'checks':len(checks), 'passed':checks, 'errors':errors}, ensure_ascii=False, indent=2))
print(len(checks), 'contrôles navigateur natif réussis')
