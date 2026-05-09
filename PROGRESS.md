# Web Loudness Meter — 進捗・ロードマップ

## 実装済み（v0.3.1）

### コード品質・修正（2026-05-10）

| カテゴリ | 内容 |
|----------|------|
| バグ修正 | `gatedBlocks` 配列を Float64Array リングバッファに置換（~10分上限）。長時間セッションのメモリ肥大・O(N)ループを解消 |
| バグ修正 | ピークホールド decay 速度を 30 dB/s → ~2 dB/s（0.5→0.033 dB/frame）に修正 |
| バグ修正 | START ボタン連打による `initAudio` 二重起動を防止（await 前に disabled） |
| バグ修正 | 音声未起動時のキャリブレーション誤保存（offset=0）を防止 |
| バグ修正 | `biquadHighShelf` の alpha 計算 `(1/1-1)` を `Math.sqrt(2)` に明示化 |
| バグ修正 | 停止時の `spectrum.draw` ハードコード 48000 Hz をデバイス実測値に変更 |
| パフォーマンス | `AnalogMeter` にオフスクリーンキャンバス導入。毎フレームのグラデーション・目盛り再描画を廃止 |
| パフォーマンス | DSP ループ統合（Raw RMS の別ループ削減）。`BarMeter` セグメント描画バッチ化（shadowBlur 変更 120→9回/frame） |
| セキュリティ | `index.html` に Content-Security-Policy meta タグ追加（外部スクリプト注入防御） |
| セキュリティ | キャリブレーション入力に `isFinite` + 範囲 [0, 140] バリデーション追加 |
| UX | 音声未起動時はキャリブレーションパネルを開けないよう制御 |
| UX | PEAK RST ボタンに 150ms フラッシュフィードバックを追加 |
| UX | `initAudio` 失敗時に START ボタンを確実に再有効化 |
| UX | `SpectrumAnalyzer` がサンプルレートをキャッシュし ResizeObserver のハードコードを除去 |

---

### 機能実装済み（v0.3.0 まで）

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
| PWA | アイコン (192/512px)、manifest.json、Service Worker（キャッシュファースト） |
| ビルド | Vite + Vanilla JS、base `/web-loudness-meter/` |
| AudioWorklet | Blob URL 経由ロード（サーバ不要） |
| デプロイ | GitHub Actions → GitHub Pages 自動デプロイ |
| 実機確認 | Chrome Android / iOS Safari 動作確認済み |

---

## 今後の対応事項

### スマホ UI 最適化
- [ ] タッチターゲット 44px 以上確保（ボタン・入力欄）
- [ ] Safe Area 対応（`env(safe-area-inset-*)` でノッチ・ホームインジケータ回避）
- [ ] `overscroll-behavior: none` でPWA起動時の誤スクロール防止
- [ ] `manifest.json` に `"orientation": "portrait"` 追加
- [ ] `beforeinstallprompt` でアプリ内インストールバナー表示

### 品質・運用
- [ ] LUFS 値の精度検証（-23 LUFS 基準音源と照合）
- [ ] Service Worker キャッシュ戦略の本番最適化（更新通知 + skipWaiting）
- [ ] 履歴グラフの表示期間選択（直近5分 / 30分 / セッション全体）
