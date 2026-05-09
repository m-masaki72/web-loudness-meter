# Web Loudness Meter — 進捗・ロードマップ

## 実装済み（v0.3.0）

| カテゴリ | 内容 |
|----------|------|
| 計測エンジン | dBFS (RMS)、dBA (A特性)、dBC (C特性)、LUFS M/S/I (ITU-R BS.1770-4) |
| UI | CRT風オシロスコープ、LEDバーグラフ (ピークホールド)、アナログ針メーター |
| スペクトラム | FFTアナライザー（対数スケール 20Hz〜20kHz、リアルタイムバー表示） |
| LUFS-S表示 | Short-term LUFS をデジタル表示（5列表示に拡張） |
| ピークリセット | PEAK RST ボタンでピークホールドをリセット |
| dBSPL トグル | dBSPL OFF/ON ボタンでキャリブレーション済み値の表示切替 |
| 計測履歴 | IndexedDB に1秒ごと保存、HIST ボタンで折れ線グラフ表示（直近5分） |
| スクロール対応 | PC・スマホ両対応、縦スクロール可能 |
| インアプリ説明書 | ? ボタンで計測値・グラフ・ボタンの解説をオーバーレイ表示（FAQ付き） |
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

### 品質・運用
- [ ] LUFS 値の精度検証（-23 LUFS 基準音源と照合）
- [ ] スマートフォン向けレイアウト調整（縦向き固定・タッチ操作最適化）
- [ ] Service Worker キャッシュ戦略の本番最適化
- [ ] 履歴グラフの表示期間選択（直近5分 / 30分 / セッション全体）
