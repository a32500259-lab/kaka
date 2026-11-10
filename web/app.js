import {makeCopy,makePosts,postForMode,livingProfile,shortName,storyFor} from './copy-engine.js';
const $=id=>document.getElementById(id);
const DISCLOSURE='이 포스팅은 선물하기 큐레이터 활동의 일환으로, 주문 발생 시 일정액의 수수료를 제공받습니다.';
const fields=['url','name','category','price','facts','images','age','occasion','audience','angle','photoCount','customOccasion'];
let loadedUrl='',current=null,drafts=[];
try{drafts=JSON.parse(localStorage.getItem('gift-note-drafts-v2')||'[]');if(!Array.isArray(drafts))drafts=[]}catch{}
$('count').textContent=drafts.length;
function validLink(raw){try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='gift-link.kakao.com'&&!u.username&&!u.password&&/^\/c\/[a-zA-Z0-9]+\/?$/.test(u.pathname)}catch{return false}}
function safeImage(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password}catch{return false}}
function resize(t){t.style.height='auto';t.style.height=t.scrollHeight+4+'px'}
function classify(name){if(/고데기|헤어|향수|립|화장|뷰티|크림|스킨/.test(name))return'beauty';if(/케이크|쿠키|초콜릿|커피|차 |티백|과일|한우|식품|디저트/.test(name))return'food';if(/이어폰|충전|스피커|키보드|가전|전자|드라이어/.test(name))return'tech';if(/가방|지갑|목걸이|팔찌|파우치|패션|머플러/.test(name))return'fashion';if(/머그|텀블러|디퓨저|캔들|수건|조명|그릇|리빙/.test(name))return'home';return'general'}
const profiles={beauty:{who:'평소 뷰티 소품을 눈여겨보는 친구',age:'20–30대',reason:'평소 손질 습관과 디자인 취향',opening:'선물 고를 때 은근히 어려운 게, 그 사람이 평소 뭘 쓰는지 떠올리는 일이더라고요.',ending:'평소 비슷한 제품을 눈여겨보던 사람이라면 선물 후보에 넣어둘 만해요.'},food:{who:'맛있는 걸 발견하면 같이 나누는 친구',age:'취향 중심',reason:'좋아하는 맛과 함께 먹을 사람',opening:'생일 선물 고르다가 결국 생각나는 건 같이 맛있는 거 먹던 순간.',ending:'좋아하는 맛을 알고 있을 때 골라주면 더 반가울 선물이에요.'},home:{who:'집 안의 작은 물건도 취향대로 고르는 사람',age:'30–40대',reason:'집의 분위기와 생활 습관',opening:'집들이 선물은 그 집에 놓였을 때의 모습부터 상상하게 돼요.',ending:'집 분위기나 평소 고르는 색을 떠올려보고 골라주면 좋겠어요.'},tech:{who:'자주 쓰는 물건에 관심이 많은 사람',age:'20–40대',reason:'실제로 사용하는 환경과 필요한 기능',opening:'잘 고른 선물은 책상 위에 계속 남아 있잖아요.',ending:'평소 쓰는 기기나 공간에 어울리는지 생각하면서 고르면 좋겠어요.'},fashion:{who:'작은 소품으로 취향을 드러내는 친구',age:'20–30대',reason:'평소 옷차림과 즐겨 고르는 디자인',opening:'옷은 고르기 어려워도, 작은 소품은 그 사람 생각나는 게 있더라고요.',ending:'평소 옷차림에 같이 매치한 모습이 떠오르면 꽤 좋은 후보예요.'},general:{who:'이런 제품을 눈여겨보던 사람',age:'취향 중심',reason:'받는 사람의 관심사와 필요한 순간',opening:'선물 고르다가 딱 한 사람 생각나는 물건이 있잖아요.',ending:'받는 사람이 좋아할 포인트가 분명할 때 골라주고 싶은 쪽이에요.'}};
let requestNumber=0,loading=false;
function inputLink(){const text=$('url').value.trim();return text.match(/https:\/\/gift-link\.kakao\.com\/c\/[a-zA-Z0-9]+(?:\?[^\s<>\]\)]+)?/)?.[0]||text}
function clearResult(message){current=null;$('post').replaceChildren();$('photoDownloads').replaceChildren();$('textCount').textContent='';$('lengthHelp').textContent='';$('copyStatus').textContent='';$('photoStatus').textContent='';$('productLink').removeAttribute('href');$('productLink').textContent='';$('rationale').textContent=message;$('copyBtn').disabled=true;$('save').disabled=true;$('sourcePhoto').hidden=true}
async function loadProduct(){
 const raw=inputLink(),serial=++requestNumber;
 if(!validLink(raw)){loading=false;loadedUrl='';$('load').disabled=false;$('load').textContent='상품 불러오기';$('generate').disabled=false;$('importStatus').textContent='카카오 큐레이터 링크를 넣어주세요. 공유 문구 전체를 붙여넣어도 됩니다.';clearResult('올바른 상품 주소를 기다리고 있어요.');return false}
 $('url').value=raw;loading=true;$('load').disabled=true;$('load').textContent='불러오는 중…';$('generate').disabled=true;clearResult('새 상품 정보를 가져오고 있어요.');$('status').textContent='';$('importStatus').textContent='카카오 상품명·가격·사진을 확인하고 있어요.';
 try{
  const response=await fetch('/api/product?url='+encodeURIComponent(raw),{signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok)throw new Error(data.error||'상품을 불러오지 못했어요.');
  if(serial!==requestNumber||inputLink()!==raw)return false;
  loadedUrl=raw;for(const id of ['name','price','facts','images','audience','angle','customOccasion'])$(id).value='';
  $('name').value=data.name;$('price').value=data.price;$('images').value=data.images.join('\n');$('photoCount').value='3';syncPhotoOptions();$('category').value='auto';$('age').value='auto';$('occasion').value='auto';
  const generic=/큐레이터 추천 상품|지금 카카오톡 선물하기에서/.test(data.description);$('facts').value=generic?'':data.description;
  $('productDetails').open=false;syncOccasion();
  $('importStatus').textContent=`${data.name} · ${data.price||'가격 미표시'} · ${`상품 사진 ${data.images.length}장`} 불러왔어요.`;
  $('status').textContent='상품을 불러왔어요. 추천 글 만들기를 누르면 이 상품으로 작성됩니다.';$('rationale').textContent='불러온 상품으로 추천 글을 만들 수 있어요.';
  window.dispatchEvent(new Event('product-loaded'));return true;
 }catch(error){if(serial!==requestNumber)return false;loadedUrl='';for(const id of ['name','price','facts','images'])$(id).value='';$('importStatus').textContent=error.name==='TimeoutError'?'상품 응답이 늦어지고 있어요. 다시 불러와주세요.':error.message==='Failed to fetch'?'상품 정보를 가져오지 못했어요. 연결을 확인하고 다시 시도해주세요.':error.message;clearResult('상품을 불러오지 못했어요. 주소를 확인하고 다시 시도해주세요.');return false}
 finally{if(serial===requestNumber){loading=false;$('load').disabled=false;$('load').textContent='상품 불러오기';$('generate').disabled=false}}
}
function syncPhotoOptions(){const count=Math.min(3,new Set($('images').value.split('\n').map(x=>x.trim()).filter(Boolean)).size),old=Number($('photoCount').value)||3;$('photoCount').replaceChildren();for(let n=count;n>=1;n--){const option=document.createElement('option');option.value=n;option.textContent=n+'장';$('photoCount').append(option)}if(!count){const o=document.createElement('option');o.value=0;o.textContent='가져온 사진 없음';$('photoCount').append(o)}$('photoCount').value=String(Math.min(old,count));$('photoCount').disabled=!count;return count}
function imageSet(){const urls=[...new Set($('images').value.split('\n').map(x=>x.trim()).filter(Boolean))];if(!urls.length)return [];if(urls.some(x=>!safeImage(x)))throw new Error('상세페이지 사진 주소를 1장 이상 넣어주세요. https:// 주소를 사용해주세요.');return urls.slice(0,Number($('photoCount').value)).map(src=>({src,alt:$('name').value+' 상품 사진'}))}
const occasions={
 'auto':{hint:'제품의 용도와 확인된 특징에 맞춰 추천 대상과 글을 자동으로 정해요.'},
 '생일':{hint:'이미 가진 것과 겹치지 않으면서, 좋아하는 취향은 놓치지 않는 방향.',start:'이미 웬만한 건 다 있는 친구, 선물 뭐 주지 싶을 때.',end:'평소 이런 거 좋아하던 친구한테 주면 좋겠다.'},
 '가벼운 감사':{hint:'큰 보답보다 상대를 생각해서 골랐다는 마음이 전해지는 방향.',start:'고맙다고 말만 하고 넘어가긴 좀 아쉬워서.',end:'“이거 너 좋아할 것 같아서” 하고 건네면 좋겠어요.'},
 '응원':{hint:'결과를 재촉하는 응원 대신 새 일상의 작은 즐거움을 생각합니다.',start:'새로 시작하는 친구한테 뭐 하나 챙겨주고 싶을 때.',end:'바쁜 와중에 이런 거 받고 잠깐이라도 웃었으면 좋겠다.'},
 '집들이':{hint:'집의 크기나 가격보다 새 공간을 쓰는 사람의 취향을 중심에 둡니다.',start:'이사한 친구 선물 찾다가 눈에 들어온 거.',end:'친구 집에 놓여 있는 모습이 벌써 떠오르는 쪽.'},
 '문득':{hint:'행사나 기념일 없이, 상품을 보고 그 사람이 떠오른 이유를 씁니다.',start:'이런 거 보면 꼭 생각나는 친구 한 명 있지 않아요?',end:'생일은 아닌데 그냥 주고 싶어지는 거 있잖아요.'},
 '나를 위한 선물':{hint:'필요성만 따지지 않고, 내 취향을 위해 고르는 작은 보상.',start:'선물 찾으러 왔다가 내 것도 슬쩍 보는 중.',end:'이건 남 주기 전에 내가 갖고 싶네 😂'},
 '부담없이':{hint:'가격이 싸다고 단정하지 않고 관계의 거리와 선물의 의미에 집중합니다.',start:'뭘 크게 챙길 사이는 아닌데, 그냥 지나가긴 아쉬울 때.',end:'“너 이런 거 좋아하잖아” 하면서 주기 좋겠다.'},
 '직접':{hint:'적어주신 실제 상황을 도입으로 쓰고 상품의 확인된 특징을 연결합니다.',start:'',end:'받을 사람 생각하면서 한번 봐도 좋겠어요.'}
};
function syncOccasion(){const value=$('occasion').value;$('occasionHelp').textContent=(occasions[value]||occasions['생일']).hint;$('customOccasionWrap').hidden=value!=='직접'}
function buildText(){
 const category=$('category').value==='auto'?classify(shortName($('name').value)):$('category').value;
 const profile=profiles[category]||profiles.general;
 const input=Object.fromEntries(['name','facts','occasion','customOccasion'].map(id=>[id,$(id).value]));
 const posts=makePosts(input);posts.recommend+='\n\n'+loadedUrl;const text=makeCopy(input);
 const age=$('age').value==='auto'?profile.age:$('age').value==='all'?'취향 중심':$('age').value+'대';
 return {sections:[text],posts,mode:'recommend',rationale:`추천 방향 · ${age} / ${storyFor($('name').value).person} · 짧은 대화체`};
}
function exportText(){return postForMode(current).replaceAll(DISCLOSURE,'').replace(/\n{3,}/g,'\n\n').trim()}
function updateCount(){const count=Array.from(exportText()).length;$('textCount').textContent=`${count}자 · 공백·링크 포함`;$('lengthHelp').textContent=count>500?'기본 게시물 기준인 500자를 넘었어요. 본문을 조금 줄여주세요.':'짧은 게시물용으로 준비했어요.';$('textCount').classList.toggle('over',count>500)}
const preparedPhotos=new Map();
function preparePhoto(photo){
 const key=JSON.stringify(photo);if(preparedPhotos.has(key))return preparedPhotos.get(key);
 const job=(async()=>{
  const source=new URL(photo.src,location.href);const imageUrl=source.hostname==='st.kakaocdn.net'?'/api/image?url='+encodeURIComponent(photo.src):photo.src;const img=new Image();if(new URL(imageUrl,location.href).origin!==location.origin)img.crossOrigin='anonymous';
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
 $('copyBtn').disabled=Boolean(current.dirty);$('save').disabled=Boolean(current.dirty);$('post').replaceChildren();$('photoDownloads').replaceChildren();$('rationale').textContent=current.rationale;syncOccasion();
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
async function generate(){if(loading)return;if(inputLink()!==loadedUrl||!loadedUrl){if(!await loadProduct())return}if(!$('name').value.trim()){$('productDetails').open=true;$('status').textContent='상품을 먼저 불러오거나 상품명을 넣어주세요.';return}try{const photos=imageSet(),copy=buildText();current={...copy,photos,link:loadedUrl,title:$('name').value.trim()};render();window.dispatchEvent(new Event('content-ready'));$('status').textContent='상품 추천·생활 공감·고르는 기준, 세 가지 글을 준비했어요.'}catch(e){$('status').textContent=e.message;$('productDetails').open=true}}
$('load').onclick=loadProduct;$('generate').onclick=generate;
$('url').addEventListener('input',()=>{if(inputLink()!==loadedUrl)clearResult('새 주소를 입력했어요. 불러오기를 눌러주세요.')});
$('url').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();loadProduct().then(ok=>{if(ok)window.dispatchEvent(new Event('product-loaded'))})}});
for(const id of fields.filter(id=>id!=='url'&&id!=='photoCount'))$(id).addEventListener('input',()=>{if(current){current.dirty=true;$('copyBtn').disabled=true;$('save').disabled=true;$('status').textContent='입력이 바뀌었어요. 추천 글 만들기를 눌러 반영해주세요.'}});
$('copyBtn').onclick=async()=>{if(!current){$('status').textContent='먼저 상품 글을 만들어주세요.';return}try{await navigator.clipboard.writeText(exportText());$('copyStatus').textContent=current.posts&&current.mode!=='recommend'?'복사 완료! 선택한 글만 스레드에 붙여넣으세요.':'복사 완료! 스레드에 붙여넣고 아래 사진을 따로 첨부해주세요.'}catch{$('copyText').focus();$('copyText').select();$('copyStatus').textContent='글을 선택했어요. Ctrl+C로 복사해주세요.'}};
$('save').onclick=()=>{if(!current){$('status').textContent='먼저 상품 글을 만들어주세요.';return}const draft={...structuredClone(current),fields:Object.fromEntries(fields.map(id=>[id,$(id).value])),date:new Date().toLocaleString('ko-KR')};try{const next=[draft,...drafts].slice(0,30);localStorage.setItem('gift-note-drafts-v2',JSON.stringify(next));drafts=next;$('count').textContent=drafts.length;$('status').textContent='수정한 글과 사진 구성을 이 브라우저에 저장했어요.'}catch{$('status').textContent='저장 공간을 사용할 수 없어요. 글 복사를 이용해주세요.'}};
$('saved').onclick=()=>{$('history').hidden=false;$('historylist').replaceChildren();if(!drafts.length)$('historylist').textContent='아직 저장한 초안이 없어요.';drafts.forEach(d=>{const b=document.createElement('button');b.textContent=d.title+' · '+d.date;b.onclick=()=>{for(const id of fields)$(id).value=d.fields[id]||'';loadedUrl=d.link;current=structuredClone(d);render();$('history').hidden=true;$('rationale').scrollIntoView({behavior:'smooth'});$('importStatus').textContent=d.title+' · 저장된 상품 정보';$('status').textContent='저장한 글과 사진을 불러왔어요.'};$('historylist').appendChild(b)});$('history').scrollIntoView({behavior:'smooth'})};$('closeHistory').onclick=()=>{$('history').hidden=true};$('occasion').addEventListener('change',syncOccasion);window.addEventListener('resize',()=>document.querySelectorAll('.posttext').forEach(resize));$('url').value='';clearResult('상품 링크를 넣어 시작해보세요.');


document.querySelectorAll('[data-kind]').forEach(button=>button.onclick=()=>{if(!current?.posts)return;current.mode=button.dataset.kind;render()});

$('photoCount').addEventListener('change',()=>{if(current){current.photos=imageSet();render();}});
$('images').addEventListener('input',syncPhotoOptions);
