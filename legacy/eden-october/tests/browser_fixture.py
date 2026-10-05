from pathlib import Path
from bs4 import BeautifulSoup
import re,json,base64
ROOT=Path(__file__).resolve().parents[1]/'docs'
def bundle(entry):
 modules=[];done=set()
 def visit(f):
  f=f.resolve();key=str(f.relative_to(ROOT));
  if key in done:return
  s=f.read_text();imports=[]
  def replace(m):
   clause,path=m.group(1),m.group(2)
   if not path.startswith('.') or not (f.parent/path).is_file():return m.group(0)
   sub=(f.parent/path).resolve();visit(sub)
   return 'const '+clause.replace(' as ',':')+' = __modules['+json.dumps(str(sub.relative_to(ROOT)))+'];'
  s=re.sub(r'import\s+(\{[^}]+\}|[\w$]+)\s+from\s+[\'\"]([^\'\"]+)[\'\"];?',replace,s)
  exports=re.findall(r'export\s+(?:async\s+)?(?:const|let|var|class|function)\s+([\w$]+)',s)
  for group in re.findall(r'export\s*\{([^}]+)\}\s*;',s):
   for piece in group.split(','):
    bits=re.split(r'\s+as\s+',piece.strip());exports.append((bits[1]+':'+bits[0]) if len(bits)==2 else bits[0])
  s=re.sub(r'export\s*\{[^}]+\}\s*;','',s)
  s=re.sub(r'export\s+(?=(?:async\s+)?(?:const|let|var|class|function)\s)', '',s)
  done.add(key);modules.append('__modules['+json.dumps(key)+']=(()=>{\n'+s+'\nreturn {'+','.join(exports)+'};})();')
 visit(ROOT/entry)
 return 'const __modules={};\n'+'\n'.join(modules)
ASSETS={}
for f in (ROOT/'assets').rglob('*'):
 if f.suffix in ('.png','.svg'):
  ASSETS[str(f.relative_to(ROOT))]='data:'+('image/svg+xml' if f.suffix=='.svg' else 'image/png')+';base64,'+base64.b64encode(f.read_bytes()).decode()
def load(page,filename,script,store=None):
 soup=BeautifulSoup((ROOT/filename).read_text(),'html.parser')
 # This DOM fixture makes NO browser navigation or network request. Deployment files are unchanged.
 for e in soup.find_all('script'):e.decompose()
 for e in soup.find_all('meta',attrs={'http-equiv':'Content-Security-Policy'}):e.decompose()
 for e in soup.find_all('link',rel='stylesheet'):e.decompose()
 style=soup.new_tag('style');style.string=re.sub(r'@import[^\n]+','',(ROOT/'app/style.css').read_text());soup.head.append(style)
 for im in soup.find_all('img'):
  if im.get('src') in ASSETS:im['src']=ASSETS[im['src']]
 page.set_content(str(soup))
 prefix='''const localStorage={getItem:k=>globalThis.__testStore[k]??null,setItem:(k,v)=>globalThis.__testStore[k]=String(v),removeItem:k=>delete globalThis.__testStore[k]};
 const location={href:'http://127.0.0.1:4181/'''+filename+'''',search:'',hash:'',pathname:'/'''+filename+'''',origin:'http://127.0.0.1:4181'};
 const history={replaceState:(a,b,v)=>{const u=new URL(v,location.href);location.href=u.href;location.hash=u.hash;location.search=u.search;}};
 const fetch=async(path,options={})=>{const r=await globalThis.__api(String(path),options);return {ok:r.status>=200&&r.status<300,status:r.status,json:async()=>r.body};};
 '''
 page.evaluate('(s)=>{globalThis.__testStore=s;globalThis.__downloads=[];}',store or {})
 script_code=bundle(script)
 # Replace download body ONLY in the fixture to inspect output without writing via a managed browser.
 script_code=re.sub(r"function download\(name,text,type='text/plain'\)\{.*?\}\n", "function download(name,text,type='text/plain'){globalThis.__downloads.push({name,text:typeof text==='string'?text:Array.from(text),type});}\n", script_code,flags=re.S)
 # Keep dynamic SVG sources embedded: no image requests.
 script_code=script_code.replace('src="assets/schemas/${esc(id)}.svg"','src="${globalThis.__testAssets[\'assets/schemas/\'+id+\'.svg\']}"')
 page.evaluate('(a)=>globalThis.__testAssets=a',ASSETS)
 page.add_script_tag(content='(()=>{'+prefix+script_code+'})();')
 page.wait_for_timeout(100)
