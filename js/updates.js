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

const GAME_VERSION = '1.2.0';

const UPDATES = [
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
      '転生の見直し：霊感は「1周で稼いだフィルムの最高記録」を更新した分だけ増えるようになりました。奥まで進んでから転生するほどお得です',
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
  if (!seen && !hadSave) {
    markVersionSeen();
    return;
  }
  const list = unseenUpdates();
  if (!list.length) {
    if (seen !== GAME_VERSION) markVersionSeen();
    return;
  }
  // 閉じたときに「見た」と記録する（閉じずにページを離れた場合は、次回また表示）
  showModal('アップデート情報', updatesHtml(list), '閉じる', markVersionSeen);
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
