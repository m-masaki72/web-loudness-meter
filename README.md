# Web Loudness Meter

スマートフォン・PCブラウザで動作するリアルタイム音響計測ツール。インストール不要。

**公開 URL:** https://m-masaki72.github.io/web-loudness-meter/

## 機能

- **SIMPLE / EXPERT モード** — タイトルバーのボタンで切替。SIMPLE は波形・騒音レベル・dBFS のみ表示、EXPERT は全機能表示（localStorage 永続）
- **騒音レベルインジケーター** — グラデーションバー + 白い針で現在レベルを視覚化。9種類の生活騒音目安ラベルを表示（深夜〜聴力障害の危険まで）
- **リアルタイム波形表示** — CRT グロー風オシロスコープ（リサイズ・画面回転対応）
- **LUFS 計測** — Momentary / Short-term / Integrated（ITU-R BS.1770-4 / EBU R128 準拠）
- **FFT スペクトラムアナライザー** — 対数周波数スケール（20Hz〜20kHz）のリアルタイムバー表示
- **騒音レベル計測** — dBFS / A 特性（dBA）/ C 特性（dBC）
- **dBSPL 表示トグル** — `dBSPL OFF/ON` ボタンでキャリブレーション済み値に切替
- **dBSPL キャリブレーション** — 外部騒音計との比較でオフセットを補正（localStorage 永続保存）
- **ピーク値リセット** — `PEAK RST` ボタンで LEDバーのピークホールドをリセット
- **計測履歴グラフ** — IndexedDB に1秒ごと保存、5min / 30min / ALL で表示期間を切替可能
- **録音・保存** — webm/opus で録音、`loudness-YYYYMMDD-HHmmss.webm` 形式で保存（iOS は Web Share API）
- **Screen Wake Lock** — 計測中の画面オフを防止
- **インアプリ説明書** — `?` ボタンで全機能の解説をオーバーレイ表示
- **PWA 対応** — ホーム画面へのインストール可能（インストールバナー表示）
- **自動更新通知** — Service Worker の新バージョン検出時にバナーで通知、ユーザー確認後に即時反映
- **PC・スマホ両対応** — Safe Area / overscroll 対応、タッチターゲット 44px+

## ブラウザ動作要件

| 環境 | 動作 |
|------|------|
| Chrome（PC / Android） | ✅ |
| Safari（iOS 15+） | ✅ HTTPS 必須 |
| Firefox | ⚠️ HTTPS 推奨 |

> **iOS メモ：** より正確な計測には、コントロールセンターのマイクモードを「ワイドスペクトラム」に設定してください。

## ローカル開発

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # ユニット + インテグレーションテスト（72テスト）
npm run coverage # カバレッジレポート
```

スマートフォンで試す場合は同一 LAN 上から `http://<PCのIP>:5173` にアクセス（getUserMedia は HTTPS 必須のため Chrome Android 推奨）。

### アイコン再生成

```bash
npm run gen-icons   # public/icons/ に PNG 出力
```

## 技術スタック

| 項目 | 内容 |
|------|------|
| ビルド | Vite 5 + Vanilla JS (ES Modules) |
| テスト | Vitest 2 + fake-indexeddb（72テスト、`npm test`） |
| 音声取得 | `getUserMedia`（AGC / echo / noise 全 OFF） |
| DSP | `AnalyserNode`（波形・FFT）+ `AudioWorklet`（LUFS / 周波数重み付け） |
| 録音 | `MediaRecorder` (webm/opus) |
| UI | Canvas 2D（グロー・グラデーション・バネ物理針アニメーション） |
| 永続化 | `localStorage`（キャリブレーションオフセット）/ `IndexedDB`（計測履歴） |
| デプロイ | GitHub Actions → GitHub Pages |

## アーキテクチャ

```
getUserMedia (AGC/echo/noise=false)
  ├─[A] AnalyserNode  → RMS → dBFS、波形 → Canvas 描画
  │                   → getFloatFrequencyData → スペクトラム表示
  ├─[B] AudioWorklet  → K-weighting → LUFS M/S/I
  │                   → A/C-weighting → dBA / dBC
  └─[C] MediaRecorder → webm/opus → Web Share API / <a> fallback

計測履歴: setInterval(1s) → IndexedDB → HistoryGraph (Canvas折れ線)
```

AudioWorklet は Blob URL 経由でロードするため、`file://` プロトコルでも動作します。

## UI レイアウト

SIMPLE / EXPERT モードで表示内容が切り替わります。

```
[Title Bar + SIMPLE/EXPERT ボタン]
[Oscilloscope]            — リアルタイム波形（両モード共通）
[LED Bar Meter]           — dBFS / dBA / LUFS-I（EXPERT のみ）
[Spectrum Analyzer]       — FFT 周波数スペクトラム（EXPERT のみ）
[Analog VU Meter]         — 針式メーター（EXPERT のみ）
[dBFS | dBA | LUFS-M | LUFS-S | LUFS-I]  — デジタル表示（SIMPLE は dBFS のみ大きく）
[Noise Level Indicator]   — 騒音レベルバー + 生活騒音目安（両モード共通）
[START | REC | STOP | CAL]  — REC/CAL は EXPERT のみ
[PEAK RST | dBSPL | HIST | ?]  — EXPERT のみ
[History Graph]           — 折りたたみ式（5min/30min/ALL 切替）
[Calibration Panel]       — 折りたたみ式
[SW 更新バナー]           — 新バージョン検出時に画面下部に表示
[インストールバナー]      — PWA インストール促進
```

## Changelog

### v0.8.0（2026-05-20）
- recorder.js: MIME fallback を `audio/mp4`（無効）→ `audio/wav` に修正、`onstop` のレース修正、AbortError（ユーザーキャンセル）と真のエラーを区別
- main.js: `renderLoop` の null チェック、iOS 検出を feature detection 化、SW `controllerchange` メモリリーク修正、`fmt()` 返り値を `'---'` に統一
- history-graph.js: LUFS-M（水色）チャンネル追加、1サンプル時のドット表示、中間時刻ラベル、キー欠損ガード
- analog-meter.js: DAMPING 0.55 → 0.65 でオーバーシュート抑制
- テスト: 72 → 80本（無音→トーン遷移・急激なレベル変化・長時間リーク・非 1kHz トーン追加）
- ヘルプ: dBC 追記・LUFS-M 追記・dBSPL 説明簡潔化・ウェイクロック説明追加・騒音レベルを箇条書き化

### v0.7.0（2026-05-19）
- アクセシビリティ: 全ボタンに `aria-label`、canvas に `role=img`、モーダルに `role=dialog`、騒音インジケーターに `aria-live`、dBSPL トグルに `aria-pressed`
- パフォーマンス: オシロスコープのスキャンライン + グリッドをオフスクリーンキャンバスにキャッシュ、スペクトラムの対数周波数 → bin 変換をリサイズ時に事前計算
- Service Worker v3: ネットワークファースト + キャッシュフォールバック戦略に変更、オフライン時のナビゲーション対応を強化
- バグ修正: `const panel = panel` 自己参照バグを修正
- UX: CAL パネルの不正値入力時にインラインエラーメッセージを表示
- ヘルプ更新: SIMPLE/EXPERT モードと騒音レベル9段階目安を追記

### v0.6.0（2026-05-19）
- バグ修正: Wake Lock の `_active` 状態不整合、`stopAudio()` null クラッシュ、CAL ハンドラ null チェック漏れ
- エラー処理: 録音保存失敗時の alert、履歴クリア失敗時の防御
- polish: LED バーの glow opacity 統一、CAL ボタン無効時の点滅フィードバック

### v0.5.0（2026-05-18）
- SIMPLE / EXPERT モード切り替え（localStorage 永続）
- 騒音レベルインジケーター（グラデーションバー + 9段階ラベル）
- 履歴グラフ 5min / 30min / ALL 表示期間切替
- Service Worker 更新通知バナー、PWA インストールバナー
- 録音ファイル名を `loudness-YYYYMMDD-HHmmss.webm` 形式に変更

### v0.4.0（2026-05-18）
- Vitest 2 によるテストスイート導入（72テスト: DSP ユニット + IndexedDB + フルパイプライン）
- タッチターゲット 44px+、Safe Area 対応、`overscroll-behavior: none`

### v0.3.1（2026-05-10）
- LUFS リングバッファ最適化、ピークホールド decay 修正、CSP 追加、各種バグ修正

### v0.3.0 以前
- dBFS / dBA / dBC / LUFS M/S/I、オシロスコープ、LED バー、スペクトラム、履歴、録音、PWA

---

## dBSPL キャリブレーション

1. **START** でマイクを起動する（計測中のみ CAL ボタンが有効）
2. **CAL** ボタンを押す
3. 基準騒音計の読み値（例：75 dBSPL）を入力して保存
4. **dBSPL ON** に切り替えると補正済み値が表示される（`localStorage` に永続保存）

> 広帯域ゲイン補正のみのため、マイクの周波数特性は補正されません。
