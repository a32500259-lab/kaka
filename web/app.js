import {sceneFor} from './scene-options.js?v=gemini8';
import {apiUrl,writerStatus,connectWriter,disconnectWriter,hasWriterConnection,prepareVisuals,requestGiftPosts} from './ai-client.js?v=gemini8';
const postForMode=current=>current?.posts?current.posts[current.mode||'recommend']||'':current?.postText??[...(current?.sections||[]),current?.link].filter(Boolean).join('\n\n');
const $=id=>document.getElementById(id);
const DISCLOSURE='이 포스팅은 선물하기 큐레이터 활동의 일환으로, 주문 발생 시 일정액의 수수료를 제공받습니다.';
const fields=['url','name','category','price','facts','images','age','occasion','audience','angle','photoCount','customOccasion','targetLength'];
let loadedUrl='',current=null,drafts=[],loadedProduct=null,generating=false,generationController=null;const recentDrafts=[];
try{drafts=JSON.parse(localStorage.getItem('gift-note-drafts-v2')||'[]');if(!Array.isArray(drafts))drafts=[]}catch{}
$('count').textContent=drafts.length;
function validLink(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='gift-link.kakao.com'&&!u.username&&!u.password&&/^\/c\/[a-zA-Z0-9]+\/?$/.test(u.pathname)}catch{return false}}
function safeImage(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
function resize(t){t.style.height='auto';t.style.height=t.scrollHeight+4+'px'}
let requestNumber=0,loading=false;
function inputLink(){const text=$('url').value.trim();return text.match(/https:\/\/gift-link\.kakao\.com\/c\/[a-zA-Z0-9]+(?:\?[^\s<>\]\)]+)?/)?.[0]||text}
function clearResult(message){current=null;$('post').replaceChildren();$('photoDownloads').replaceChildren();$('textCount').textContent='';$('lengthHelp').textContent='';$('copyStatus').textContent='';$('photoStatus').textContent='';$('productLink').removeAttribute('href');$('productLink').textContent='';$('rationale').textContent=message;$('copyBtn').disabled=true;$('save').disabled=true;$('sourcePhoto').hidden=true}
async function loadProduct(){
 generationController?.abort();const raw=inputLink(),serial=++requestNumber;loadedProduct=null;
 if(!validLink(raw)){loading=false;loadedUrl='';$('load').disabled=false;$('load').textContent='상품 불러오기';$('generate').disabled=false;$('importStatus').textContent='카카오 큐레이터 링크를 넣어주세요. 공유 문구 전체를 붙여넣어도 됩니다.';clearResult('올바른 상품 주소를 기다리고 있어요.');return false}
 $('url').value=raw;loading=true;$('load').disabled=true;$('load').textContent='불러오는 중…';$('generate').disabled=true;clearResult('새 상품 정보를 가져오고 있어요.');$('status').textContent='';$('importStatus').textContent='카카오 상품명·가격·사진을 확인하고 있어요.';
 try{
  const response=await fetch(apiUrl('/api/product?url='+encodeURIComponent(raw)),{signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'상품을 불러오지 못했어요.');
  if(serial!==requestNumber||inputLink()!==raw)return false;
  loadedUrl=raw;loadedProduct=data;for(const id of ['name','price','facts','images','audience','angle','customOccasion'])$(id).value='';
  $('name').value=data.name;$('price').value=data.price;$('images').value=data.images.join('\n');$('photoCount').value='3';syncPhotoOptions();$('category').value='auto';$('age').value='auto';$('occasion').value='auto';
  const generic=/큐레이터 추천 상품|지금 카카오톡 선물하기에서/.test(data.description);$('facts').value=[generic?'':data.description,...(data.productFacts||[]),data.detailText||''].filter(Boolean).join('\n');
  $('productDetails').open=false;syncOccasion();
  $('importStatus').textContent=`${data.name} · ${data.price||'가격 미표시'} · ${`상품 사진 ${data.images.length}장`} 불러왔어요.`;
  $('status').textContent='상품을 불러왔어요. 추천 글 만들기를 누르면 이 상품으로 작성됩니다.';$('rationale').textContent='불러온 상품으로 추천 글을 만들 수 있어요.';
  window.dispatchEvent(new Event('product-loaded'));return true;
 }catch(error){if(serial!==requestNumber)return false;loadedUrl='';for(const id of ['name','price','facts','images'])$(id).value='';$('importStatus').textContent=error.name==='TimeoutError'?'상품 응답이 늦어지고 있어요. 다시 불러와주세요.':error.message==='Failed to fetch'?'상품 정보를 가져오지 못했어요. 연결을 확인하고 다시 시도해주세요.':error.message;clearResult('상품을 불러오지 못했어요. 주소를 확인하고 다시 시도해주세요.');return false}
 finally{if(serial===requestNumber){loading=false;$('load').disabled=false;$('load').textContent='상품 불러오기';$('generate').disabled=false}}
}
function syncPhotoOptions(){const count=Math.min(3,new Set($('images').value.split('\n').map(x=>x.trim()).filter(Boolean)).size),old=Number($('photoCount').value)||3;$('photoCount').replaceChildren();for(let n=count;n>=1;n--){const option=document.createElement('option');option.value=n;option.textContent=n+'장';$('photoCount').append(option)}if(!count){const o=document.createElement('option');o.value=0;o.textContent='가져온 사진 없음';$('photoCount').append(o)}$('photoCount').value=String(Math.min(old,count));$('photoCount').disabled=!count;return count}
function imageSet(){const urls=[...new Set($('images').value.split('\n').map(x=>x.trim()).filter(Boolean))];if(!urls.length)return [];if(urls.some(x=>!safeImage(x)))throw new Error('상세페이지 사진 주소를 1장 이상 넣어주세요. https:// 주소를 사용해주세요.');return urls.slice(0,Number($('photoCount').value)).map(src=>({src,alt:$('name').value+' 상품 사진'}))}
function syncOccasion(){const value=$('occasion').value;$('occasionHelp').textContent=value==='auto'?'받는 사람과 선물 고르는 이유가 한 흐름으로 이어지게 써요.':value==='직접'?'적어주신 상황을 글의 출발점으로 사용해요.':sceneFor(value)?.hint||'상품의 쓰임과 선택한 상황을 함께 생각해요.';$('customOccasionWrap').hidden=value!=='직접'}
function exportText(){return postForMode(current).replaceAll(DISCLOSURE,'').replace(/(^|\n)(https:\/\/gift-link\.kakao\.com\/c\/[^\s]+)/g,'$1카카오톡 선물하기 : $2').replace(/\n{3,}/g,'\n\n').trim()}
function updateCount(){
 const text=exportText();
 const count=Array.from(text).length;
 const body=text.replace(/^카카오톡 선물하기\s*:\s*https?:\/\/\S+\s*$/gm,'').trim().replace(/\r?\n/g,'');
 const bodyCount=Array.from(body).length;
 const target=Number(current?.targetLength||$('targetLength').value||100);
 $('textCount').textContent=`본문 ${bodyCount}자 · 목표 ${target}자 / 링크 포함 ${count}자`;
 $('lengthHelp').textContent=count>500?'게시 전 본문 길이를 확인해주세요.':Math.abs(bodyCount-target)>target*.1?'선택한 글자 수보다 차이가 있어요. 본문을 직접 다듬을 수 있어요.':'공백 포함 · 줄바꿈과 링크 제외 기준이에요.';
 $('textCount').classList.toggle('over',count>500);
}
const preparedPhotos=new Map();
function preparePhoto(photo){
 const key=JSON.stringify(photo);if(preparedPhotos.has(key))return preparedPhotos.get(key);
 const job=(async()=>{
  const source=new URL(photo.src,location.href);const imageUrl=source.hostname==='st.kakaocdn.net'?apiUrl('/api/image?url='+encodeURIComponent(photo.src)):photo.src;const img=new Image();if(new URL(imageUrl,location.href).origin!==location.origin)img.crossOrigin='anonymous';
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('timeout')),15000);img.onload=()=>{clearTimeout(timer);resolve()};img.onerror=()=>{clearTimeout(timer);reject(new Error('image'))};img.src=imageUrl});
  const width=1600,sourceHeight=photo.h||img.naturalHeight,contentHeight=Math.round(sourceHeight*width/img.naturalWidth);
  const canvas=document.createElement('canvas'),padding=28;canvas.width=width;const ctx=canvas.getContext('2d');ctx.font='24px "Malgun Gothic", sans-serif';const fontSize=Math.min(24,24*(width-padding*2)/ctx.measureText(DISCLOSURE).width);const footerHeight=Math.ceil(fontSize+padding*2);
  canvas.height=contentHeight+footerHeight;ctx.fillStyle='#fff';ctx.fillRect(0,0,width,canvas.height);ctx.drawImage(img,0,photo.y||0,img.naturalWidth,sourceHeight,0,0,width,contentHeight);
  ctx.fillStyle='#505050';ctx.font=`${fontSize}px "Malgun Gothic", sans-serif`;ctx.textBaseline='middle';ctx.fillText(DISCLOSURE,padding,contentHeight+footerHeight/2);
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('encode')),'image/jpeg',.95));
  return URL.createObjectURL(blob);
 })();preparedPhotos.set(key,job);job.catch(()=>preparedPhotos.delete(key));return job;
}
function render(){
 if(!current)return;syncPhotoOptions();const selling=!current.posts||current.mode==='recommend';$('photoSection').hidden=!selling;$('productLink').hidden=!selling;
 document.querySelectorAll('[data-kind]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.kind===(current.mode||'recommend')));b.disabled=!current.posts});
 $('modeHint').textContent=selling?'상품을 고른 이유와 링크 · 제품 사진 함께 첨부':'생활 주제로 대화하는 글 · 상품명, 구매 링크, 제품 사진 없이 복사';
 $('copyBtn').disabled=Boolean(current.dirty);$('save').disabled=Boolean(current.dirty);$('post').replaceChildren();$('photoDownloads').replaceChildren();$('rationale').textContent=current.rationale+(current.provider?' · '+current.provider+' / '+current.model:' · 과거 저장 초안');syncOccasion();
 const ta=document.createElement('textarea');ta.id='copyText';ta.className='posttext';ta.setAttribute('aria-label','스레드에 복사할 전체 글');ta.value=exportText();
 ta.addEventListener('input',()=>{if(current.posts)current.posts[current.mode]=ta.value;else current.postText=ta.value;resize(ta);updateCount()});$('post').appendChild(ta);updateCount();
 (selling?current.photos:[]).forEach((photo,i)=>{
  const figure=document.createElement('figure'),frame=document.createElement('div'),img=document.createElement('img');figure.className='productphoto';frame.className='photowindow';
  img.alt=photo.alt+' · 하단 수수료 안내 포함';frame.textContent='안내 문구를 사진에 넣고 있어요…';figure.appendChild(frame);
  const button=document.createElement('button');button.textContent=`사진 ${i+1} 저장`;button.disabled=true;figure.appendChild(button);
  const label=document.createElement('small');label.textContent='사진 안에 안내 문구 포함';figure.appendChild(label);$('photoDownloads').appendChild(figure);
  preparePhoto(photo).then(url=>{frame.replaceChildren(img);img.src=url;button.disabled=false;button.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=`gift-photo-disclosed-${i+1}.jpg`;a.click();$('photoStatus').textContent=`안내 문구가 들어간 사진 ${i+1} 다운로드를 시작했어요.`}}).catch(()=>{frame.className='photo-error';frame.textContent='사진을 불러오지 못해 안내 문구를 넣지 못했어요. 사진 주소를 확인해주세요.';label.textContent='저장 준비 실패'});
 });
 $('productLink').textContent='원본 상품 링크 확인 ↗';$('productLink').href=current.link;$('sourcePhoto').hidden=true;
 $('copyStatus').textContent=selling?'추천 글과 링크만 복사됩니다. 수수료 안내는 아래 사진 안에 자동 삽입됩니다.':'선택한 글만 복사됩니다. 구매 링크와 제품 사진은 붙이지 않습니다.';
 $('photoStatus').textContent=current.photos.length?`수집된 사진 ${$('images').value.split('\n').filter(Boolean).length}장 중 ${current.photos.length}장을 준비했어요. 각 사진 하단에 수수료 안내가 한 줄로 포함됩니다.`:'가져온 사진이 없어요. 상품 정보에서 사진 주소를 추가할 수 있습니다.';requestAnimationFrame(()=>resize(ta));
}
async function generate(){
 if(loading||generating)return;if(inputLink()!==loadedUrl||!loadedUrl){if(!await loadProduct())return}
 if(!loadedProduct){$('status').textContent='상품을 다시 불러와주세요.';return}
 const controller=new AbortController();generationController=controller;generating=true;
 const input=Object.fromEntries(['facts','age','occasion','customOccasion','targetLength'].map(id=>[id,$(id).value]));const link=loadedUrl,serial=requestNumber;
 const previous=current;const button=$('generate');button.disabled=true;$('regenerate').disabled=true;button.textContent='Gemini가 작성 중…';$('post').setAttribute('aria-busy','true');
 let timeout=setTimeout(()=>controller.abort('timeout'),150000);
 try{
  const status=await writerStatus(controller.signal);updateAiStatus(status);
  if(!status.configured)throw new Error('Gemini 무료 연결 설정을 확인해야 합니다.');
  if(!status.connected){showConnection();throw new Error('먼저 작업실 연결 코드를 입력해주세요. API 키는 서버에서만 사용합니다.')}
  const {visuals,failures}=await prepareVisuals(loadedProduct,controller.signal,message=>{$('status').textContent=message});
  $('status').textContent='Gemini가 상품 사진과 설명을 읽고, 글의 흐름을 다듬고 있어요…';
  const result=await requestGiftPosts({...input,link,visuals,recentDrafts},controller.signal);
  if(controller.signal.aborted||serial!==requestNumber||inputLink()!==link)return;
  if(['facts','age','occasion','customOccasion','targetLength'].some(id=>$(id).value!==input[id])){$('status').textContent='작성 중 선택이 바뀌었어요. 다시 만들기를 눌러주세요.';return}
  const photos=imageSet();current={...result,mode:'recommend',sections:[result.posts.recommend],photos,link,title:loadedProduct.name};
  recentDrafts.push(result.posts.recommend);if(recentDrafts.length>2)recentDrafts.shift();render();window.dispatchEvent(new Event('content-ready'));
  $('status').textContent=`Gemini가 새로 작성했어요 · 상품 사진 ${result.visualSegments}개 구간 참고`+(failures.length?' · 일부 사진은 읽지 못해 제외했어요.':'');
 }catch(error){
  if(serial!==requestNumber||inputLink()!==link)return;
  if(error.code==='AUTH_REQUIRED')showConnection();
  $('status').textContent=error.name==='AbortError'?'작성이 중단됐어요. 다시 만들기를 눌러주세요.':error.message;
  if(previous&&current===previous)$('status').textContent+=' 기존 초안은 그대로 남아 있습니다.';
 }finally{clearTimeout(timeout);generating=false;generationController=null;button.disabled=loading;$('regenerate').disabled=false;button.textContent='Gemini로 글 만들기 →';$('post').removeAttribute('aria-busy')}
}
function updateAiStatus(status){$('aiConnectionState').textContent=!status.configured?'Gemini 설정 확인 필요':status.connected?'Gemini 무료 연결됨':'Gemini · 작업실 연결 필요';$('aiConnectionState').dataset.connected=String(status.configured&&status.connected)}
function showConnection(){$('aiConnectionDialog').showModal();$('writerConnectionCode').focus()}
$('aiConnect').onclick=showConnection;$('aiConnectionClose').onclick=()=>$('aiConnectionDialog').close();
$('aiConnectionForm').onsubmit=async event=>{event.preventDefault();const value=$('writerConnectionCode').value;if(!value.trim())return;$('aiConnectionMessage').textContent='연결 확인 중…';connectWriter(value,$('rememberWriterConnection').checked);try{const status=await writerStatus();updateAiStatus(status);if(!status.configured)throw new Error('서버의 Gemini 무료 연결 설정을 확인해야 합니다.');if(!status.connected)throw new Error('연결 코드가 맞지 않습니다.');$('writerConnectionCode').value='';$('aiConnectionDialog').close();$('status').textContent='Gemini 연결을 확인했어요. 글 만들기를 눌러주세요.'}catch(error){disconnectWriter();$('aiConnectionMessage').textContent=error.message}};
writerStatus().then(updateAiStatus).catch(()=>{$('aiConnectionState').textContent='Gemini 연결 확인 필요'});
$('load').onclick=loadProduct;$('generate').onclick=generate;
$('url').addEventListener('input',()=>{if(inputLink()!==loadedUrl){generationController?.abort();clearResult('새 주소를 입력했어요. 불러오기를 눌러주세요.')}});
$('url').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();loadProduct().then(ok=>{if(ok)window.dispatchEvent(new Event('product-loaded'))})}});
for(const id of fields.filter(id=>id!=='url'&&id!=='photoCount'))$(id).addEventListener('input',()=>{if(current){current.dirty=true;$('copyBtn').disabled=true;$('save').disabled=true;$('status').textContent='입력이 바뀌었어요. 추천 글 만들기를 눌러 반영해주세요.'}});
$('copyBtn').onclick=async()=>{if(!current){$('status').textContent='먼저 상품 글을 만들어주세요.';return}try{await navigator.clipboard.writeText(exportText());$('copyStatus').textContent=current.posts&&current.mode!=='recommend'?'복사 완료! 선택한 글만 스레드에 붙여넣으세요.':'복사 완료! 스레드에 붙여넣고 아래 사진을 따로 첨부해주세요.'}catch{$('copyText').focus();$('copyText').select();$('copyStatus').textContent='글을 선택했어요. Ctrl+C로 복사해주세요.'}};
$('save').onclick=()=>{if(!current){$('status').textContent='먼저 상품 글을 만들어주세요.';return}const draft={...structuredClone(current),fields:Object.fromEntries(fields.map(id=>[id,$(id).value])),date:new Date().toLocaleString('ko-KR')};try{const next=[draft,...drafts].slice(0,30);localStorage.setItem('gift-note-drafts-v2',JSON.stringify(next));drafts=next;$('count').textContent=drafts.length;$('status').textContent='수정한 글과 사진 구성을 이 브라우저에 저장했어요.'}catch{$('status').textContent='저장 공간을 사용할 수 없어요. 글 복사를 이용해주세요.'}};
$('saved').onclick=()=>{$('history').hidden=false;$('historylist').replaceChildren();if(!drafts.length)$('historylist').textContent='아직 저장한 초안이 없어요.';drafts.forEach(d=>{const b=document.createElement('button');b.textContent=d.title+' · '+d.date;b.onclick=()=>{for(const id of fields)$(id).value=d.fields[id]||(id==='targetLength'?'100':'');loadedUrl=d.link;current=structuredClone(d);render();$('history').hidden=true;$('rationale').scrollIntoView({behavior:'smooth'});$('importStatus').textContent=d.title+' · 저장된 상품 정보';$('status').textContent='저장한 글과 사진을 불러왔어요.'};$('historylist').appendChild(b)});$('history').scrollIntoView({behavior:'smooth'})};$('closeHistory').onclick=()=>{$('history').hidden=true};$('occasion').addEventListener('change',syncOccasion);window.addEventListener('resize',()=>document.querySelectorAll('.posttext').forEach(resize));$('url').value='';clearResult('상품 링크를 넣어 시작해보세요.');


document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{if(!current?.posts)return;current.mode=button.dataset.kind;render()});

$('photoCount').addEventListener('change',()=>{if(current){current.photos=imageSet();render();}});
$('images').addEventListener('input',syncPhotoOptions);
