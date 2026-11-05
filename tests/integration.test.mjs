import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createMemorySearch,scopeKey} from '../runtime.mjs';
test('extension initializes, starts disabled, toggles current character and reads through registered tool',async()=>{
 const controls=new Map(),registered=[],events=new Map();let saved=0,requests=0;
 const $=selector=>{if(!controls.has(selector))controls.set(selector,{handlers:{},properties:{},value:'',append(html){this.html=html;return this;},prop(k,v){this.properties[k]=v;return this;},text(v){this.value=v;return this;},val(){return this.value;},on(event,fn){this.handlers[event]=fn;return this;}});return controls.get(selector);};
 const context={characterId:0,characters:[{avatar:'Nora.png'}],name2:'Nora',chatId:'chat',registerFunctionTool:t=>registered.push(t)};
 const sandbox={extension_settings:{},getContext:()=>context,eventSource:{on:(n,fn)=>events.set(n,fn)},event_types:{CHAT_CHANGED:'chat'},saveSettingsDebounced:()=>saved++,getRequestHeaders:()=>({'X-Test':'1'}),getDataBankAttachmentsForSource:s=>s==='character'?[{name:'notes.md',url:'/user/files/notes.txt'}]:[],createMemorySearch,scopeKey,jQuery:fn=>fn(),$,toastr:{error:m=>assert.fail(m)},location:{origin:'https://example.test'},URL,AbortController,TextDecoder,setTimeout,clearTimeout,fetch:async(url,opts)=>{requests++;assert.equal(new URL(url).origin,'https://example.test');assert.equal(opts.cache,'no-store');return new Response('<memory date="2026-01-01">The voice agreement is recorded here.</memory>');}};
 const code=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInNewContext(code,sandbox);assert.equal(registered.length,2);assert.equal(registered[0].shouldRegister(),false);
 controls.get('#wms-enabled').handlers.change.call({checked:true});assert.equal(saved,1);assert.equal(registered[0].shouldRegister(),true);
 const answer=JSON.parse(await registered[0].action({query:'voice agreement'}));assert.equal(answer.matches.length,1);assert.equal(answer.matches[0].date,'2026-01-01');assert.equal(requests,1);
 assert(events.has('chat'));assert.match(controls.get('#extensions_settings').html,/Test memory search/);
});
