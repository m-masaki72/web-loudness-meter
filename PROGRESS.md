# Web Loudness Meter — 実装進捗

## 技術選定
| 項目 | 決定 |
|------|------|
| ビルドツール | Vite + Vanilla JS |
| LUFS実装 | 手書き（ITU-R BS.1770-4） |
| PWA | 対応（HTTPS環境のみ有効） |
| UIスタイル | リアルハードウェアメーター風（MVMeter2参考） |
| サーバ依存 | なし（`dist/` を直接ブラウザで開いて動作） |

---

## 実装済み機能

### Phase 1 — プロジェクトセットアップ ✅
- [x] Vite + Vanilla JS 初期化
- [x] PWA雛形（manifest.json + sw.js）
- [x] `.gitignore` 設定（node_modules / dist 除外）
- [x] 初期コミット

### Phase 2 — コア計測エンジン ✅
- [x] `getUserMedia`（AGC / echo / noise = false）+ `AudioContext` 初期化
- [x] `AnalyserNode` + RMS → dBFS 計算
- [x] `AudioWorkletNode` — Blob URL 経由でロード（サーバ不要）
- [x] K-weighting フィルター係数（sampleRate 動的対応）
- [x] LUFS Momentary（400ms）/ Short-term（3s）/ Integrated（ゲーティング付き）

### Phase 3 — A/C 特性 + SPL キャリブレーション ✅
- [x] A 特性・C 特性 Biquad 係数実装（sampleRate 対応）
- [x] dBFS → dBSPL 疑似キャリブレーション UI（localStorage 保存）

### Phase 4 — リアルタイム UI（Canvas） ✅
- [x] メタリックパネル背景（ベゼル・スクリュー・グラデーション）
- [x] オシロスコープ（発光グリーンライン・CRT スキャンライン・グロー）
- [x] LED バーグラフ（dBFS / dBA / LUFS-I の 3 本、ピークホールド付き）
- [x] アナログ針メーター（バネ物理モデル・金属盤面・ラジアルグラデーション）
- [x] 7 セグメント風デジタル数値表示（グロー付き）

### Phase 5 — 録音・エクスポート ✅
- [x] `MediaRecorder`（webm/opus、iOS は mp4 fallback）録音実装
- [x] Web Share API（iOS 対応）+ `<a>` ダウンロード fallback

### Phase 6 — モバイル対応 ✅
- [x] Screen Wake Lock + `visibilitychange` 復帰ロジック
- [x] iOS ワイドスペクトラム設定案内 UI（初回起動時のみ表示）
- [x] `file://` で開いた場合は Service Worker 登録をスキップ

---

## ファイル構成

```
web-loudness-meter/
├── .gitignore
├── CLAUDE.md
├── PROGRESS.md
├── README.md
├── index.html
├── manifest.json
├── sw.js                              # Service Worker（HTTPS のみ有効）
├── vite.config.js                     # base: './' で file:// 対応
├── package.json
├── public/
│   └── loudness-processor.js          # ビルド前参照用（実際は ?raw で bundle）
└── src/
    ├── main.js                        # エントリー・UI イベント制御
    ├── style.css
    ├── audio/
    │   ├── mic-capture.js             # getUserMedia + AudioContext + Worklet 初期化
    │   ├── analyser.js                # AnalyserNode ラッパー（RMS / dBFS）
    │   ├── weighting.js               # Biquad 係数生成（A / C / K 特性）
    │   ├── calibration.js             # dBFS → dBSPL オフセット管理
    │   ├── recorder.js                # MediaRecorder + Web Share API エクスポート
    │   └── worklet/
    │       └── loudness-processor.js  # AudioWorkletProcessor（LUFS / dBA / dBC）
    ├── ui/
    │   ├── oscilloscope.js            # Canvas：CRT 風発光波形
    │   ├── bar-meter.js               # Canvas：LED バーグラフ
    │   ├── analog-meter.js            # Canvas：アナログ針メーター
    │   └── wake-lock.js               # Screen Wake Lock 管理
    └── utils/
        └── sample-rate.js             # sampleRate 検出・双一次変換ユーティリティ
```

---

## 既知の課題・今後の改善点

| 優先度 | 内容 |
|--------|------|
| 高 | PWA アイコン画像未作成（`icons/` フォルダが空） |
| 高 | 動作確認未実施（実機でのマイク・LUFS 値検証） |
| 中 | Canvas サイズが起動時固定のため、ウィンドウリサイズに未対応 |
| 中 | LUFS Short-term 値の UI 表示（現在 Momentary と Integrated のみ） |
| 低 | Service Worker キャッシュ戦略の本番最適化 |
| 低 | スペクトラムアナライザー（FFT 表示）の追加 |

---

## 動作確認手順

```bash
# 開発
npm run dev        # http://localhost:5173

# ビルド（サーバ不要版）
npm run build      # dist/ 生成
# → dist/index.html をブラウザで直接開く（Chrome 推奨）
```

**スマートフォンでの動作確認：**
- GitHub Pages / Netlify 等にデプロイ（HTTPS 必須）
- または `npm run dev` 起動後に LAN の IP（`http://192.168.x.x:5173`）でアクセス
