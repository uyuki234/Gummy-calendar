
# エアライダーのグミシステム (テンプレート)

Google Calendar の年間イベントを取得して、2Dのグミとして Matter.js で降らせる React + Vite のテンプレートです。

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. Google Cloud の準備

1. Google Cloud Console でプロジェクトを作成し **Google Calendar API** を有効化します。
2. OAuth 同意画面を構成し、**外部**ユーザータイプ（個人利用）を選択。テストユーザーに自分のアカウントを追加します。
3. **OAuth 2.0 クライアントID (Web)** を作成し、`Authorized JavaScript origins` にローカルのURL（例: `http://localhost:5173`）を追加します。
4. **APIキー** を作成し、必要に応じて API 制限（Calendar API）と参照元ドメイン制限を設定します。

> クライアントIDとAPIキーを `.env.local` に設定します（下記参照）。

### 3. 環境変数の設定

`.env.example` を `.env.local` にコピーし、値を入れます。

```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=your-api-key
```

### 4. 開発サーバ起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

## 使い方

1. 「Googleに認証」ボタンで認証。
2. 年度を選択して「今年のイベント取得」。
3. 画面にグミが上から降ってきます。

## 技術構成

- React + Vite + TypeScript
- 物理演算: `matter-js`
- 色の自動決定（AIっぽさ）: `wink-sentiment`
- Google Calendar API: gapi + Google Identity Services

## 備考

- すべて **フロントエンドのみ** で動作し、イベントデータはブラウザ内で処理されます。
- `gapi` の初期化と `Google Identity Services` によるトークン取得を組み合わせて、`events.list` を呼び出しています。

## デプロイ

- Vercel / Netlify / GitHub Pages などの静的ホスティングにそのままデプロイ可能です。

## ライセンス

MIT
