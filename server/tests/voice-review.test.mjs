import test from 'node:test';
import assert from 'node:assert/strict';
import {generateDailyPost,generateGiftPosts,evaluateReview} from '../worker/writer.mjs';
const env={GEMINI_API_KEY:'test',GEMINI_FREE_TIER_CONFIRMED:'true'};
const dims=['endings','rhythm','emotion','readerAddress','paragraphs','punctuation'];
const review=(names,score=4)=>({posts:names.map(name=>({name,...Object.fromEntries(dims.map(x=>[x,score])),grounded:true,threadsFormat:true,structure:true,comparisons:dims.map(dimension=>({dimension,observed:'짧은 질문과 긴 독백이 이어짐',actual:'질문 뒤 독백으로 이어지며 문단을 나눔'})),issues:score<4?['어미와 감정이 평범한 광고 말투임. 독자에게 반문하는 어미로 다시 쓸 것']:[]}))});
const response=data=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(data)}]}}]}));
const input={source:'퇴근하고 싶어',targetLength:100,referenceThreads:[{text:'오늘 무슨 일이지!!!\n갑자기 바빠졌잖아...\n나만 이런 거 아니지??'}]};
const draft={referenceVoice:'감탄과 반문',paragraphs:[['퇴근하고 싶은 사람 여기!!! ☕','마음은 벌써 집에 가 있는데... 🏠'],['나만 시계 보고 있는 거 아니지?? 😊']]};
test('failed final draft is reviewed, feedback rewrites it, only passed second draft is returned',async()=>{
 const seen=[];let generations=0,reviews=0;
 const result=await generateDailyPost(input,env,{fetcher:async(_,init)=>{
  const body=JSON.parse(init.body);seen.push(body);
  if(body.generationConfig.responseSchema.properties.posts){reviews++;const payload=JSON.parse(body.contents[0].parts[0].text);assert.equal(payload.referenceThreads[0],input.referenceThreads[0].text);assert.match(payload.posts.daily,/퇴근/);return response(review(['daily'],reviews===1?2:4))}
  generations++;if(generations===2)assert.match(body.contents[0].parts[1].text,/평범한 광고 말투/);
  return response(draft);
 }});
 assert.equal(generations,2);assert.equal(reviews,2);assert.equal(seen.length,4);
 assert.equal(result.qualityReview.status,'passed');assert.equal(result.qualityReview.attempts,2);
 assert.match(result.text,/\n\n/);
});
test('all failed attempts are withheld, bounded at 3 generations and 3 reviews',async()=>{
 let calls=0;
 await assert.rejects(generateDailyPost(input,env,{fetcher:async(_,init)=>{calls++;return response(JSON.parse(init.body).generationConfig.responseSchema.properties.posts?review(['daily'],1):draft)}}),e=>e.code==='AI_STYLE_REVIEW');
 assert.equal(calls,6);
});
test('429/503 during review stop immediately without returning the candidate',async()=>{
 for(const status of [429,503]){let calls=0;await assert.rejects(generateDailyPost(input,env,{fetcher:async()=>++calls===1?response(draft):new Response('{}',{status})}),e=>e.code===(status===429?'FREE_QUOTA_EXCEEDED':'AI_BUSY'));assert.equal(calls,2)}
});
test('missing, duplicate, ungrounded or low-scored dimensions cannot pass',()=>{
 assert.ok(evaluateReview({},['daily']).length);
 const valid=review(['daily']);assert.deepEqual(evaluateReview(valid,['daily']),[]);
 for(const dim of dims){const bad=structuredClone(valid);bad.posts[0][dim]=3;assert.ok(evaluateReview(bad,['daily']).length)}
 const bad=structuredClone(valid);bad.posts[0].comparisons=[];assert.ok(evaluateReview(bad,['daily']).length);
 const fact=structuredClone(valid);fact.posts[0].grounded=false;assert.ok(evaluateReview(fact,['daily']).length);
 assert.ok(evaluateReview(review(['daily','daily']),['daily','other']).length);
});
test('single long line is rewritten before semantic review',async()=>{
 let generations=0,reviews=0;
 const output=await generateDailyPost(input,env,{fetcher:async(_,init)=>{
  const body=JSON.parse(init.body);
  if(body.generationConfig.responseSchema.properties.posts){reviews++;return response(review(['daily']))}
  generations++;return response(generations===1?{paragraphs:[['퇴근하고 싶은데 '+ '아직 할 일이 남았어 '.repeat(8)]]}:draft);
 }});
 assert.equal(generations,2);assert.equal(reviews,1);assert.equal(output.qualityReview.attempts,2);
});
test('product review compares the final formatted post including link, and passes all three posts',async()=>{
 const photo='https://st.kakaocdn.net/test.jpg',link='https://gift-link.kakao.com/c/test';let reviewed;
 const product={name:'무드등',images:[photo],link,description:'밝기 조절',productFacts:[]};
 const part={hook:'이 조명 뭐야!!! 💡',explanation:'밝기 조절도 된다는데\n밤에 켜둘 조명 찾던 중이야 ✨',empathy:'취향 맞는 선물 찾는 거 나만 어렵나?? 🎁',continuation:''};
 const result=await generateGiftPosts({...input,link,visuals:[{source:photo,dataUrl:'data:image/jpeg;base64,YWJj'}]},product,env,{fetcher:async(_,init)=>{
  const body=JSON.parse(init.body);if(body.generationConfig.responseSchema.properties.posts){reviewed=JSON.parse(body.contents[0].parts[0].text);return response(review(['recommend','conversation','guide']))}
  return response({recommend:part,conversation:part,guide:part,referenceVoice:'감탄과 반문',audience:'친구',angle:'조명',evidence:['밝기 조절'],photoNotes:['조명 본체'],productEmoji:['💡','✨','🎁']});
 }});
 assert.deepEqual(reviewed.posts,result.posts);assert.match(result.posts.recommend,/된다는데\n밤에/);assert.equal(result.qualityReview.status,'passed');
});
