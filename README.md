# Web Loudness Meter

スマートフォン・PCブラウザで動作するリアルタイム音響計測ツール。インストール不要。

**公開 URL:** https://m-masaki72.github.io/web-loudness-meter/

## 機能

- **リアルタイム波形表示** — CRT グロー風オシロスコープ（リサイズ・画面回転対応）
- **LUFS 計測** — Momentary / Integrated（ITU-R BS.1770-4 / EBU R128 準拠）
- **騒音レベル計測** — dBFS / A 特性（dBA）/ C 特性（dBC）
- **dBSPL キャリブレーション** — 外部騒音計との比較でオフセットを補正
- **録音・保存** — webm/opus で録音、Web Share API 経由でエクスポート（iOS 対応）
- **Screen Wake Lock** — 計測中の画面オフを防止
- **PWA 対応** — ホーム画面へのインストール可能

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
| DSP | `AnalyserNode`（波形）+ `AudioWorklet`（LUFS / 周波数重み付け） |
| 録音 | `MediaRecorder` (webm/opus) |
| UI | Canvas 2D（グロー・グラデーション・バネ物理針アニメーション） |
| 永続化 | `localStorage`（キャリブレーションオフセット） |
| デプロイ | GitHub Actions → GitHub Pages |

## アーキテクチャ

```
getUserMedia (AGC/echo/noise=false)
  ├─[A] AnalyserNode  → RMS → dBFS、波形 → Canvas 描画
  ├─[B] AudioWorklet  → K-weighting → LUFS M/I
  │                   → A/C-weighting → dBA / dBC
  └─[C] MediaRecorder → webm/opus → Web Share API / <a> fallback
```

AudioWorklet は Blob URL 経由でロードするため、`file://` プロトコルでも動作します。

## dBSPL キャリブレーション

1. **CAL** ボタンを押す
2. 基準騒音計の読み値（例：75 dBSPL）を入力して保存
3. 以降の表示値に自動でオフセットが適用される（`localStorage` に永続保存）

> 広帯域ゲイン補正のみのため、マイクの周波数特性は補正されません。
