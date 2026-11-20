import {spawnSync} from 'node:child_process';

const config = 'wrangler.telegram.jsonc';
const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_FIREBASE_UID', 'TELEGRAM_FIREBASE_BOT_UID',
  'TELEGRAM_FIREBASE_API_KEY', 'TELEGRAM_FIREBASE_REFRESH_TOKEN',
  'GIFT_WRITER_TOKEN', 'TELEGRAM_WEBHOOK_SECRET'];

function run(args, input) {
  const result = spawnSync(process.execPath, [process.env.WRANGLER_ENTRY, ...args], {
    input, encoding: 'utf8', stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
  });
  if (result.error) throw new Error('Wrangler를 실행하지 못했습니다.');
  return result;
}

async function deploy() {
  const missing = ['WRANGLER_ENTRY', 'TELEGRAM_WORKER_URL', ...keys].filter(key => !process.env[key]);
  if (missing.length) throw new Error('필요한 설정 ' + missing.join(', '));
  const url = new URL(process.env.TELEGRAM_WORKER_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') ||
      !url.hostname.startsWith('gift-note-telegram.') || url.username || url.password) {
    throw new Error('전용 봇의 workers.dev 주소를 설정해 주세요.');
  }
  const webhook = new URL('/telegram', url).href;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) throw new Error('웹훅 비밀값 형식을 확인해 주세요.');
  const queue = run(['queues', 'create', 'gift-note-telegram', '--config', config]);
  if (queue.status !== 0 && !/already exists/i.test(queue.stderr + queue.stdout)) {
    throw new Error('대기열 생성에 실패했습니다. Cloudflare 로그인과 계정 권한을 확인해 주세요.');
  }
  if (run(['deploy', '--config', config]).status !== 0) {
    throw new Error('텔레그램 워커 배포에 실패했습니다.');
  }
  const secrets = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  if (run(['secret', 'bulk', '--config', config], JSON.stringify(secrets)).status !== 0) {
    throw new Error('Cloudflare 비밀 설정 등록에 실패했습니다.');
  }
  const probe = await fetch(webhook, {
    method: 'POST', headers: {'X-Telegram-Bot-Api-Secret-Token': secret, 'Content-Type': 'application/json'},
    body: '{}', signal: AbortSignal.timeout(15000)
  });
  if (!probe.ok || !(await probe.json()).ok) throw new Error('배포한 웹훅을 확인하지 못했습니다.');
  const telegram = async (method, body) => {
    const response = await fetch('https://api.telegram.org/bot' + process.env.TELEGRAM_BOT_TOKEN + '/' + method, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error('Telegram ' + method + ' 요청에 실패했습니다.');
    return result.result;
  };
  await telegram('setWebhook', {url: webhook, secret_token: secret, allowed_updates: ['message', 'callback_query']});
  if ((await telegram('getWebhookInfo', {})).url !== webhook) throw new Error('웹훅 등록 결과가 일치하지 않습니다.');
  console.log('전용 워커 배포와 Telegram 웹훅 등록을 확인했습니다.');
}

deploy().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
