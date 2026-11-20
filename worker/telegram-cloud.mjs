import {isOwnerTelegramUpdate, processTelegramUpdate, telegramSend} from './telegram.mjs';
import {ThreadsSchedule, handleScheduleCommand, isOwnerScheduleUpdate} from './threads-schedule.mjs';

export {ThreadsSchedule};

export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/telegram/setup') {
      if (request.method !== 'POST' || !env.TELEGRAM_BOT_TOKEN ||
          request.headers.get('Authorization') !== 'Bearer ' + env.TELEGRAM_BOT_TOKEN) {
        return new Response(null, {status: 403});
      }
      if (!env.TELEGRAM_WEBHOOK_SECRET || !env.THREADS_SCHEDULE) return new Response(null, {status: 503});
      const options = await request.json().catch(() => ({}));
      const setup = await fetch('https://api.telegram.org/bot' + env.TELEGRAM_BOT_TOKEN + '/setWebhook', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url: new URL('/telegram', request.url).href,
          secret_token: env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query']}),
        signal: AbortSignal.timeout(10000)
      });
      if (!setup.ok || !(await setup.json()).ok) return new Response(null, {status: 502});
      const check = await env.THREADS_SCHEDULE.getByName('owner').fetch('https://schedule.internal/command', {
        method: 'POST', body: JSON.stringify({input: '예약연결확인'})
      });
      const view = await check.json();
      const reservationResponse = await env.THREADS_SCHEDULE.getByName('owner').fetch('https://schedule.internal/command', {
        method: 'POST', body: JSON.stringify({input: '예약목록', messageId: crypto.randomUUID()})
      });
      const reservation = await reservationResponse.json();
      if (options.notify !== false) {
        await telegramSend(env, view.text + '\n\n새로 받은 초안 아래에서 번호를 선택해 예약할 수 있어요.',
          fetch, {inline_keyboard: [[{text: '예약목록', callback_data: 'sn:status:list:'}]]});
      }
      let verification;
      if (options.verify) {
        const testStub = env.THREADS_SCHEDULE.getByName('verification');
        const command = async (value, path = 'command') => {
          const result = await testStub.fetch('https://schedule.internal/' + path, {
            method: 'POST', body: JSON.stringify({messageId: crypto.randomUUID(), ...value})
          });
          if (!result.ok) throw new Error('예약 동작 검사 실패');
          return result.json();
        };
        const choose = async (current, label) => {
          const selected = current.keyboard.inline_keyboard.flat().find(item => item.text === label);
          if (!selected) throw new Error('예약 선택 버튼 없음');
          return command({callback: selected.callback_data});
        };
        const first = await command({id: crypto.randomUUID(), drafts: ['예약 동작 검사\n\n줄바꿈 유지', '두 번째 검사', '세 번째 검사']}, 'drafts');
        const dates = await choose(first, '2번 선택');
        const week = await choose(dates, '다음 주');
        const hours = await command({callback: week.keyboard.inline_keyboard[0][0].callback_data});
        const minutes = await choose(hours, '19시');
        const confirmation = await choose(minutes, '30분');
        const saved = await choose(confirmation, '예약 확정');
        const editing = await choose(saved, '예약 변경');
        const canceled = await command({input: '예약취소'});
        const listing = await command({input: '예약목록'});
        verification = saved.text.includes('예약 완료') && editing.text.includes('날짜') &&
          canceled.text.includes('취소') && listing.text.includes('없어요');
      }
      return Response.json({webhook: 'ready', threadsConnected: view.text.includes('연결 정상'),
        connection: view.connection, reservation: reservation.text, verification});
    }
    if (new URL(request.url).pathname !== '/telegram') return new Response(null, {status: 404});
    if (request.method !== 'POST') return new Response(null, {status: 405});
    if (!env.TELEGRAM_WEBHOOK_SECRET ||
        request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response(null, {status: 403});
    }
    const required = ['TELEGRAM_CHAT_ID', 'TELEGRAM_BOT_TOKEN'];
    if (!env.TELEGRAM_QUEUE || required.some(key => !env[key])) return new Response(null, {status: 503});
    const update = await request.json().catch(() => null);
    if (isOwnerScheduleUpdate(update, env) ||
        (isOwnerTelegramUpdate(update, env) && /^예약(?:\s|$)|^예약(?:확정|취소|목록|변경|연결확인)$/.test(update.message.text || ''))) {
      await handleScheduleCommand(update, env);
    } else if (isOwnerTelegramUpdate(update, env) && typeof update.message.text === 'string') {
      await env.TELEGRAM_QUEUE.send(update);
    }
    return Response.json({ok: true});
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      try {
        if (!(await handleScheduleCommand(message.body, env))) {
          await processTelegramUpdate(message.body, env);
        }
        message.ack();
      } catch {
        console.error('Telegram reply delivery failed');
        message.retry();
      }
    }
  }
};
