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
