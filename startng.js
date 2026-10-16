// Talks to start.ng through its hidden connect page (https://start.ng/docs).
// The connect page only answers games served from a *.start.ng address,
// so when the game is opened anywhere else (a local file, localhost) every
// call resolves to null and the game falls back to the guest look.
const START_NG = 'https://start.ng';

export const onStartNg = location.hostname.endsWith('.start.ng');
export const GAME = onStartNg ? location.hostname.split('.')[0] : 'coin-dash-arena';
export const openedAsGuest = new URLSearchParams(location.search).has('guest');

// After sign-in start.ng sends the player back with a game session in the address.
// We use the connect page instead, so just tidy the address bar.
if (location.hash.includes('startng_session=')) {
  history.replaceState(null, '', location.pathname + location.search);
}

let frame;

function connectFrame() {
  frame ??= new Promise((resolve, reject) => {
    const el = document.createElement('iframe');
    el.src = `${START_NG}/connect`;
    el.hidden = true;
    el.title = 'start.ng connect';
    el.onload = () => resolve(el);
    el.onerror = reject;
    document.body.append(el);
  });
  return frame;
}

// Sends a message and resolves to start.ng's reply, or null if it didn't answer.
async function askStartNg(message, replyType, timeoutMs = 5000) {
  if (!onStartNg) return null;
  let el;
  try {
    el = await connectFrame();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const done = (reply) => {
      clearTimeout(timer);
      removeEventListener('message', onMessage);
      resolve(reply);
    };
    const timer = setTimeout(() => done(null), timeoutMs);
    function onMessage(e) {
      // Only trust replies that really come from start.ng's connect frame.
      if (e.origin !== START_NG || e.source !== el.contentWindow) return;
      if (e.data?.type === replyType && e.data.requestId === requestId) done(e.data);
    }
    addEventListener('message', onMessage);
    el.contentWindow.postMessage({ ...message, requestId }, START_NG);
  });
}

// { user, guest } from start.ng, or null when start.ng can't be reached.
export async function whoami() {
  const reply = await askStartNg({ type: 'startng:whoami' }, 'startng:user');
  if (!reply) return null;
  return { user: reply.user ?? null, guest: reply.guest ?? null };
}

// stats must match startng.json exactly: { coins, survived }, whole numbers.
export function saveRun(stats) {
  return askStartNg({ type: 'startng:score', stats }, 'startng:scoreSaved', 8000);
}

export function getLeaderboard(limit = 10) {
  return askStartNg({ type: 'startng:leaderboard', limit }, 'startng:leaderboardData');
}

export function signIn() {
  location.href = `${START_NG}/?return_to=${encodeURIComponent(location.origin + location.pathname)}`;
}
