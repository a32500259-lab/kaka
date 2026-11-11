import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGiftPosts,validatePosts,GEMINI_MODEL,formatThreadsPost} from '../worker/writer.mjs';
import handler from '../worker/handler.mjs';
const photo='https://st.kakaocdn.net/product/gift/product/test.jpg';
const link='https://gift-link.kakao.com/c/testCase?keep=original';
const evidence={name:'밝기 조절 무드등',description:'조명',detailText:'밝기 조절',productFacts:[],images:[photo],detailImages:[],link,source:'https://gift.kakao.com/product/123',checkedAt:'2026-11-10'};
const input={link,age:'30',occasion:'집들이',visuals:[{source:photo,dataUrl:'data:image/jpeg;base64,YWJj',label:'앞면'}]};
const env={GEMINI_API_KEY:'test-only-key',GIFT_WRITER_TOKEN:'test-only-token',GEMINI_FREE_TIER_CONFIRMED:'true',WRITER_PROMPT:'저장된 실제 문체 지침'};
const good={recommend:'집들이 선물로 조명을 고르면 방에 놓을 자리부터 떠올리게 돼.\n\n밝기를 조절할 수 있어서 침대 옆에 둘 걸 찾는 친구한테도 보여주고 싶어.',conversation:'집들이 선물을 같이 고르는 건 성의 없는 게 아니라 실패를 줄이는 방법 같아.\n\n깜짝 선물도 좋지만 진짜 필요한 걸 묻는 마음도 좋잖아.',guide:'조명을 선물한다면 침대 옆에 둘 건지 책상에서 쓸 건지 먼저 알아보는 편.\n\n둘 장소가 정해져야 크기랑 전원 위치도 생각하기 편하니까.',audience:'방을 꾸미는 30대 친구',angle:'둘 자리에 맞는 집들이 선물',evidence:['밝기 조절'],photoNotes:[]};
const answer=data=>new Response(JSON.stringify({modelVersion:'gemini-test-version',candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]}),{headers:{'content-type':'application/json'}});
test('real provider request carries prompt, visuals and selected audience; only app adds original link',async()=>{
 let seen;const result=await generateGiftPosts(input,evidence,env,{fetcher:async(url,options)=>{seen={url,options,body:JSON.parse(options.body)};return answer(good)}});
 assert.ok(seen.url.endsWith('/'+GEMINI_MODEL+':generateContent'));
 assert.equal(seen.options.headers['x-goog-api-key'],env.GEMINI_API_KEY);assert.ok(!seen.options.body.includes(env.GEMINI_API_KEY));
 assert.match(seen.body.systemInstruction.parts[0].text,/저장된 실제 문체 지침/);
 assert.equal(JSON.parse(seen.body.contents[0].parts[0].text).options.age,'30');
 assert.equal(seen.body.contents[0].parts[2].inlineData.mimeType,'image/jpeg');
 assert.ok(result.posts.recommend.endsWith('카카오톡 선물하기 : '+link));
 assert.equal(result.posts.conversation,good.conversation);assert.equal(result.model,'gemini-test-version');assert.equal(result.visualSegments,1);
});
test('no call without a confirmed free-tier configuration or valid source images',async()=>{
 let calls=0;const options={fetcher:async()=>{calls++;return answer(good)}};
 await assert.rejects(generateGiftPosts(input,evidence,{...env,GEMINI_FREE_TIER_CONFIRMED:'false'},options),e=>e.code==='AI_NOT_CONFIGURED');
 await assert.rejects(generateGiftPosts({...input,visuals:[{source:'https://evil.test/img',dataUrl:'data:image/jpeg;base64,YWJj'}]},evidence,env,options),e=>e.code==='INVALID_IMAGE');
 await assert.rejects(generateGiftPosts({...input,visuals:[]},evidence,env,options),e=>e.code==='NO_IMAGES');assert.equal(calls,0);
});
test('free quota is surfaced immediately with no paid fallback or automatic retry',async()=>{
 let calls=0;await assert.rejects(generateGiftPosts(input,evidence,env,{fetcher:async()=>{calls++;return new Response('{"error":{}}',{status:429})}}),e=>e.code==='FREE_QUOTA_EXCEEDED');assert.equal(calls,1);
});
test('temporary overload retries same model at most once',async()=>{
 let calls=0;let delays=0;await assert.rejects(generateGiftPosts(input,evidence,env,{fetcher:async()=>{calls++;return new Response('{}',{status:503})},delay:async()=>{delays++}}),e=>e.code==='AI_BUSY');assert.equal(calls,2);assert.equal(delays,1);
});
test('truncated or invalid model results are never published as completed posts',async()=>{
 await assert.rejects(generateGiftPosts(input,evidence,env,{fetcher:async()=>new Response('{"candidates":[{"finishReason":"MAX_TOKENS"}]}')}),e=>e.code==='AI_INCOMPLETE');
 await assert.rejects(generateGiftPosts(input,evidence,env,{fetcher:async()=>answer({...good,recommend:'직접 사용해보니 좋았어. 할인해서 39,000원이고 선물하기 딱 좋은 제품이야.'})}),e=>e.code==='AI_VALIDATION_FAILED');
 assert.ok(validatePosts({...good,guide:good.guide+' https://example.com'}).length);
});
test('writer endpoint requires owner connection before fetching products or spending quota',async()=>{
 const old=globalThis.fetch;let calls=0;globalThis.fetch=async()=>{calls++;throw Error('must not fetch')};
 try{
  const response=await handler.fetch(new Request('https://studio.test/api/generate',{method:'POST',headers:{Origin:'https://a32500259-lab.github.io','Content-Type':'application/json'},body:JSON.stringify(input)}),env);
  assert.equal(response.status,401);assert.equal(calls,0);
  const blocked=await handler.fetch(new Request('https://studio.test/api/generate',{method:'POST',headers:{Origin:'https://attacker.example',Authorization:'Bearer '+env.GIFT_WRITER_TOKEN},body:JSON.stringify(input)}),env);assert.equal(blocked.status,403);assert.equal(calls,0);
  const preflight=await handler.fetch(new Request('https://studio.test/api/generate',{method:'OPTIONS',headers:{Origin:'https://a32500259-lab.github.io'}}),env);assert.match(preflight.headers.get('Access-Control-Allow-Methods'),/POST/);assert.match(preflight.headers.get('Access-Control-Allow-Headers'),/Authorization/);
 }finally{globalThis.fetch=old}
});

test('model-authored URLs are discarded; only original curator tracking link is appended',async()=>{
 const result=await generateGiftPosts(input,evidence,env,{fetcher:async()=>answer({...good,recommend:good.recommend+'\n\n카카오톡 선물하기 : https://untrusted.example/modified'})});
 assert.ok(!result.posts.recommend.includes('untrusted.example'));assert.equal((result.posts.recommend.match(/카카오톡 선물하기 :/g)||[]).length,1);assert.ok(result.posts.recommend.endsWith(link));
});

test('actual product-detail GIFs can pass through the image proxy for canvas reading',async()=>{
 const old=globalThis.fetch;globalThis.fetch=async()=>new Response('GIF89a',{headers:{'content-type':'image/gif'}});
 try{const response=await handler.fetch(new Request('https://studio.test/api/image?url='+encodeURIComponent('https://st.kakaocdn.net/product/gift/editor/detail.gif')));assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/gif')}finally{globalThis.fetch=old}
});

test('Threads plain-text output retains paragraph gaps when model returns a single line',()=>{
 assert.equal(formatThreadsPost('첫 문장. 제품 설명. 마지막 한마디.'),'첫 문장. 제품 설명. 마지막 한마디.');
 assert.equal(formatThreadsPost('첫 줄\n\n제품 포인트\n두 번째 포인트'),'첫 줄\n\n제품 포인트\n두 번째 포인트');
});

test('canned ending is rewritten once and never silently accepted after another failure',async()=>{
 let calls=0;const bad={...good,recommend:good.recommend+' 좋겠어.'};
 const result=await generateGiftPosts(input,evidence,env,{fetcher:async()=>answer(++calls===1?bad:good)});
 assert.equal(calls,2);assert.ok(!result.posts.recommend.includes('좋겠어.'));
 calls=0;await assert.rejects(generateGiftPosts(input,evidence,env,{fetcher:async()=>{calls++;return answer(bad)}}),e=>e.code==='AI_STYLE_REVIEW');assert.equal(calls,2);
});

test('a cramped recommendation is rewritten into paragraphs before adding the link',async()=>{
 let calls=0;
 const cramped={...good,recommend:good.recommend.replace('\n\n',' ')};
 const result=await generateGiftPosts(input,evidence,env,{fetcher:async()=>answer(++calls===1?cramped:good)});
 assert.equal(calls,2);
 assert.equal(result.posts.recommend,good.recommend+'\n\n카카오톡 선물하기 : '+link);
});
