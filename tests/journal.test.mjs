import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { journalInfo, parseJournal } from '../core.mjs';
import { createMemorySearch } from '../runtime.mjs';

const file=(suffix='')=>({name:`ava-log-2026-11-06${suffix}.md`,url:`/user/files/ava-log-2026-11-06${suffix}.md`,size:200});
const body='I remembered the copper kettle.\n\nJoe had made me laugh.\n';
const journal=(avatar='Ava.png',text=body,title='The Copper Kettle')=>`---\ndate: 2026-11-06\ntime: "23:10:00 GMT"\ntimezone: "Europe/London"\ntitle: ${JSON.stringify(title)}\navatar: ${JSON.stringify(avatar)}\nchat_id: "private-chat"\nwritten_at: "2026-11-06T23:10:00Z"\n---\n\n${text}`;
function fixture(){
 const context={characterId:0,characters:[{avatar:'Ava.png'},{avatar:'Other.png'}],chatId:'one'};
 const settings={enabled:true,shared:false,journals:false},files=[file()],reads=[];
 const texts=new Map([[files[0].url,journal()]]);
 const deps={context:()=>context,settings:()=>settings,attachments:(scope,includeDisabled)=>scope==='character'&&context.characterId===0&&includeDisabled?files:[],read:async url=>{reads.push(url);return texts.get(url);}};
 return {context,settings,files,reads,texts,deps,memory:createMemorySearch(deps)};
}

test('disabled journals need explicit character opt-in; enabling search never changes attachment flags',async()=>{
 const f=fixture(),before=structuredClone(f.files);
 assert.equal((await f.memory.search('copper')).matches.length,0);assert.equal(f.reads.length,0);
 f.settings.journals=true;const r=await f.memory.search('copper');
 assert.equal(r.matches.length,1);assert.equal(r.matches[0].date,'2026-11-06');assert.equal(r.matches[0].title,'The Copper Kettle');
 assert.equal(r.matches[0].text,'\n'+body);assert.deepEqual(f.files,before);assert.equal(r.journalArchive.totalFiles,1);
 assert.equal((await f.memory.open(r.matches[0].id)).text,r.matches[0].text);
 f.settings.journals=false;await assert.rejects(f.memory.open(r.matches[0].id),/unavailable/);
});

test('other disabled files and other characters journals never enter the opted-in archive',async()=>{
 const f=fixture();f.settings.journals=true;
 f.files.push({name:'private.md',url:'/user/files/private.md'},file('-2'),{name:'ava-log-2026-11-06.md',url:'https://outside.test/user/files/ava-log-2026-11-06.md'});
 f.texts.set(file('-2').url,journal('Other.png','OTHER CHARACTER SECRET copper'));
 const r=await f.memory.search('copper');assert.equal(r.matches.length,1);assert.match(r.warnings.join(' '),/different character/);
 assert.ok(!JSON.stringify(r).includes('OTHER CHARACTER SECRET'));assert.equal(f.reads.length,2);
 const id=r.matches[0].id;f.context.characterId=1;await assert.rejects(f.memory.open(id),/unavailable/);
});

test('new entries appear on next search, file edits invalidate ids and removed attachments cannot be reopened',async()=>{
 const f=fixture();f.settings.journals=true;
 const old=(await f.memory.search('copper')).matches[0];
 f.files.push(file('-2'));f.texts.set(file('-2').url,journal('Ava.png','The silver spoon stayed.','Silver Spoon Afternoon'));
 assert.equal((await f.memory.search('silver')).matches.length,1);
 f.texts.set(file().url,journal('Ava.png','The copper kettle moved.'));await assert.rejects(f.memory.open(old.id),/changed/);
 const id=(await f.memory.search('silver')).matches[0].id;f.files.pop();await assert.rejects(f.memory.open(id),/unavailable/);
});

test('switching chats, withdrawing consent or removing attachments during a read prevents stale results',async()=>{
 for(const change of [f=>{f.context.chatId='two';},f=>{f.settings.journals=false;}]){
  const f=fixture();f.settings.journals=true;f.deps.read=async()=>{change(f);return journal();};
  await assert.rejects(f.memory.search('copper'),/changed/i);
 }
 const f=fixture();f.settings.journals=true;f.deps.read=async()=>{f.files.length=0;return journal();};
 assert.equal((await f.memory.search('copper')).matches.length,0);
});

test('all archive pages are reachable and opening an older result reads only its file',async()=>{
 const f=fixture();f.settings.journals=true;f.files.length=0;
 for(let i=1;i<=62;i++){const p=file(i===1?'':`-${i}`);f.files.push(p);f.texts.set(p.url,journal('Ava.png',i===1?'Unmistakable oldest phrase.':`Record ${i}.`));}
 const first=await f.memory.search('unmistakable');assert.equal(first.matches.length,0);assert.equal(first.journalArchive.nextJournalPage,2);assert.equal(f.reads.length,60);
 const second=await f.memory.search('unmistakable',2);assert.equal(second.matches.length,1);assert.equal(second.journalArchive.nextJournalPage,null);
 f.reads.length=0;assert.match((await f.memory.open(second.matches[0].id)).text,/oldest/);assert.deepEqual(f.reads,[file().url]);
 await assert.rejects(f.memory.search('copper',0),/positive integer/);
});

test('journal date/title are searchable and original contents are returned verbatim without parsing memory tags',async()=>{
 const f=fixture();f.settings.journals=true;
 const exact='A literal </memory> marker and <original_log_text> stay.\n';f.texts.set(file().url,journal('Ava.png',exact));
 const r=await f.memory.search('2026-11-06');assert.equal(r.matches.length,1);assert.equal(r.matches[0].text,'\n'+exact);
 assert.equal((await f.memory.search('Copper Kettle')).matches.length,1);
});

test('strict journal provenance rejects malformed files, invalid dates and wrong avatars',()=>{
 assert.equal(journalInfo({name:'ava-log-2026-02-30.md',url:'/user/files/ava-log-2026-02-30.md'}),null);
 assert.throws(()=>parseJournal(file(),'ordinary text','Ava.png'),/Invalid/);
 assert.throws(()=>parseJournal(file(),journal('Other.png'),'Ava.png'),/different character/);
 assert.throws(()=>parseJournal(file(),journal().replace('date: 2026-11-06','date: 2026-11-05'),'Ava.png'),/Incomplete/);
 assert.throws(()=>parseJournal(file(),journal().replace('title:', 'avatar: "Other.png"\ntitle:'),'Ava.png'),/Duplicate/);
});

test('source contract: ST exposes includeDisabled solely as a read filter, journal saves remain disabled',async t=>{
 let st,journalSource;
 try {
  st=await readFile(`${process.env.ST_ROOT||'/workspace/scratch/d5e75b8f0021/research/st-1.19.0'}/public/scripts/chats.js`,'utf8');
  journalSource=await readFile(`${process.env.JOURNAL_ROOT||'/workspace/scratch/837751a18ba6/ava-journal'}/core.mjs`,'utf8');
 } catch(error) { if(error.code==='ENOENT'&&!process.env.ST_ROOT&&!process.env.JOURNAL_ROOT){t.skip('Set ST_ROOT and JOURNAL_ROOT to the verified source trees.');return;}throw error; }
 assert.match(st,/export function getDataBankAttachmentsForSource\(source, includeDisabled = true\)/);
 assert.match(st,/includeDisabled \|\| !isAttachmentDisabled\(x\)/);
 assert.match(journalSource,/settings\.disabled_attachments\.push\(entry\.url\)/);
});
