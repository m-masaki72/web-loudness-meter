# Web Loudness Meter

スマートフォン・PCブラウザで動作するリアルタイム音響計測ツール。インストール不要。

**公開 URL:** https://m-masaki72.github.io/web-loudness-meter/

## 機能

- **リアルタイム波形表示** — CRT グロー風オシロスコープ（リサイズ・画面回転対応）
- **LUFS 計測** — Momentary / Short-term / Integrated（ITU-R BS.1770-4 / EBU R128 準拠）
- **FFT スペクトラムアナライザー** — 対数周波数スケール（20Hz〜20kHz）のリアルタイムバー表示
- **騒音レベル計測** — dBFS / A 特性（dBA）/ C 特性（dBC）
- **dBSPL 表示トグル** — `dBSPL OFF/ON` ボタンでキャリブレーション済み値に切替
- **dBSPL キャリブレーション** — 外部騒音計との比較でオフセットを補正（localStorage 永続保存）
- **ピーク値リセット** — `PEAK RST` ボタンで LEDバーのピークホールドをリセット
- **計測履歴グラフ** — IndexedDB に1秒ごと保存、`HIST` ボタンで折れ線グラフ表示
- **録音・保存** — webm/opus で録音、Web Share API 経由でエクスポート（iOS 対応）
- **Screen Wake Lock** — 計測中の画面オフを防止
- **インアプリ説明書** — `?` ボタンで計測値・グラフ・ボタンの解説をオーバーレイ表示
- **PWA 対応** — ホーム画面へのインストール可能
- **PC・スマホ両対応** — スクロール対応レイアウト

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
npm run dev   # http://localhost:5173
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

```
[Title Bar]
[Oscilloscope]       — リアルタイム波形
[LED Bar Meter]      — dBFS / dBA / LUFS-I（ピークホールド付き）
[Spectrum Analyzer]  — FFT 周波数スペクトラム
[Analog VU Meter]    — 針式メーター
[dBFS | dBA | LUFS-M | LUFS-S | LUFS-I]  — デジタル数値表示
[START | REC | STOP | CAL]
[PEAK RST | dBSPL | HIST]
[History Graph]      — 折りたたみ式履歴グラフ
[Calibration Panel]  — 折りたたみ式キャリブレーション
```

## dBSPL キャリブレーション

1. **CAL** ボタンを押す
2. 基準騒音計の読み値（例：75 dBSPL）を入力して保存
3. **dBSPL ON** に切り替えると補正済み値が表示される（`localStorage` に永続保存）

> 広帯域ゲイン補正のみのため、マイクの周波数特性は補正されません。
