import {storyFor,verifiedSentence} from './editorial.js';
import {livingProfile} from './lifestyle.js';
export {livingProfile,storyFor};
// Product facts select the subject; gift occasions only change the angle.
// Never turn title keywords into claims about personal use or performance.
const money=/(?:[₩￦]\s*\d|\d[\d,.]*\s*(?:만\s*)?원|가격|최저가|할인가|가성비|무료배송|할인율|\d+\s*%)/;
const clean=s=>String(s||'').replace(/[ㄱ-ㅎㅏ-ㅣ]+/g,'').split('\n').map(line=>line.split(/(?<=[.!?])\s+/).filter(x=>!money.test(x)).join(' ')).filter(Boolean).join('\n').trim();
export function shortName(raw){
 const s=String(raw).replace(/\[[^\]]*\]|\([^)]*\)/g,' ').split(/\+|증정|행사기간/)[0].trim();
 if(/손난로/.test(s)&&/고구마|군밤/.test(s))return (/단미/.test(s)?'단미 ':'')+'고구마·군밤 손난로';
 const concise=s.replace(/밝기\s*조절|분리\s*세척|스테인리스|스텐레스|접이식|\d+(?:\.\d+)?\s*(?:ml|mL|리터)\b/g,' ').replace(/\s+/g,' ').trim();
 const main=concise.match(/^.*?(?:빗고데기|손난로|바디\s*(?:에어\s*)?드라이어|보조배터리|텀블러|디퓨저|머그컵|키보드|이어폰|케이크|쿠키|목걸이|머플러|핸드크림|향수|스피커|파우치|가방|지갑|캔들|조명|무드등|수건|타월|타올|샤워가운|이불|침구|담요|베개|쿠션|블랭킷|수납함|정리함|트롤리|선반|청소기|밀대|청소솔|세제|세정제|샤워기|발매트|핸드워시|바디워시|디스펜서|프라이팬|냄비|도마|접시|그릇|밀폐용기|도시락|커트러리|수저|물병|티포트|가습기|제습기|공기청정기|선풍기|서큘레이터|거치대|충전기|슬리퍼|실내화)/)?.[0]||concise;
 return main.split(/\s+/).filter(w=>!money.test(w)&&!/^20\d{2}$/.test(w)).slice(0,7).join(' ').trim();
}
export function makeCopy({name='',facts='',occasion='auto',customOccasion='',kind='recommend'}={}){
 const story=storyFor(name),title=shortName(name)||'이 제품';
 if(kind==='conversation')return story.talk;
 if(kind==='guide')return story.guide;
 if(occasion==='직접'&&!customOccasion.trim())throw new Error('직접 적을 선물 상황을 한 줄 넣어주세요.');
 const starts={
  '집들이':`집들이 선물은 친구 집에 둘 모습부터 생각하면서 고르고 싶어 ${story.emoji}`,
  '응원':`첫 출근이나 새 일상을 앞둔 사람한테, 자주 쓸 물건 하나 챙겨주고 싶어 ${story.emoji}`,
  '나를 위한 선물':`이번에는 남 줄 선물 말고 내가 쓸 걸 고르고 있어 ${story.emoji}`,
  '가벼운 감사':`고맙다는 말에 작은 선물 하나 같이 보내고 싶어 ${story.emoji}`,
  '문득':`기념일이 아니어도 좋아할 만한 물건을 발견하면 보내주고 싶어 ${story.emoji}`,
  '부담없이':`큰 의미를 담기보다 평소 취향 기억해서 골라주고 싶어 ${story.emoji}`
 };
 const lead=occasion==='직접'?clean(customOccasion):starts[occasion]||story.lead;
 const c=title.charCodeAt(title.length-1),topic=c>=0xac00&&c<=0xd7a3&&(c-0xac00)%28?'은':'는';
 const detail=verifiedSentence(name,facts);
 let body=detail?`${title}${topic} ${detail[0].toLowerCase()+detail.slice(1)}`:`${title}도 후보에 넣어봤어. ${story.reason}`;
 // The sentence already names the subject; avoid a repeated functional noun.
 body=body.replace('손난로는 손을 데우는 용도에','손난로는').replace('스테인리스야.','스테인리스로 되어 있어.');
 return [clean(lead),clean(body)].filter(Boolean).join('\n\n');
}
export function makePosts(input){return Object.fromEntries(['recommend','conversation','guide'].map(kind=>[kind,makeCopy({...input,kind})]));}
export function postForMode(current){
 if(current?.posts)return current.posts[current.mode||'recommend']||'';
 return current?.postText??[...(current?.sections||[]),current?.link].filter(Boolean).join('\n\n');
}
