import test from 'node:test';
import assert from 'node:assert/strict';
import {generateGiftPosts} from '../worker/writer.mjs';

const photo='https://st.kakaocdn.net/product/gift/product/test.jpg';
const link='https://gift-link.kakao.com/c/example?keep=original';
const input={link,targetLength:100,visuals:[{source:photo,dataUrl:'data:image/jpeg;base64,YWJj',label:'메인 사진'}]};
const evidence={name:'군밤 고구마 손난로',description:'두 개 세트',detailText:'손난로',productFacts:['두 개 세트'],images:[photo],link,source:'https://gift.kakao.com/product/123'};
const env={GEMINI_API_KEY:'test',GEMINI_FREE_TIER_CONFIRMED:'true'};
const first={hook:'겨울 선물 찾다가 군밤이랑 고구마 발견 🌰',explanation:'먹는 거 아니고 손난로야 ✨',empathy:'고구마는 내가 가져도 되나 🍠',continuation:'두 개 세트라 하나씩 나눠 갖고 싶어'};
const second={hook:'손 시리다는 친구 생각나서 골라봤어 🌰',explanation:'군밤이랑 고구마 모양 손난로 세트야 🍠',empathy:'하나씩 나눠 가지면 귀엽겠다 ✨',continuation:'나는 군밤 쪽이 더 끌리는 걸'};
const data={recommend:first,recommendAlternative:second,conversation:first,guide:second,audience:'친구',angle:'겨울 선물',evidence:['두 개 세트'],photoNotes:['군밤과 고구마 모양 본체'],productEmoji:['🌰','🍠','✨'],linkIntro:'카톡으로 슬쩍 선물 보내볼까 🎁',linkIntroAlternative:'카카오톡 선물하기에도 있어 💛'};
const answer=value=>new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(value)}]}}]}));
const dimensions=['endings','rhythm','emotion','readerAddress','paragraphs','punctuation'];
const review=posts=>({posts:Object.keys(posts).map(name=>({name,...Object.fromEntries(dimensions.map(key=>[key,4])),grounded:true,threadsFormat:true,structure:true,comparisons:dimensions.map(dimension=>({dimension,observed:'친근한 원문의 문장 호흡',actual:'구어체와 의미별 줄바꿈 유지'})),issues:[]}))});

test('two drafts keep original body spacing and emojis, use separate generated endings and preserve exact link',async()=>{
 let calls=0;
 const fetcher=async(_,init)=>{
  calls++;
  const request=JSON.parse(init.body);
  assert.ok(request.generationConfig.responseSchema.required.includes('recommendAlternative'));
  assert.ok(request.generationConfig.responseSchema.required.includes('linkIntroAlternative'));
  assert.match(request.systemInstruction.parts.map(part=>part.text).join('\n'),/기존 줄바꿈·문단·이모지/);
  return answer(data);
 };
 const before=await generateGiftPosts(input,evidence,env,{fetcher:async()=>answer(data)});
 const result=await generateGiftPosts({...input,draftCount:2,naturalLinkEnding:true},evidence,env,{fetcher});
 assert.equal(calls,1,'both drafts are produced in one generation request');
 assert.equal(result.recommendDrafts.length,2);
 assert.equal(result.posts.recommend,result.recommendDrafts[0]);
 assert.equal(result.recommendDrafts[0].split('\n\n'+data.linkIntro)[0],before.posts.recommend.split('\n\n카카오톡')[0]);
 assert.ok(result.recommendDrafts[0].endsWith(data.linkIntro+'\n'+link));
 assert.ok(result.recommendDrafts[1].endsWith(data.linkIntroAlternative+'\n'+link));
 assert.equal(result.recommendDrafts[0].includes('카카오톡 선물하기 :'),false);
 assert.notEqual(result.recommendDrafts[0],result.recommendDrafts[1]);
});

test('both recommendation drafts and their endings are included in independent voice review',async()=>{
 let reviewed;
 const result=await generateGiftPosts({...input,draftCount:2,naturalLinkEnding:true,referenceThreads:[{text:'이런 거 발견하면 생각나는 친구 있잖아!!!\n너무 귀여워...'}]},evidence,env,{fetcher:async(_,init)=>{
  const request=JSON.parse(init.body);
  if(request.generationConfig.responseSchema.properties.posts){
   reviewed=JSON.parse(request.contents[0].parts[0].text).posts;
   return answer(review(reviewed));
  }
  return answer({...data,referenceVoice:'감탄과 독백을 짧게 나누는 말투'});
 }});
 assert.ok(reviewed.recommend.endsWith(link));
 assert.ok(reviewed.recommendAlternative.endsWith(link));
 assert.match(reviewed.recommendAlternative,/카카오톡 선물하기에도 있어/);
 assert.equal(result.qualityReview.status,'passed');
 assert.equal(result.qualityReview.assessment.posts.length,4);
});
