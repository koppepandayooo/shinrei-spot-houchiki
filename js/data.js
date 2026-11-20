'use strict';
/* =========================================================
 * ゲームデータ（スポット・アップグレード・セリフ）
 * 数値バランスはここをいじれば調整できます。
 * ========================================================= */

const STAGES = [
  {
    id: 'komine',
    name: '旧小峰トンネル',
    area: '東京都 八王子市／あきる野市',
    mult: 1,
    unlock: 0,
    desc: '八王子とあきる野の境、小峰峠の旧道に残る古いトンネル。新しい道ができてからは通る車もなく、苔むした坑口が杉林の闇に口を開けている。',
    landmark: 'komine',
    hint: '八王子とあきる野の境にある峠道。杉林の奥に、使われなくなったトンネルがあるという。',
    theme: {
      sky: ['#04050b', '#08101c', '#0f1b2a', '#16263a'],
      moon: false, mountain: '#0b1520', trees: '#0a1a17', mound: '#0c1d19',
      ground: '#26282c', groundTop: '#3a3d40', pebble: '#4a4c50', line: '#4d4b42',
      dark: 'rgba(3,4,12,0.58)', fog: '170,200,190',
      portal: '#4b4f52', portalLight: '#666b6e', moss: '#2f4a2c', midTree: '#0d211c',
      interior: {
        wallType: 'concrete', wall: '#74746f', // 灰色の吹き付けコンクリート（煉瓦は覆われて見えない）
        brick: '#4e4038', brick2: '#5a4a40', mortar: '#241c18', rib: '#665448',
        floor: '#1a1918', floorTop: '#2a2724', puddle: '#2a3440', stain: 'rgba(8,16,8,0.4)', moss: '#2c3e26',
        dark: 'rgba(0,0,0,0.92)', light: 1,
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
    id: 'doryodo',
    name: '道了堂跡',
    area: '東京都 八王子市 鑓水',
    mult: 8,
    unlock: 500,
    desc: 'かつて生糸を運んだ「絹の道」を見下ろす丘に建っていたお堂の跡。明治のころは行き交う商人で賑わったというが、今は石段と石灯籠だけが木立の中に残っている。',
    landmark: 'doryodo',
    hint: '生糸を運んだ古い街道を見下ろす丘。石段をのぼった先に、お堂の影が見えるという…',
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
    id: 'hachioji',
    name: '八王子城跡',
    area: '東京都 八王子市',
    mult: 60,
    unlock: 15000,
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
    id: 'fukiage',
    name: '旧吹上隧道',
    area: '東京都 青梅市',
    mult: 500,
    unlock: 400000,
    desc: '青梅市北部、吹上峠の山中に残る古い隧道。内壁は吹き付けコンクリートで固められ、新しいトンネルができてからは使われなくなった。狭く湿った闇が、奥までまっすぐ続いている。',
    landmark: 'fukiage',
    hint: '青梅の峠に、使われなくなった古い隧道が眠っているらしい。',
    theme: {
      sky: ['#080306', '#160812', '#24101a', '#321620'],
      moon: false, mountain: '#160a10', trees: '#0f0d10', mound: '#140d10',
      ground: '#262020', groundTop: '#3a2f2c', pebble: '#4f4240', line: '#4a3c36',
      dark: 'rgba(10,2,6,0.68)', fog: '220,170,170',
      brick: '#6a3428', brickDark: '#47211a', moss: '#2c3a22', midTree: '#140f12',
      interior: {
        // 吹き付けコンクリート。旧小峰より狭く天井が低い／落書きは少なく色あせ、しみ出しと白い析出物が多い
        wallType: 'concrete', wall: '#5c5f57', ceil: 38, archLine: true, graffiti: 3, graffitiFade: 0.55, seep: 60, efflor: true, narrow: true,
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
    id: 'kyukyu',
    name: '旧旧吹上隧道',
    area: '東京都 青梅市',
    mult: 5000,
    unlock: null,
    secret: true, // 旧吹上隧道を解放した状態で、心霊写真を累計10枚撮ると出現
    secretPhotos: 10,
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

const UPGRADES = [
  {
    id: 'flash', name: '懐中電灯', icon: 'flash',
    desc: '闇の奥まで照らせるようになり、探索で見つかるフィルムが増える。',
    base: 15, growth: 1.22,
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
    id: 'ofuda', name: 'お札', icon: 'ofuda', req: 2,
    desc: '霊の気配を引き寄せる。心霊写真のボーナスが増え、幽霊が少し現れやすくなる。',
    base: 3000, growth: 1.45, max: 15,
  },
  {
    id: 'ir', name: '赤外線カメラ', icon: 'ir', req: 3,
    desc: '闇の中でも写せる上位カメラ。探索・撮影すべての収入が増える。',
    base: 60000, growth: 1.5,
  },
  {
    id: 'sensor', name: '霊感センサー', icon: 'sensor', req: 4,
    desc: '微かな霊の反応を拾う上位装備。★レアの幽霊が出やすくなり、足音イベントの撮影成功率も上がる。',
    base: 3e6, growth: 1.8, max: 10,
  },
];

/* ③ 転生（お祓いを受けて出直す）
 *  装備・フィルム・解放スポットをリセットするかわりに「霊感」ポイントを得る。
 *  霊感1につき、すべての収入が +10%（ずっと残る） */
const REBIRTH = {
  minSpots: 3, // 八王子城跡まで解放していること
  divisor: 1e5, // 獲得霊感 = floor(√(今回の獲得フィルム ÷ divisor))
  bonusPerPoint: 0.1,
};

/* 仲間（フィルムで仲間にして、なかよし度を上げると効果アップ） */
const COMPANIONS = [
  {
    id: 'cat', name: 'お供の黒猫「クロ」', req: 1, join: 500, base: 2000, growth: 1.6, max: 20,
    desc: 'ゆらの足もとをついて歩く黒猫。ときどき、どこかからフィルムをくわえて戻ってくる。',
  },
  {
    id: 'kohai', name: 'オカルト好きの後輩「ミオ」', req: 2, join: 50000, base: 120000, growth: 1.6, max: 20,
    desc: '心霊スポット巡りについてきたオカルト好きの後輩。撮影のコツを教えてくれる。',
  },
  {
    id: 'vet', name: 'ベテラン探検家「ゲンさん」', req: 3, join: 2e6, base: 6e6, growth: 1.6, max: 20,
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

/* 心霊写真コレクション（各スポットに2種。rare は出にくいがボーナス3倍） */
const GHOSTS = [
  { id: 'shiro', stage: 0, rare: false, name: 'トンネルの白い影', glow: '#9fc6ff',
    desc: 'トンネルの中をふわふわ漂う白い影。こちらをじっと見ている…ような気がする。' },
  { id: 'akame', stage: 0, rare: true, name: '闇の奥の赤い目', glow: '#ff5060',
    desc: 'トンネルの闇の奥に、ふたつ並んだ赤い光。まばたきは、しない。' },
  { id: 'hitodama', stage: 1, rare: false, name: '青いひとだま', glow: '#7fd0ff',
    desc: '石灯籠のあたりを漂う青白い火の玉。近づくと、すっと逃げていく。' },
  { id: 'onna', stage: 1, rare: true, name: '石段の女', glow: '#c8d4ff',
    desc: '長い黒髪で顔を隠した白い着物の女。石段の上から、ずっとこちらを見下ろしている。' },
  { id: 'onibi', stage: 2, rare: false, name: '石垣の鬼火', glow: '#ffb060',
    desc: '石垣の上に灯るいくつもの橙色の火。誰かを探すように、ゆっくり揺れている。' },
  { id: 'musha', stage: 2, rare: true, name: '落武者の影', glow: '#ffd27a',
    desc: '兜をかぶった鎧姿の影。四百年たった今も、城を守り続けているのだろうか。' },
  { id: 'kodomo', stage: 3, rare: false, name: '隧道の奥の子ども', glow: '#b0a0ff',
    desc: '光の届かない隧道の奥に立つ小さな影。「あそぼ」と聞こえた気がした。' },
  { id: 'nobi', stage: 3, rare: true, name: 'のびる人影', glow: '#ff8090',
    desc: '懐中電灯が明滅するたび、少しずつ背が高くなっていく黒い人影。' },
  { id: 'tabibito', stage: 4, rare: false, name: '笠の旅人', glow: '#d8c890',
    desc: '古びた笠をかぶった旅人の影。明治のころから、まだ峠を越える途中なのかもしれない。' },
  { id: 'tegata', stage: 4, rare: true, name: '壁いっぱいの手形', glow: '#e8f0ff',
    desc: '懐中電灯を向けた煉瓦の壁に、びっしりと浮かび上がる白い手形。' },
];

/* 実績（check は状態 s を受け取って達成なら true） */
const ACHIEVEMENTS = [
  { id: 'photo1', name: '初めての心霊写真', desc: '心霊写真を1枚撮る', check: (s) => s.ghosts >= 1 },
  { id: 'photo10', name: '心霊写真家', desc: '心霊写真を累計10枚撮る', check: (s) => s.ghosts >= 10 },
  { id: 'photo50', name: '霊に好かれる体質', desc: '心霊写真を累計50枚撮る', check: (s) => s.ghosts >= 50 },
  { id: 'rare1', name: 'レアものを激写', desc: '★レアの心霊写真を撮る', check: (s) => GHOSTS.some((g) => g.rare && s.photos[g.id]) },
  { id: 'collect', name: '心霊写真コンプリート', desc: 'すべての種類の心霊写真を集める', check: (s) => GHOSTS.every((g) => s.photos[g.id]) },
  { id: 'shot100', name: '撮影100回', desc: 'タップで100回撮影する', check: (s) => s.clicks >= 100 },
  { id: 'shot1000', name: '撮影1000回', desc: 'タップで1000回撮影する', check: (s) => s.clicks >= 1000 },
  { id: 'film1e4', name: '総獲得フィルム10,000', desc: 'フィルムを累計1万枚手に入れる', check: (s) => s.total >= 1e4 },
  { id: 'film1e6', name: '総獲得フィルム100万', desc: 'フィルムを累計100万枚手に入れる', check: (s) => s.total >= 1e6 },
  { id: 'film1e8', name: '総獲得フィルム1億', desc: 'フィルムを累計1億枚手に入れる', check: (s) => s.total >= 1e8 },
  { id: 'spot2', name: '絹の道の丘へ', desc: '道了堂跡を解放する', check: (s) => s.unlocked >= 2 },
  { id: 'spot3', name: '落城の山へ', desc: '八王子城跡を解放する', check: (s) => s.unlocked >= 3 },
  { id: 'spot4', name: '峠の隧道へ', desc: '旧吹上隧道を解放する', check: (s) => s.unlocked >= 4 },
  { id: 'spot5', name: '東京最古の闇', desc: '旧旧吹上隧道にたどり着く', secret: true, check: (s) => s.unlocked >= 5 },
  { id: 'stepWin', name: '足音に立ち向かう', desc: '足音イベントで撮影に成功する', check: (s) => s.steps.win >= 1 },
  { id: 'stepLose', name: '……誰もいない', desc: '足音イベントで撮影に失敗する', check: (s) => s.steps.lose >= 1 },
  { id: 'stepRun', name: '逃げるが勝ち', desc: '足音イベントで「逃げる」を選ぶ', check: (s) => s.steps.run >= 1 },
  { id: 'flash10', name: '暗闇に強い', desc: '懐中電灯をLv10にする', check: (s) => s.lv.flash >= 10 },
  { id: 'moped10', name: '峠の走り屋', desc: '原付をLv10にする', check: (s) => s.lv.moped >= 10 },
  { id: 'amuletMax', name: 'お守りフル装備', desc: 'お守りを最大レベルにする', check: (s) => s.lv.amulet >= 8 },
  { id: 'away1h', name: 'のんびり放置', desc: '1時間以上放置してから戻ってくる', check: (s) => s.maxAway >= 3600 },
  { id: 'rebirth1', name: 'お祓いを受けて出直す', desc: '初めて転生する', check: (s) => s.rebirths >= 1 },
  { id: 'reikan10', name: '霊感が強い', desc: '霊感を10以上ためる', check: (s) => s.reikan >= 10 },
  { id: 'comp1', name: 'ひとりじゃない', desc: '仲間を1人（1匹）むかえる', check: (s) => Object.values(s.comp).some((v) => v >= 1) },
  { id: 'comp3', name: '心霊スポット探検隊', desc: '仲間を3人そろえる', check: (s) => Object.values(s.comp).filter((v) => v >= 1).length >= 3 },
  { id: 'daily7', name: '七日目の夜', desc: '7日連続でデイリーボーナスをもらう', check: (s) => s.daily.best >= 7 },
  { id: 'ranked', name: 'ランキング初登録', desc: '名前を登録してスコアを送信する', check: (s) => !!s.ranked },
  { id: 'ir1', name: '闇を見通す目', desc: '赤外線カメラを手に入れる', check: (s) => s.lv.ir >= 1 },
];
