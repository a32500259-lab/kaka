import {sceneFor} from './scene-options.js?v=gemini8';
import {requestDailyPost} from './ai-client.js?v=gemini8';
import {apiUrl,writerStatus,connectWriter,disconnectWriter,hasWriterConnection,prepareVisuals,requestGiftPosts} from './ai-client.js?v=gemini8';
const postForMode=current=>current?.posts?current.posts[current.mode||'recommend']||'':current?.postText??[...(current?.sections||[]),current?.link].filter(Boolean).join('\n\n');
const $=id=>document.getElementById(id);
const DISCLOSURE='이 포스팅은 선물하기 큐레이터 활동의 일환으로, 주문 발생 시 일정액의 수수료를 제공받습니다.';
const fields=['url','name','category','price','facts','images','age','occasion','audience','angle','photoCount','customOccasion','targetLength'];
let loadedUrl='',current=null,drafts=[],loadedProduct=null,generating=false,generationController=null;const recentDrafts=[];let collectedThreads=[];const selectedReferenceIds=new Set();let photoCandidates=[],selectedPhotoSources=new Set();
try{drafts=JSON.parse(localStorage.getItem('gift-note-drafts-v2')||'[]');if(!Array.isArray(drafts))drafts=[]}catch{}
$('count').textContent='0';
let cloudApi=null,cloudFailure='',remoteThreads=[],extensionThreadsReady=false;const pendingThreadDeletes=new Map();
const cloudApiReady=import('./firebase-store.js?v=firebase-save-1').then(async api=>{await api.initializeCloud();cloudApi=api;$('cloudStatus').textContent='☁ 클라우드 저장 연결됨';$('cloudStatus').title='이 브라우저의 익명 Firebase 계정에 저장합니다. 다른 기기 공유는 로그인 연결 후 사용할 수 있어요.';return api}).catch(error=>{cloudFailure=error?.message||'연결할 수 없습니다';$('cloudStatus').textContent='☁ 브라우저 저장만 사용 중';$('cloudStatus').title='Firebase 연결 실패: '+cloudFailure;return null});
function cloudIdFor(kind,item){if(item?.id&&kind==='collectedThreads')return String(item.id);if(item?.cloudId)return String(item.cloudId);const signature=kind==='dailyDrafts'?`${item?.date||''}|${item?.output||''}|${item?.source||''}`:`${item?.date||''}|${item?.body||item?.postText||item?.posts?.recommend||''}|${item?.link||''}`;let hash=2166136261;for(const char of signature){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return `${kind}-${(hash>>>0).toString(36)}`}
const deletedDraftsKey='gift-note-deleted-drafts';
const deletedThreadsKey='gift-note-deleted-collected-threads';
function deletedIds(key){
 try{
  const ids=JSON.parse(localStorage.getItem(key)||'[]');
  return new Set(Array.isArray(ids)?ids:[]);
 }catch{return new Set()}
}
function mergeCloudItems(kind,...groups){const seen=deletedIds(kind==='collectedThreads'?deletedThreadsKey:deletedDraftsKey),merged=[];for(const group of groups)for(const raw of group||[]){if(!raw||typeof raw!=='object')continue;const item={...raw};if(kind!=='collectedThreads')item.cloudId=cloudIdFor(kind,item);const key=cloudIdFor(kind,item);if(seen.has(key))continue;seen.add(key);merged.push(item)}return merged}
function storeLocalSnapshot(kind,items){if(kind==='productDrafts'){localStorage.setItem('gift-note-drafts-v2',JSON.stringify(items));drafts=items}else if(kind==='dailyDrafts'){localStorage.setItem(dailyArchiveKey,JSON.stringify(items));dailyDrafts=items}}
const draftCloudWrites=new Map();
function writeCloudSnapshot(kind,items){
 const prior=draftCloudWrites.get(kind)||Promise.resolve();
 const write=prior.catch(()=>{}).then(async()=>{
  const api=await cloudApiReady;
  if(!api)throw new Error(cloudFailure||'Firebase 연결을 사용할 수 없어요.');
  const stored=await api.readSnapshot(kind);
  await api.writeSnapshot(kind,mergeCloudItems(kind,items,stored));
 });
 draftCloudWrites.set(kind,write);
 return write;
}
async function hydrateCloud(){const api=await cloudApiReady;if(!api)return;try{const [remoteProducts,remoteDaily,threads]=await Promise.all([api.readSnapshot('productDrafts'),api.readSnapshot('dailyDrafts'),api.readSnapshot('collectedThreads')]);const mergedProducts=mergeCloudItems('productDrafts',drafts,remoteProducts),mergedDaily=mergeCloudItems('dailyDrafts',dailyDrafts,remoteDaily);drafts=mergedProducts;dailyDrafts=mergedDaily;storeLocalSnapshot('productDrafts',drafts);storeLocalSnapshot('dailyDrafts',dailyDrafts);remoteThreads=mergeCloudItems('collectedThreads',threads);collectedThreads=mergeCloudItems('collectedThreads',collectedThreads,remoteThreads);$('archiveCount').textContent='저장한 글 '+(archiveKind==='daily'?dailyDrafts:drafts).length+'개';if(!$('draftArchive').hidden)renderArchive();renderCollectedThreads();await Promise.all([writeCloudSnapshot('productDrafts',drafts),writeCloudSnapshot('dailyDrafts',dailyDrafts)]);$('cloudStatus').textContent='☁ 클라우드 저장 완료'}catch(error){cloudFailure=error?.message||'Firebase 저장 자료를 읽지 못했어요';$('cloudStatus').textContent='☁ 클라우드 동기화 오류';$('cloudStatus').title=cloudFailure}}
let collectedCloudWrite=Promise.resolve();
function saveCollectedThreads(items,removedIds=[]){
 const removed=new Set(removedIds.map(String));
 const keep=item=>!removed.has(String(item?.id));
 remoteThreads=remoteThreads.filter(keep);
 collectedThreads=mergeCloudItems('collectedThreads',collectedThreads.filter(keep),remoteThreads,items.filter(keep));
 const validIds=new Set(collectedThreads.map(post=>post.id));
 for(const id of selectedReferenceIds)if(!validIds.has(id))selectedReferenceIds.delete(id);
 renderCollectedThreads();
 collectedCloudWrite=collectedCloudWrite.catch(()=>{}).then(async()=>{
  const api=await cloudApiReady;
  if(!api)throw new Error(cloudFailure||'Firebase 연결을 사용할 수 없어요.');
  const stored=await api.readSnapshot('collectedThreads');
  remoteThreads=mergeCloudItems('collectedThreads',stored.filter(keep),items.filter(keep));
  await api.writeSnapshot('collectedThreads',remoteThreads);
  collectedThreads=mergeCloudItems('collectedThreads',collectedThreads,remoteThreads);
  renderCollectedThreads();
  $('collectionStatus').textContent='수집목록을 클라우드에 반영했어요.';
  delete $('collectionStatus').dataset.error;
 }).catch(error=>{
  $('collectionStatus').textContent='이 브라우저의 목록은 갱신했어요. 클라우드에는 사이트를 다시 열 때 동기화를 시도합니다.';
  $('collectionStatus').dataset.error='true';
  $('collectionStatus').title=error.message;
 });
}
function validLink(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='gift-link.kakao.com'&&!u.username&&!u.password&&/^\/c\/[a-zA-Z0-9]+\/?$/.test(u.pathname)}catch{return false}}
function safeImage(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
function resize(t){t.style.height='auto';t.style.height=t.scrollHeight+4+'px'}
let requestNumber=0,loading=false;
function inputLink(){const text=$('url').value.trim();return text.match(/https:\/\/gift-link\.kakao\.com\/c\/[a-zA-Z0-9]+(?:\?[^\s<>\]\)]+)?/)?.[0]||text}
function clearResult(message){current=null;$('post').replaceChildren();const placeholder=document.createElement('textarea');placeholder.id='copyText';placeholder.className='posttext';placeholder.setAttribute('aria-label','스레드에 복사할 전체 글');placeholder.placeholder='상품을 불러오고 글 만들기를 눌러주세요.';$('post').append(placeholder);$('photoDownloads').replaceChildren();$('textCount').textContent='';$('lengthHelp').textContent='';$('copyStatus').textContent='';$('photoStatus').textContent='';$('productLink').removeAttribute('href');$('productLink').textContent='';$('rationale').textContent=message;$('copyBtn').disabled=true;$('save').disabled=true;$('sourcePhoto').hidden=true;updatePhonePreview()}
async function loadProduct(){
 generationController?.abort();const raw=inputLink(),serial=++requestNumber;loadedProduct=null;photoCandidates=[];selectedPhotoSources.clear();renderPhotoChoices();syncPhotoOptions();updatePhotoSelectionUi();syncGenerationContext();
 if(!validLink(raw)){loading=false;loadedUrl='';$('load').disabled=false;$('load').textContent='상품 불러오기';$('generate').disabled=false;$('importStatus').textContent='카카오 큐레이터 링크를 넣어주세요. 공유 문구 전체를 붙여넣어도 됩니다.';clearResult('올바른 상품 주소를 기다리고 있어요.');return false}
 $('url').value=raw;loading=true;$('load').disabled=true;$('load').textContent='불러오는 중…';$('generate').disabled=true;clearResult('새 상품 정보를 가져오고 있어요.');$('status').textContent='';$('importStatus').textContent='카카오 상품명·가격·사진을 확인하고 있어요.';
 try{
  const response=await fetch(apiUrl('/api/product?url='+encodeURIComponent(raw)),{signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'상품을 불러오지 못했어요.');
  if(serial!==requestNumber||inputLink()!==raw)return false;
  loadedUrl=raw;loadedProduct=data;syncGenerationContext();for(const id of ['name','price','facts','images','audience','angle','customOccasion'])$(id).value='';
  $('name').value=data.name;$('price').value=data.price;$('images').value=data.images.join('\n');$('category').value='auto';$('age').value='auto';$('occasion').value='auto';setPhotoCandidates(data);renderPhotoChoices();
  const generic=/큐레이터 추천 상품|지금 카카오톡 선물하기에서/.test(data.description);$('facts').value=[generic?'':data.description,...(data.productFacts||[]),data.detailText||''].filter(Boolean).join('\n');
  $('productDetails').open=false;syncOccasion();
  $('importStatus').textContent=`${data.name} · 원문 사진 후보 ${photoCandidates.length}장${data.partial?' · 일부 정보는 확인되지 않았어요':''}`;
  $('status').textContent='상품을 불러왔어요. 추천 글 만들기를 누르면 이 상품으로 작성됩니다.';$('rationale').textContent='불러온 상품으로 추천 글을 만들 수 있어요.';
  window.dispatchEvent(new Event('product-loaded'));return true;
 }catch(error){if(serial!==requestNumber)return false;loadedUrl='';for(const id of ['name','price','facts','images'])$(id).value='';$('importStatus').textContent=error.name==='TimeoutError'?'상품 응답이 늦어지고 있어요. 다시 불러와주세요.':error.message==='Failed to fetch'?'상품 정보를 가져오지 못했어요. 연결을 확인하고 다시 시도해주세요.':error.message;clearResult('상품을 불러오지 못했어요. 주소를 확인하고 다시 시도해주세요.');return false}
 finally{if(serial===requestNumber){loading=false;$('load').disabled=false;$('load').textContent='상품 불러오기';$('generate').disabled=false}}
}
function setPhotoCandidates(product){const gallery=(product?.images||[]).filter(safeImage).map(src=>({src,alt:$('name').value+' 상품 메인 사진'}));const manual=$('images').value.split('\n').map(src=>src.trim()).filter(safeImage).map(src=>({src,alt:$('name').value+' 상품 메인 사진'}));const unique=new Map();for(const item of [...gallery,...manual])if(!unique.has(item.src))unique.set(item.src,item);photoCandidates=[...unique.values()].slice(0,3);selectedPhotoSources=new Set([...selectedPhotoSources].filter(src=>photoCandidates.some(x=>x.src===src)));if(!selectedPhotoSources.size&&photoCandidates.length)selectedPhotoSources.add(photoCandidates[0].src);syncPhotoOptions();updatePhotoSelectionUi()}
function syncPhotoOptions(){const count=photoCandidates.length;const selected=selectedPhotoSources.size;$('photoCount').replaceChildren();for(let n=0;n<=3;n++){const option=document.createElement('option');option.value=String(n);option.textContent=n+'장';$('photoCount').append(option)}$('photoCount').value=String(selected);$('photoCount').disabled=!count;return count}
function imageSet(){const urls=[...selectedPhotoSources];if(urls.length>3)throw new Error('사진은 최대 3장까지 선택할 수 있어요.');if(urls.some(x=>!safeImage(x)))throw new Error('상품 메인 사진 주소를 확인해주세요. https:// 주소를 사용해주세요.');return urls.map(src=>photoCandidates.find(x=>x.src===src)||({src,alt:$('name').value+' 상품 사진'}))}
function updatePhotoSelectionUi(){const selected=selectedPhotoSources.size;$('photoSelectionCount').textContent=`${selected}/3`;$('selectedPhotoLabel').textContent=selected?`${selected}장 선택`:'선택 전';$('photoSectionSummary').textContent=selected?`선택한 사진 저장 · ${selected}장`:'선택한 사진 저장';$('photoStatus').textContent=photoCandidates.length?`상품 메인 사진 ${photoCandidates.length}장 · 체크한 사진을 글 생성에 먼저 읽혀요 · 저장 파일에는 수수료 안내를 넣습니다.`:'상품 링크를 불러오면 메인 페이지 사진이 이곳에 보여요.';$('applyInlinePhotos').disabled=!selected;$('applyInlinePhotos').textContent=selected?`선택한 사진 추가 · ${selected}장`:'사진을 체크해주세요';updatePhonePreview()}
function renderPhotoChoices(){
 const root=$('photoPreviewList');if(!root)return;root.replaceChildren();
 if(!photoCandidates.length){const empty=document.createElement('p');empty.className='photo-preview-empty';empty.textContent='상품 링크를 불러오면 메인 사진이 여기에 최대 3장 보여요.';root.append(empty);return}
 photoCandidates.forEach((photo,index)=>{
  const card=document.createElement('article');card.className='inline-photo-choice';
  const label=document.createElement('label');label.className='inline-photo-check';
  const check=document.createElement('input');check.type='checkbox';check.checked=selectedPhotoSources.has(photo.src);check.setAttribute('aria-label',`상품 사진 ${index+1} 선택`);
  const tick=document.createElement('span');tick.setAttribute('aria-hidden','true');label.append(check,tick);
  const image=document.createElement('img');image.alt=`카카오 선물하기 메인 사진 ${index+1} · 하단 안내 문구 포함`;image.loading='lazy';image.src=apiUrl('/api/image?url='+encodeURIComponent(photo.src));
  image.onerror=()=>{image.alt='사진 미리보기를 불러오지 못했습니다';image.classList.add('image-load-error')};
  const caption=document.createElement('span');caption.className='inline-photo-caption';caption.textContent=`메인 사진 ${index+1}`;label.append(image,caption);
  const save=document.createElement('button');save.type='button';save.className='inline-photo-save';save.textContent='PC 다운로드 준비 중…';save.disabled=true;
  preparePhoto(photo).then(url=>{save.dataset.downloadUrl=url;image.src=url;save.disabled=false;save.textContent='PC에 이미지 저장'}).catch(()=>{save.textContent='저장 준비 실패';$('photoStatus').textContent=`사진 ${index+1}에 안내 문구를 넣지 못했어요. 다시 상품을 불러와주세요.`});
  save.addEventListener('click',()=>{
   const url=save.dataset.downloadUrl;if(!url){$('photoStatus').textContent=`사진 ${index+1} 저장 준비가 끝나지 않았어요.`;return}
   const anchor=document.createElement('a');anchor.href=url;anchor.download=`gift-photo-disclosed-${index+1}.jpg`;anchor.style.display='none';document.body.append(anchor);anchor.click();anchor.remove();
   $('photoStatus').textContent=`사진 ${index+1}을 PC 다운로드 폴더에 저장하기 시작했어요. 안내 문구는 사진 하단에 들어갔습니다.`;
  });
  card.append(label,save);
  check.addEventListener('change',()=>{if(check.checked&&selectedPhotoSources.size>=3){check.checked=false;$('photoStatus').textContent='사진은 최대 3장까지 선택할 수 있어요.';return}if(check.checked)selectedPhotoSources.add(photo.src);else selectedPhotoSources.delete(photo.src);card.classList.toggle('is-selected',check.checked);syncPhotoOptions();updatePhotoSelectionUi()});
  card.classList.toggle('is-selected',check.checked);root.append(card);
 });
}
function applyInlinePhotoSelection(){if(!selectedPhotoSources.size){$('photoStatus').textContent='사진을 1장 이상 체크해주세요.';return}if(current){current.photos=imageSet();render()}$('status').textContent=`상품 메인 사진 ${selectedPhotoSources.size}장을 추가했어요. 각 사진 하단에는 수수료 안내가 들어갑니다.`;$('photoStatus').textContent=`사진 ${selectedPhotoSources.size}장을 추가했어요 · Gemini가 이 사진을 읽고 초안을 작성합니다.`}
function updatePhonePreview(){const link=$('phoneLink');if(link)link.hidden=true;const text=$('phoneText');if(text)text.textContent=exportText()||'상품을 불러오고 글을 만들면 Threads 미리보기가 여기에 보여요.';const photos=$('phonePhotos');if(!photos)return;photos.replaceChildren();const selected=imageSetSafe();selected.slice(0,3).forEach(photo=>{const img=document.createElement('img');img.alt=photo.alt;img.src=apiUrl('/api/image?url='+encodeURIComponent(photo.src));photos.append(img)})}
function imageSetSafe(){try{return imageSet()}catch{return []}}
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
  const imageUrl=apiUrl('/api/image?url='+encodeURIComponent(photo.src));
  // The display image may be cached from a request without CORS headers.
  const response=await fetch(imageUrl,{mode:'cors',cache:'reload',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error('사진 응답 오류 '+response.status);
  const sourceUrl=URL.createObjectURL(await response.blob());
  const img=new Image();
  try{img.src=sourceUrl;await img.decode()}finally{URL.revokeObjectURL(sourceUrl)}
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
 $('modeHint').textContent=selling?'상품을 고른 이유와 링크 · 제품 사진 함께 첨부':'생활 주제로 대화하는 글 · 상품 링크와 제품 사진 없이 복사';
 $('copyBtn').disabled=Boolean(current.dirty);$('save').disabled=Boolean(current.dirty);$('post').replaceChildren();$('photoDownloads').replaceChildren();$('rationale').textContent=current.rationale+(current.provider?' · '+current.provider+' / '+current.model:' · 과거 저장 초안');syncOccasion();
 const ta=document.createElement('textarea');ta.id='copyText';ta.className='posttext';ta.setAttribute('aria-label','스레드에 복사할 전체 글');ta.value=exportText();
 ta.addEventListener('input',()=>{if(current.posts)current.posts[current.mode]=ta.value;else current.postText=ta.value;resize(ta);updateCount();updatePhonePreview()});$('post').appendChild(ta);updateCount();
 (selling?current.photos:[]).forEach((photo,i)=>{
  const figure=document.createElement('figure'),frame=document.createElement('div'),img=document.createElement('img');figure.className='productphoto';frame.className='photowindow';
  img.alt=photo.alt+' · 하단 수수료 안내 포함';frame.textContent='안내 문구를 사진에 넣고 있어요…';figure.appendChild(frame);
  const button=document.createElement('button');button.textContent=`사진 ${i+1} 저장`;button.disabled=true;figure.appendChild(button);
  const label=document.createElement('small');label.textContent='사진 안에 안내 문구 포함';figure.appendChild(label);$('photoDownloads').appendChild(figure);
  preparePhoto(photo).then(url=>{frame.replaceChildren(img);img.src=url;button.disabled=false;button.onclick=()=>{const a=document.createElement('a');a.href=url;a.download=`gift-photo-disclosed-${i+1}.jpg`;a.click();$('photoStatus').textContent=`안내 문구가 들어간 사진 ${i+1} 다운로드를 시작했어요.`}}).catch(()=>{frame.className='photo-error';frame.textContent='사진을 불러오지 못해 안내 문구를 넣지 못했어요. 사진 주소를 확인해주세요.';label.textContent='저장 준비 실패'});
 });
 $('productLink').textContent='원본 상품 링크 확인 ↗';$('productLink').href=current.link;$('sourcePhoto').hidden=true;
 $('copyStatus').textContent='';
 $('photoStatus').textContent=current.photos.length?`상품 메인에서 고른 ${current.photos.length}장 · 저장 파일 하단에 수수료 안내를 한 줄로 넣어요.`:'이미지 추가를 눌러 상품 메인 사진을 최대 3장 불러오세요.';updatePhonePreview();requestAnimationFrame(()=>resize(ta));
}
async function generate(){
 if(loading||generating)return;$('status').textContent='';if(inputLink()!==loadedUrl||!loadedUrl){$('productImportOpen').click();$('status').textContent='먼저 상품 링크를 가져오면 글 작성 단계로 이동합니다.';return}
 if(!loadedProduct){$('status').textContent='상품을 다시 불러와주세요.';return}
 const controller=new AbortController();generationController=controller;generating=true;
 const input=Object.fromEntries(['facts','age','occasion','customOccasion','targetLength'].map(id=>[id,$(id).value]));const link=loadedUrl,serial=requestNumber;
 const previous=current;const button=$('generate');button.disabled=true;button.textContent='Gemini가 작성 중…';$('generationContext').textContent='상품 정보와 선택한 참고 글을 확인하고 있어요.';$('status').textContent='Gemini 연결과 상품 사진을 확인하고 있어요…';$('post').setAttribute('aria-busy','true');
 let timeout=setTimeout(()=>controller.abort('timeout'),150000);
 try{
  const status=await writerStatus(controller.signal);updateAiStatus(status);
  if(!status.configured)throw new Error('Gemini 무료 연결 설정을 확인해야 합니다.');
  if(!status.connected){showConnection();throw new Error('먼저 작업실 연결 코드를 입력해주세요. API 키는 서버에서만 사용합니다.')}
  const chosen=[...selectedPhotoSources];const mainPhotos=chosen.length?chosen:photoCandidates.map(photo=>photo.src).slice(0,3);if(!mainPhotos.length)throw new Error('상품 메인 사진이 없어 초안을 만들지 않았어요. 사진이 있는 상품을 불러와주세요.');const visualProduct={...loadedProduct,images:mainPhotos,detailImages:[]};const {visuals}=await prepareVisuals(visualProduct,controller.signal,message=>{$('status').textContent=message});
  $('status').textContent='Gemini가 상품 사진과 설명을 읽고, 글의 흐름을 다듬고 있어요…';
  const referenceThreads=referencePayload();
  $('generationContext').textContent=`참고 글 ${referenceThreads.length}개 · 후킹 → 설명 → 공감 · 가격 제외`;
  const result=await requestGiftPosts({...input,link,visuals,recentDrafts,referenceThreads},controller.signal);
  if(controller.signal.aborted||serial!==requestNumber||inputLink()!==link)return;
  if(['facts','age','occasion','customOccasion','targetLength'].some(id=>$(id).value!==input[id])){$('status').textContent='작성 중 선택이 바뀌었어요. 다시 만들기를 눌러주세요.';return}
  const photos=imageSet();current={...result,mode:'recommend',sections:[result.posts.recommend],photos,link,title:loadedProduct.name};
  recentDrafts.push(result.posts.recommend);if(recentDrafts.length>2)recentDrafts.shift();render();window.dispatchEvent(new Event('content-ready'));
  $('status').textContent=`Gemini가 상품 메인 사진 ${visualProduct.images.length}장을 확인해 새로 작성했어요 · 사진 ${result.visualSegments}개 구간${result.referenceStyle?` · 참고한 말투 · ${result.referenceStyle}`:''}`;
 }catch(error){
  if(serial!==requestNumber||inputLink()!==link)return;
  if(error.code==='AUTH_REQUIRED')showConnection();
  $('status').textContent=error.name==='AbortError'?'작성이 중단됐어요. 다시 만들기를 눌러주세요.':error.message;
  if(previous&&current===previous)$('status').textContent+=' 기존 초안은 그대로 남아 있습니다.';
 }finally{clearTimeout(timeout);generating=false;generationController=null;button.disabled=loading;button.textContent='✎ 내 글 바꾸기';$('post').removeAttribute('aria-busy');syncGenerationContext()}
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
 $('save').onclick=async()=>{if(!current){$('status').textContent='먼저 상품 글을 만들어주세요.';return}const draft={...structuredClone(current),body:exportText(),fields:Object.fromEntries(fields.map(id=>[id,$(id).value])),date:new Date().toLocaleString('ko-KR')};draft.cloudId=cloudIdFor('productDrafts',draft);try{const next=mergeCloudItems('productDrafts',[draft],drafts);storeLocalSnapshot('productDrafts',next);$('status').textContent='이 브라우저에 저장했어요. Firebase 클라우드에도 저장 중…';try{await writeCloudSnapshot('productDrafts',next);$('status').textContent='내 글 보관함과 Firebase 클라우드에 상품 초안을 저장했어요.';$('cloudStatus').textContent='☁ 클라우드 저장 완료'}catch(error){$('status').textContent='이 브라우저에는 저장했어요. Firebase 저장은 실패했어요: '+error.message;$('cloudStatus').textContent='☁ 클라우드 저장 오류';$('cloudStatus').title=error.message}if(!$('draftArchive').hidden)renderArchive()}catch{$('status').textContent='브라우저 저장 공간을 사용할 수 없어요. 글 복사를 이용해주세요.'}};
function cleanCollectedText(value) {
 const lines=String(value||'').trim().split(/\r?\n/);
 let end=lines.length;
 let numbers=0;
 let marker=false;
 while(end>0){
  const line=lines[end-1].trim();
  if(/^(?:[\d,.]+\s*(?:만|천|[KM])?|\d+\s*\/\s*\d+)$/i.test(line)){numbers++;if(line.includes('/'))marker=true}
  else if(line==='/'){marker=true}
  else if(!line||/^(?:번역하기|AI 콘텐츠)$/.test(line)){}
  else break;
  end--;
 }
 return (numbers>=2||marker?lines.slice(0,end):lines).join('\n').trim();
}
function renderCollectedThreads(){
 const root=$('historylist');root.replaceChildren();$('count').textContent=String(collectedThreads.length);
 renderReferenceSelection();renderReferenceLibrary();
 if(!collectedThreads.length){root.textContent='아직 수집한 글이 없어요. Chrome에서 Threads 글 옆의 수집 버튼을 누르면 여기에 나타납니다.';return}
 const query=$('collectionSearch').value.trim().toLocaleLowerCase();
 const matches=collectedThreads.filter(post=>[post.author,post.text].some(value=>String(value||'').toLocaleLowerCase().includes(query)));
 if(!matches.length){root.textContent='검색에 맞는 수집글이 없어요.';return}
 for(const post of matches){
  const card=document.createElement('article');card.className='collected-thread';
  const head=document.createElement('div');head.className='collected-thread-head';
  const author=document.createElement('strong');author.textContent=post.author||'Threads 게시물';
  const date=document.createElement('time');date.textContent=post.collectedAt?new Date(post.collectedAt).toLocaleString('ko-KR'):(post.date||'');
  head.append(author,date);
  const text=document.createElement('p');text.className='collected-thread-text';text.textContent=cleanCollectedText(post.text);
  const foot=document.createElement('div');foot.className='collected-thread-foot';
  const metrics=document.createElement('span');metrics.textContent=[post.views!=null?`조회 ${post.views}`:'조회수 미표시',post.likes!=null?`좋아요 ${post.likes}`:'좋아요 미표시'].join(' · ');
  const actions=document.createElement('div');actions.className='collected-thread-actions';
  const remove=document.createElement('button');remove.type='button';remove.className='delete-collected-thread';remove.textContent='삭제';remove.disabled=!post.id;
  remove.title=post.id?'이 수집 글을 삭제합니다':'확장프로그램을 새로고침해 다시 수집하면 삭제할 수 있습니다';
  remove.addEventListener('click',()=>{if(post.id)deleteCollectedThread(post.id)});
  const use=document.createElement('button');
  use.type='button';use.textContent='참고로 사용';use.disabled=!post.id;
  use.addEventListener('click',()=>{
   if(!selectedReferenceIds.has(post.id)&&selectedReferenceIds.size>=3){$('collectionStatus').textContent='참고 글은 최대 3개까지 선택할 수 있어요. 기존 참고 글을 먼저 해제해주세요.';return}
   selectedReferenceIds.add(post.id);renderReferenceSelection();renderReferenceLibrary();
   window.dispatchEvent(new Event('collection-reference-picked'));
  });
  actions.append(use,remove);
  foot.append(metrics,actions);
  try{const u=new URL(post.url);if(u.protocol==='https:'&&/(^|\.)threads\.com$/.test(u.hostname)){const link=document.createElement('a');link.href=u.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent='원문 열기 ↗';foot.append(link)}}catch{}
  card.append(head,text,foot);root.append(card);
 }
}
function selectedReferencePosts(){return [...selectedReferenceIds].map(id=>collectedThreads.find(post=>post.id===id)).filter(post=>post&&typeof post.text==='string'&&post.text.trim()).slice(0,3)}
function referencePayload(){
 return selectedReferencePosts().map(post=>{
  const lines=cleanCollectedText(post.text).split('\n');
  const author=String(post.author||'').replace(/^@/,'');
  if(author&&lines[0]?.trim().replace(/^@/,'')===author){
   lines.shift();
   const timestamp=lines.slice(0,3).findIndex(line=>/^(?:\d+\s*(?:초|분|시간|일|주)(?:\s*전)?|\d{4}-\d{2}-\d{2})$/.test(line.trim()));
   if(timestamp>=0)lines.splice(0,timestamp+1);
  }
  return {text:lines.join('\n').trim().slice(0,1200)};
 }).filter(post=>post.text);
}
function formatDailyDraft(text){
 const sentences=new Intl.Segmenter('ko',{granularity:'sentence'});
 return text.split('\n').map(line=>{
  const segments=Array.from(sentences.segment(line),item=>item.segment.trim());
  return segments.join('\n').replace(/(\p{Extended_Pictographic}\uFE0F?)[ \t]+(?=[가-힣A-Za-z0-9])/gu,'$1\n');
 }).join('\n');
}
$('collectionSearch').addEventListener('input',renderCollectedThreads);

const dailySource=$('dailySource'),dailyOutput=$('dailyOutput'),dailyLength=$('dailyLength'),dailyStatus=$('dailyStatus');
const dailyArchiveKey='gift-note-daily-archive';
let dailyDrafts=[];
function updateDailyPreview(){
 const output=dailyOutput.value;
 $('dailyPhoneText').textContent=output||'일상글을 만들면 여기에 보여요.';
 $('dailyCount').textContent=output?Array.from(output.replace(/\r?\n/g,'')).length+'자':'';
 $('dailyCopy').disabled=$('dailySave').disabled=!output.trim();
}
try{
 const saved=JSON.parse(localStorage.getItem(dailyArchiveKey)||'null');
 const legacy=JSON.parse(localStorage.getItem('gift-note-daily-draft')||'null');
 dailyDrafts=Array.isArray(saved)?saved:legacy?.output?[legacy]:[];
 const draft=dailyDrafts[0];
 if(draft){dailySource.value=draft.source||'';dailyOutput.value=draft.output||'';dailyLength.value=draft.length||'100'}
}catch{}
updateDailyPreview();
dailyOutput.addEventListener('input',updateDailyPreview);
$('dailyGenerate').addEventListener('click',async()=>{
 const source=dailySource.value.trim();
 if(!source){dailyStatus.textContent='먼저 내 일상글이나 공감글을 적어주세요.';dailySource.focus();return}
 const button=$('dailyGenerate');
 const referenceThreads=referencePayload();
 button.disabled=dailySource.readOnly=dailyOutput.readOnly=dailyLength.disabled=true;
  dailyStatus.textContent=referenceThreads.length?`선택한 참고글 ${referenceThreads.length}개를 말투·글쓰기 0순위로 보내고 있어요.`:'선택한 참고글이 없어요. 입력한 이야기를 바탕으로 작성하고 있어요.';
 try{
  const generated=await requestDailyPost({source,targetLength:Number(dailyLength.value),referenceThreads},AbortSignal.timeout(75000));
  dailyOutput.value=formatDailyDraft(generated);
  updateDailyPreview();
   dailyStatus.textContent=referenceThreads.length?`선택한 참고글 ${referenceThreads.length}개를 0순위 말투 기준으로 요청해 작성했어요.`:'입력한 내용을 바탕으로 작성했어요.';
 }catch(error){
  dailyStatus.textContent=error.message;
  if(error.code==='AUTH_REQUIRED')showConnection();
 }finally{button.disabled=dailySource.readOnly=dailyOutput.readOnly=dailyLength.disabled=false}
});
$('dailyCopy').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(dailyOutput.value);dailyStatus.textContent='글을 복사했어요.'}
 catch{dailyOutput.focus();dailyOutput.select();dailyStatus.textContent='선택된 글을 Ctrl+C로 복사해주세요.'}
});
$('dailySave').addEventListener('click',async()=>{
 try{
  const draft={source:dailySource.value,output:dailyOutput.value,length:dailyLength.value,date:new Date().toLocaleString('ko-KR')};draft.cloudId=cloudIdFor('dailyDrafts',draft);
  const next=mergeCloudItems('dailyDrafts',[draft],dailyDrafts);
  storeLocalSnapshot('dailyDrafts',next);
  dailyStatus.textContent='이 브라우저에 저장했어요. Firebase 클라우드에도 저장 중…';
  try{await writeCloudSnapshot('dailyDrafts',next);dailyStatus.textContent='내 글 보관함과 Firebase 클라우드에 일상글을 저장했어요.';$('cloudStatus').textContent='☁ 클라우드 저장 완료'}catch(error){dailyStatus.textContent='이 브라우저에는 저장했어요. Firebase 저장은 실패했어요: '+error.message;$('cloudStatus').textContent='☁ 클라우드 저장 오류';$('cloudStatus').title=error.message}
  if(!$('draftArchive').hidden)renderArchive();
 }catch{dailyStatus.textContent='저장 공간을 사용할 수 없어요. 글 복사를 이용해주세요.'}
});
function restoreArchiveDraft(kind,draft){
 if(kind==='daily'){
  if($('dailyGenerate').disabled)return false;
  dailySource.value=draft.source||'';
  dailyOutput.value=draft.output;
  dailyLength.value=draft.length||'100';
  updateDailyPreview();
  dailyStatus.textContent='보관함에서 글을 불러왔어요.';
  document.querySelector('[data-studio="daily"]').click();
  return true;
 }
 if(loading||generating)return false;
 const defaults={category:'auto',age:'auto',occasion:'auto',targetLength:'100'};
 for(const id of fields){
  if(id!=='photoCount')$(id).value=draft.fields?.[id]??defaults[id]??'';
 }
 $('url').value=draft.fields?.url||draft.link||'';
 $('name').value=draft.fields?.name||draft.title||'';
 current={...structuredClone(draft),dirty:false,photos:Array.isArray(draft.photos)?draft.photos.filter(photo=>safeImage(photo?.src)):[]};
 if(!$('images').value)$('images').value=current.photos.map(photo=>photo.src).join('\n');
 loadedUrl=inputLink();
 selectedPhotoSources=new Set(current.photos.map(photo=>photo.src));
 loadedProduct={name:$('name').value,images:$('images').value.split('\n').filter(safeImage)};
 setPhotoCandidates(loadedProduct);
 if(!current.photos.length)selectedPhotoSources.clear();
 syncPhotoOptions();
 updatePhotoSelectionUi();
 renderPhotoChoices();
 document.querySelector('[data-studio="workbench"]').click();
 render();
 window.dispatchEvent(new Event('product-loaded'));
 $('status').textContent='보관함에서 초안을 불러왔어요.';
 return true;
}
let archiveKind='product';
async function deleteArchiveDraft(kind,draft){
 if(!window.confirm('보관함에서 이 글을 삭제할까요?'))return;
 const collection=kind==='daily'?'dailyDrafts':'productDrafts';
 const removed=deletedIds(deletedDraftsKey);
 removed.add(cloudIdFor(collection,draft));
 const status=$('archiveStatus');
 let remaining;
 try{
  localStorage.setItem(deletedDraftsKey,JSON.stringify([...removed]));
  remaining=mergeCloudItems(collection,kind==='daily'?dailyDrafts:drafts);
  storeLocalSnapshot(collection,remaining);
 }catch{
  status.textContent='브라우저 저장 공간에 삭제를 기록하지 못했어요.';
  return;
 }
 if(archiveKind===kind)renderArchive();
 status.textContent='글을 삭제했어요. 클라우드에도 반영 중이에요.';
 try{
  await initialCloudHydration;
  await writeCloudSnapshot(collection,kind==='daily'?dailyDrafts:drafts);
  if(archiveKind===kind)status.textContent='보관함과 클라우드에서 글을 삭제했어요.';
 }catch{
  if(archiveKind===kind)status.textContent='이 브라우저에서는 글을 삭제했어요. 클라우드에는 다시 연결될 때 반영됩니다.';
 }
}
function renderArchive(){
 const records=archiveKind==='daily'?mergeCloudItems('dailyDrafts',dailyDrafts):mergeCloudItems('productDrafts',drafts);
 const root=$('archiveList');
 root.replaceChildren();
 $('archiveStatus').textContent='';
 $('archiveCount').textContent='저장한 글 '+records.length+'개';
 document.querySelectorAll('[data-archive]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.archive===archiveKind)));
 if(!records.length){$('archiveStatus').textContent='아직 저장한 글이 없어요.';return}
 for(const draft of records){
  const kind=archiveKind;
  const body=String(kind==='daily'?draft.output||'':draft.body||postForMode(draft));
  const card=document.createElement('article');
  card.className='archive-card';
  const header=document.createElement('header');
  const avatar=document.createElement('span');
  avatar.className='avatar';avatar.textContent='선';
  const identity=document.createElement('div');
  const name=document.createElement('strong');
  name.textContent='howabout.pick';
  const date=document.createElement('small');
  date.textContent=draft.date||'';
  identity.append(name,date);header.append(avatar,identity);
  const content=document.createElement('p');
  content.textContent=body;
  const actions=document.createElement('div');
  actions.className='archive-actions';
  const copy=document.createElement('button');
  copy.type='button';copy.textContent='글 복사';
  copy.addEventListener('click',async()=>{
   try{await navigator.clipboard.writeText(body);$('archiveStatus').textContent='글을 복사했어요.'}
   catch{$('archiveStatus').textContent='복사하지 못했어요. 본문을 선택해 복사해주세요.'}
  });
  const edit=document.createElement('button');
  edit.type='button';edit.className='save-button';edit.textContent='이어서 편집';
  edit.addEventListener('click',()=>{
   if(!restoreArchiveDraft(kind,draft))$('archiveStatus').textContent='작성 중인 작업이 끝나면 다시 눌러주세요.';
  });
  const remove=document.createElement('button');
  remove.type='button';remove.className='archive-delete';remove.textContent='삭제';
  remove.addEventListener('click',()=>deleteArchiveDraft(kind,draft));
  actions.append(copy,edit,remove);card.append(header,content,actions);root.append(card);
 }
}
document.querySelector('[data-studio="archive"]').addEventListener('click',renderArchive);
document.querySelectorAll('[data-archive]').forEach(button=>button.addEventListener('click',()=>{
 archiveKind=button.dataset.archive;
 renderArchive();
}));
function syncGenerationContext(){const count=selectedReferencePosts().filter(post=>typeof post.text==='string'&&post.text.trim()).length;$('generationContext').textContent=`${loadedProduct?'상품 준비됨':'상품 링크를 먼저 불러와 주세요'} · 참고 글 ${count}개${count?' 생성에 반영':' 선택됨'} · 후킹 → 설명 → 공감`}
function renderReferenceSelection(){
 const root=$('selectedReferences');if(!root)return;root.replaceChildren();
 const selected=selectedReferencePosts();syncGenerationContext();
 if(!selected.length){const empty=document.createElement('p');empty.className='reference-empty';empty.textContent='수집한 글을 불러오면\n여기에 원문이 보여요.';root.append(empty);return}
 for(const post of selected){const item=document.createElement('article');item.className='selected-reference';const head=document.createElement('div');head.className='selected-reference-head';const author=document.createElement('strong');author.textContent='@'+(post.author||'Threads 게시물').replace(/^@/,'');const date=document.createElement('span');date.textContent=post.date||'수집한 글';head.append(author,date);const copy=document.createElement('p');copy.textContent=cleanCollectedText(post.text);const meta=document.createElement('div');meta.className='benchmark-metrics';meta.textContent=`♡ ${post.likes??'—'}　◯ ${post.replies??'—'}　⟳ ${post.reposts??'—'}`;const actions=document.createElement('div');actions.className='benchmark-actions';const original=document.createElement('a');try{const url=new URL(post.url);if(url.protocol==='https:'&&/(^|\.)threads\.com$/.test(url.hostname)){original.href=url.href;original.target='_blank';original.rel='noopener noreferrer';original.textContent='원문 열기 ↗'}}catch{}const remove=document.createElement('button');remove.type='button';remove.textContent='참고 해제';remove.addEventListener('click',()=>{selectedReferenceIds.delete(post.id);renderReferenceSelection();renderReferenceLibrary()});actions.append(original,remove);item.append(head,copy,meta,actions);root.append(item)}
}
function renderReferenceLibrary(){
 const root=$('referenceLibraryList');if(!root)return;root.replaceChildren();
 if(!collectedThreads.length){root.textContent='아직 수집한 글이 없어요. Threads에서 글을 수집한 뒤 다시 열어주세요.';$('referencePickerStatus').textContent='확장프로그램 수집 내용과 동기화되면 여기에 표시됩니다.';return}
 $('referencePickerStatus').textContent=`${collectedThreads.length}개 수집됨 · 최대 3개까지 불러올 수 있어요.`;
 for(const post of collectedThreads){
  const card=document.createElement('article');card.className='reference-library-item';
  const label=document.createElement('label');label.className='reference-choice';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=Boolean(post.id&&selectedReferenceIds.has(post.id));checkbox.disabled=!post.id;
  checkbox.addEventListener('change',()=>{if(checkbox.checked&&selectedReferenceIds.size>=3){checkbox.checked=false;$('referencePickerStatus').textContent='참고 글은 한 번에 최대 3개까지 선택할 수 있어요.';return}if(checkbox.checked)selectedReferenceIds.add(post.id);else selectedReferenceIds.delete(post.id);renderReferenceSelection()});
  const body=document.createElement('span');body.className='reference-choice-copy';const author=document.createElement('strong');author.textContent=post.author||'Threads 게시물';const text=document.createElement('span');text.textContent=cleanCollectedText(post.text);const metrics=document.createElement('small');metrics.textContent=`조회 ${post.views??'—'} · 좋아요 ${post.likes??'—'}`;body.append(author,text,metrics);label.append(checkbox,body);
  const remove=document.createElement('button');remove.type='button';remove.className='delete-collected-thread';remove.textContent='삭제';remove.disabled=!post.id;remove.addEventListener('click',()=>{if(post.id)deleteCollectedThread(post.id)});card.append(label,remove);root.append(card);
 }
}
function requestCollectedThreads(){const requestId=crypto.randomUUID();window.postMessage({source:'gift-note-site',type:'get-references',requestId},location.origin)}
function requestExtensionDeletion(id){
 if([...pendingThreadDeletes.values()].includes(id))return;
 const requestId=crypto.randomUUID();
 pendingThreadDeletes.set(requestId,id);
 window.postMessage({source:'gift-note-site',type:'delete-reference',requestId,id},location.origin);
 setTimeout(()=>pendingThreadDeletes.delete(requestId),5000);
}
function deleteCollectedThread(id){
 if(!window.confirm('이 게시물을 수집목록에서 삭제할까요?'))return;
 const removed=deletedIds(deletedThreadsKey);
 removed.add(String(id));
 try{localStorage.setItem(deletedThreadsKey,JSON.stringify([...removed]))}
 catch{
  $('collectionStatus').textContent='브라우저에 삭제를 기록하지 못했어요. 저장 공간을 확인해주세요.';
  return;
 }
 selectedReferenceIds.delete(id);
 saveCollectedThreads(collectedThreads,[id]);
 $('collectionStatus').textContent='수집목록에서 삭제했어요. 클라우드에도 반영 중이에요.';
 requestExtensionDeletion(id);
}
let lastExtensionThreadIds=null;
window.addEventListener('message',event=>{
 const data=event.data;
 if(event.source!==window||event.origin!==location.origin||data?.source!=='gift-note-extension')return;
 if(data.type==='references-error'){
  if(pendingThreadDeletes.delete(data.requestId))return;
  $('collectionStatus').textContent='확장프로그램 연결이 끊겼어요. 확장프로그램을 새로고침한 뒤 이 사이트 탭도 새로고침해주세요.';
  $('collectionStatus').dataset.error='true';
  if(referencePickerStatus)referencePickerStatus.textContent='Chrome 확장프로그램 연결을 다시 시작한 뒤 목록을 불러와주세요.';
  return;
 }
 if(!Array.isArray(data.items))return;
 if(data.type==='delete-result'){
  pendingThreadDeletes.delete(data.requestId);
  return;
 }
 if(!['references','references-updated'].includes(data.type))return;
 const incomingIds=new Set(data.items.map(post=>post.id));const removed=data.type==='references-updated'&&lastExtensionThreadIds?[...lastExtensionThreadIds].filter(id=>!incomingIds.has(id)):[];
 lastExtensionThreadIds=incomingIds;extensionThreadsReady=true;
 saveCollectedThreads(data.items,removed);
 for(const id of deletedIds(deletedThreadsKey))if(incomingIds.has(id))requestExtensionDeletion(id);
});
window.addEventListener('gift-note-extension-ready',requestCollectedThreads);
requestCollectedThreads();
const initialCloudHydration=hydrateCloud();
if(deletedIds(deletedThreadsKey).size)initialCloudHydration.then(()=>saveCollectedThreads([]));
 function openReferencePicker(){$('referencePickerDialog').showModal();renderReferenceLibrary()}
$('openReferencePicker').onclick=openReferencePicker;$('openReferencePickerSide').onclick=openReferencePicker;$('openReferencePickerBottom').onclick=openReferencePicker;$('closeReferencePicker').onclick=()=>$('referencePickerDialog').close();$('applyReferenceSelection').onclick=()=>{$('referencePickerDialog').close();renderReferenceSelection();$('referencePickerStatus').textContent=`${selectedReferencePosts().length}개 글을 벤치마킹 원문에 불러왔어요.`};$('clearReferenceSelection').onclick=()=>{selectedReferenceIds.clear();renderReferenceSelection();renderReferenceLibrary()};
 $('applyInlinePhotos').onclick=applyInlinePhotoSelection;$('clearInlinePhotos').onclick=()=>{selectedPhotoSources.clear();if(current)current.photos=[];syncPhotoOptions();renderPhotoChoices();updatePhotoSelectionUi();if(current)render();$('photoStatus').textContent='사진 선택을 해제했어요.'};
 $('saved').onclick=()=>{$('history').hidden=false;renderCollectedThreads();requestCollectedThreads();$('history').scrollIntoView({behavior:'smooth'})};$('closeHistory').onclick=()=>{$('history').hidden=true};$('occasion').addEventListener('change',syncOccasion);window.addEventListener('resize',()=>document.querySelectorAll('.posttext').forEach(resize));$('url').value='';clearResult('상품 링크를 넣어 시작해보세요.');


document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{if(!current?.posts)return;current.mode=button.dataset.kind;render()});

$('photoCount').addEventListener('change',()=>{if(current){current.photos=imageSet();render();}});
$('images').addEventListener('input',()=>{setPhotoCandidates(loadedProduct);renderPhotoChoices()});
