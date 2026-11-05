// Read-only, dependency-free retrieval. Source text is evidence, never instructions.
const stop = new Set('a an the of to and or is are was were be been being i me my you your we our us it its this that these those in on at for from with as by have has had do does did can could would should please use available anything what which tell about'.split(' '));
export function words(s) {
    return (String(s).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
        .filter(w => !stop.has(w)).map(w => w.length > 7 && w.endsWith('ing') ? w.slice(0,-3) : w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0,-1) : w);
}
function hash(s) { let h=2166136261; for (let i=0;i<s.length;i++) h=Math.imul(h^s.charCodeAt(i),16777619); return (h>>>0).toString(16); }
export function parseFile(source, text) {
    if (text.startsWith('%PDF-') || text.includes('\0')) throw Error('Binary file: attach a text-extracted copy.');
    const blocks=text.split('</memory>').filter(s=>s.trim()); const entries=[]; const groups=new Map();
    for (let index=0;index<blocks.length;index++) {
        const raw=blocks[index];
        const date=raw.match(/<memory\b[^>]*\bdate="([^"]*)"/)?.[1] || raw.match(/\bDate: ([^;\]\n]+)/)?.[1] || 'Not stated; do not infer from today';
        const label=raw.match(/\b(?:ELOG-\d+|MLOG-\d+)\b/)?.[0] || `entry ${index+1}`;
        let body=raw.match(/<original_log_text>\n?([\s\S]*?)\n?<\/original_log_text>/)?.[1];
        if (body===undefined) body=raw.replace(/^\s*<memory\b[^>]*>\s*\n?/, '').replace(/^\s*\[Retrieval metadata:[\s\S]*?\]\s*\n?/, '');
        const warnings=[];
        if (!body.trim()) warnings.push('Heading or metadata without a body.');
        if (raw.includes('<original_log_text>') && !raw.includes('</original_log_text>')) warnings.push('Unclosed original text marker.');
        const fragment=raw.match(/Fragment (\d+) of (\d+)/i);
        const sourceMetadata=raw.match(/\[Retrieval metadata:([\s\S]*?)\]/)?.[1]?.trim()||null;
        if(/^\s*(?:- \[[^\n]+\]|#{1,6} [^\n]+)\s*$/.test(body))warnings.push('Heading without following content.');
        // Rejoin only explicitly numbered fragments of the same labelled entry in this file.
        const key=fragment && /^MLOG-/.test(label) ? label : `${label}:${index}`;
        let entry=groups.get(key);
        if (!entry) {entry={source:source.name,sourceKey:source.url,label,date,text:'',warnings,sourceMetadata:[],fragments:[],index};groups.set(key,entry);entries.push(entry);}
        if(sourceMetadata)entry.sourceMetadata.push(sourceMetadata);
        entry.text+=body;
        if(fragment)entry.fragments.push({part:Number(fragment[1]),total:Number(fragment[2])});
    }
    for (const e of entries) {
        if(e.fragments.length){const total=e.fragments[0].total; if(e.fragments.length!==total || e.fragments.some((f,i)=>f.part!==i+1||f.total!==total))e.warnings.push('Missing, duplicated or out-of-order source fragments.');}
        e.id=`memory-${hash(source.url)}-${e.index}-${hash(e.text)}`;
        e.title=e.text.split('\n').find(l=>l.trim())?.slice(0,200)||e.label;
    }
    return entries;
}
export function rank(entries, query, limit=5) {
    const terms=[...new Set(words(query))];if(!terms.length)return [];
    const docs=entries.map(e=>({entry:e,tokens:words(e.text)}));
    const avg=docs.reduce((n,d)=>n+d.tokens.length,0)/Math.max(1,docs.length)||1;
    const df=new Map(terms.map(t=>[t,docs.filter(d=>d.tokens.includes(t)).length]));
    const phrase=query.trim().replace(/^["“]|["”]$/g,'').toLowerCase();
    return docs.map(d=>{
        let score=0,matched=[];
        for(const t of terms){const tf=d.tokens.filter(w=>w===t).length;if(!tf)continue;matched.push(t);const idf=Math.log(1+(docs.length-df.get(t)+.5)/(df.get(t)+.5));score+=idf*tf*2.2/(tf+1.2*(.25+.75*d.tokens.length/avg));}
        if(phrase.length>=4&&d.entry.text.toLowerCase().includes(phrase))score+=12;
        return {...d.entry,score,matched};
    }).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,limit);
}
export function paginate(text, max=6000) {
    if(text.length<=max)return [{text}];
    const units=text.match(/[\s\S]+?(?:\n[ \t]*\n|$)/g)||[];const pages=[];let current='';
    for(const unit of units){
        if(unit.length>max){if(current){pages.push({text:current});current='';}pages.push({text:null,omittedCharacters:unit.length,warning:'A single paragraph exceeds the display limit. It was not silently truncated. Inspect the source file.'});continue;}
        if(current&&current.length+unit.length>max){pages.push({text:current});current='';}
        current+=unit;
    }
    if(current)pages.push({text:current});return pages.length?pages:[{text:''}];
}
export function result(entry, part=1) {
    const pages=paginate(entry.text);if(!Number.isInteger(part)||part<1||part>pages.length)throw Error('Invalid part number.');
    return {id:entry.id,source:entry.source,label:entry.label,date:entry.date,title:entry.title,part,parts:pages.length,
        complete:pages.length===1&&pages[0].text!==null&&entry.warnings.length===0,warnings:entry.warnings,sourceMetadata:entry.sourceMetadata,...pages[part-1],nextPart:part<pages.length?part+1:null};
}
