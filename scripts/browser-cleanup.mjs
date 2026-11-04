// Only use with the BrowserServer created by the current test. On macOS a
// Chrome helper can retain inherited stdio after the browser has exited;
// releasing those owned pipes lets Playwright finish its process cleanup.
async function within(promise, milliseconds) {
 let timer;
 try{return await Promise.race([promise.then(()=>true),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),milliseconds);})]);}
 finally{clearTimeout(timer);}
}

export async function closeOwnedBrowser(browser, browserServer) {
 if(!browserServer)return;
 if(browser)await within(Promise.allSettled(browser.contexts().map(async context=>{
  await Promise.allSettled(context.pages().map(page=>page.close({runBeforeUnload:false})));
  await context.close();
 })),3000);
 const child=browserServer.process(),closing=browserServer.kill();
 for(const stream of child.stdio)stream?.destroy();
 if(!await within(closing,5000)){
  child.kill('SIGKILL');
  for(const stream of child.stdio)stream?.destroy();
  if(!await within(closing,5000))throw new Error('The owned test browser did not finish shutting down.');
 }
}
