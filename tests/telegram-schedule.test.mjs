import test from 'node:test';
import assert from 'node:assert/strict';
import {ThreadsSchedule, parseTime, isOwnerScheduleUpdate, handleScheduleCommand} from '../worker/threads-schedule.mjs';

function fixture(initial = []) {
  const data = new Map(initial);
  let alarm;
  const storage = {
    async get(key) { return structuredClone(data.get(key)); },
    async put(key, value) { data.set(key, structuredClone(value)); },
    async delete(key) { return data.delete(key); },
    async setAlarm(time) { alarm = time; },
    async deleteAlarm() { alarm = undefined; },
    async transaction(fn) { return fn(storage); }
  };
  const scheduler = new ThreadsSchedule({storage}, {});
  let serial = 0;
  const call = async (command, path = 'command') => (await scheduler.fetch(new Request(
    'https://internal/' + path, {method: 'POST', body: JSON.stringify({messageId: ++serial, ...command})}
  ))).json();
  const click = (view, label, overrides) => {
    const target = view.keyboard.inline_keyboard.flat().find(button => button.text === label);
    assert.ok(target, 'Missing button ' + label);
    assert.ok(Buffer.byteLength(target.callback_data) <= 64);
    return call({callback: target.callback_data, ...overrides});
  };
  const choose = async (drafts = ['첫 줄\n\n둘째 줄 💛', '두 번째 글', null]) => {
    const view = await call({drafts, id: String(serial)}, 'drafts');
    return click(view, '1번 선택');
  };
  const dateAndTime = async view => {
    const next = await click(view, '다음 주');
    const day = next.keyboard.inline_keyboard[0][0];
    const hours = await call({callback: day.callback_data});
    const minutes = await click(hours, '19시');
    return click(minutes, '30분');
  };
  return {data, scheduler, call, click, choose, dateAndTime, alarm: () => alarm};
}

test('calendar preserves the selected draft and schedules only after confirmation; edit and cancel update alarm', async () => {
  const f = fixture();
  const confirm = await f.dateAndTime(await f.choose());
  assert.match(confirm.text, /첫 줄\n\n둘째 줄 💛/);
  assert.equal(f.alarm(), undefined);
  const saved = await f.click(confirm, '예약 확정', {messageId: 'confirm-once'});
  const firstTime = f.alarm();
  assert.ok(firstTime > Date.now());
  const duplicate = await f.click(confirm, '예약 확정', {messageId: 'confirm-once'});
  assert.deepEqual(duplicate, saved);
  const edit = await f.click(saved, '예약 변경');
  assert.equal(f.alarm(), firstTime, 'existing reservation stays active until replacement confirmation');
  const changed = await f.dateAndTime(edit);
  const updated = await f.click(changed, '예약 확정');
  const staleCancel = await f.click(saved, '예약 취소');
  assert.match(staleCancel.text, /이미 취소되거나/);
  assert.ok(f.data.has('job'));
  await f.click(updated, '예약 취소');
  assert.equal(f.data.has('job'), false);
  assert.equal(f.alarm(), undefined);
});

test('new drafts invalidate old choices and changed date invalidates old confirmation', async () => {
  const f = fixture();
  const old = await f.dateAndTime(await f.choose());
  await f.click(old, '날짜·시간 변경');
  assert.match((await f.click(old, '예약 확정')).text, /현재 확인 화면/);
  await f.choose(['다른 글']);
  assert.match((await f.click(old, '예약 확정')).text, /현재 확인 화면/);
  assert.equal(f.alarm(), undefined);
});

test('legacy reply commands remain usable and KST dates reject invalid input', async () => {
  assert.ok(Number.isNaN(parseTime('2026-02-30 19:30')));
  assert.ok(Number.isNaN(parseTime('2026-11-21 25:00')));
  assert.equal(parseTime('2026-11-21 19:30'), Date.parse('2026-11-21T10:30:00Z'));
  const f = fixture([['pending', {draft: '기존 초안', time: Date.now() + 60000}]]);
  assert.match((await f.call({input: '예약확정'})).text, /예약 완료/);
  assert.match((await f.call({input: '예약목록'})).text, /기존 초안/);
  await f.call({input: '예약취소'});
  assert.equal(f.alarm(), undefined);
});

test('callback owner validation, quick acknowledgement and edited message keep Telegram paragraph breaks', async () => {
  const update = {update_id: 10, callback_query: {id: 'click', data: 'sn:test:pick:0',
    from: {id: 42, is_bot: false},
    message: {message_id: 9, chat: {id: 42, type: 'private'}, from: {is_bot: true}}}};
  const env = {TELEGRAM_CHAT_ID: '42', TELEGRAM_BOT_TOKEN: 'fake', THREADS_ACCESS_TOKEN: 'fake',
    THREADS_SCHEDULE: {getByName: () => ({fetch: async () => Response.json({
      text: '첫 줄\n\n둘째 줄', keyboard: {inline_keyboard: []}
    })})}};
  assert.ok(isOwnerScheduleUpdate(update, env));
  assert.equal(isOwnerScheduleUpdate({...update, callback_query: {...update.callback_query, from: {id: 43}}}, env), false);
  const requests = [];
  await handleScheduleCommand(update, env, {fetcher: async (url, options) => {
    requests.push({url, body: JSON.parse(options.body)});
    return Response.json({ok: true, result: true});
  }});
  assert.match(requests[0].url, /answerCallbackQuery$/);
  assert.match(requests[1].url, /editMessageText$/);
  assert.equal(requests[1].body.text, '첫 줄\n\n둘째 줄');
});

test('alarm timeout never repeats a public write and retains uncertain draft', async () => {
  const f = fixture([['job', {id: 'due', draft: '예약 글\n그대로', time: Date.now() - 1}]]);
  const original = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async url => {
    if (String(url).includes('/me?')) return Response.json({username: 'pocket.note_'});
    if (String(url).includes('/me/threads')) { writes++; throw new Error('timeout'); }
    return Response.json({ok: true, result: {}});
  };
  try {
    await f.scheduler.alarm();
    await f.scheduler.alarm();
    assert.equal(writes, 1);
    assert.equal(f.data.get('lastPublication').status, 'unconfirmed');
    assert.equal(f.data.get('lastPublication').draft, '예약 글\n그대로');
  } finally { globalThis.fetch = original; }
});
