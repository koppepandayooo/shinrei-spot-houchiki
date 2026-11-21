'use strict';
/* =========================================================
 * ゲームデータ（スポット・アップグレード・セリフ）
 * 数値バランスはここをいじれば調整できます。
 *
 * スポットの並びは「全国心霊マップ」の順位を参考に、弱い順（2026-11-20調査）。
 * 背景は実物の写真・資料を確認し、実在しない要素は描かない方針。
 * ========================================================= */

const STAGES = [
  {
    id: 'phone',
    name: '八王子霊園の電話ボックス',
    area: '東京都 八王子市',
    mult: 1,
    unlock: 0,
    desc: '都立八王子霊園の近く、道ばたにぽつんと立つ電話ボックス。中には緑色の公衆電話が置かれ、夜になると明かりだけが闇に浮かんでいる。',
    landmark: 'phone',
    hint: '霊園の近くの道ばたに、夜でも明かりのついた電話ボックスがあるらしい。',
    theme: {
      sky: ['#03060a', '#071018', '#0c1a24', '#12242e'],
      mountain: '#0a141a', trees: '#08130f', mound: '#0a1612',
      ground: '#25272a', groundTop: '#383b3e', pebble: '#46494c', line: '#5a5a52',
      dark: 'rgba(2,5,8,0.6)', fog: '170,200,190',
      midTree: '#0b1a14', hedge: '#13261a', hedgeTop: '#1c3424',
    },
    lines: [
      '電話ボックスの明かりに、虫が集まっている。',
      '……今、受話器が揺れなかった？',
      'ゆら「こんな時間に、誰が電話するんだろう」',
      '遠くで、電話のベルが鳴った気がした。',
      '生け垣の向こうから、誰かの気配がする。',
    ],
  },
  {
    id: 'ryohoku',
    name: '陵北大橋',
    area: '東京都 八王子市 下恩方町',
    mult: 3,
    unlock: 800,
    desc: '八王子市西部、北浅川にかかる大きな橋。赤い橋桁と白い欄干、背の高い街灯が並び、橋の上からは川原と山並みが見渡せる。',
    landmark: 'ryohoku',
    hint: '北浅川に、赤い橋桁の大きな橋がかかっているという。',
    theme: {
      sky: ['#04060e', '#08101e', '#0e1a2c', '#16243a'],
      ridges: [['#0c1626', 0.04, 40, 16, 0.016], ['#0a1320', 0.1, 26, 12, 0.03]],
      mountain: '#0a1422', trees: '#08121a', mound: '#0a141c',
      ground: '#2a2c30', groundTop: '#c8ccd0', pebble: '#44474c', line: '#6a6a60',
      dark: 'rgba(3,5,12,0.58)', fog: '170,190,220',
      midTree: '#0a1620', girder: '#9a2a2a', girderDark: '#5a1818', rail: '#c8ccd2', railDark: '#7a8088',
    },
    lines: [
      '橋の下を、川の音が流れていく。',
      '街灯の明かりが、ひとつだけ消えている。',
      'ゆら「風が強い…帽子が飛ばされそう」',
      '川霧の中に、白いものが見えた気がした。',
      '欄干が、ひんやりと冷たい。',
    ],
  },
  {
    id: 'manji',
    name: '旧満地トンネル',
    area: '東京都 あきる野市／青梅市',
    mult: 10,
    unlock: 1e5,
    desc: 'あきる野市と青梅市の境、満地峠の旧道に残る卵形のトンネル（1958年完成・長さ150m）。新しいトンネルの開通後は歩行者と自転車専用になり、煉瓦張りの坑口の奥に、明かりの並ぶ静かな通路が続いている。',
    landmark: 'manji',
    hint: '峠の旧道に、歩行者と自転車しか通れない卵形のトンネルがあるらしい。',
    theme: {
      sky: ['#05060a', '#0a0c16', '#121424', '#1a1c30'],
      moon: false, mountain: '#0c0e18', trees: '#0a120e', mound: '#0c140f',
      ground: '#2a2a2c', groundTop: '#3c3c3e', pebble: '#4a4a4c', line: '#5a5850',
      dark: 'rgba(4,4,10,0.6)', fog: '190,190,200',
      brick: '#7a3c2c', brickDark: '#4e2418', moss: '#2c3e26', midTree: '#0c1a14',
      interior: {
        // 卵形の断面。上は白っぽいコンクリート、下の壁は煉瓦調。天井に明かりが並ぶ（落書きは無い：実際に訪れた人の確認による）
        wallType: 'manji',
        upper: '#9a9a94', lower: '#6e4a3a', lowerDark: '#4a3026',
        floor: '#2a2826', floorTop: '#3a3634', puddle: '#30343c', stain: 'rgba(10,12,6,0.25)', moss: '#2c3a26',
        dark: 'rgba(0,0,0,0.55)', light: 1.1, lamps: true,
      },
    },
    lines: [
      '天井の明かりが、規則正しく続いている。',
      '煉瓦の壁に、濡れた手のあとがついている…',
      'ゆら「ここは歩きと自転車しか通れないんだって」',
      '出口の向こうで、自転車のベルが鳴った。…誰もいない。',
      '明かりがひとつ、じじじ…と瞬いている。',
    ],
  },
  {
    id: 'doryodo',
    name: '道了堂跡',
    area: '東京都 八王子市 鑓水',
    mult: 35,
    unlock: 2e7,
    desc: 'かつて生糸を運んだ「絹の道」を見下ろす丘に建っていたお堂の跡。明治のころは行き交う商人で賑わったが、お堂は1983年に解体された。今は石段や石灯籠、お地蔵さまが木立の中に残る、公園のような静かな跡地になっている。',
    landmark: 'doryodo',
    hint: '生糸を運んだ古い街道を見下ろす丘。石段をのぼった先に、今はなきお堂の跡が残っているという…',
    theme: {
      sky: ['#06040c', '#0f0a1c', '#1a1230', '#251a3c'],
      mountain: '#120e1e', trees: '#0e1418', mound: '#10121a',
      ground: '#2b241e', groundTop: '#3d3328', pebble: '#55483a',
      dark: 'rgba(6,3,14,0.62)', fog: '190,170,220',
      stone: '#6a6870', stoneDark: '#46454c', midTree: '#101820',
    },
    lines: [
      '苔むした石灯籠に、ぽっと灯がともった気がした。',
      '石段の上から、誰かに見下ろされている…？',
      '風もないのに、木々がざわめいている。',
      'ゆら「ここ、昔はにぎやかだったんだって」',
      '足もとの石が、ひんやりと濡れている。',
    ],
  },
  {
    id: 'komine',
    name: '旧小峰トンネル',
    area: '東京都 八王子市／あきる野市',
    mult: 120,
    unlock: 4e9,
    desc: '八王子とあきる野の境、小峰峠の旧道に残る古いトンネル。新しい道ができてからは通る車もなく、苔むした坑口が杉林の闇に口を開けている。',
    landmark: 'komine',
    hint: '八王子とあきる野の境にある峠道。杉林の奥に、使われなくなったトンネルがあるという。',
    theme: {
      sky: ['#04050b', '#08101c', '#0f1b2a', '#16263a'],
      moon: false, mountain: '#0b1520', trees: '#0a1a17', mound: '#0c1d19',
      ground: '#26282c', groundTop: '#3a3d40', pebble: '#4a4c50', line: '#4d4b42',
      dark: 'rgba(3,4,12,0.58)', fog: '170,200,190',
      portal: '#4b4f52', portalLight: '#666b6e', moss: '#2f4a2c', midTree: '#0d211c',
      brick: '#5e3a2e', brickDark: '#3e241a', // 坑口は煉瓦（扁額「小峯隧道」）
      interior: {
        // 灰色の吹き付けコンクリート（煉瓦は覆われて見えない）。天井には古い照明が残り、ところどころ点いている
        wallType: 'concrete', wall: '#74746f', litLamps: true, rail: true,
        brick: '#4e4038', brick2: '#5a4a40', mortar: '#241c18', rib: '#665448',
        floor: '#1a1918', floorTop: '#2a2724', puddle: '#2a3440', stain: 'rgba(8,16,8,0.4)', moss: '#2c3e26',
        dark: 'rgba(0,0,0,0.9)', light: 1,
      },
    },
    lines: [
      '天井から、水の滴る音が響いている…',
      '懐中電灯の光が、コンクリートの壁のしみを照らした。',
      'コンクリートの壁に、小さな手形がついている。',
      '落書きだらけの壁に、ひとつだけ新しい手形がある…',
      '誰もいないはずの背後で、砂利を踏む音がした。',
      'トンネルの中だけ、空気が妙に冷たい。',
      'ゆら「出口の光…あれ、さっきより遠くない？」',
    ],
  },
  {
    id: 'fukiage',
    name: '旧吹上隧道',
    area: '東京都 青梅市',
    mult: 400,
    unlock: 6e11,
    desc: '青梅市北部、吹上峠の山中に残る古い隧道。内壁はコンクリートで固められ、新しいトンネルができてからは使われなくなった。狭く湿った闇が、奥までまっすぐ続いている。',
    landmark: 'fukiage',
    hint: '青梅の峠に、使われなくなった古い隧道が眠っているらしい。',
    theme: {
      sky: ['#080306', '#160812', '#24101a', '#321620'],
      moon: false, mountain: '#160a10', trees: '#0f0d10', mound: '#140d10',
      ground: '#262020', groundTop: '#3a2f2c', pebble: '#4f4240', line: '#4a3c36',
      dark: 'rgba(10,2,6,0.68)', fog: '220,170,170',
      brick: '#6a3428', brickDark: '#47211a', moss: '#2c3a22', midTree: '#140f12',
      interior: {
        // コンクリートの内壁。旧小峰より狭く天井が低い／巻き立ての継ぎ目が並ぶ／落書きは少なく色あせ、しみ出しと白い析出物が多い
        wallType: 'concrete', wall: '#5c5f57', ceil: 38, archLine: true, rings: true, graffiti: 3, graffitiFade: 0.55, seep: 60, efflor: true, narrow: true,
        brick: '#5e2c22', brick2: '#6e3628', mortar: '#2a1410', rib: '#7a4232',
        floor: '#1c1616', floorTop: '#2a2020', puddle: '#2c2a36', stain: 'rgba(10,12,6,0.42)', moss: '#2a3420',
        dark: 'rgba(2,0,0,0.94)', light: 0.95,
      },
    },
    lines: [
      '光の届かない奥で、何かが動いた。',
      '自分の足音が、少し遅れて返ってくる…',
      'ゆら「この峠、トンネルが三本もあるんだって」',
      'コンクリートの壁から、白い筋がしみ出している。',
      '懐中電灯が一瞬だけ、明滅した。',
      '天井が低い。息が詰まりそうだ…',
    ],
  },
  {
    id: 'hachioji',
    name: '八王子城跡',
    area: '東京都 八王子市',
    mult: 1400,
    unlock: 4e13,
    desc: '戦国時代に北条氏照が築いた山城の跡。天正18年（1590年）、豊臣方の大軍に攻められ、わずか一日で落城したと伝わる。石垣と御主殿の滝が、往時の面影を今に残す。',
    landmark: 'hachioji',
    hint: '戦国の世に、たった一日で落ちた山城。苔むした石垣が今も山の中に眠っている。',
    theme: {
      sky: ['#020610', '#06102a', '#0b1a3a', '#122348'],
      ridges: [['#0e1b3a', 0.04, 44, 18, 0.016], ['#0b1631', 0.1, 32, 16, 0.028], ['#091329', 0.18, 22, 12, 0.045]],
      mountain: '#081226', trees: '#07131a', mound: '#0a1620',
      ground: '#1d261c', groundTop: '#2c3a26', pebble: '#3f4c36',
      dark: 'rgba(2,4,14,0.64)', fog: '160,180,230',
      wall: '#5c5a56', wallDark: '#3e3d3b', wood: '#4a3526', woodDark: '#2e2118', midTree: '#0a1820',
    },
    lines: [
      '木々の向こうから、御主殿の滝の音が聞こえてくる。',
      '石垣の隙間から、冷たい風が吹き出している。',
      'ゆら「この石垣、四百年以上前のものなんだって」',
      'ゆら「この先の滝では、静かにしていよう」',
      '甲冑の擦れるような音が、すぐそばで…',
    ],
  },
  {
    id: 'kyukyu',
    name: '旧旧吹上隧道',
    area: '東京都 青梅市',
    mult: 5000,
    unlock: null,
    secret: true, // 解放条件は SECRET を参照。解放されるまで存在を隠す
    desc: '旧吹上隧道よりもさらに古く、山道の先にひっそりと残る小さな隧道。1904年完成、東京で現存する最古の道路トンネル。苔と湿気に覆われた煉瓦の壁の奥には、灯りひとつない闇が続いている。',
    landmark: 'fukiage',
    hint: '',
    theme: {
      sky: ['#040203', '#0a0407', '#12070c', '#180a10'],
      moon: false, mountain: '#0c0608', trees: '#0a080a', mound: '#0c0809',
      ground: '#1a1616', groundTop: '#262020', pebble: '#3a302e', line: '#30282a',
      dark: 'rgba(4,0,2,0.8)', fog: '200,170,170',
      brick: '#4a2a22', brickDark: '#2e1812', moss: '#22301c', midTree: '#0c0a0c',
      interior: {
        brick: '#3e2a24', brick2: '#4a3028', mortar: '#160c0a', rib: '#563a30',
        floor: '#121010', floorTop: '#1c1816', puddle: '#20242c', stain: 'rgba(6,14,6,0.5)', moss: '#22301c',
        dark: 'rgba(0,0,0,0.975)', light: 0.8,
      },
    },
    lines: [
      '百年以上前の煉瓦が、懐中電灯の光を吸い込んでいく…',
      '光の輪の外から、誰かがこちらを見ている。',
      'ゆら「ここが…東京でいちばん古いトンネル」',
      '背後で、草鞋の擦れるような音がした。',
      '息が白い。真夏のはずなのに。',
    ],
  },
];

/* バランス調整（2026-11-21 試算）
 *  放置だけ（タップ・心霊写真なし）で：陵北大橋 約5分 → 旧満地 約15分 → 道了堂跡 約1時間
 *  → 旧小峰 約3.5時間 → 旧吹上 約16時間 → 八王子城跡 約3日。タップや心霊写真があるともっと早い。
 *  転生すると、2周目は八王子城跡まで約8時間、3周目は約4時間と速くなっていく。 */
const BALANCE = {
  milestoneEvery: 25, // 懐中電灯・カメラは、このレベルごとに効果2倍（前は10）
};

// 順番に解放していく通常のスポット（隠しスポットを除く）の数
const LINEAR_SPOTS = STAGES.filter((st) => !st.secret).length;
const stageIndex = (id) => STAGES.findIndex((st) => st.id === id);
// そのスポットが解放済みか（s = セーブデータ）
// そのスポットを知っているか（いま解放しているか、転生前に到達したことがある。隠しスポットは一度たどり着いたことがある）
function spotKnown(s, idx) {
  const st = STAGES[idx];
  if (!st) return false;
  return st.secret ? !!s.secretSeen : idx < Math.max(s.unlocked, s.bestUnlocked || 1);
}
// 知らないスポットは「？？？」と書く（ネタバレ防止）
const spotLabel = (s, idx) => (spotKnown(s, idx) ? STAGES[idx].name : '？？？');
function spotOpen(s, id) {
  const i = stageIndex(id);
  if (i < 0) return false;
  return STAGES[i].secret ? !!s.secretOpen : s.unlocked > i;
}

/* 隠しスポット「旧旧吹上隧道」の解放条件
 *  旧旧吹上隧道だけで撮れる写真を除き、コレクションの全種類を1枚以上撮ること。
 *  （転生して登り直したときは、八王子城跡まで解放し直すと、また行けるようになる） */
const SECRET = {
  id: 'kyukyu',
  // 雨の日だけの写真は、天気しだいで集められないことがあるので条件に入れない
  needGhosts: () => GHOSTS.filter((g) => g.stage !== 'kyukyu' && !g.weather),
};

const UPGRADES = [
  {
    id: 'flash', name: '懐中電灯', icon: 'flash',
    desc: '闇の奥まで照らせるようになり、探索で見つかるフィルムが増える。',
    base: 15, growth: 1.25,
  },
  {
    id: 'camera', name: 'カメラ', icon: 'camera',
    desc: '性能アップで、タップ撮影でもらえるフィルムが増える。',
    base: 10, growth: 1.21,
  },
  {
    id: 'moped', name: '原付', icon: 'moped',
    desc: 'スポットへの移動が速くなり、探索スピードが上がる。',
    base: 60, growth: 1.38, max: 40,
  },
  {
    id: 'amulet', name: 'お守り', icon: 'amulet',
    desc: '無事に帰ってこられる時間がのび、放置で貯まる上限時間が増える。',
    base: 300, growth: 3, max: 8,
  },
  /* ② 上位装備（スポットを解放すると買えるようになる。req = 必要な解放スポット数） */
  {
    id: 'ofuda', name: 'お札', icon: 'ofuda', req: 3,
    desc: '霊の気配を引き寄せる。心霊写真のボーナスが増え、幽霊が少し現れやすくなる。',
    base: 2e5, growth: 1.45, max: 15,
  },
  {
    id: 'ir', name: '赤外線カメラ', icon: 'ir', req: 4,
    desc: '闇の中でも写せる上位カメラ。探索・撮影すべての収入が増える。',
    base: 2e6, growth: 1.6,
  },
  {
    id: 'sensor', name: '霊感センサー', icon: 'sensor', req: 6,
    desc: '微かな霊の反応を拾う上位装備。★レアの幽霊が出やすくなり、足音イベントの撮影成功率も上がる。',
    base: 1e12, growth: 1.8, max: 10,
  },
];

/* ③ 転生（お祓いを受けて出直す）
 *  装備・フィルム・解放スポットをリセットするかわりに「霊感」を得る。
 *  霊感1につき、すべての収入が +10%（ずっと残る）。
 *
 *  ■ 霊感は「1周でどれだけ稼いだか」の最高記録で決まる
 *   記録値 = floor(perDecade × log10(今回の獲得フィルム ÷ base))
 *    例：40億→72、1兆→120、40兆→152、1000兆→180
 *   転生でもらえるのは「今回の記録値 − これまでの最高記録値」（＋初めて奥へ行ったときの踏破ボーナス）。
 *   → 早めの転生を何度くり返しても、最高記録を超えない限り霊感は増えない。
 *     奥まで進んで、たくさん稼いでから転生するほど得をする。
 *  ■ 踏破ボーナス：そのスポットまで解放して転生したとき、初回だけもらえる */
const REBIRTH = {
  minSpots: 5, // 旧小峰トンネルまで解放していること
  base: 1e6,
  perDecade: 20,
  bonusPerPoint: 0.1,
  firstBonus: { fukiage: 10, hachioji: 30, kyukyu: 50 }, // 踏破ボーナス（初回だけ）
};

/* 仲間（フィルムで仲間にして、なかよし度を上げると効果アップ） */
const COMPANIONS = [
  {
    id: 'cat', name: 'お供の黒猫「クロ」', req: 1, join: 500, base: 2000, growth: 1.6, max: 20,
    desc: 'ゆらの足もとをついて歩く黒猫。ときどき、どこかからフィルムをくわえて戻ってくる。',
  },
  {
    id: 'kohai', name: 'オカルト好きの後輩「ミオ」', req: 3, join: 50000, base: 120000, growth: 1.6, max: 20,
    desc: '心霊スポット巡りについてきたオカルト好きの後輩。撮影のコツを教えてくれる。',
  },
  {
    id: 'vet', name: 'ベテラン探検家「ゲンさん」', req: 5, join: 1e9, base: 3e9, growth: 1.6, max: 20,
    desc: '山と廃道を知り尽くしたベテラン探検家。効率のよい探索ルートを案内してくれる。',
  },
];

/* デイリーボーナス（連続日数。7日目は大きめ＋霊感+1。8日目からまた1日目） */
const DAILY = [
  { min: 5 }, { min: 8 }, { min: 12 }, { min: 18 }, { min: 25 }, { min: 35 }, { min: 90, reikan: 1 },
];

const COMMON_LINES = [
  'ゆら「……今、何か写った？」',
  'ゆら「次はあっちを撮ってみよう」',
  'ゆら「フィルム、まだ残ってるよね…」',
  'どこかでカラスが一声鳴いた。',
];

const DISCLAIMER =
  'ゲーム内の怪奇現象はすべてフィクションです。実在のスポットを訪れる際は、私有地・立入禁止区域に入らず、夜間の騒音やゴミなど地域の方の迷惑にならないようにしましょう。';

/* 心霊写真コレクション（各スポットに2種。rare は出にくいがボーナス3倍。stage はスポットの id） */
const GHOSTS = [
  { id: 'juwaki', stage: 'phone', rare: false, name: '揺れる受話器', glow: '#9fffb0',
    desc: '誰もいない電話ボックスで、ひとりでに揺れる受話器。耳を近づけると、遠くで誰かの声が…' },
  { id: 'hakonaka', stage: 'phone', rare: true, name: 'ボックスの中の人影', glow: '#b8ffd0',
    desc: '明かりのついた電話ボックスの中に、背を向けて立つ人影。近づくと、もういない。' },
  { id: 'kawabi', stage: 'ryohoku', rare: false, name: '川面の灯り', glow: '#ffe08a',
    desc: '橋の下の暗い川面を、ゆっくり流れていく小さな灯り。' },
  { id: 'kiri', stage: 'ryohoku', rare: true, name: '川霧の人影', glow: '#c8d4e8',
    desc: '川霧の向こうに立つ、ぼんやりとした人影。霧が晴れると消えている。' },
  { id: 'midori', stage: 'manji', rare: false, name: '緑の光', glow: '#80ffa0',
    desc: '天井の明かりとは違う、緑色の小さな光。トンネルの奥へ逃げていく。' },
  { id: 'shirokage', stage: 'manji', rare: true, name: '満地の白い影', glow: '#d8f0e0',
    desc: '明かりと明かりのあいだの暗がりに、白い影がじっと立っている。' },
  { id: 'hitodama', stage: 'doryodo', rare: false, name: '青いひとだま', glow: '#7fd0ff',
    desc: '石灯籠のあたりを漂う青白い火の玉。近づくと、すっと逃げていく。' },
  { id: 'onna', stage: 'doryodo', rare: true, name: '石段の女', glow: '#c8d4ff',
    desc: '長い黒髪で顔を隠した白い着物の女。石段の上から、ずっとこちらを見下ろしている。' },
  { id: 'shiro', stage: 'komine', rare: false, name: 'トンネルの白い影', glow: '#9fc6ff',
    desc: 'トンネルの中をふわふわ漂う白い影。こちらをじっと見ている…ような気がする。' },
  { id: 'akame', stage: 'komine', rare: true, name: '闇の奥の赤い目', glow: '#ff5060',
    desc: 'トンネルの闇の奥に、ふたつ並んだ赤い光。まばたきは、しない。' },
  { id: 'kodomo', stage: 'fukiage', rare: false, name: '隧道の奥の子ども', glow: '#b0a0ff',
    desc: '光の届かない隧道の奥に立つ小さな影。「あそぼ」と聞こえた気がした。' },
  { id: 'nobi', stage: 'fukiage', rare: true, name: 'のびる人影', glow: '#ff8090',
    desc: '懐中電灯が明滅するたび、少しずつ背が高くなっていく黒い人影。' },
  { id: 'onibi', stage: 'hachioji', rare: false, name: '石垣の鬼火', glow: '#ffb060',
    desc: '石垣の上に灯るいくつもの橙色の火。誰かを探すように、ゆっくり揺れている。' },
  { id: 'musha', stage: 'hachioji', rare: true, name: '落武者の影', glow: '#ffd27a',
    desc: '兜をかぶった鎧姿の影。四百年たった今も、城を守り続けているのだろうか。' },
  // 雨の日だけ（現実のそのスポットのあたりが雨・雷雨のとき）に出る心霊写真
  { id: 'amagasa', stage: 'phone', weather: 'rain', rare: false, name: '雨の日の傘の女', glow: '#a8c4ff',
    desc: '雨の夜、電話ボックスの横で傘をさして立つ女。誰かからの電話を、ずっと待っている。' },
  { id: 'nureashi', stage: 'doryodo', weather: 'rain', rare: false, name: '石段の濡れた足あと', glow: '#8fd0ff',
    desc: '雨の石段に、はだしの足あとが一段ずつ増えていく。上っていく姿は、どこにも見えない。' },
  { id: 'tabibito', stage: 'kyukyu', rare: false, name: '笠の旅人', glow: '#d8c890',
    desc: '古びた笠をかぶった旅人の影。明治のころから、まだ峠を越える途中なのかもしれない。' },
  { id: 'tegata', stage: 'kyukyu', rare: true, name: '壁いっぱいの手形', glow: '#e8f0ff',
    desc: '懐中電灯を向けた煉瓦の壁に、びっしりと浮かび上がる白い手形。' },
];

/* 実績（check は状態 s を受け取って達成なら true） */
const ACHIEVEMENTS = [
  { id: 'photo1', name: '初めての心霊写真', desc: '心霊写真を1枚撮る', check: (s) => s.ghosts >= 1 },
  { id: 'photo10', name: '心霊写真家', desc: '心霊写真を累計10枚撮る', check: (s) => s.ghosts >= 10 },
  { id: 'photo50', name: '霊に好かれる体質', desc: '心霊写真を累計50枚撮る', check: (s) => s.ghosts >= 50 },
  { id: 'rare1', name: 'レアものを激写', desc: '★レアの心霊写真を撮る', check: (s) => GHOSTS.some((g) => g.rare && s.photos[g.id]) },
  { id: 'collect', name: '心霊写真コンプリート', desc: 'すべての種類の心霊写真を集める', check: (s) => GHOSTS.every((g) => s.photos[g.id]) },
  { id: 'rainPhoto', name: '雨の日の写真家', desc: '雨の日だけの心霊写真を撮る', check: (s) => GHOSTS.some((g) => g.weather && s.photos[g.id]) },
  { id: 'shot100', name: '撮影100回', desc: 'タップで100回撮影する', check: (s) => s.clicks >= 100 },
  { id: 'shot1000', name: '撮影1000回', desc: 'タップで1000回撮影する', check: (s) => s.clicks >= 1000 },
  { id: 'film1e4', name: '総獲得フィルム10,000', desc: 'フィルムを累計1万枚手に入れる', check: (s) => s.total >= 1e4 },
  { id: 'film1e6', name: '総獲得フィルム100万', desc: 'フィルムを累計100万枚手に入れる', check: (s) => s.total >= 1e6 },
  { id: 'film1e8', name: '総獲得フィルム1億', desc: 'フィルムを累計1億枚手に入れる', check: (s) => s.total >= 1e8 },
  { id: 'spotRyohoku', spot: 'ryohoku', name: '夜の大橋', desc: '陵北大橋を解放する', check: (s) => spotOpen(s, 'ryohoku') },
  { id: 'spotManji', spot: 'manji', name: '卵形のトンネル', desc: '旧満地トンネルを解放する', check: (s) => spotOpen(s, 'manji') },
  { id: 'spot2', spot: 'doryodo', name: '絹の道の丘へ', desc: '道了堂跡を解放する', check: (s) => spotOpen(s, 'doryodo') },
  { id: 'spotKomine', spot: 'komine', name: '小峰峠の闇', desc: '旧小峰トンネルを解放する', check: (s) => spotOpen(s, 'komine') },
  { id: 'spot4', spot: 'fukiage', name: '峠の隧道へ', desc: '旧吹上隧道を解放する', check: (s) => spotOpen(s, 'fukiage') },
  { id: 'spot3', spot: 'hachioji', name: '落城の山へ', desc: '八王子城跡を解放する', check: (s) => spotOpen(s, 'hachioji') },
  { id: 'spot5', name: '東京最古の闇', desc: '旧旧吹上隧道にたどり着く', secret: true, check: (s) => !!s.secretSeen },
  { id: 'stepWin', name: '足音に立ち向かう', desc: '足音イベントで撮影に成功する', check: (s) => s.steps.win >= 1 },
  { id: 'stepLose', name: '……誰もいない', desc: '足音イベントで撮影に失敗する', check: (s) => s.steps.lose >= 1 },
  { id: 'stepRun', name: '逃げるが勝ち', desc: '足音イベントで「逃げる」を選ぶ', check: (s) => s.steps.run >= 1 },
  { id: 'flash10', name: '暗闇に強い', desc: '懐中電灯をLv10にする', check: (s) => s.lv.flash >= 10 },
  { id: 'moped10', name: '峠の走り屋', desc: '原付をLv10にする', check: (s) => s.lv.moped >= 10 },
  { id: 'amuletMax', name: 'お守りフル装備', desc: 'お守りを最大レベルにする', check: (s) => s.lv.amulet >= 8 },
  { id: 'away1h', name: 'のんびり放置', desc: '1時間以上放置してから戻ってくる', check: (s) => s.maxAway >= 3600 },
  { id: 'rebirth1', name: 'お祓いを受けて出直す', desc: '初めてお祓いを受ける', check: (s) => s.rebirths >= 1 },
  { id: 'reikan10', name: '霊感が強い', desc: '霊感を10以上ためる', check: (s) => s.reikan >= 10 },
  { id: 'comp1', name: 'ひとりじゃない', desc: '仲間を1人（1匹）むかえる', check: (s) => Object.values(s.comp).some((v) => v >= 1) },
  { id: 'comp3', name: '心霊スポット探検隊', desc: '仲間を3人そろえる', check: (s) => Object.values(s.comp).filter((v) => v >= 1).length >= 3 },
  { id: 'daily7', name: '七日目の夜', desc: '7日連続でデイリーボーナスをもらう', check: (s) => s.daily.best >= 7 },
  { id: 'ranked', name: 'ランキング初登録', desc: '名前を登録してスコアを送信する', check: (s) => !!s.ranked },
  { id: 'ir1', name: '闇を見通す目', desc: '赤外線カメラを手に入れる', check: (s) => s.lv.ir >= 1 },
];
