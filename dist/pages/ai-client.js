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
async function loadImage(source,signal){
 const image=new Image();image.crossOrigin='anonymous';
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>finish(new Error('상품 사진 응답이 늦습니다.')),20000);const abort=()=>finish(new DOMException('Cancelled','AbortError'));function finish(error){clearTimeout(timer);signal?.removeEventListener('abort',abort);image.onload=null;image.onerror=null;if(error){image.src='';reject(error)}else resolve()}
 image.onload=()=>finish();image.onerror=()=>finish(new Error('상품 사진을 읽지 못했습니다.'));if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});image.src=apiUrl('/api/image?url='+encodeURIComponent(source));});
 return image;
}
function cropData(image,y,height){
 const canvas=document.createElement('canvas');canvas.width=Math.min(1200,image.naturalWidth);canvas.height=Math.round(height*canvas.width/image.naturalWidth);
 canvas.getContext('2d').drawImage(image,0,y,image.naturalWidth,height,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',.82);
}
export async function prepareVisuals(product,signal,onProgress=()=>{}){
 const details=(product.detailImages||[]).filter(x=>x.url&&!(x.height&&x.height<500));
 const long=details.filter(x=>x.height&&x.width&&x.height/x.width>4).sort((a,b)=>b.height-a.height)[0];
 const sources=[long?.url||details[0]?.url,...(product.images||[])].filter((x,i,a)=>x&&a.indexOf(x)===i).slice(0,2);
 if(!sources.length)throw new Error('읽을 상품 사진이 없습니다. 상품을 다시 불러와주세요.');
 const visuals=[];const failures=[];
 for(const [i,source] of sources.entries()){
  onProgress(`상품 사진을 읽고 있어요 · ${i+1}/${sources.length}`);
  try{const image=await loadImage(source,signal);const tileHeight=Math.min(image.naturalHeight,Math.round(image.naturalWidth*1.8));const count=i===0&&image.naturalHeight>tileHeight*2?5:1;
   for(let n=0;n<count;n++){const y=count===1?0:Math.round((image.naturalHeight-tileHeight)*n/(count-1));const height=count===1?image.naturalHeight:tileHeight;visuals.push({source,label:`사진 ${i+1} · 세로 ${y}~${y+height}/${image.naturalHeight}`,dataUrl:cropData(image,y,height)})}
  }catch(error){if(error.name==='AbortError')throw error;failures.push(source)}
 }
 if(!visuals.length)throw new Error('상품 사진을 읽지 못했습니다. 잠시 후 다시 불러와주세요.');
 return {visuals:visuals.slice(0,6),failures};
}
export async function requestGiftPosts(input,signal){
 const response=await fetch(apiUrl('/api/generate'),{method:'POST',headers:{'Content-Type':'application/json',...(accessToken?{Authorization:'Bearer '+accessToken}:{})},body:JSON.stringify(input),signal});
 let data;try{data=await response.json()}catch{throw new Error('AI 서버의 응답을 읽지 못했습니다.')}
 if(!response.ok){const error=new Error(data.error||'AI 글 생성에 실패했습니다.');error.code=data.code;throw error}
 if(!data.posts||!['recommend','conversation','guide'].every(k=>typeof data.posts[k]==='string'))throw new Error('AI 글 결과가 올바르지 않습니다.');
 return data;
}
