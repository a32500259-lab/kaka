const API_BASE='https://gift-note-studio-sdkim.stillterrapin2.chatgpt.site';
let accessToken='';
try{accessToken=localStorage.getItem('gift-writer-connection')||''}catch{}
export const apiUrl=path=>API_BASE+path;
export function connectWriter(value,remember=false){accessToken=value.trim();try{if(remember)localStorage.setItem('gift-writer-connection',accessToken);else localStorage.removeItem('gift-writer-connection')}catch{}}
export function disconnectWriter(){connectWriter('')}
export function hasWriterConnection(){return Boolean(accessToken)}
export async function writerStatus(signal){
 const response=await fetch(apiUrl('/api/ai/status'),{headers:accessToken?{Authorization:'Bearer '+accessToken}:{},signal,cache:'no-store'});
 if(!response.ok)throw new Error('AI 연결 상태를 확인하지 못했어요.');return response.json();
}
async function loadImage(source,signal,attempt=0){
 const image=new Image();image.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('상품 사진 응답이 늦습니다.')),20000);const abort=()=>finish(new DOMException('Cancelled','AbortError'));function finish(error){clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;if(error){image.src='';reject(error)}else resolve()}
 image.onload=()=>finish();image.onerror=()=>finish(new Error('상품 사진을 읽지 못했습니다.'));if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});image.src=apiUrl('/api/image?url='+encodeURIComponent(source)+(attempt?'&retry='+attempt:''));});
 return image;
}
function cropData(image,y,height){
 const canvas=document.createElement('canvas');canvas.width=Math.min(1200,image.naturalWidth);canvas.height=Math.round(height*canvas.width/image.naturalWidth);
 canvas.getContext('2d').drawImage(image,0,y,image.naturalWidth,height,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);
}
export async function prepareVisuals(product,signal,onProgress=()=>{}){
 const sources=(product.images||[]).filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,3);
 if(!sources.length)throw new Error('상품 메인 사진이 없어 초안을 만들지 않았어요. 사진이 있는 상품을 다시 불러와주세요.');
 const visuals=[];const failures=[];
 for(const [i,source] of sources.entries()){
  onProgress(`상품 메인 사진을 읽고 있어요 · ${i+1}/${sources.length}`);
  let image=null;for(let attempt=0;attempt<2&&!image;attempt++){try{image=await loadImage(source,signal,attempt)}catch(error){if(error.name==='AbortError')throw error;if(attempt===0)onProgress(`사진 ${i+1} 읽기를 다시 시도하고 있어요…`)}}
  try{if(!image)throw new Error('사진 다시 읽기 실패');const tileHeight=Math.min(image.naturalHeight,Math.round(image.naturalWidth*1.8));const maxSegments=Math.max(1,6-(sources.length-1));const count=i===0&&image.naturalHeight>tileHeight*2?Math.min(5,maxSegments):1;
   for(let n=0;n<count;n++){const y=count===1?0:Math.round((image.naturalHeight-tileHeight)*n/(count-1));const height=count===1?image.naturalHeight:tileHeight;visuals.push({source,label:`사진 ${i+1} · 세로 ${y}~${y+height}/${image.naturalHeight}`,dataUrl:cropData(image,y,height)})}
  }catch(error){if(error.name==='AbortError')throw error;failures.push(source)}
 }
 if(failures.length)throw new Error(`상품 메인 사진 ${sources.length}장 중 ${failures.length}장을 읽지 못했어요. 초안을 만들지 않았습니다. 사진 선택을 바꾸거나 다시 시도해주세요.`);
 if(visuals.length!==sources.length)throw new Error('상품 메인 사진을 모두 확인하지 못해 초안을 만들지 않았어요. 사진을 다시 불러온 뒤 시도해주세요.');
 return {visuals:visuals.slice(0,6),failures};
}
export async function requestGiftPosts(input,signal){
 const response=await fetch(apiUrl('/api/generate'),{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:'Bearer '+accessToken}:{})},body:JSON.stringify(input),signal});
 let data;try{data=await response.json()}catch{throw new Error('AI 서버의 응답을 읽지 못했습니다.')}
 if(!response.ok){const error=new Error(data.error||'AI 글 생성에 실패했습니다.');error.code=data.code;throw error}
 if(!data.posts||!['recommend','conversation','guide'].every(k=>typeof data.posts[k]==='string'))throw new Error('AI 글 결과가 올바르지 않습니다.');
 return data;
}
