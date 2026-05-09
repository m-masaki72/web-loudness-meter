# Web Loudness Meter — 進捗・ロードマップ

## 実装済み（v0.2.0）

| カテゴリ | 内容 |
|----------|------|
| 計測エンジン | dBFS (RMS)、dBA (A特性)、dBC (C特性)、LUFS M/I (ITU-R BS.1770-4) |
| UI | CRT風オシロスコープ、LEDバーグラフ (ピークホールド)、アナログ針メーター |
| リサイズ対応 | ResizeObserver による Canvas 自動追従（画面回転・ウィンドウリサイズ） |
| キャリブレーション | dBSPL疑似キャリブレーション（localStorageに永続保存） |
| 録音 | MediaRecorder (webm/opus)、Web Share API / `<a>` fallback |
| モバイル対応 | Screen Wake Lock、iOS ワイドスペクトラム案内 |
| PWA | アイコン (192/512px)、manifest.json、Service Worker |
| ビルド | Vite + Vanilla JS、base `/web-loudness-meter/` |
| AudioWorklet | Blob URL 経由ロード（サーバ不要） |
| デプロイ | GitHub Actions → GitHub Pages 自動デプロイ |
| 実機確認 | Chrome Android / iOS Safari 動作確認済み |

---

## 今後の対応事項

### 機能追加
- [ ] LUFS Short-term 値の UI 表示（現在 Momentary と Integrated のみ）
- [ ] ピーク値リセットボタン
- [ ] 計測履歴の保存・グラフ表示（IndexedDB）
- [ ] スペクトラムアナライザー（FFT バーグラフ）
- [ ] dBSPL 表示の切り替えトグル（dBFS / dBSPL）

### 品質・運用
- [ ] LUFS 値の精度検証（-23 LUFS 基準音源と照合）
- [ ] スマートフォン向けレイアウト調整（縦向き固定・タッチ操作最適化）
- [ ] Service Worker キャッシュ戦略の本番最適化
