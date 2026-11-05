import {extension_settings,getContext} from '../../../extensions.js';
import {eventSource,event_types,saveSettingsDebounced,getRequestHeaders} from '../../../../script.js';
import {getDataBankAttachmentsForSource} from '../../../chats.js';
import {createMemorySearch,scopeKey} from './runtime.mjs';
const NAME='written-memory-search';
function settings(key){const root=extension_settings[NAME]??={characters:{}};root.characters??={};return root.characters[key]??={enabled:false,shared:false};}
const memory=createMemorySearch({context:getContext,settings,attachments:getDataBankAttachmentsForSource,read:async path=>{
    const u=new URL(path,location.origin);
    if(u.origin!==location.origin||!u.pathname.startsWith('/user/files/'))throw Error('Unsupported file location.');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),15000);
    try{
        const response=await fetch(u.href,{headers:getRequestHeaders(),cache:'no-store',signal:controller.signal});
        if(!response.ok)throw Error(`File read failed (${response.status}).`);
        const reader=response.body.getReader();let bytes=0,text='';const decoder=new TextDecoder();
        while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>2_000_000){await reader.cancel();throw Error('File exceeds the 2 MB search limit.');}text+=decoder.decode(value,{stream:true});}
        return text+decoder.decode();
    }finally{clearTimeout(timer);}
}});
jQuery(()=>{
    if(typeof getContext().registerFunctionTool!=='function'){toastr.error('Written Memory Search requires SillyTavern 1.19.0-compatible tool APIs.');return;}
    $('#extensions_settings').append(`<div class="extension_container"><div class="inline-drawer"><div class="inline-drawer-toggle inline-drawer-header"><b>Written Memory Search</b><div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div></div><div class="inline-drawer-content">
      <label class="checkbox_label"><input type="checkbox" id="wms-enabled"><span>Enable for <span id="wms-character"></span></span></label>
      <label class="checkbox_label"><input type="checkbox" id="wms-shared"><span>Also search shared Data Bank files</span></label>
      <p>Reads enabled character and current-chat text files. Original files and vector settings stay as they are. Requires function calling in Chat Completion settings. Group chats are not supported.</p>
      <input id="wms-query" class="text_pole" placeholder="Test a phrase or keywords"><button type="button" id="wms-test" class="menu_button">Test memory search</button>
      <pre id="wms-result" style="white-space:pre-wrap;max-height:25em;overflow:auto"></pre><small>0.1.0 · Read-only · No embedding model or server restart</small>
    </div></div></div>`);
    function refresh(){const c=getContext(),key=scopeKey(c);$('#wms-character').text(key?c.name2:'a one-to-one character chat');$('#wms-enabled').prop('disabled',!key).prop('checked',!!key&&settings(key).enabled);$('#wms-shared').prop('disabled',!key).prop('checked',!!key&&settings(key).shared);$('#wms-result').text('');}
    $('#wms-enabled').on('change',function(){const key=scopeKey(getContext());if(key){settings(key).enabled=this.checked;saveSettingsDebounced();}refresh();});
    $('#wms-shared').on('change',function(){const key=scopeKey(getContext());if(key){settings(key).shared=this.checked;saveSettingsDebounced();}refresh();});
    let epoch=0;eventSource.on(event_types.CHAT_CHANGED,()=>{epoch++;refresh();});
    $('#wms-test').on('click',async()=>{const start=epoch;$('#wms-result').text('Searching…');try{const r=await memory.search(String($('#wms-query').val()));if(start===epoch)$('#wms-result').text(JSON.stringify(r,null,2));}catch(e){if(start===epoch)$('#wms-result').text(e.message);}});
    for(const tool of memory.tools())getContext().registerFunctionTool(tool);
    refresh();
});
