import {variedPosts,variedCopy,describePlan,sceneFor,scenes,productLens} from './variation.js?v=2899231f4410f3f8';
export {describePlan,sceneFor,scenes,productLens};
// Product facts select the subject; gift occasions only change the angle.
// Never turn title keywords into claims about personal use or performance.
const money=/(?:[₩￦]\s*\d|\d[\d,.]*\s*(?:만\s*)?원|가격|최저가|할인가|가성비|무료배송|할인율|\d+\s*%)/;
const clean=s=>String(s||'').replace(/[ㄱ-ㅎㅏ-ㅣ]+/g,'').split('\n').map(line=>line.split(/(?<=[.!?])\s+/).filter(x=>!money.test(x)).join(' ')).filter(Boolean).join('\n').trim();
export function shortName(raw){
 const s=String(raw).replace(/\[[^\]]*\]|\([^)]*\)/g,' ').split(/\+|증정|행사기간/)[0].trim();
 if(/핑크퐁|아기상어/.test(raw)&&/목욕|디스펜서/.test(raw))return '핑크퐁 아기상어 목욕놀이 세트';
 if(/손난로/.test(s)&&/고구마|군밤/.test(s))return (/단미/.test(s)?'단미 ':'')+'고구마·군밤 손난로';
 const concise=s.replace(/밝기\s*조절|분리\s*세척|스테인리스|스텐레스|접이식|\d+(?:\.\d+)?\s*(?:ml|mL|리터)\b/g,' ').replace(/\s+/g,' ').trim();
 const main=concise.match(/^.*?(?:빗고데기|손난로|바디\s*(?:에어\s*)?드라이어|보조배터리|텀블러|디퓨저|머그컵|키보드|이어폰|케이크|쿠키|목걸이|머플러|핸드크림|향수|스피커|파우치|가방|지갑|캔들|조명|무드등|수건|타월|타올|샤워가운|이불|침구|담요|베개|쿠션|블랭킷|수납함|정리함|트롤리|선반|청소기|밀대|청소솔|세제|세정제|샤워기|발매트|핸드워시|바디워시|디스펜서|프라이팬|냄비|도마|접시|그릇|밀폐용기|도시락|커트러리|수저|물병|티포트|가습기|제습기|공기청정기|선풍기|서큘레이터|거치대|충전기|슬리퍼|실내화)/)?.[0]||concise;
 return main.split(/\s+/).filter(w=>!money.test(w)&&!/^20\d{2}$/.test(w)).slice(0,7).join(' ').trim();
}
export function makeCopy(input={}){return variedCopy(input,shortName(input.name)||'이 제품')}
export function makePosts(input){return variedPosts(input,shortName(input.name)||'이 제품')}
export function postForMode(current){
 if(current?.posts)return current.posts[current.mode||'recommend']||'';
 return current?.postText??[...(current?.sections||[]),current?.link].filter(Boolean).join('\n\n');
}
