import {isOwnerTelegramUpdate, telegramSend} from './telegram.mjs';

const account = 'pocket.note_';
const api = 'https://graph.threads.net/v1.0';
const seoul = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Seoul', dateStyle: 'short', timeStyle: 'short'
});
const dateInSeoul = time => seoul.format(time).slice(0, 10);
const pad = value => String(value).padStart(2, '0');
const rows = (items, size) => Array.from({length: Math.ceil(items.length / size)},
  (_, index) => items.slice(index * size, (index + 1) * size));
const button = (text, id, action, value = '') => ({
  text, callback_data: ['sn', id, action, value].join(':')
});
const keyboard = inline_keyboard => ({inline_keyboard});
const message = (text, buttons = []) => ({text, keyboard: keyboard(buttons)});

export function parseTime(value) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value)) return NaN;
  const time = Date.parse(value.replace(' ', 'T') + ':00+09:00');
  return Number.isFinite(time) && seoul.format(time) === value ? time : NaN;
}

export function isOwnerScheduleUpdate(update, env) {
  const callback = update?.callback_query;
  return Boolean(env.TELEGRAM_CHAT_ID && callback?.message?.chat?.type === 'private' &&
    String(callback.message.chat.id) === env.TELEGRAM_CHAT_ID &&
    String(callback.from?.id) === env.TELEGRAM_CHAT_ID && callback.from?.is_bot === false &&
    callback.message.from?.is_bot === true && /^sn:/.test(callback.data || ''));
}

async function telegramCall(env, method, body, fetcher) {
  const response = await fetcher('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/' + method, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    if (method === 'editMessageText' && result.description?.includes('message is not modified')) return;
    throw new Error('Telegram schedule delivery failed');
  }
  return result.result;
}

export async function handleScheduleCommand(update, env, {fetcher = fetch} = {}) {
  const callback = isOwnerScheduleUpdate(update, env) ? update.callback_query : null;
  const input = isOwnerTelegramUpdate(update, env) ? update.message.text?.trim() : '';
  if (!callback && !/^예약(?:\s|$)|^예약(?:확정|취소|목록|변경|연결확인)$/.test(input || '')) return false;
  if (callback) {
    await telegramCall(env, 'answerCallbackQuery', {callback_query_id: callback.id}, fetcher).catch(() => {});
  }
  if (!env.THREADS_ACCESS_TOKEN || !env.THREADS_SCHEDULE) {
    await telegramSend(env, 'Threads 예약 연결을 확인해 주세요.', fetcher);
    return true;
  }
  const command = {
    input, callback: callback?.data,
    messageId: String(update.update_id ?? callback?.id ?? update.message.message_id)
  };
  if (input?.startsWith('예약 ')) {
    const original = update.message.reply_to_message;
    const draft = original?.text?.match(/^[1-3]\/[1-3]\n\n([\s\S]+)$/)?.[1];
    const time = parseTime(input.slice(3).trim());
    if (original?.from?.username?.toLowerCase() !== 'kakagiftnotedailybot' ||
        !original?.from?.is_bot || !draft || draft === '다른 초안과 구별되는 글을 완성하지 못했어요.' ||
        Array.from(draft).length > 500 || !(time > Date.now())) {
      await telegramSend(env, '올릴 초안에 답장으로 예약 YYYY-MM-DD HH:mm을 보내주세요. 한국 시간 기준이에요.', fetcher);
      return true;
    }
    Object.assign(command, {draft, time});
  }
  const result = await env.THREADS_SCHEDULE.getByName('owner').fetch('https://schedule.internal/command', {
    method: 'POST', body: JSON.stringify(command)
  });
  if (!result.ok) throw new Error('예약 처리 실패');
  const view = await result.json();
  if (callback) {
    try {
      await telegramCall(env, 'editMessageText', {
        chat_id: env.TELEGRAM_CHAT_ID, message_id: callback.message.message_id,
        text: view.text, reply_markup: view.keyboard
      }, fetcher);
    } catch {
      await telegramSend(env, view.text, fetcher, view.keyboard);
    }
  } else {
    await telegramSend(env, view.text, fetcher, view.keyboard);
  }
  return true;
}

function draftButtons(flow) {
  return keyboard([flow.drafts.flatMap((draft, index) =>
    draft ? [button((index + 1) + '번 선택', flow.id, 'pick', index)] : [])]);
}

function dateView(flow, offset = 0) {
  const today = dateInSeoul(Date.now());
  const start = Date.parse(today + 'T12:00:00+09:00');
  const days = Array.from({length: 7}, (_, index) => {
    const day = dateInSeoul(start + (offset + index) * 86400000);
    return button(day.slice(5).replace('-', '/') + (day === today ? ' 오늘' : ''), flow.id, 'date', day);
  });
  return message('게시할 날짜를 선택해 주세요\n한국 시간 기준 · ' + (flow.index + 1) + '번 초안', [
    ...rows(days, 4),
    [button('이전 주', flow.id, 'days', Math.max(0, offset - 7)),
      button('다음 주', flow.id, 'days', offset + 7)],
    [button('선택 취소', flow.id, 'close')]
  ]);
}

function hourView(flow) {
  return message(flow.day + ' · 게시할 시간을 선택해 주세요\n한국 시간 기준', [
    ...rows(Array.from({length: 24}, (_, hour) => button(pad(hour) + '시', flow.id, 'hour', hour)), 6),
    [button('날짜 다시 선택', flow.id, 'days', 0)]
  ]);
}

function minuteView(flow) {
  return message(flow.day + ' ' + pad(flow.hour) + '시 · 분을 선택해 주세요', [
    [0, 15, 30, 45].map(minute => button(pad(minute) + '분', flow.id, 'minute', minute)),
    [button('시간 다시 선택', flow.id, 'hours')]
  ]);
}

function confirmView(flow) {
  return message('예약 내용을 확인해 주세요\n@' + account + '\n' + seoul.format(flow.time) +
    ' KST\n\n' + flow.drafts[flow.index], [
    [button('예약 확정', flow.id, 'confirm', flow.revision)],
    [button('날짜·시간 변경', flow.id, 'days', 0), button('선택 취소', flow.id, 'close')]
  ]);
}

function savedView(job) {
  return message('예약 완료 ✓\n@' + account + ' · ' + seoul.format(job.time) + ' KST\n\n' + job.draft, [
    [button('예약 변경', job.id, 'change'), button('예약 취소', job.id, 'cancel')],
    [button('예약목록', job.id, 'list')]
  ]);
}

export class ThreadsSchedule {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    const command = await request.json();
    const storage = this.ctx.storage;
    if (new URL(request.url).pathname === '/drafts') {
      const flow = {id: crypto.randomUUID().slice(0, 8), drafts: command.drafts, revision: 0};
      const result = await storage.transaction(async tx => {
        const existing = await tx.get('batch:' + command.id);
        if (existing) return existing;
        await tx.put('flow', flow);
        const response = {keyboard: draftButtons(flow)};
        await tx.put('batch:' + command.id, response);
        return response;
      });
      return Response.json(result);
    }
    if (command.input === '예약연결확인') {
      try {
        const result = await fetch(api + '/me?fields=username', {
          headers: {Authorization: 'Bearer ' + this.env.THREADS_ACCESS_TOKEN},
          signal: AbortSignal.timeout(10000)
        });
        const profile = await result.json();
        return Response.json({...message(result.ok && profile.username === account
          ? '@' + account + ' 연결 정상 ✓\n초안 번호 → 날짜 → 시간 → 예약 확정 순서로 선택하세요.'
          : 'Threads 계정 연결을 다시 확인해 주세요.'),
          connection: {httpStatus: result.status, username: profile.username,
            errorCode: profile.error?.code, errorSubcode: profile.error?.error_subcode,
            errorMessage: profile.error?.message?.replaceAll(this.env.THREADS_ACCESS_TOKEN, '[hidden]').slice(0,350)}});
      } catch {
        return Response.json(message('Threads 연결 확인에 응답이 없어요. 잠시 후 다시 확인해 주세요.'));
      }
    }
    const response = await storage.transaction(async tx => {
      const cacheKey = 'command:' + command.messageId;
      const previous = await tx.get(cacheKey);
      if (previous) return previous;
      let flow = await tx.get('flow');
      const job = await tx.get('job');
      const [, id, action, value] = command.callback?.split(':') || [];
      let view;
      if (command.input === '예약목록' || action === 'list') {
        view = job ? savedView(job) : message('예약된 글이 없어요.');
      } else if (command.input === '예약취소' || action === 'cancel') {
        if (action === 'cancel' && (!job || job.id !== id)) {
          view = message('이미 취소되거나 처리된 예약이에요. 예약목록으로 확인해 주세요.');
        } else {
          await tx.delete('job');
          await tx.delete('flow');
          await tx.delete('pending');
          await tx.deleteAlarm();
          view = message('예약을 취소했어요.');
        }
      } else if (command.input === '예약변경' || action === 'change') {
        if (!job || (id && id !== job.id)) view = message('변경할 예약이 없어요.');
        else {
          flow = {id: crypto.randomUUID().slice(0, 8), drafts: [job.draft], index: 0, revision: 0, editing: job.id};
          await tx.put('flow', flow);
          view = dateView(flow);
        }
      } else if (command.draft) {
        flow = {id: crypto.randomUUID().slice(0, 8), drafts: [command.draft],
          index: 0, time: command.time, revision: 1};
        await tx.put('flow', flow);
        view = confirmView(flow);
      } else if (command.input === '예약확정' || action === 'confirm') {
        const pending = await tx.get('pending');
        if (!flow && pending) flow = {id: 'legacy', drafts: [pending.draft], index: 0, time: pending.time};
        if (!flow || (id && (flow.id !== id || String(flow.revision) !== value)) || !flow.time) {
          view = message('현재 확인 화면의 예약 확정 버튼을 눌러주세요.');
        } else if (job && job.id !== flow.editing) {
          view = message('먼저 기존 예약을 변경하거나 취소해 주세요.', savedView(job).keyboard.inline_keyboard);
        } else if (flow.time <= Date.now()) {
          flow.time = null;
          await tx.put('flow', flow);
          view = dateView(flow);
        } else {
          const scheduled = {id: flow.id, draft: flow.drafts[flow.index], time: flow.time};
          await tx.put('job', scheduled);
          await tx.delete('flow');
          await tx.delete('pending');
          await tx.setAlarm(scheduled.time);
          view = savedView(scheduled);
        }
      } else if (!flow || flow.id !== id) {
        view = message('이 선택 화면은 만료됐어요. 최근 초안의 선택 버튼을 눌러주세요.');
      } else if (action === 'pick' && flow.drafts[Number(value)] && !flow.editing) {
        flow.index = Number(value);
        flow.time = null;
        flow.revision++;
        await tx.put('flow', flow);
        view = dateView(flow);
      } else if (action === 'close') {
        await tx.delete('flow');
        view = job ? savedView(job) : message('예약 선택을 취소했어요.');
      } else if (flow.index === undefined) {
        view = message('먼저 초안 번호를 선택해 주세요.', draftButtons(flow).inline_keyboard);
      } else if (action === 'days' && /^\d+$/.test(value) && Number(value) <= 364) {
        flow.time = null;
        delete flow.day;
        delete flow.hour;
        flow.revision++;
        await tx.put('flow', flow);
        view = dateView(flow, Number(value));
      } else if (action === 'date' && Number.isFinite(parseTime(value + ' 12:00'))) {
        flow.day = value;
        flow.time = null;
        delete flow.hour;
        flow.revision++;
        await tx.put('flow', flow);
        view = hourView(flow);
      } else if (action === 'hours' && flow.day) {
        flow.time = null;
        delete flow.hour;
        flow.revision++;
        await tx.put('flow', flow);
        view = hourView(flow);
      } else if (action === 'hour' && flow.day && /^\d{1,2}$/.test(value) && Number(value) < 24) {
        flow.hour = Number(value);
        flow.time = null;
        flow.revision++;
        await tx.put('flow', flow);
        view = minuteView(flow);
      } else if (action === 'minute' && flow.day && flow.hour !== undefined && /^(0|15|30|45)$/.test(value)) {
        flow.time = parseTime(flow.day + ' ' + pad(flow.hour) + ':' + pad(value));
        flow.revision++;
        await tx.put('flow', flow);
        view = flow.time > Date.now() ? confirmView(flow)
          : message('이미 지난 시간이에요. 시간을 다시 선택해 주세요.', hourView(flow).keyboard.inline_keyboard);
      } else {
        view = message('최근 선택 화면에서 다시 선택해 주세요.');
      }
      await tx.put(cacheKey, view);
      return view;
    });
    return Response.json(response);
  }

  async alarm() {
    // Persist a claim before publishing. An ambiguous timeout must not publish twice.
    const job = await this.ctx.storage.transaction(async tx => {
      const scheduled = await tx.get('job');
      if (!scheduled) return null;
      if (scheduled.time > Date.now()) {
        await tx.setAlarm(scheduled.time);
        return null;
      }
      await tx.put('lastPublication', {...scheduled, status: 'processing'});
      await tx.delete('job');
      return scheduled;
    });
    if (!job) return;
    let status = 'Threads 발행 결과를 확인하지 못했어요. 다시 올리기 전에 프로필을 확인해 주세요.';
    let publication = {...job, status: 'unconfirmed'};
    try {
      const headers = {Authorization: 'Bearer ' + this.env.THREADS_ACCESS_TOKEN};
      const me = await fetch(api + '/me?fields=username', {headers, signal: AbortSignal.timeout(10000)});
      if (!me.ok || (await me.json()).username !== account) {
        status = 'Threads 계정 연결을 확인하지 못해 예약 글을 발행하지 않았어요.';
        publication.status = 'failed';
      } else {
        const result = await fetch(api + '/me/threads', {
          method: 'POST', headers, signal: AbortSignal.timeout(15000),
          body: new URLSearchParams({media_type: 'TEXT', text: job.draft, auto_publish_text: 'true'})
        });
        const posted = await result.json();
        if (result.ok && posted.id) {
          publication = {...job, status: 'published', postId: posted.id};
          status = '@' + account + '에 예약 글을 발행했어요.\n\n' + job.draft;
        } else publication.status = 'failed';
      }
    } catch {
      // Preserve the draft and uncertain outcome for investigation.
    }
    await this.ctx.storage.put('lastPublication', publication);
    await telegramSend(this.env, status, fetch);
  }
}
