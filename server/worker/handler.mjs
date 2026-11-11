import {generateGiftPosts,writerStatus,WriterError} from './writer.mjs';
const SAMPLE_IMAGE='https://st.kakaocdn.net/product/gift/editor/20261029145607_a767704706514ec38cc0a2dedcf91b40.jpg';
const pages=new Set(['gift-link.kakao.com','gift.kakao.com']);
export function allowed(raw,kind){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(kind==='image'?u.hostname==='st.kakaocdn.net'&&u.pathname.startsWith('/product/gift/'):kind==='data'?u.hostname==='gift.kakao.com'&&/^\/a\/product-detail\/v3\/products\/\d+$/.test(u.pathname):pages.has(u.hostname)&&(u.hostname==='gift-link.kakao.com'?/^\/c\/[a-zA-Z0-9]+\/?$/.test(u.pathname):/^\/product\/\d+$/.test(u.pathname)))}catch{return false}}
async function remote(url,kind){for(let i=0;i<4;i++){if(!allowed(url,kind))throw new Error('허용된 카카오 상품 주소가 아닙니다.');const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:kind==='image'?'image/*':kind==='data'?'application/json':'text/html','User-Agent':'GiftNote/1.0'}});if(r.status>=300&&r.status<400){url=new URL(r.headers.get('location'),url).href;continue}if(!r.ok)throw new Error('카카오 상품 응답 오류 ('+r.status+'). 잠시 후 다시 불러와주세요.');return r}throw new Error('상품 주소의 이동 횟수가 너무 많습니다.')}
function decode(s=''){return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c<=0x10ffff?String.fromCodePoint(c):''})}
export function metadata(html){const data={};for(const tag of html.match(/<meta\b[^>]*>/gi)||[]){const attrs={};for(const a of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g))attrs[a[1].toLowerCase()]=decode(a[2]??a[3]??a[4]);const key=attrs.property||attrs.name;if(key&&attrs.content)data[key]=attrs.content}return data}
async function pageHtml(url){const r=await remote(url,'page');const text=await r.text();if(text.length>2500000)throw new Error('상품 페이지가 너무 큽니다.');return text}
export async function product(raw){if(!allowed(raw,'page'))throw new Error('카카오 선물하기 상품 링크를 확인해주세요.');let html=await pageHtml(raw),meta=metadata(html),source=raw,partial=false;
 const id=new URL(raw).pathname.match(/^\/product\/(\d+)$/)?.[1]||html.match(/gift\.kakao\.com%2Fproduct%2F(\d+)/i)?.[1]||html.match(/https:\/\/gift\.kakao\.com\/product\/(\d+)/)?.[1];
 if(id&&new URL(raw).hostname==='gift-link.kakao.com'){source='https://gift.kakao.com/product/'+id;try{meta={...meta,...metadata(await pageHtml(source))}}catch{partial=true}}
 const title=meta['og:title']||meta['twitter:title'];if(!title||title==='카카오톡 선물하기')throw new Error('상품 정보를 확인할 수 없습니다. 만료되거나 공개되지 않은 링크인지 확인해주세요.');
 const image=meta['og:image']||meta['twitter:image'];const description=meta['og:description']||'';const price=description.match(/[\d,]+원/)?.[0]||'';
 let images=image&&allowed(image,'image')?[image]:[],detailImages=[],detailText='',productFacts=[];
 if(id){try{const r=await remote('https://gift.kakao.com/a/product-detail/v3/products/'+id,'data');const data=await r.json();if(String(data.id)!==id)throw new Error('상품 정보 불일치');const gallery=[...new Set([data.imageUrl,...(Array.isArray(data.optionalImageUrls)?data.optionalImageUrls:[])].filter(x=>typeof x==='string'&&allowed(x,'image')))];if(gallery.length)images=gallery.slice(0,12);
 const detail=String(data.description||'').slice(0,250000).replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,(all,attrs,body)=>{const linked=attrs.match(/gift\.kakao\.com\/product\/(\d+)/)?.[1];return linked&&linked!==id?'':body});
 for(const match of detail.matchAll(/<img\b[^>]*>/gi)){const src=decode(match[0].match(/src\s*=\s*["']([^"']+)["']/i)?.[1]||'');if(allowed(src,'image')&&!detailImages.some(x=>x.url===src)){const size=match[0].match(/__cu_imgsize_(\d+)_(\d+)/);detailImages.push({url:src,width:size?+size[1]:null,height:size?+size[2]:null})}}
 detailImages=detailImages.slice(0,20);detailText=decode(detail.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ')).replace(/\s+/g,' ').trim().slice(0,7000);
 productFacts=[data.manufacturer&&'제조/브랜드: '+String(data.manufacturer),data.standardCategory?.name&&'상품 분류: '+data.standardCategory.name,...(Array.isArray(data.announcements)?data.announcements:[]).filter(x=>typeof x.value==='string'&&!/상세|참조|참고|판매자/.test(x.value)).slice(0,8).map(x=>String(x.name)+': '+x.value)].filter(Boolean).map(x=>x.slice(0,500));
 }catch{partial=true}}
 return {link:raw,name:title,price,description,images,source,checkedAt:new Date().toISOString(),partial,detailPhotos:detailImages.length>0,detailImages,detailText,productFacts};
}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}
const pagesOrigin=/^https:\/\/[a-z0-9-]+\.github\.io$/i;
function corsHeaders(request){const origin=request.headers.get('Origin');return origin&&pagesOrigin.test(origin)?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}:{}}
function withCors(response,request){const headers=new Headers(response.headers);for(const [key,value] of Object.entries(corsHeaders(request)))headers.set(key,value);return new Response(response.body,{status:response.status,statusText:response.statusText,headers})}
export default {async fetch(request,env={}){const u=new URL(request.url);try{
 const apiPath=u.pathname==='/api/product'||u.pathname==='/api/image'||u.pathname==='/detail-original.jpg'||u.pathname==='/api/generate'||u.pathname==='/api/ai/status';
 if(apiPath&&request.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(request)});
 if(u.pathname==='/api/ai/status'&&request.method==='GET')return withCors(json(writerStatus(env,request)),request);
 if(u.pathname==='/api/generate'){
  const origin=request.headers.get('Origin');if(origin&&origin!==new URL(request.url).origin&&origin!=='https://a32500259-lab.github.io')return withCors(json({error:'작업실에서 요청해주세요.',code:'ORIGIN_REJECTED'},403),request);
  if(request.method!=='POST')return withCors(json({error:'글 생성은 POST 요청을 사용해주세요.'},405),request);
  if(!env.GEMINI_API_KEY||env.GEMINI_FREE_TIER_CONFIRMED!=='true')return withCors(json({error:'Gemini 무료 등급 연결을 먼저 확인해야 합니다.',code:'AI_NOT_CONFIGURED'},503),request);
  if(!env.GIFT_WRITER_TOKEN||request.headers.get('Authorization')!=='Bearer '+env.GIFT_WRITER_TOKEN)return withCors(json({error:'작업실 연결 코드를 확인해주세요.',code:'AUTH_REQUIRED'},401),request);
  const raw=await request.text();if(raw.length>9000000)throw new WriterError('사진 데이터가 너무 큽니다. 다시 불러와주세요.',413,'INPUT_TOO_LARGE');let input;try{input=JSON.parse(raw)}catch{throw new WriterError('요청 내용을 읽지 못했어요.',400,'INVALID_INPUT')}
  if(typeof input.link!=='string'||!allowed(input.link,'page'))throw new WriterError('상품 링크를 확인해주세요.',400,'INVALID_LINK');
  const evidence=await product(input.link);return withCors(json(await generateGiftPosts(input,evidence,{...env,WRITER_PROMPT:typeof WRITER_PROMPT==='string'?WRITER_PROMPT:env.WRITER_PROMPT})),request);
 }
 if(request.method!=='GET')return withCors(json({error:'지원하지 않는 요청입니다.'},405),request);
 if(u.pathname==='/api/product')return withCors(json(await product(u.searchParams.get('url')||'')),request);
 if(u.pathname==='/api/image'||u.pathname==='/detail-original.jpg'){const src=u.pathname==='/detail-original.jpg'?SAMPLE_IMAGE:u.searchParams.get('url');const r=await remote(src,'image');const type=r.headers.get('content-type')||'';if(!/^image\/(jpeg|png|webp|gif)/i.test(type))return withCors(json({error:'지원하는 사진 파일이 아닙니다.'},415),request);return withCors(new Response(r.body,{headers:{'Content-Type':type,'Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff'}}),request)}
 if(Object.hasOwn(ASSETS,u.pathname))return new Response(ASSETS[u.pathname],{headers:{'Content-Type':u.pathname.endsWith('.js')?'application/javascript; charset=utf-8':u.pathname.endsWith('.css')?'text/css; charset=utf-8':'text/html; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 return new Response('Not found',{status:404});
 }catch(error){const response=json({error:error.name==='TimeoutError'?'응답이 늦어지고 있어요. 잠시 후 다시 시도해주세요.':error.message,code:error.code||'REQUEST_FAILED'},error.status||502);return withCors(response,request)}}};
