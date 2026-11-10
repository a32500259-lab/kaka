// Concrete everyday situations, not claims of ownership or tested performance.
export const livingTypes=[
 {id:'towel',match:/수건|타월|타올|샤워가운/,emoji:'🛁',person:'욕실 물건도 깔끔하게 맞추는 친구',hook:'수건까지 취향 맞춰 쓰는 친구 있잖아 🛁',reason:'욕실에 걸어둘 색 생각하면서 고르는 것도 은근 재밌겠다.',end:'집들이 갈 때 친구가 좋아하는 색으로 챙겨주고 싶음.',home:'집들이 선물, 욕실에 둘 것까지 생각해봤어 🛁',self:'욕실 수건 바꿀 때 된 사람… 일단 나 🛁'},
 {id:'bedding',match:/이불|침구|담요|베개|쿠션|블랭킷/,emoji:'🛋️',person:'집에서 쉬는 시간을 좋아하는 친구',hook:'집에서 쉬는 게 제일 좋다는 친구한테 🛋️',reason:'이런 건 친구 방에 놓인 모습부터 상상하게 돼.',end:'평소 방 사진에 자주 보이던 색으로 골라주고 싶다.',home:'집들이 선물 고르다 친구 침대 색까지 떠올리는 중 🛋️',self:'방에서 보내는 시간에 하나쯤 챙겨주고 싶어서 🛋️'},
 {id:'light',match:/무드등|조명|스탠드등|수면등|램프/,emoji:'💡',person:'방 분위기를 꾸미는 친구',hook:'방 꾸미는 친구한테 조명 선물은 좀 탐난다 💡',reason:'침대 옆에 둘지 책상에 둘지, 자리부터 떠올려보게 되는 물건.',end:'친구 방 사진 다시 보고 골라야겠어.',home:'이사한 친구 방에 조명 하나 골라주고 싶다면 💡',self:'내 방에 둘 조명 보다가 시간 가는 줄 모르는 중 💡'},
 {id:'storage',match:/정리함|수납함|수납장|트롤리|바구니|보관함|정리대|선반/,emoji:'🧺',person:'물건마다 자리를 정해두는 친구',hook:'작은 물건도 자리 정해서 두는 친구한테 🧺',reason:'정리용품은 뭘 넣을지 생각하면서 보면 고르는 맛이 있지.',end:'책상용인지 욕실용인지, 놓을 자리 떠올려보고 고르면 되겠다.',home:'이사하고 물건 자리 잡는 중인 친구한테 🧺',self:'정리해야지 생각만 하다가 수납함부터 보는 중 🧺'},
 {id:'cleaning',match:/청소기|청소솔|청소포|밀대|빗자루|돌돌이|먼지떨이|세제|세정제|수세미/,emoji:'🫧',person:'생활에 바로 쓰는 선물을 좋아하는 친구',hook:'선물은 바로 꺼내 쓰는 게 좋다는 친구라면 🫧',reason:'청소용품도 평소 어떤 걸 쓰는지 알면 선물 후보가 되겠네.',end:'집에 필요한 거 있냐고 물었을 때 이런 거 말하는 친구 꼭 있지.',home:'이사한 친구가 생활용품으로 골라달라고 하면 🫧',self:'집 정리할 때 같이 바꿀 물건 찾다가 🫧'},
 {id:'bath',match:/샤워기|욕실매트|욕실 매트|발매트|비누|핸드워시|바디워시|디스펜서|칫솔|치약/,emoji:'🫧',person:'욕실 소품에도 취향이 있는 친구',hook:'욕실에 두는 작은 물건도 취향 확실한 친구에게 🫧',reason:'매일 마주치는 물건이라 이런 쪽으로 선물 골라도 좋겠어.',end:'친구 욕실에 잘 어울릴지 생각하면서 보는 중.',home:'집들이 선물 찾다가 욕실 소품 쪽으로 와봤어 🫧',self:'욕실에 두고 쓸 내 물건 하나 고르는 중 🫧'},
 {id:'kitchen',match:/프라이팬|후라이팬|냄비|도마|칼세트|식기|접시|그릇|커트러리|수저|밀폐용기|도시락|주방저울|조리도구|앞치마/,emoji:'🍽️',person:'집밥 차리는 걸 좋아하는 친구',hook:'집밥 사진 자주 올리는 친구한테 줄 거 찾다가 🍽️',reason:'밥 차릴 때 꺼내 쓰는 물건 쪽으로 골라주면 어떨까 싶어.',end:'요리 좋아하는 친구라면 이런 쪽도 반가워하겠다.',home:'첫 자취 시작한 친구 선물, 주방 쪽으로 골라보는 중 🍽️',self:'집밥 좀 해먹겠다고 주방용품부터 구경하는 중 🍽️'},
 {id:'cup',match:/텀블러|머그|컵|보온병|물병|티포트/,emoji:'☕',person:'마시는 시간에도 취향이 있는 친구',hook:'컵 하나도 취향 확실하게 고르는 친구 있잖아 ☕',reason:'책상에 둘 건지 들고 다닐 건지 생각하면서 고르면 좋겠어.',end:'평소 좋아하는 색은 기억해뒀다가 이런 때 써먹는 거지.',home:'이사한 친구한테 새 컵 하나 골라주고 싶어서 ☕',self:'집에 컵은 있는데 새 컵도 보고 싶은 마음 ☕'},
 {id:'scent',match:/디퓨저|캔들|룸스프레이|인센스|방향제/,emoji:'🌿',person:'집에서 쓰는 향에 관심이 있는 친구',hook:'집에 쓰는 향까지 취향 확실한 친구한테 🌿',reason:'향 선물은 평소 뭘 좋아하는지 기억해두면 고르기 재밌겠다.',end:'좋아하는 향 계열 슬쩍 물어봐야지.',home:'새집에 둘 향 고르는 친구한테 🌿',self:'집에 들어올 때 맡고 싶은 향 찾는 중 🌿'},
 {id:'air',match:/가습기|공기청정기|제습기|선풍기|서큘레이터/,emoji:'🏠',person:'집에서 쓸 가전을 찾는 친구',hook:'집에서 쓸 물건 선물로 찾는 중이면 🏠',reason:'이런 가전은 어디에 놓고 쓸지부터 생각해보게 돼.',end:'친구 집에 이미 있는지만 슬쩍 확인해봐야겠다.',home:'이사한 친구한테 필요한 가전 뭐 있나 보다가 🏠',self:'집에 들일 작은 가전 구경하는 중 🏠'},
 {id:'hair',match:/고데기|헤어드라이어|헤어 드라이어|빗|헤어브러시/,emoji:'🪞',person:'머리 손질을 자주 하는 친구',hook:'머리 손질 자주 하는 친구한테 줄 거 찾다가 🪞',reason:'평소 어떤 식으로 머리 만지는지 생각하면 고르기 좀 쉬워지겠어.',end:'인테리어 소품보다 이런 쪽 반가워할 친구도 있잖아.',home:'친구 화장대에 둘 선물 찾다가 🪞',self:'아침에 머리 만질 때 쓸 거 구경하는 중 🪞'},
 {id:'desk',match:/충전기|보조배터리|거치대|키보드|마우스|데스크매트|데스크 매트/,emoji:'🖥️',person:'책상 위 물건에 관심이 많은 친구',hook:'책상 위 물건 고르는 데 진심인 친구한테 🖥️',reason:'매일 쓰는 자리라 자기 취향 하나 들어가는 재미가 있지.',end:'친구 책상에 놓인 모습 떠올려보면서 고르는 중.',home:'이사한 친구 책상에 둘 물건 찾다가 🖥️',self:'책상 정리하다가 새 물건까지 구경하는 흐름 🖥️'},
 {id:'slippers',match:/슬리퍼|실내화/,emoji:'🏠',person:'집에서 편하게 지내는 걸 좋아하는 친구',hook:'집에서 쓰는 선물로 실내화도 괜찮겠네 🏠',reason:'크게 꾸미는 물건 말고, 집에서 자주 손 가는 쪽으로 골라보고 싶었어.',end:'친구 발 사이즈 아는 게 이런 때 도움 되지.',home:'이사한 친구 집에 놓을 실내화 찾다가 🏠',self:'집에서 신을 것까지 내 취향으로 고르고 싶어서 🏠'}
];
export function livingProfile(name){const main=name.replace(/\[[^\]]*\]|\([^)]*\)/g,' ').split(/\+|증정|행사기간/)[0];return livingTypes.find(x=>x.match.test(main));}
const price=/가격|할인|최저가|\d[\d,.]*\s*(?:만\s*)?원|[₩￦]/;
export function livingDetail(name,facts){
 const source=(name+'\n'+facts).split(/\n|[.!?]/).filter(s=>!price.test(s)&&!/(아닌|아니|없음|미지원|불가|별도|제외)/.test(s)).join(' ');
 const rules=[
  [/밝기\s*(?:조절|조정)/,'밝기 조절되는 타입이라 놓을 자리부터 떠올려보게 돼.'],
  [/분리\s*세척/,'분리해서 세척할 수 있다는 점이 눈에 들어왔어.'],
  [/식기세척기\s*(?:사용\s*)?가능/,'식기세척기에 넣을 수 있는 구성이라 이 부분 먼저 보게 되네.'],
  [/접이식/,'접어둘 수 있는 타입. 보관할 자리 생각하면 이런 부분부터 보게 돼.'],
  [/높이\s*조절/,'높이 조절되는 제품이네. 어디에 놓을지 같이 생각해봐야겠다.'],
  [/무선\s*충전/,'무선 충전되는 타입이라 쓰는 기기랑 같이 확인해보면 되겠어.'],
  [/무선/,'무선으로 쓰는 타입. 놓을 자리 상상하면서 보는 중.'],
  [/파우치\s*(?:포함|구성|세트)/,'파우치까지 같이 들어 있는 구성이네.'],
  [/스테인리스|스텐레스/,'스테인리스 소재라는 점이 눈에 들어왔어.']
 ];
 for(const [pattern,line] of rules)if(pattern.test(source))return line;
 const capacity=source.match(/\b(\d+(?:\.\d+)?)\s*(ml|mL|리터|L)\b/);
 if(capacity)return `${capacity[1]}${capacity[2]} 용량. 평소 쓰는 크기랑 비교해보면 고르기 좋겠어.`;
 return '';
}
export function livingCopy({name,title,facts,occasion}){
 const p=livingProfile(name);if(!p)return null;
 let hook=p.hook,end=p.end;
 if(occasion==='집들이'){hook=p.home;end='집들이 갈 때 이런 쪽으로 챙겨도 좋겠다.';}
 if(occasion==='나를 위한 선물'){hook=p.self;end='선물 고르러 왔다가 내 취향 찾는 중.';}
 if(occasion==='응원')hook=`새 일상 시작한 친구한테, ${title} ${p.emoji}`;
 if(occasion==='가벼운 감사')end='고맙다는 말이랑 같이, 평소 취향 기억해서 골랐다고 주고 싶어.';
 if(occasion==='문득')end='기념일은 아닌데 이런 거 보면 생각나는 사람 있어.';
 if(occasion==='부담없이')end='“네가 이런 거 좋아하잖아” 하고 건네고 싶은 쪽.';
 const detail=livingDetail(name,facts);
 const last=title.charCodeAt(title.length-1),hasFinal=last>=0xac00&&last<=0xd7a3&&(last-0xac00)%28!==0;
 const topic=hasFinal?'은':'는';
 const introductions={
  towel:`${title}처럼 매일 꺼내 쓰는 물건도 좋겠어.`,
  bedding:`${title} 보고 있는데, 친구 방에 놓으면 어떨까 싶어서.`,
  light:`${title} 하나 골라주는 것도 재밌겠다.`,
  storage:`${title}${topic} 뭘 넣을지부터 생각하게 되네.`,
  cleaning:`${title}도 선물 후보에 넣어봤어.`,
  bath:`${title}처럼 매일 마주치는 물건 쪽으로 보고 있어.`,
  kitchen:`${title}도 있네. 좋아하는 그릇이나 주방 색이랑 맞춰줘도 좋겠다.`,
  cup:`${title} 보고 있어. 컵 선물은 색 고르는 게 제일 고민돼.`,
  scent:`${title}${topic} 좋아하는 향부터 알아두고 고르면 좋겠어.`,
  air:`${title}도 눈에 들어오네. 어디에 놓고 쓸지부터 생각해보는 중.`,
  hair:`${title}도 있네. 평소 머리 손질 자주 하는 친구한테 생각날 듯.`,
  desk:`${title} 보고 있는데, 친구 책상에 어울릴까 싶어서.`,
  slippers:`${title} 하나 골라주는 것도 좋겠다.`
 };
 const body=[hook.includes(title)?'':introductions[p.id],detail].filter(Boolean).join('\n');
 return {hook,body,end,emoji:p.emoji,person:p.person,kind:p.id};
}
