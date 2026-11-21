'use strict';
/* =========================================================
 * バージョンとアップデート情報
 *
 * ■ 更新するときの手順
 *   1. GAME_VERSION を新しい番号にする（例：'1.1.0' → '1.2.0'）
 *   2. UPDATES のいちばん上に、同じ番号の項目を足して、変更点を items に書く
 *   → 前回より新しいバージョンを初めて開いた人に、起動時に1回だけ「アップデート情報」が出ます。
 *     閉じると、次からは出ません（このブラウザに「どのバージョンまで見たか」を記録します）。
 *
 *   ・items の1行が、箇条書きの1項目になります（文字だけ。HTMLのタグは使えません）
 *   ・何バージョンか飛ばして開いた人には、見ていない分がまとめて新しい順に表示されます
 *   ・番号は「大.中.小」の形で、数字として比べます（1.10.0 は 1.9.0 より新しい）
 * ========================================================= */

const GAME_VERSION = '1.3.1';

const UPDATES = [
  {
    version: '1.3.1',
    date: '2026-11-22',
    items: [
      '遊んでいる間に新しいバージョンが公開されたら、画面の上でお知らせするようにしました（「再読み込み」で最新版になります）',
      '収入（放置報酬・探索・撮影）は、いま居るスポットではなく、解放した中で一番高い報酬のスポットの倍率で計算するようにしました。心霊写真集めで手前のスポットに移動しても、収入は下がりません',
      '「転生」の名前を、心霊スポットらしく「お祓い」に変えました（中身は同じです）',
      'ランキングの横のボタンを「もっと見る」にしました（上位50人を見られます）',
      '右上にデイリーボーナスのボタンを置きました（連続日数と明日もらえる量が見られます）。ランキングは画面の「もっと見る」から開けます',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-11-22',
    items: [
      'チャットを追加しました（ランキングの横、スマホではランキングの下）。書き込むには名前を決める必要があります',
      '画面に出すランキングは上位5人にしました（「もっと見る」で上位50人を見られます）',
      'ランキングは毎時0分・30分に全員そろって更新されるようになりました。見出しの横に、次の更新までの残り時間が出ます',
      '原付がLv28から先、上げても探索が速くならなかった不具合を直しました。最大のLv40まで速くなります',
      '設定画面から、開発者に意見・不具合を送れるようになりました',
      '名前は設定画面で決めるようになりました（ランキングとチャットで共通）。初めて遊ぶときにも名前を聞きます',
    ],
  },
  {
    version: '1.2.1',
    date: '2026-11-22',
    items: [
      '総獲得フィルムがとても多いセーブで、ランキングのスコアが0のまま増えない不具合を直しました（直した版を開いてから稼いだ分が数えられます）',
      'ランキング画面に、次の自動送信までの残り時間を表示するようにしました。手動の「更新」ボタンはなくしました',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-11-21',
    items: [
      'ランキングをリセットしました。これからのスコアは「リセット後に獲得したフィルム」です（セーブや進み具合はそのままです）',
      'ランキングの到達地点は、これまでに到達した一番奥のスポットを表示します。まだ自分が行ったことのないスポットは「？？？」と表示されます',
      'ランキングへの送信は、プレイ中30分ごとと、スポットを移動したときにも行われます',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-21',
    items: [
      '新しいスポット「八王子霊園の電話ボックス」「陵北大橋」「旧満地トンネル」を追加。スポットの並びを、出やすさの弱い順に並べ替えました',
      '現実の時刻と連動：外のスポットは、日本時間に合わせて昼・夕方・夜に切り替わります',
      '現実の天気と連動：各スポットのあたりの天気（晴れ・くもり・霧・雨・雪・雷雨）が画面に出ます（設定でオフにできます）',
      '雨の日だけ出る心霊写真が2種類。雨の日は足音イベントの成功ボーナスも1.5倍です',
      'お祓いの見直し：霊感は「1周で稼いだフィルムの最高記録」を更新した分だけ増えるようになりました。奥まで進んでからお祓いを受けるほどお得です',
      '放置報酬は、ゲームを5分以上閉じていたときだけ、次に開いたときにもらえるようになりました',
      '八王子城跡に曳橋を追加。陵北大橋に標識などを追加しました',
    ],
  },
];

/* ---------- ここから下は表示の仕組み（ふだんは触らなくて大丈夫です） ---------- */
const SEEN_VERSION_KEY = 'shinrei-houchi-seen-version';

// バージョン番号を比べる（a が新しければ正の数）
function compareVersion(a, b) {
  const pa = String(a).split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d;
  }
  return 0;
}
function seenVersion() {
  try {
    return localStorage.getItem(SEEN_VERSION_KEY);
  } catch (e) {
    return null;
  }
}
function markVersionSeen() {
  try {
    localStorage.setItem(SEEN_VERSION_KEY, GAME_VERSION);
  } catch (e) {}
}
function updatesHtml(list) {
  return (
    '<div class="update-list">' +
    list
      .map(
        (u) =>
          `<h3>ver ${escapeHtml(u.version)}${u.date ? `<small>（${escapeHtml(u.date)}）</small>` : ''}</h3>` +
          `<ul>${u.items.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
      )
      .join('') +
    '</div>'
  );
}
// まだ見ていないアップデート（新しい順）
function unseenUpdates() {
  const seen = seenVersion() || '0';
  return UPDATES.filter((u) => compareVersion(u.version, seen) > 0 && compareVersion(u.version, GAME_VERSION) <= 0).sort((a, b) =>
    compareVersion(b.version, a.version)
  );
}

/**
 * 起動時に呼ぶ。新しいバージョンを初めて開いたときだけ、アップデート情報を1回表示する。
 * hadSave：セーブがあったか（初めて遊ぶ人には出さず、今のバージョンを見たことにする）
 */
function checkUpdateInfo(hadSave) {
  const seen = seenVersion();
  // 閉じたら「見た」と記録し、初めて遊ぶ人にはそのあと名前を聞く
  const done = () => {
    markVersionSeen();
    if (typeof askNameIfNew === 'function') askNameIfNew();
  };
  if (!seen && !hadSave) {
    // 初めて遊ぶ人：いまのバージョンの内容だけを出す
    const cur = UPDATES.filter((u) => u.version === GAME_VERSION);
    if (cur.length) showModal(`ようこそ！（ver ${GAME_VERSION}）`, updatesHtml(cur), 'はじめる', done);
    else done();
    return;
  }
  const list = unseenUpdates();
  if (!list.length) {
    if (seen !== GAME_VERSION) markVersionSeen();
    if (typeof askNameIfNew === 'function') askNameIfNew(); // 名前を決めずにページを閉じた人にも、もう一度
    return;
  }
  // 閉じたときに「見た」と記録する（閉じずにページを離れた場合は、次回また表示）
  showModal('アップデート情報', updatesHtml(list), '閉じる', done);
}

// 設定画面：バージョンの表示と「アップデート情報を見る」
function setupVersionInfo() {
  const v = $('#gameVersion');
  if (v) v.textContent = `ver ${GAME_VERSION}`;
  const btn = $('#updatesBtn');
  if (btn)
    btn.addEventListener('click', () => {
      if (typeof closeSheets === 'function') closeSheets();
      showModal('アップデート情報', updatesHtml([...UPDATES].sort((a, b) => compareVersion(b.version, a.version))), '閉じる', markVersionSeen);
    });
}

/* ---------- 遊んでいる間に新しい版が公開されたら、お知らせして再読み込みしてもらう ----------
 * 公開中の index.html を5分ごと（画面が見えているときだけ）に読み直し、
 * そこに書かれた game.js の ?v= の番号が、いま動いている版と違えば画面の上に帯を出す。
 * 更新のたびに ?v= を上げているので、ここを書き換える必要はない。
 * ※ GitHub Pages の配信には最大10分ほどのキャッシュがあるので、お知らせは公開の数分〜10分後になることがある */
const UPDATE_CHECK_EVERY = 5 * 60 * 1000;
let updateCheckAt = 0;
let updateFound = false;
function runningBuild() {
  const el = document.querySelector('script[src*="js/game.js"]');
  const m = el && el.getAttribute('src').match(/[?&]v=([\w.-]+)/);
  return m ? m[1] : null;
}
async function checkNewBuild() {
  if (updateFound) return;
  const cur = runningBuild();
  if (!cur) return;
  try {
    const res = await fetch(new URL('index.html', location.href).href + '?check=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const m = (await res.text()).match(/js\/game\.js\?v=([\w.-]+)/);
    if (m && m[1] !== cur) {
      updateFound = true;
      $('#updateBar').classList.remove('hidden');
    }
  } catch (e) {
    /* 通信できないときは、次の機会に */
  }
}
function setupUpdateCheck() {
  $('#updateReload').addEventListener('click', () => {
    if (typeof save === 'function') save(); // 今の進み具合を保存してから
    location.reload();
  });
  $('#updateLater').addEventListener('click', () => $('#updateBar').classList.add('hidden'));
  updateCheckAt = Date.now() + UPDATE_CHECK_EVERY;
  setInterval(() => {
    if (document.hidden || (typeof tabPaused !== 'undefined' && tabPaused) || Date.now() < updateCheckAt) return;
    updateCheckAt = Date.now() + UPDATE_CHECK_EVERY;
    checkNewBuild();
  }, 5000);
  // しばらく裏にいたあと戻ってきたときにも確かめる
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now() >= updateCheckAt - UPDATE_CHECK_EVERY + 60 * 1000) {
      updateCheckAt = Date.now() + UPDATE_CHECK_EVERY;
      checkNewBuild();
    }
  });
}
