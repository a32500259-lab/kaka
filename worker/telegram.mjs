


function telegramReference(fields) {
  const edited = fields?.referenceEdit?.mapValue?.fields?.text?.stringValue;
  if (edited?.trim()) return edited.trim().slice(0, 1200);
  const lines = (fields?.text?.stringValue || '').trim().split(/\r?\n/);
  const author = (fields?.author?.stringValue || '').replace(/^@/, '');
  if (author && lines[0]?.trim().replace(/^@/, '') === author) {
    lines.shift();
    const date = lines.slice(0, 3).findIndex(line =>
      /^(?:\d+\s*(?:초|분|시간|일|주)(?:\s*전)?|\d{4}-\d{2}-\d{2})$/.test(line.trim()));
    if (date >= 0) lines.splice(0, date + 1);
  }
  let end = lines.length;
  let counters = 0;
  let marker = false;
  while (end > 0) {
    const line = lines[end - 1].trim();
    if (/^(?:[\d,.]+\s*(?:만|천|[KM])?|\d+\s*\/\s*\d+)$/i.test(line)) {
      counters++;
      if (line.includes('/')) marker = true;
    } else if (line === '/') marker = true;
    else if (line && !/^(?:번역하기|AI 콘텐츠)$/.test(line)) break;
    end--;
  }
  return (counters >= 2 || marker ? lines.slice(0, end) : lines).join('\n').trim().slice(0, 1200);
}

async function readTelegramReferences(env, fetcher) {
  const refresh = await fetcher('https://securetoken.googleapis.com/v1/token?key=' + encodeURIComponent(env.TELEGRAM_FIREBASE_API_KEY), {
    method: 'POST',
    body: new URLSearchParams({grant_type: 'refresh_token', refresh_token: env.TELEGRAM_FIREBASE_REFRESH_TOKEN}),
    signal: AbortSignal.timeout(10000)
  });
  if (!refresh.ok) throw new Error('Firestore authentication failed');
  const token = await refresh.json();
  if (token.user_id !== env.TELEGRAM_FIREBASE_BOT_UID || !token.id_token) throw new Error('Firestore user mismatch');
  const url = 'https://firestore.googleapis.com/v1/projects/kaka-2dae9/databases/(default)/documents/users/'
    + encodeURIComponent(env.TELEGRAM_FIREBASE_UID) + '/workspace/collectedThreads?mask.fieldPaths=items';
  const response = await fetcher(url, {
    headers: {Authorization: 'Bearer ' + token.id_token},
    signal: AbortSignal.timeout(10000)
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error('Firestore read failed');
  const doc = await response.json();
  return (doc.fields?.items?.arrayValue?.values || []).map(item => telegramReference(item.mapValue?.fields)).filter(Boolean);
}

export async function telegramSend(env, text, fetcher, replyMarkup) {
  const response = await fetcher('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/sendMessage', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({chat_id: env.TELEGRAM_CHAT_ID, text, reply_markup: replyMarkup}),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error('Telegram reply failed');
  return result.result;
}

export function isOwnerTelegramUpdate(update, env) {
  const message = update?.message;
  return Boolean(env.TELEGRAM_CHAT_ID && message?.chat?.type === 'private' &&
    String(message.chat.id) === env.TELEGRAM_CHAT_ID && String(message.from?.id) === env.TELEGRAM_CHAT_ID &&
    message.from?.is_bot === false);
}

export async function processTelegramUpdate(update, env, {fetcher = fetch, random = Math.random} = {}) {
  if (!isOwnerTelegramUpdate(update, env)) return;
  const message = update.message;
  const source = typeof message.text === 'string' ? message.text.trim() : '';
  if (!source) return;
  if (/^\/start(?:\s|$)/.test(source)) return telegramSend(env, '일상글로 쓸 소재를 한 줄 보내주세요. 초안 아래에서 번호를 선택해 예약할 수 있어요.', fetcher);
  if (!env.TELEGRAM_FIREBASE_UID || !env.TELEGRAM_FIREBASE_BOT_UID || !env.TELEGRAM_FIREBASE_API_KEY ||
      !env.TELEGRAM_FIREBASE_REFRESH_TOKEN || !env.GIFT_WRITER_TOKEN) {
    return telegramSend(env, '텔레그램 연결은 됐어요. 수집글과 글쓰기 서버 연결을 마치면 일상글을 만들 수 있어요.', fetcher);
  }
  if (source.length > 4000) return telegramSend(env, '소재를 4,000자 이내로 보내주세요.', fetcher);
  let references;
  try {
    references = [...new Set(await readTelegramReferences(env, fetcher))];
  } catch {
    return telegramSend(env, '수집글을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.', fetcher);
  }
  const selected = [];
  while (selected.length < 3 && references.length) {
    const [reference] = references.splice(Math.floor(random() * references.length), 1);
    selected.push(reference);
  }
  if (!selected.length) {
    return telegramSend(env, 'Firebase에 저장된 참고글이 없어요. 선물노트에서 수집글을 동기화해 주세요.', fetcher);
  }
  if (selected.length < 3) {
    await telegramSend(env, '서로 다른 참고글이 '+selected.length+'편 있어서 이번에는 '+selected.length+'편을 만들게요.', fetcher);
  }
  const drafts = [];
  for (const [index, reference] of selected.entries()) {
    const isThirdDraft = index === 2;
    const emojiCount = isThirdDraft ? 10 + Math.floor(random() * 6) : 0;
    let accepted = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetcher('https://gift-note-studio-sdkim.stillterrapin2.chatgpt.site/api/generate', {
          method: 'POST',
          headers: {Authorization: 'Bearer ' + env.GIFT_WRITER_TOKEN, 'Content-Type': 'application/json'},
          body: JSON.stringify({mode: 'daily', source, targetLength: isThirdDraft ? 100 : 200, referenceThreads: [{text: reference}]}),
          signal: AbortSignal.timeout(240000)
        });
        if (!response.ok) throw new Error('Writer request failed');
        const draft = await response.json();
        if (draft.qualityReview?.status !== 'passed' || typeof draft.text !== 'string' || !draft.text.trim()) {
          throw new Error('Voice review failed');
        }
        const text = isThirdDraft
          ? formatThirdDraft(draft.text, source, emojiCount)
          : formatTelegramEmoji(draft.text, source);
        if (drafts.some(previous => previous && tooSimilar(previous, text))) {
          console.info('Telegram draft similarity check rejected a candidate');
          continue;
        }
        accepted = text;
        break;
        } catch {
        break;
      }
    }
    drafts.push(accepted);
  }
  let keyboard;
  if (env.THREADS_SCHEDULE && drafts.some(Boolean)) {
    const result = await env.THREADS_SCHEDULE.getByName('owner').fetch('https://schedule.internal/drafts', {
      method: 'POST', body: JSON.stringify({drafts, id: String(update.update_id ?? message.message_id)})
    });
    if (!result.ok) throw new Error('예약 초안 저장 실패');
    keyboard = (await result.json()).keyboard;
  }
  for (const [index, draft] of drafts.entries()) {
    const label = (index + 1) + '/' + selected.length;
    const text = draft || '다른 초안과 구별되는 글을 완성하지 못했어요.';
    await telegramSend(env, label + '\n\n' + text, fetcher, draft ? keyboard : undefined);
  }
}

export function tooSimilar(first, second) {
  const normalize = text => text.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '');
  const trigrams = text => new Set(Array.from({length: Math.max(0, text.length - 2)}, (_, i) => text.slice(i, i + 3)));
  const overlap = (left, right) => {
    const a = trigrams(left), b = trigrams(right);
    const shared = [...a].filter(part => b.has(part)).length;
    return shared / Math.max(1, Math.min(a.size, b.size));
  };
  const a = normalize(first), b = normalize(second);
  if (a === b || overlap(a, b) >= 0.55) return true;
  const aLines = first.split('\n').map(normalize).filter(Boolean);
  const bLines = second.split('\n').map(normalize).filter(Boolean);
  const paired = aLines.filter((line, index) => bLines[index] && overlap(line, bLines[index]) >= 0.55).length;
  return paired >= 2 && paired / Math.min(aLines.length, bLines.length) >= 0.5;
}

function formatThirdDraft(text, source, count) {
  const segments = new Intl.Segmenter('ko', {granularity: 'grapheme'});
  const length = value => [...segments.segment(value)].length;
  const isEmoji = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u;
  const originalEmoji = [...segments.segment(text)].map(({segment}) => segment).filter(segment => isEmoji.test(segment));
  const themes = [
    [/비행기|공항|여행/, ['✈️', '🧳', '🎫', '☁️', '🌍']],
    [/산책|공원|바람/, ['🌿', '🍃', '🌙', '🌳', '👟']],
    [/빵|카페|커피/, ['🥐', '🍞', '☕', '🍰']],
    [/비가|빗소리|우산/, ['☔', '🌧️', '💧']],
    [/퇴근|집에/, ['🏠', '🌆', '😌']],
  ];
  const palette = [...new Set([...originalEmoji, ...themes.filter(([pattern]) => pattern.test(source)).flatMap(([, icons]) => icons),
    '👀', '✨', '💬', '😊', '💛', '💭', '🙌', '🤍', '💫', '🙂', '⭐', '👏', '🎈', '😄', '💗'])].slice(0, count);
  const clean = line => [...segments.segment(line)].filter(({segment}) => !isEmoji.test(segment))
    .map(({segment}) => segment).join('').replace(/ {2,}/g, ' ').trim();
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const budget = 100 - count - 4;
  const kept = lines.slice(0, 4);
  while (kept.length < 4) {
    const index = kept.reduce((longest, line, i) => length(line) > length(kept[longest]) ? i : longest, 0);
    const words = kept[index]?.split(' ') ?? [];
    if (words.length < 2) throw new Error('Third draft needs four lines');
    const middle = Math.ceil(words.length / 2);
    kept.splice(index, 1, words.slice(0, middle).join(' '), words.slice(middle).join(' '));
  }
  while (length(kept.join('')) > budget) {
    const index = kept.reduce((longest, line, i) => line.includes(' ') && (longest < 0 || length(line) > length(kept[longest])) ? i : longest, -1);
    if (index < 0) throw new Error('Third draft could not fit');
    kept[index] = kept[index].slice(0, kept[index].lastIndexOf(' '));
  }
  const [first, second, third, fourth] = kept.map((line, index) => {
    const start = Math.floor(index * count / 4);
    const end = Math.floor((index + 1) * count / 4);
    return line + ' ' + palette.slice(start, end).join('');
  });
  return `${first}\n\n${second}\n\n${third}\n${fourth}`;
}

function formatTelegramEmoji(text, source) {
  const emoji = /\p{Extended_Pictographic}(?:\uFE0F)?/gu;
  const themes = [
    [/빵|베이커리/, ['🥐', '🍞']],
    [/커피|카페/, ['☕', '🍰']],
    [/산책|공원|나무/, ['🌿', '🍃']],
    [/비가|빗소리|우산/, ['☔', '🌧️']],
    [/고양이|냥이/, ['🐱', '🐾']],
    [/강아지|반려견/, ['🐶', '🐾']],
    [/퇴근|집에|쉬는/, ['🏠', '😌']]
  ];
  const choices = [...themes.filter(([pattern]) => pattern.test(source)).flatMap(([, items]) => items), '😊', '💭', '✨', '💛'];
  const lines = text.split('\n');
  const used = new Set();
  for (const [index, line] of lines.entries()) {
    lines[index] = line.replace(emoji, symbol => {
      const key = symbol.replace(/\uFE0F/g, '');
      if (used.size >= 4 || used.has(key)) return '';
      used.add(key);
      return symbol;
    }).trimEnd();
  }
  const nonempty = lines.map((line, index) => ({line, index})).filter(({line}) => line);
  const slots = [...nonempty.filter(({line}) => !line.match(emoji)), ...nonempty];
  for (const {index} of slots) {
    if (used.size >= 3) break;
    const symbol = choices.find(item => !used.has(item.replace(/\uFE0F/g, '')));
    lines[index] += ' ' + symbol;
    used.add(symbol.replace(/\uFE0F/g, ''));
  }
  return lines.join('\n');
}
