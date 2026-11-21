# ランキング API（Cloudflare Workers + D1）

ゲーム本体は GitHub Pages のまま、スコアだけをこの Worker に送ります。
ログインはなく、名前を入力するだけの方式です（スコアは自己申告）。

## はじめての準備（1回だけ）

Node.js が入っている PC で、この `worker` フォルダに移動して実行します。

```bash
cd worker
```

1. Cloudflare にログイン（ブラウザが開きます。無料アカウントで OK）

```bash
npx wrangler login
```

2. データベース（D1）を作る

```bash
npx wrangler d1 create shinrei-ranking
```

表示された `database_id` を、`wrangler.jsonc` の `REPLACE_WITH_DATABASE_ID` と置き換えます。

3. テーブルを作る

```bash
npx wrangler d1 execute shinrei-ranking --remote --file=schema.sql
```

4. （任意）IP のハッシュ用の「塩」を設定（他人に推測されない文字列なら何でも）

```bash
npx wrangler secret put IP_SALT
```

5. デプロイ

```bash
npx wrangler deploy
```

最後に表示される `https://shinrei-ranking.〇〇.workers.dev` が API の URL です。

6. ゲームの `js/config.js` の `RANKING_API` にその URL を書いて、GitHub に反映すれば完成です。

## 動作確認

```bash
curl "https://shinrei-ranking.〇〇.workers.dev/api/ranking"
```

`{"entries":[],"me":null}` のように返ってくれば OK です。

## 設定

- `wrangler.jsonc` の `ALLOWED_ORIGINS`：スコアを送れるサイト。GitHub Pages の URL とローカル確認用（`http://localhost:8765`）が入っています。
- 送信は同じ端末・同じ IP から20秒に1回まで（`src/index.js` の `MIN_INTERVAL_MS`）。

## いたずらへの対策と限界

- 名前は12文字まで、制御文字や `<` `>` は取り除きます。スコアは数値として妥当な範囲かを確認します。
- ブラウザのゲームなので、開発者ツールでスコアを書き換えて送ることはできてしまいます（ログインなし方式の限界）。
  気になる記録は、Cloudflare のダッシュボード（D1 → shinrei-ranking → scores）から行を削除できます。

```bash
npx wrangler d1 execute shinrei-ranking --remote --command="DELETE FROM scores WHERE name = '消したい名前'"
```

## ランキングをリセットする（セーブや進行状況はそのまま）

スコアは「シーズンが始まってから獲得したフィルム」です。リセットするときは、シーズン番号を1つ増やします。

1. `js/config.js` の `RANK_SEASON` と、`wrangler.jsonc` の `RANK_SEASON` を同じ新しい番号にする
2. サーバーを更新する：`npx wrangler deploy`（古い番号のスコアは受け付けなくなります）
3. 念のため今の記録を書き出してから、記録を消す

```bash
npx wrangler d1 export shinrei-ranking --remote --output=../tools/ranking-backup.sql
npx wrangler d1 execute shinrei-ranking --remote --command="DELETE FROM scores; DELETE FROM rate;"
```

4. ゲームを GitHub Pages に公開する（`index.html` の `?v=` も上げる）

プレイヤーが新しい版を開くと、その時点の総獲得フィルムが新しいシーズンの出発点になり、そこから増えた分がスコアになります。

## チャットと、意見・不具合の報告

同じサーバー（このワーカー）で、ゲーム内のチャットと開発者への意見・不具合の報告も受け付けています。
初めて使うとき・テーブルを足したときは、`schema.sql` を本番のデータベースに流してください（`CREATE TABLE IF NOT EXISTS` なので、今のデータは消えません）。

```bash
npx wrangler d1 execute shinrei-ranking --remote --file=schema.sql
```

### 届いた意見・不具合の報告を読む

```bash
npx wrangler d1 execute shinrei-ranking --remote --command="SELECT no, datetime(at/1000,'unixepoch','+9 hours') AS 日時, kind, name, version, text FROM feedback ORDER BY no DESC LIMIT 20"
```

Cloudflare のダッシュボード（D1 → shinrei-ranking → feedback）からも読めます。

### チャットの書き込みを消す

- チャットは1回80文字まで、同じ人・同じ IP から5秒に1回まで。ひどい言葉・URL・メールアドレス・電話番号のような数字は、サーバーで伏せ字（＊）にします（`src/index.js` の `NG_WORDS`）
- 7日たった書き込みと、新しい500件より古い書き込みは自動で消えます
- 困った書き込みは、番号（no）を確かめてから消せます。同じ人の書き込みをまとめて消すこともできます

```bash
npx wrangler d1 execute shinrei-ranking --remote --command="SELECT no, name, text, pid FROM chat ORDER BY no DESC LIMIT 30"
npx wrangler d1 execute shinrei-ranking --remote --command="DELETE FROM chat WHERE no = 番号"
npx wrangler d1 execute shinrei-ranking --remote --command="DELETE FROM chat WHERE pid = 'その人のpid'"
```
