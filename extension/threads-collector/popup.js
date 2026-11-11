const $=id=>document.getElementById(id);
let found=[],saved=[];
const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
function renderFound(){
 const root=$('results');root.replaceChildren();
 found.forEach((post,i)=>{
  const card=document.createElement('article');card.className='candidate';
  const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.dataset.index=i;
  check.addEventListener('change',updateSelection);
  const copy=document.createElement('span');copy.className='candidate-text';copy.textContent=post.text||'(게시물 글을 읽지 못했어요)';
  label.append(check,copy);card.append(label);
  const metrics=document.createElement('p');metrics.className='metrics';metrics.textContent=[post.author,post.views!=null?`조회 ${post.views}`:'조회수 표시 없음',post.likes!=null?`좋아요 ${post.likes}`:'좋아요 표시 없음',post.date].filter(Boolean).join(' · ');card.append(metrics);root.append(card);
 });
 updateSelection();
}
function updateSelection(){const n=document.querySelectorAll('#results input:checked').length;$('selectedCount').textContent=n;$('save').disabled=n===0}
function renderSaved(){
 $('savedCount').textContent=saved.length;$('savedList').replaceChildren();
 for(const [i,p] of saved.entries()){
  const row=document.createElement('div');row.className='saved-item';
  const link=document.createElement('a');link.href=p.url;link.target='_blank';link.rel='noreferrer';link.textContent=`${p.author||'Threads 게시물'} · ${p.text.slice(0,64)}${p.text.length>64?'…':''}`;
  const remove=document.createElement('button');remove.className='remove';remove.textContent='삭제';remove.addEventListener('click',async()=>{saved.splice(i,1);await chrome.storage.local.set({giftNoteThreadReferences:saved});renderSaved()});row.append(link,remove);$('savedList').append(row);
 }
}
async function loadSaved(){const data=await chrome.storage.local.get('giftNoteThreadReferences');saved=Array.isArray(data.giftNoteThreadReferences)?data.giftNoteThreadReferences:[];renderSaved()}
$('scan').addEventListener('click',async()=>{
 $('status').textContent='현재 보이는 게시물을 확인하고 있어요…';$('scan').disabled=true;
 try{
  const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
  if(!tab?.id||!/^https?:\/\/(www\.)?threads\.com\//.test(tab.url||''))throw new Error('threads.com 게시물 화면을 먼저 열어주세요.');
  const [{result}]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:collectVisibleThreads});
  found=result||[];renderFound();$('status').textContent=found.length?`${found.length}개 게시물을 찾았어요. 저장할 글만 선택하세요.`:'현재 화면에서 게시물을 찾지 못했어요. 게시물 목록으로 이동해 다시 눌러주세요.';
 }catch(error){$('status').textContent=error.message||'게시물을 읽지 못했어요.'}
 finally{$('scan').disabled=false}
});
$('save').addEventListener('click',async()=>{
 const picked=[...document.querySelectorAll('#results input:checked')].map(c=>found[Number(c.dataset.index)]).filter(Boolean);
 const seen=new Set(saved.map(x=>x.url));const now=new Date().toISOString();
 const fresh=picked.filter(p=>p.url&&!seen.has(p.url)).map(p=>({...p,id:crypto.randomUUID(),collectedAt:now}));
 saved=[...fresh,...saved].slice(0,300);await chrome.storage.local.set({giftNoteThreadReferences:saved});renderSaved();$('status').textContent=`${fresh.length}개 글을 이 Chrome에 저장했어요.`;
});
$('export').addEventListener('click',async()=>{
 await loadSaved();if(!saved.length){$('status').textContent='내보낼 참고 글이 아직 없어요.';return}
 const data=new Blob([JSON.stringify({version:1,items:saved},null,2)],{type:'application/json'});const url=URL.createObjectURL(data);
 await chrome.downloads.download({url,filename:'gift-note-thread-references.json',saveAs:true});setTimeout(()=>URL.revokeObjectURL(url),30000);
});
function collectVisibleThreads(){
 const visible=el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight&&s.visibility!=='hidden'&&s.display!=='none'};
 const anchors=[...document.querySelectorAll('a[href*="/post/"]')].filter(visible);const posts=[];const used=new Set();
 for(const a of anchors){
  let el=a;for(let n=0;n<8&&el.parentElement;n++){if(el.matches('article,[role="article"]'))break;el=el.parentElement}
  if(!visible(el))continue;
  const url=new URL(a.href,location.href);url.search='';url.hash='';if(!/threads\.com$/.test(url.hostname))continue;
  const key=url.href;if(used.has(key))continue;used.add(key);
  const text=(el.innerText||'').replace(/\n{3,}/g,'\n\n').trim();if(text.length<12||text.length>8000)continue;
  const buttons=[...el.querySelectorAll('button,[role="button"]')].map(b=>`${b.getAttribute('aria-label')||''} ${b.innerText||''}`.trim());
  const getCount=pattern=>{for(const line of buttons){if(!pattern.test(line))continue;const m=line.match(/[\d,.]+\s*[만천]?/);if(m)return m[0].replace(/\s/g,'')}return null};
  const author=(el.querySelector('a[href*="/@"]')?.innerText||'').trim().slice(0,80);
  const date=el.querySelector('time')?.getAttribute('datetime')||el.querySelector('time')?.innerText||'';
  const views=getCount(/조회|view/i);const likes=getCount(/좋아요|like|heart/i);
  posts.push({text,author,date,views,likes,url:key,source:'visible-threads-page'});
 }
 return posts.slice(0,30);
}
loadSaved();
