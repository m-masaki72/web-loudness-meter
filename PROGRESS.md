# Web Loudness Meter — 進捗・ロードマップ

## 実装済み（v0.1.0）

| カテゴリ | 内容 |
|----------|------|
| 計測エンジン | dBFS (RMS)、dBA (A特性)、dBC (C特性)、LUFS M/I (ITU-R BS.1770-4) |
| UI | CRT風オシロスコープ、LEDバーグラフ (ピークホールド)、アナログ針メーター |
| キャリブレーション | dBSPL疑似キャリブレーション（localStorageに永続保存） |
| 録音 | MediaRecorder (webm/opus)、Web Share API / `<a>` fallback |
| モバイル対応 | Screen Wake Lock、iOS ワイドスペクトラム案内 |
| ビルド | Vite + Vanilla JS、`base: './'` で `file://` 直接起動対応 |
| AudioWorklet | Blob URL 経由ロード（サーバ不要） |
| リポジトリ | .gitignore、README.md、MITライセンス、GitHub push 済み |

---

## 今後の対応事項

### 必須（動作確認・バグ修正）
- [ ] 実機動作確認（Chrome / iOS Safari / Android Chrome）
- [ ] LUFS 値の精度検証（-23 LUFS 基準音源と照合）
- [ ] Canvas がウィンドウリサイズ・画面回転に追従しない問題の修正
- [ ] PWA アイコン画像の作成（`icons/icon-192.png`、`icons/icon-512.png`）

### 機能追加
- [ ] LUFS Short-term 値の UI 表示（現在 Momentary と Integrated のみ）
- [ ] ピーク値リセットボタン
- [ ] 計測履歴の保存・グラフ表示（IndexedDB）
- [ ] スペクトラムアナライザー（FFT バーグラフ）
- [ ] dBSPL 表示の切り替えトグル（dBFS / dBSPL）

### 品質・運用
- [ ] Service Worker キャッシュ戦略の本番最適化
- [ ] GitHub Pages / Netlify へのデプロイ設定（HTTPS 対応）
- [ ] スマートフォン向けレイアウト調整（縦向き固定・タッチ操作最適化）
