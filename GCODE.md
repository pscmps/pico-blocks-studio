# Gcode / PlotterFlow

[English](GCODE.en.md)

「高度なブロック」の一番下の **Gcode** に9ブロックを用意しています。XY倍率、STEP/DIR、PWMペン、受信制御の開始、USBの1行受信、実行してUSBへ応答、起動メッセージ、解析、状態です。メニュー → サンプル → PlotterFlow / Gcode受信からPico 2 / Pico 2 Wのプログラムを読み込めます。読み込みは現在のブロックとボード選択を置き換え、元に戻せます。自動実行はしません。

繰り返しの中で、受信した行を独立した「Gcodeを実行してUSBへ応答」ブロックへ渡します。このブロックが1回実行し、`ok` または `error:…` をUSBへ返すので、出力ブロックは不要です。「Gcode処理を開始」は初期化だけを行います。保存済みの旧形式も読み込めます。新しい配置を使うにはサンプルを読み込み直してください。

## PlotterFlow Motor Shield v0.7

**HELPの一番下で「開発中の項目を表示」をON**にすると、今回の6構成のボード・専用ブロック・サンプルが選択可能になります。初期状態はOFFで、設定はブラウザに保存します。OFFにしても保存済みのブロックやボード設定は保持しますが、再開・書き込みにはONへ戻す必要があります。表示設定は実行中の機器を停止しません。

右側の「使用するボード」で **Motor Shield · コントローラ名** を選び、メニュー → サンプル → PlotterFlow / Gcode受信から同じ構成を読み込みます。「高度なブロック → Gcode」のシールド専用接続ブロックは、STEP/DIRとPWMペンをまとめて初期化します。従来の裸のPico用サンプルはそのまま残しています。

| コントローラ | ソケット | X STEP / DIR | Y STEP / DIR | EN | PWMペン | 初期ファーム |
|---|---|---|---|---|---|---|
| Pico / Pico W / Pico 2 / Pico 2 W | J1 | GP2 / GP4 | GP3 / GP5 | GP7、Low有効 | GP12 | 各機種の公式MicroPython |
| RP2350-LCD-1.47-A | J2 | GP2 / GP4 | GP3 / GP5 | GP7、Low有効 | GP9 | Waveshare RP2350A |
| RP2350-Touch-LCD-2 / -C | J3 | GP2 / GP4 | GP3 / GP5 | GP7、Low有効 | GP9 | Waveshare RP2350A |

Touch系は**カメラとFPCを外した構成のみ**。LCD/SD等の予約GPIOは候補から除外し、Touchでは利用可能なADC端子がないためADCブロックを非表示にします。Zero系は対象外です。Pico W / Pico 2 WのWi-Fi書き込みは本体の既存機能を使用できますが、Gcode受信はUSBです。

左の図は寸法・面・取り付け向きを再現するCAD図ではなく、端子番号付きの機能図です。J5/J6はX/YモータのA1/A2/B1/B2、U1/U2は下面に挿す互換StepStickです。PWMペンはJ9（1=GND、2=+5V、3=PWM）、信号には基板上のR14 220Ωが入ります。J12は1=GND、2=VCC、3=DATAでR20 220Ωを内蔵し、電源はJ13です。これらの抵抗を外付けで重ねて追加する図ではありません。

J7=外部12V、J8=外部安定化5V、J13=シリアルサーボ定格の専用電源。**各＋端子は別系統、全GND共通**。PWMだけのGcodeサンプルはJ12/J13を使いません。コントローラはUSB給電し、常に1枚だけ装着します。基板上のヒューズ・逆接保護はなく、外部保護が必要です。

**試作・実機未検証です。TMCの設定はこのサンプルに含みません。** TMC2209（基準BTT V1.2）は設計資料どおりのジャンパ、GP0 TX / GP1 RX、アドレスX=0/Y=1。電流・マイクロステップ・UART設定と読戻しを別途確認してください。80 step/mmは仮値なので機構とマイクロステップに合わせます。これらを確認するまではM17を送らないでください。原点復帰、リミット停止、ボタン処理、LCD/タッチ表示も未実装です。既存Gcodeの送り速度・即時停止の制約は下記のままです。

参照：[シールドのGPIO定義](https://github.com/pscmps/plotterflow-motor-shield/blob/25aed4887b741969eb9d3d8ba8d62d9c550b7a4b/firmware/board-mappings.json)、[電源・UART](https://github.com/pscmps/plotterflow-motor-shield/blob/25aed4887b741969eb9d3d8ba8d62d9c550b7a4b/docs/power-and-uart.md)、[ジャンパ](https://github.com/pscmps/plotterflow-motor-shield/blob/25aed4887b741969eb9d3d8ba8d62d9c550b7a4b/docs/jumper-settings.md)。閲覧には元リポジトリの権限が必要な場合があります。元の基板・図面ファイルは複製していません。ファーム配布元：[LCD-1.47-A公式Wiki](https://www.waveshare.com/wiki/RP2350-LCD-1.47-A)、[Touch-LCD-2公式Wiki](https://www.waveshare.com/wiki/RP2350-Touch-LCD-2)。

## 必要な外部回路

ステッピングモータはGPIOに直結できません。**各軸に外付けSTEP/DIRドライバ（TMC2209などの対応キャリア基板）と、モータ仕様に合う外部電源が必要**です。

| 機能 | サンプルの接続 |
|---|---|
| X STEP / Y STEP | GP2 / GP3（連続するGPIO） |
| X DIR / Y DIR | GP4 / GP5 |
| 共通EN | GP7、Lowで有効 |
| PWMペン | GP12、50 Hz、上1000 µs／下1800 µs |
| XY倍率 | 各80 step/mm |
| ドライバVM | モータ用外部電源の＋ |
| ドライバVIO | 3.3 Vに対応するキャリアのみPicoの3V3 |
| GND | Pico・両ドライバ・モータ電源・ペン電源で共通 |

左の図は機能端子の模式図で、実物の端子順・配線色ではありません。コイルA/Bはモータの組を確認し、電源を切って配線します。通電中のモータ抜き差しは避けます。VMをGPIO・3V3・VIOに接続しないでください。ペンも別途定格に合う電源を使用し、Picoからモータやサーボに給電しません。

TMCのUART設定、電流設定、マイクロステップ設定はこのプログラムに含めません。キャリア基板の説明書に従って設定し、実際の移動量とstep/mmを合わせます。ENには外部の無効レベルへのプル抵抗など、リセット中も意図せず有効にならない設計が必要です。具体的な抵抗・電源電圧・電流は使用基板に合わせてください。

[TMC2209公式資料](https://www.analog.com/en/products/TMC2209.html)はICの資料です。購入したキャリア基板の端子順・回路は別途確認してください。

## 使用順序

1. 対象ボードに通常のMicroPythonを入れ、このサイトのサンプルでピン・倍率・ペン幅を確認。
2. USBから「保存して実行」。起動時はドライバ無効、ペンは上位置へ動きます。
3. このサイトのUSB接続を切断し、PlotterFlowで同じポートに接続。開発中のMicroPython RP STEP/DIR XYプロファイルを使います。
4. M115で応答確認。駆動条件と外部の停止手段を確認した後にM17で有効化。M18で無効化。

書き込み待機へ戻すにはPlotterFlow側のポートを閉じ、このサイトで再接続します。保存後の起動待機やBOOTの扱いは既存のHELPを参照してください。USB/Wi-Fi JOG、PIOシリアルサーボ、割り込み・タイマーとは別プログラムです。

## 元ファームとの対応・差分

出典：pscmps [plotterflow-micropython-rp / firmware/rp_stepdir](https://github.com/pscmps/plotterflow-micropython-rp/tree/0e4917ee24309520e9e147308ff75fe1d22e56f1/firmware/rp_stepdir)、コミット `0e4917ee24309520e9e147308ff75fe1d22e56f1`。比較原本は `tests/fixtures/plotterflow` に保存しています。元リポジトリには確認時点でLICENSEファイルがなく、この原本に新たなライセンスを付与していません。

- `board_config.py` → XY、STEP/DIR、PWMペンの各設定ブロック。
- `main.py` → プログラム開始、4設定、起動メッセージ表示、ずっとくり返す、1行受信、空でなければ独立したブロックで実行してUSBへ応答。
- `gcode.py`、`planner.py`、`protocol.py` → 生成Python内の解析・モーダル状態・XY補間・コントローラ。解析ブロックは `{"command": "G1", "words": {"G": 1.0, "X": 2.0}}` のような辞書を返します。
- `update_store.py` は移植対象外。保存・書き込み待機・Wi-Fi転送はPicoBlocks既存の仕組みを使います。生成物は依存ファイル不要の1プログラムです。

**バイト単位のコピーではなく、設定・受信ループ・対応命令の再現です。** 通常の命令に対する応答、座標・状態・同期ステップ列は原本との比較テストを通しています。次は意図的に修正しています。

- MicroPythonで使えない `findall` と省略され得る `re.sub` への依存を除去。STOP文字を空白として消さない。
- STEPのSET対象を2本に明示。次のDIR変更前にFIFOの排出と最終パルスを待つ。
- `restart()`だけでなく停止時の再初期化でFIFOをクリア。ENのHigh/Low両極性に対応。
- ステップ列を逐次生成し、無制限の履歴を蓄積しない。
- プログラム中断・未処理エラー時はドライバ無効、PIO停止、STEPをLow、PWM解放。
- 原本と同じ行内エラーは `error:...` として返信し、受信ループを継続するため、必ずドライバ無効になるわけではありません。

## 試作としての制約

対応：G0/G1、G90/G91、G20/G21、G92、M17/M18、M3/M5、M115、STOP（0x85）。G92は原点復帰ではなく内部座標の設定です。G92の単位処理やZとM3/M5の状態の違いも元実装を踏襲しています。状態ブロックの `pen_down` はM3/M5指令の状態で、Z移動や実測位置ではありません。

Fは記録のみでパルス速度に反映しません。元の1 MHz PIOクロックでFIFO供給に依存し、一定の送り速度や加減速を保証しません。MAX_FEED_MM_MINも元で未使用のためブロック化していません。原点復帰、リミット、移動範囲制限、位置フィードバック、円弧、リアルタイムSTOPは未実装です。`ok` は実測位置到達を意味しません。

STOPもUSBの改行待ち／Pythonのqueue処理中には割り込めません。物理的にドライバ電源を遮断できる停止手段を用意し、最初は無負荷で試験してください。**実機・波形・脱調・PlotterFlowとの実USB接続は未検証**です。

テスト：`npm test`、`python tests/gcode_runtime.py`。後者は原本との1012解析入力・1000XY経路比較、コマンド応答・状態・ステップ列、EN両極性、FIFO初期化、2種類の生成受信ループを仮想GPIO/PIOで検査します。

根拠：[MicroPython re](https://docs.micropython.org/en/v1.29.0/library/re.html)、[rp2](https://docs.micropython.org/en/v1.29.0/library/rp2.html)。
