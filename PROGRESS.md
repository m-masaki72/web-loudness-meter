# Web Loudness Meter — 実装進捗

## 技術選定
| 項目 | 決定 |
|------|------|
| ビルドツール | Vite + Vanilla JS |
| LUFS実装 | 手書き（ITU-R BS.1770-4） |
| PWA | 最初から対応 |
| UIスタイル | リアルハードウェアメーター風（MVMeter2参考） |

---

## フェーズ一覧

### Phase 1 — プロジェクトセットアップ ✅
- [x] Vite + Vanilla JS 初期化
- [x] PWA雛形（manifest.json + sw.js）
- [x] ディレクトリ構成作成
- [x] `vite dev` でlocalhost確認（http://localhost:5173）

### Phase 2 — コア計測エンジン ✅
- [x] `getUserMedia`（AGC/echo/noise=false）+ `AudioContext`初期化
- [x] `AnalyserNode` + RMS → dBFS計算
- [x] `AudioWorkletNode` セットアップ（public/loudness-processor.js）
- [x] K-weightingフィルター係数（sampleRate動的対応）
- [x] LUFS Momentary（400ms）/ Short-term（3s）/ Integrated（ゲーティング付き）

### Phase 3 — A/C特性 + SPLキャリブレーション ✅
- [x] A特性・C特性 Biquad係数実装（sampleRate対応）
- [x] dBFS→dBSPL 疑似キャリブレーションUI（localStorage保存）

### Phase 4 — リアルタイムUI（Canvas） ✅
- [x] メタリックパネル背景（ベゼル・スクリュー・グラデーション）
- [x] オシロスコープ（発光グリーンライン・CRTスキャンライン・グロー）
- [x] LEDバーグラフ（dBFS / dBA / LUFS-I の3本、セグメントグロー）
- [x] アナログ針メーター（バネ物理モデル・金属盤面）
- [x] 7セグメント風デジタル数値表示（グロー付き）

### Phase 5 — 録音・エクスポート ✅
- [x] `MediaRecorder`（webm/opus）録音実装
- [x] Web Share API（iOS対応）+ `<a>`ダウンロードfallback

### Phase 6 — モバイル対応 + PWA仕上げ ✅
- [x] Screen Wake Lock + `visibilitychange`復帰ロジック
- [x] iOSワイドスペクトラム設定案内UI
- [ ] PWA manifest アイコン生成（要画像ファイル）
- [ ] Service Worker キャッシュ戦略（本番ビルド時に調整要）

---

## ファイル構成
```
web-loudness-meter/
├── index.html
├── manifest.json
├── sw.js
├── icons/
├── src/
│   ├── main.js
│   ├── audio/
│   │   ├── mic-capture.js         # getUserMedia + AudioContext
│   │   ├── analyser.js            # AnalyserNode：波形 + dBFS
│   │   ├── worklet/
│   │   │   └── loudness-processor.js  # AudioWorkletProcessor
│   │   ├── weighting.js           # Biquad係数（A/C/K）
│   │   ├── calibration.js         # dBFS→dBSPL オフセット
│   │   └── recorder.js            # MediaRecorder + エクスポート
│   ├── ui/
│   │   ├── oscilloscope.js        # Canvas：発光波形
│   │   ├── bar-meter.js           # Canvas：LEDバーグラフ
│   │   ├── analog-meter.js        # Canvas：アナログ針
│   │   ├── panel.js               # Canvas：メタリックパネル
│   │   └── wake-lock.js           # Screen Wake Lock
│   └── utils/
│       └── sample-rate.js
├── package.json
└── vite.config.js
```

---

## 重要な実装ノート

### オーディオパイプライン
```
getUserMedia (AGC/echo/noise=false)
  ├─[A] AnalyserNode → dBFS(RMS) + 波形配列
  ├─[B] AudioWorkletNode → LUFS M/S/I、dBA、dBC
  └─[C] MediaRecorder → webm/opus録音
```

### Canvas リアル描画テクニック
- `shadowBlur` + `shadowColor` → LEDグロー・オシロ発光
- `createRadialGradient` → メーター盤面の金属質感
- `createLinearGradient` → アルミパネル
- 針アニメーション：`velocity += (target - current) * spring - velocity * damping`

### iOS固有対処
- getUserMedia後に `audioContext.resume()` 必須（Safari制約）
- ファイル保存：`navigator.canShare({files:[...]})` → Web Share API → `<a>`fallback
- Screen Wake Lock解除後の復帰：`visibilitychange`イベントで再取得

### サンプルレート対応
- `audioContext.sampleRate` を初期化時に確認（44100 / 48000 / 96000）
- 双一次変換でBiquad係数を動的計算

---

## 検証方法
1. `npm run dev` → localhost でマイクテスト（Chrome）
2. ngrok or LAN HTTPS でスマートフォン実機確認
3. iOS Safari + Android Chrome 両方で動作確認
4. LUFS値を-23 LUFS基準音で照合
