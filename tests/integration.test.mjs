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
 const journalFile={name:'ava-log-2026-11-06.md',url:'/user/files/ava-log-2026-11-06.md'};
 sandbox.extension_settings.disabled_attachments=[journalFile.url];
 assert(events.has('chat'));assert.match(controls.get('#extensions_settings').html,/Test memory search/);
 assert.match(controls.get('#extensions_settings').html,/Search this character’s journal archive on demand/);
 controls.get('#wms-journals').handlers.change.call({checked:true});
 assert.equal(sandbox.extension_settings['written-memory-search'].characters['Nora.png'].journals,true);
 assert.equal(controls.get('#wms-journals').properties.checked,true);
 assert.deepEqual(sandbox.extension_settings.disabled_attachments,[journalFile.url]);
});

test('actual host wiring searches disabled journal only after its UI opt-in and preserves normal retrieval flags',async()=>{
 const controls=new Map(),registered=[],events=new Map(),f={name:'ava-log-2026-11-06.md',url:'/user/files/ava-log-2026-11-06.md'};
 const settings={disabled_attachments:[f.url],character_attachments:{'Ava.png':[f]}};
 const $=selector=>{if(!controls.has(selector))controls.set(selector,{handlers:{},properties:{},value:'',append(html){this.html=html;return this;},prop(k,v){this.properties[k]=v;return this;},text(v){this.value=v;return this;},val(){return this.value;},on(event,fn){this.handlers[event]=fn;return this;}});return controls.get(selector);};
 const context={characterId:0,characters:[{avatar:'Ava.png'},{avatar:'Other.png'}],name2:'Ava',chatId:'one',registerFunctionTool:t=>registered.push(t)};
 let reads=0;
 const sandbox={extension_settings:settings,getContext:()=>context,eventSource:{on:(n,fn)=>events.set(n,fn)},event_types:{CHAT_CHANGED:'chat'},saveSettingsDebounced(){},getRequestHeaders:()=>({}),getDataBankAttachmentsForSource:(scope,includeDisabled)=>scope==='character'&&context.characterId===0&&includeDisabled?[f]:[],createMemorySearch,scopeKey,jQuery:fn=>fn(),$,toastr:{error:m=>assert.fail(m)},location:{origin:'https://example.test'},URL,AbortController,TextDecoder,setTimeout,clearTimeout,fetch:async()=>{reads++;return new Response('---\ndate: 2026-11-06\ntitle: "Copper Kettle Evening"\navatar: "Ava.png"\n---\n\nCopper kettle memory.\n');}};
 const code=fs.readFileSync(new URL('../index.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');vm.runInNewContext(code,sandbox);
 controls.get('#wms-enabled').handlers.change.call({checked:true});
 assert.equal(JSON.parse(await registered[0].action({query:'copper'})).matches.length,0);assert.equal(reads,0);
 controls.get('#wms-journals').handlers.change.call({checked:true});
 const answer=JSON.parse(await registered[0].action({query:'copper'}));assert.equal(answer.matches[0].title,'Copper Kettle Evening');assert.equal(answer.matches[0].date,'2026-11-06');
 assert.equal(JSON.parse(await registered[1].action({id:answer.matches[0].id})).text,'\nCopper kettle memory.\n');
 assert.deepEqual(settings.disabled_attachments,[f.url]);assert.equal(settings['written-memory-search'].characters['Ava.png'].shared,false);
 context.characterId=1;context.chatId='two';events.get('chat')();assert.equal(registered[0].shouldRegister(),false);assert.equal(controls.get('#wms-journals').properties.checked,false);
});
