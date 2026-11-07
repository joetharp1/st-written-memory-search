const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const root=path.resolve(__dirname,'../..'), extension='/scripts/extensions/third-party/st-written-memory-search/';
const url='/user/files/ava-log-2026-11-06.md',file={url,name:'ava-log-2026-11-06.md',size:300};
const text='---\ndate: 2026-11-06\ntitle: "A Quiet Copper Evening"\navatar: "Ava.png"\nwritten_at: "2026-11-06T22:00:00Z"\n---\n\nThe copper kettle was still warm.\n\nJoe made me laugh.\n';
const reads=[];
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{background:#222;color:#eee;font:17px system-ui;margin:16px}*{box-sizing:border-box}label{display:flex;gap:8px;margin:12px 0}input[type=checkbox]{flex-shrink:0}input.text_pole,button{max-width:100%;padding:10px;background:#333;color:white;border:1px solid #888}pre{overflow-wrap:anywhere}.inline-drawer-header{font-weight:bold}</style><div id="extensions_settings"></div><script>
 window.ext=JSON.parse(localStorage.getItem('settings')||'null')||{character_attachments:{'Ava.png':[${JSON.stringify(file)}]},disabled_attachments:[${JSON.stringify(url)}]};
 window.events={},window.tools=[];window.context={characterId:0,characters:[{avatar:'Ava.png'},{avatar:'Other.png'}],name2:'Ava',chatId:'one',registerFunctionTool:t=>tools.push(t)};
 window.host={getContext:()=>context,eventSource:{on:(key,fn)=>events[key]=fn},event_types:{CHAT_CHANGED:'chat'},saveSettingsDebounced:()=>localStorage.setItem('settings',JSON.stringify(ext)),getRequestHeaders:()=>({'X-Test':'fixture'}),getDataBankAttachmentsForSource:(scope,includeDisabled=true)=>(scope==='character'?ext.character_attachments[context.characters[context.characterId].avatar]||[]:[]).filter(f=>includeDisabled||!ext.disabled_attachments.includes(f.url))};
 window.$=selector=>{const el=document.querySelector(selector);return{append:html=>el.insertAdjacentHTML('beforeend',html),prop(k,v){el[k]=v;return this},text(v){el.textContent=v;return this},val:()=>el.value,on:(event,fn)=>el.addEventListener(event,fn)}};
 window.jQuery=fn=>fn();window.toastr={error:message=>{throw Error(message)}};
 </script><script type="module" src="${extension}index.js"></script>`;
(async()=>{
 const server=http.createServer((req,res)=>{
  if(req.url===url){reads.push(req.url);res.setHeader('content-type','text/plain');res.end(text);return;}
  if(req.url==='/scripts/extensions.js'){res.setHeader('content-type','text/javascript');res.end('export const extension_settings=window.ext,getContext=window.host.getContext;');return;}
  if(req.url==='/script.js'){res.setHeader('content-type','text/javascript');res.end('export const {eventSource,event_types,saveSettingsDebounced,getRequestHeaders}=window.host;');return;}
  if(req.url==='/scripts/chats.js'){res.setHeader('content-type','text/javascript');res.end('export const getDataBankAttachmentsForSource=window.host.getDataBankAttachmentsForSource;');return;}
  if(req.url.startsWith(extension)){const name=path.basename(req.url);if(!['index.js','runtime.mjs','core.mjs'].includes(name)){res.statusCode=404;res.end();return;}res.setHeader('content-type','text/javascript');res.end(fs.readFileSync(path.join(root,name)));return;}
  res.setHeader('content-type','text/html');res.end(html);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/tmp/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.tools.length===2);
  await page.locator('#wms-enabled').check();await page.locator('#wms-query').fill('copper kettle');await page.locator('#wms-test').click();
  await page.waitForFunction(()=>document.querySelector('#wms-result').textContent.includes('entriesSearched'));
  assert.equal(JSON.parse(await page.locator('#wms-result').innerText()).matches.length,0);assert.equal(reads.length,0);
  await page.locator('#wms-journals').check();await page.locator('#wms-test').click();
  await page.waitForFunction(()=>document.querySelector('#wms-result').textContent.includes('A Quiet Copper Evening'));
  const result=JSON.parse(await page.locator('#wms-result').innerText());assert.equal(result.matches[0].date,'2026-11-06');assert.equal(result.matches[0].text,'\nThe copper kettle was still warm.\n\nJoe made me laugh.\n');
  const opened=await page.evaluate(async id=>JSON.parse(await tools[1].action({id})),result.matches[0].id);assert.equal(opened.text,result.matches[0].text);
  assert.deepEqual(await page.evaluate(()=>ext.disabled_attachments),[url]);assert.equal(await page.locator('#wms-shared').isChecked(),false);
  for(const width of [320,393,709]){await page.setViewportSize({width,height:852});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await page.reload();await page.waitForFunction(()=>window.tools.length===2);assert.equal(await page.locator('#wms-journals').isChecked(),true);
  await page.evaluate(()=>{context.characterId=1;context.chatId='two';context.name2='Other';events.chat();});
  assert.equal(await page.locator('#wms-journals').isChecked(),false);assert.equal(await page.locator('#wms-enabled').isChecked(),false);
  assert.equal(await page.evaluate(()=>tools[0].shouldRegister()),false);assert.deepEqual(errors,[]);
  console.log('PASS Chromium: actual extension UI, default exclusion, journal opt-in, keyword search, dated verbatim result, direct open, unchanged disabled flag, reload persistence, character isolation, mobile 320/393/709px.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
