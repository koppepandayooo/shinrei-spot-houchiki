'use strict';
/* =========================================================
 * チャット（プレイヤー同士）と、開発者への意見・不具合報告
 *  ・サーバーはランキングと同じ Cloudflare Workers（js/config.js の RANKING_API）
 *  ・チャットはランキングの横（スマホではランキングの下）に常に表示する
 *  ・書き込むには、設定で名前を決める必要がある（名前はランキングと共通）
 *  ・1回80文字まで・5秒に1回まで。7日たった書き込みは自動で消える
 *    ひどい言葉・URL・メールアドレス・電話番号などはサーバーで伏せ字にする
 *  ・意見・不具合報告は開発者だけが読む（ほかのプレイヤーには見えない）
 * ========================================================= */

// 新しい書き込みを確かめる間隔（画面が見えているときだけ）。
// ふだんは20秒ごと。会話が続いている間（新しい書き込みがあった・自分が書き込んだ・入力欄を触った
// ときから3分間）は5秒ごとにして、やりとりが遅く感じないようにする。
// ずっと短い間隔にすると、Cloudflare の無料枠（1日10万リクエスト）を使い切りやすい
const CHAT_POLL = 20 * 1000;
const CHAT_POLL_FAST = 5 * 1000;
const CHAT_ACTIVE_MS = 3 * 60 * 1000;
let chatActiveUntil = 0;
function chatActive() {
  chatActiveUntil = Date.now() + CHAT_ACTIVE_MS;
  chatNextPoll = Math.min(chatNextPoll, Date.now() + CHAT_POLL_FAST);
}
let chatLastNo = 0; // 画面に出している最新の書き込みの番号
let chatBusy = false;
let chatNextPoll = 0;

const chatEnabled = () => !!RANKING_API;
const chatBoards = () => document.querySelectorAll('.chat-board');
function chatTime(at) {
  const d = new Date(at);
  const day = d.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric' });
  const tm = d.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  return `${day} ${tm}`;
}

// 書き込みを一覧の下に足していく（文字はすべて textContent で入れる）
function appendChat(messages) {
  const fresh = messages.filter((m) => m.no > chatLastNo);
  if (!fresh.length) return;
  if (chatLastNo) chatActive(); // 起動直後の読み込み以外で新しい書き込みが来たら、しばらく速く読む
  // 一覧は下から上へ積む（CSS の column-reverse）。いちばん新しい書き込みが、いつも一番下に見える
  document.querySelectorAll('.cb-list').forEach((list) => {
    if (list.querySelector('.chat-empty')) list.innerHTML = '';
    for (const m of fresh) {
      const li = document.createElement('li');
      li.className = 'chat-row' + (S.playerName && m.name === S.playerName ? ' me' : '');
      const head = document.createElement('div');
      head.className = 'chat-head';
      const nm = document.createElement('span');
      nm.className = 'chat-name';
      nm.textContent = m.name;
      const tm = document.createElement('span');
      tm.className = 'chat-time';
      tm.textContent = chatTime(m.at);
      head.append(nm, tm);
      const tx = document.createElement('div');
      tx.className = 'chat-text';
      tx.textContent = m.text;
      li.append(head, tx);
      list.insertBefore(li, list.firstChild); // 新しいものほど先頭（＝画面では一番下）
    }
    // 古い行は画面から外す（最新の50件まで）
    while (list.children.length > 50) list.removeChild(list.lastChild);
  });
  chatLastNo = fresh[fresh.length - 1].no;
}

async function loadChat() {
  if (!chatEnabled() || chatBusy) return;
  chatBusy = true;
  try {
    const { status, data } = await rankFetch('/api/chat?after=' + chatLastNo);
    if (status !== 200 || !Array.isArray(data.messages)) throw new Error(String(status));
    if (data.messages.length) appendChat(data.messages);
    else if (!chatLastNo)
      document.querySelectorAll('.cb-list').forEach((l) => (l.innerHTML = '<li class="chat-empty">まだ書き込みはありません。最初のひとことをどうぞ！</li>'));
  } catch (e) {
    if (!chatLastNo) document.querySelectorAll('.cb-list').forEach((l) => (l.innerHTML = '<li class="chat-empty">チャットを読み込めませんでした。</li>'));
  } finally {
    chatBusy = false;
  }
}

function chatMsg(board, text, ok) {
  const el = board.querySelector('.cb-msg');
  el.textContent = text;
  el.className = 'code-msg cb-msg ' + (ok ? 'ok' : 'ng');
}
// 名前があるかで、入力欄と「名前を決める」を切り替える（名前を決めた・変えたあとにも呼ぶ）
function refreshChatForm() {
  const named = !!S.playerName;
  chatBoards().forEach((b) => {
    b.querySelector('.cb-form').classList.toggle('hidden', !named);
    b.querySelector('.cb-noname').classList.toggle('hidden', named);
  });
}

async function sendChat(board) {
  if (!chatEnabled() || !S.playerName) return;
  const box = board.querySelector('.cb-text');
  const btn = board.querySelector('.cb-send');
  const text = box.value.trim();
  if (!text || btn.disabled) return;
  btn.disabled = true;
  try {
    const { status, data } = await rankFetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ensurePlayerId(), name: S.playerName, text }),
    });
    if (status === 200 && data.ok) {
      box.value = '';
      chatMsg(board, '', true);
      chatActive();
      await loadChat();
    } else if (status === 429) chatMsg(board, '続けて書き込めるのは5秒に1回までです。', false);
    else chatMsg(board, `書き込めませんでした（${data.error || status}）。`, false);
  } catch (e) {
    chatMsg(board, 'サーバーにつながりませんでした。時間をおいて試してください。', false);
  } finally {
    setTimeout(() => (btn.disabled = false), 1500);
  }
}

/* ---------- 意見・不具合報告 ---------- */
async function sendFeedback() {
  const msg = $('#fbMsg');
  const text = $('#fbText').value.trim();
  if (!text) {
    msg.textContent = '内容を書いてください。';
    msg.className = 'code-msg ng';
    return;
  }
  $('#fbSend').disabled = true;
  msg.textContent = '送信中…';
  msg.className = 'code-msg ok';
  try {
    const { status, data } = await rankFetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ensurePlayerId(),
        name: S.playerName || '',
        kind: $('#fbKind').value,
        text,
        version: typeof GAME_VERSION !== 'undefined' ? GAME_VERSION : '',
      }),
    });
    if (status === 200 && data.ok) {
      $('#fbText').value = '';
      msg.textContent = '送信しました。ありがとうございます！';
      msg.className = 'code-msg ok';
    } else if (status === 429) {
      msg.textContent = '続けて送れるのは1分に1回までです。少し待ってから送ってください。';
      msg.className = 'code-msg ng';
    } else {
      msg.textContent = `送信できませんでした（${data.error || status}）。`;
      msg.className = 'code-msg ng';
    }
  } catch (e) {
    msg.textContent = 'サーバーにつながりませんでした。時間をおいて試してください。';
    msg.className = 'code-msg ng';
  } finally {
    setTimeout(() => ($('#fbSend').disabled = false), 2000);
  }
}

function setupChat() {
  const on = chatEnabled();
  chatBoards().forEach((b) => b.classList.toggle('hidden', !on));
  $('#feedbackCard').classList.toggle('hidden', !on);
  if (!on) return;
  chatBoards().forEach((b) => {
    b.querySelector('.cb-ico').src = Sprites.iconURL('chat');
    // チャットの操作を、ゲーム画面のタップ（撮影）として扱わない
    b.addEventListener('pointerdown', (e) => e.stopPropagation());
    b.querySelector('.cb-send').addEventListener('click', () => sendChat(b));
    b.querySelector('.cb-text').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) {
        e.preventDefault();
        sendChat(b);
      }
    });
    b.querySelector('.cb-to-rank').addEventListener('click', openNameSetting);
    // 入力欄を触ったら、すぐ最新を読み、しばらく速く読む
    b.querySelector('.cb-text').addEventListener('focus', () => {
      chatActive();
      loadChat();
    });
  });
  $('#fbSend').addEventListener('click', sendFeedback);
  refreshChatForm();
  loadChat();
  chatNextPoll = Date.now() + CHAT_POLL;
  setInterval(() => {
    refreshChatForm();
    if (document.hidden || tabPaused || Date.now() < chatNextPoll) return;
    chatNextPoll = Date.now() + (Date.now() < chatActiveUntil ? CHAT_POLL_FAST : CHAT_POLL);
    loadChat();
  }, 1000);
}
