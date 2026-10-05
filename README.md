# PicoBlocks Studio

## Gcode / PlotterFlow

今回のMotor Shield系は **HELP最下部 →「開発中の項目を表示」** をONにしたときだけ選択肢へ表示します（初期OFF・ブラウザに保存）。専用ブロック・サンプルも同じ設定で切り替わります。作成済みプログラムはOFFでも保持します。

**Motor Shield v0.7**：Pico / Pico W / Pico 2 / Pico 2 W、RP2350-LCD-1.47-A、RP2350-Touch-LCD-2 / -C（カメラ/FPC取り外し）の6構成を追加。基板選択・専用接続ブロック・端子番号付き簡略図・USB Gcodeサンプルを用意しています。Zero系は対象外。TMC初期化・原点復帰・リミット停止・LCDは未実装、実機未検証です。[ピン・電源・使い方](GCODE.md#plotterflow-motor-shield-v07)。

「高度なブロック → Gcode」と、メニュー → サンプルにPlotterFlow受信プログラムを追加しています。Pico 2 / Pico 2 WのSTEP/DIR式XY＋PWMペンを、設定・USBの1行受信・Gコード実行・返信のブロックで再現します。各軸の外付けドライバ（TMCなど）と外部電源が必須で、左の図にも表示します。TMC UART設定は含みません。

元ファームとの比較テスト済み、実機未検証。Fによる速度制御や即時STOPは未実装です。元ファームからの互換性・安全面の修正と使い方は [GCODE.md](GCODE.md) を参照してください。

## Pythonでブロックを作る

**高度なブロック → ブロック作成（Python）**に、複数行のコード欄を持つ関数定義があります。プログラム開始の直下へつなぎ、名前と本文だけを書きます。`def`は不要。引数は`arg`、戻り値は`return`で指定し、同名の「関数の結果」「関数を実行」ブロックから呼び出します。たとえば`return arg * 2`に引数3を渡すと6になります。

Enterで改行、Tabで4スペース、Ctrl+Enterまたは欄の外をクリックして確定。本文は16384文字までで、複製・保存・言語切替・JSON取り込みにも対応します。複数の引数は配列や辞書にまとめて渡してください。ローカル変数は通常ブロックの変数名とは別で、必要なimportは本文に書きます。

定義だけでは実行せず、呼び出し時にボード上で動きます。ブラウザーでPythonを実行する機能や、Pythonファイル全体を通常ブロックへ変換する機能ではありません。本文の文法やGPIO競合は自動検査できず、構文エラーは実行時にシリアル欄で確認します。信頼できるコードだけを使い、長い処理・無限ループによるJOGやタイマーの停止に注意してください。

入力欄はBlockly公式の[@blockly/field-multilineinput](https://www.npmjs.com/package/@blockly/field-multilineinput) 5.0.17（Apache-2.0）を使用し、Blockly 11.2.2との互換性を固定しています。

## サンプルプログラム

メニュー → **サンプル**から、PWM・SCS009・XL330・STS3215・STS3235の同種3台をUSB JOGで操作する例を呼び出せます。Pico W / Pico 2 W / ATOM LiteではWi-Fi JOG版も選べます。選択ボードに合わせてGPIOを設定し、GEEKにはLCDの機種名・キー割り当て表示を追加します（実測位置ではありません）。

- 上下＝ID/番号1、左右＝2、W/S＝3、Space＝3台を中央へ。A/Dはサーボ未割り当てです。
- 読み込みは現在のブロックを置き換えますが、自動実行・書き込みはしません。サンプル画面の「読み込み前に戻す」で直前の状態を1件復元できます。対話AI取り込みのバックアップとは別です。
- シリアルサーボは事前にID 1/2/3・通信速度・位置制御モードを設定。XL330は57,600 bps、SCS/STSは1 Mbpsです。サンプルはこれらを書き換えず、実行時にトルクONにします。PWMは50 Hz・1000〜2000 µsで、JOG指令まで出力しません。
- 外部電源・共通GND・信号レベルを確認し、負荷を外して試してください。最初のJOGやSpaceで中央付近へ大きく移動する場合があります。中央値・増減幅・パルス幅は実物に合わせて編集します。
- Wi-Fi版はボードが親機になるAP方式です。初回USB実行前にSSID/仮パスワードを変更し、スマホをそのWi-Fiへ接続してシリアル欄のURLを開きます。USB JOGとも共用できます。家庭のWi-Fi経由の書き込み機能とは別です。

9ボード・5種類・対応通信方式の計60構成を生成・構文検査し、3台だけへJOG指令が届くことを模擬検証しています。実機動作は未検証です（ATOM Liteも引き続き開発中）。明示したJOG割り当てがある場合は、未割り当て軸にSCS IDを自動補完しません。割り当てブロックがない旧形式の4軸既定値は維持します。

## 基本の整理・高度なブロック（2026-09-27）

「うごき」を廃止し、本体LED・GPIO出力を「基本 → 入力・出力」、waitを「時間・くり返し」に統一。新規GPIO出力は一行の `basic_write`、待ちは `basic_wait` を使います。旧 `gpio_write` / `wait_ms` の保存データはそのまま読み込めます。

「基本」のすぐ下の「高度なブロック」に45種類を追加しました。

- 配列（リスト）・数値型配列・バイト列・辞書
- 引数1個と戻り値のある関数、要素ごとの反復、break / continue、try / except / finally
- GPIO割り込みとソフトタイマー（停止・デバウンス対応）
- 型変換、文字列分割・置換、JSON、ビット演算、三角関数
- 汎用PWM、ソフトI2Cのスキャン・8ビットレジスタ読書き、ソフトSPI転送
- マイクロ秒カウンタ・差分、空きメモリ・GC

初期ファームの入れ直しは不要。追加処理を生成Pythonへ含めます。既存9ボードの外部GPIO候補に合わせ、ピンの競合・RPのPWMスライス競合・関数や制御ブロックの配置を検査します。サーボ配線図は従来どおりで、I2C/SPI周辺機器の結線図はまだありません。

### 割り込み・タイマーの実行方式

GPIOの `Pin.irq(hard=False)` はフラグを立てるだけです。中に置いたブロックは通常の実行側のディスパッチャーが実行し、IRQ内でサーボ通信・メモリ確保・待ちを行いません。ソフトタイマーは `ticks_ms/ticks_diff/ticks_add` による協調実行で、ハードウェアTimerではありません。待ち・ループ・文の間でイベントとJOGを処理し、プログラム末尾には待受ループを自動生成。終了時はfinallyでIRQを解除します。

イベントは同時実行せず、長い処理や別のハンドラー中は遅延します。IRQの連続変化や過ぎたタイマー周期を厳密には数えず、まとめます。高速計数・精密周期・安全装置用ではありません。ハンドラー内の無限ループや長い待ちは避けてください。

配列は0始まり、型・範囲違いはPythonの例外です。I2C/SPIは3.3 V信号専用で、I2Cには3.3 Vへのプルアップが必要です。周辺機器の仕様を確認してください。GPIO/I2C/SPI/PWMの接続は本体・サーボの使用ピンと共用しません。**MicroPythonの全APIではなく、主要機能のたたきです。実機の遅延・通信・波形は未検証です。** ファイル操作・RTC設定・スリープ・WDT・スレッド・asyncio・任意PIOは含めていません。

根拠：[割り込みの制約](https://docs.micropython.org/en/v1.29.0/reference/isr_rules.html)、[Pin](https://docs.micropython.org/en/v1.29.0/library/machine.Pin.html)、[I2C](https://docs.micropython.org/en/v1.29.0/library/machine.I2C.html)、[SPI](https://docs.micropython.org/en/v1.29.0/library/machine.SPI.html)、[PWM](https://docs.micropython.org/en/v1.29.0/library/machine.PWM.html)、[array](https://docs.micropython.org/en/v1.29.0/library/array.html)。

検査：`node tests/advanced.js` と `python tests/advanced_runtime.py`。45ブロック・9ボードの生成と検査、78プログラムの構文、配列・辞書・関数、IRQ/タイマーの模擬動作・終了時解除、SPIエラー時CS復帰などを確認します。

日本語 · [English](README.en.md) · [エディターを開く](https://pscmps.github.io/pico-blocks-studio/)

RP2040 / RP2350 + MicroPython向けの、ブラウザーだけで使えるブロックプログラミング環境のプロトタイプです。

## JOGと信号レベル（2026-09-27更新）

USB／Wi-Fi共通のJOG割り当てから生の速度値を非表示にしました。中央と増減幅だけを設定します。新規の内部既定値はSCS009・STS3215・STS3235が500、XL330が20。ボードの速度でもミリ秒でもなく、サーボへ渡す値です。保存済みの`SPEED`は互換性のため維持します。通常の位置移動ブロックの速度設定は引き続き使用できます。

SCS009（資料名SCS0009）・STS3215・STS3235：メーカー資料はHigh 2〜5 V、Low 0〜0.45 V。送信側・受信側を分けた規格や内部プルアップ電圧は明記されておらず、返答が常に3.3 V以下とは保証できません。

XL330：ROBOTIS公式は3.3 Vロジック・5 V互換。これはサーボ側の仕様で、ESP32の5 V耐性を意味しません。

STS3235・XL330はユーザー環境で直結動作実績あり（2026-09-27申告）。ボード・配線・通信速度などの条件は未記録で、このサイトの全ボード・全条件での検証済みを意味しません。

プルアップは解放されたDATAをHighへ戻すための抵抗で、電圧変換ではありません。相手が5 Vを出力する場合や5 Vへの既存プルアップがある場合、3.3 Vに抵抗を足しても安全にはできません。電圧が不明ならGPIOへ直結せず、メーカー確認またはボードを切り離した測定で確認します。5 Vのバスには通信速度と双方向半二重に適合するレベル変換が必要です。

2.2 kΩ・1/8 W以上は、3.3 Vのバスと確認できた場合の試験開始値です。メーカー指定ではなく、1 Mbpsの保証もありません。Low時は約1.5 mA・5 mW。相手の許容電流、既存抵抗との並列合成、配線容量と立ち上がり波形を確認します。安定している配線へ必ず追加するものではありません。

PIO／単線UARTによる方向切替と、信号の電圧変換は別の話です。サーボV+は外部電源へ、GNDは共通。ESP32 GPIOの許容電圧は3.6 Vで、5 V直結は禁止です。

[SCS0009 (PDF)](https://www.feetechrc.com/Data/feetechrc/upload/file/20201231/6374501159851026569964966.pdf) · [STS3215 (PDF)](https://files.seeedstudio.com/products/Feetech/108090023_STS3215-C001_Datasheet.pdf) · [STS3235 (PDF)](https://www.feetechrc.com/Data/feetechrc/upload/file/20211211/6377481273721644411048359.pdf) · [XL330 / ROBOTIS](https://emanual.robotis.com/docs/en/dxl/x/xl330-m077/) · [ESP32 / Espressif](https://docs.espressif.com/projects/esp-faq/en/latest/hardware-related/hardware-design.html)

## ATOM Lite（開発中・動作未確認）

M5Stack **ATOM Lite / ESP32-PICO-D4**を試験追加しました。AtomS3等は対象外です。USB書き込み・USB JOG・Wi-Fi書き込み・Wi-Fi JOG、SCS009 / XL330 / STS3215 / STS3235・PWM・基本ブロックに対応する実装です。LCDはGEEK専用のままです。**実機・通信波形・電源断耐性は未確認**です。

- 初回は[標準ESP32_GENERIC MicroPython](https://micropython.org/download/ESP32_GENERIC/)の安定版1.29以降を使用（通常版・LittleFS。UIFlow、S3/C3、UF2、カスタムFAT版は不可）。既存ファイルをバックアップ後、公式のesptool手順で`erase-flash`、`.bin`を`write-flash 0x1000`で書き込みます。**消去で既存UIFlow・設定・ファイルは失われます**。正面ボタンは初期ファーム用BOOTボタンではありません。
- 再起動後、このサイトで「ボードを接続」からFTDIのUSBシリアルポートを選択（115200 bps）。表示されなければ[M5Stack公式のFTDIドライバ案内](https://docs.m5stack.com/ja/core/ATOM%20Lite)を確認します。
- Groveの黄線G26・白線G32は接続ブロックで`G26 (Grove)` / `G32 (Grove)`として選べます。黒はGND、赤は5 V。G32はADCにも使用可能です（G26のADC2はWi-Fi競合を避けるためADC候補から除外）。
- 左の配線図には、シリアルバスごとに必要時のプルアップとして**本体拡張端子3V3 → 2.2 kΩ（1/8 W以上）→ DATA**を表示します。PWMには付けません。Groveには3.3 Vがないため本体から引き出し、赤の5 V・サーボV+にはつなぎません。DATAが5 Vの場合はこの抵抗では保護できません。
- 2.2 kΩは短配線の試験開始値です。Low時の電流は約1.5 mA、抵抗の最大消費は約5 mW（3.3 Vの場合）。1 kΩなら約3.3 mA・11 mW。抵抗の定格だけでなく相手側のシンク電流と既存抵抗との並列合成を確認します。立ち上がりは配線容量に依存し、例えば100 pFで0→75%は2.2 kΩで約0.30 µs（理想RC計算）。1 Mbpsを保証する値ではないので、波形・応答を見て必要なら1〜2.2 kΩで調整してください。実機未確認です。[Espressifの単線UART配線例](https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Serial/OneWire_UART_Two_Boards/OneWire_UART_Two_Boards.ino)を参考にした設計上の目安で、M5Stackの指定抵抗値ではありません。
- 保存後は起動から3秒後に自動実行。書き込み待機にするには、電源を入れ直して3秒以内に**正面ボタン（GPIO39）**を押します。一般説明のBOOTはATOM Liteではこのボタンです。USB接続中は画面の「書き込み待機」も使えます。
- Wi-FiはPico Wと同じメニュー・手順です。初回のみPC＋USBで受信機能と現在のプログラムを保存し、以後は同じLANのPC／Android Chromeからこのサイトで直接保存します。Wi-Fi JOGは別のAP動作です。実機ではいずれも未確認です。
- シリアルサーボは**同一GPIOのTX/RX＋オープンドレインUART**を使用。USB用UART0を残しUART1/2を自動割当て（合計2種類まで）。ブロックはGPIOと通信速度だけです。送信エコーを除去してから応答を解析し、異常時はUARTを停止してピンを入力へ戻します。再試行にはプログラムの再起動が必要です。
- **半二重変換ICなしの試作ですが、無条件に直結できる意味ではありません。** DATAは3.3 V互換が条件で、5 V信号の直結は禁止。内蔵プルアップは弱く、配線長・容量・速度によって外付け3.3 Vプルアップが必要です。1 Mbpsを含め通信品質は未確認。サーボは仕様に合う外部電源、GND共通で、まず無負荷・低速で確認します。
- GPIO候補は19 / 21 / 22 / 23 / 25 / 26 / 32 / 33。ADCはWi-Fiと共存するADC1の32 / 33のみ、電圧表示は概算。LEDはGPIO27のRGBを白色点灯・消灯。GPIO39はボタン、GPIO12はIR用として予約します。
- 配線図は拡張端子とGroveを分けたオリジナルの模式図で、3V3・5V・GNDも表示します。物理的な端子順・向きは公式ピン情報を確認してください。

根拠：[ESP-IDF同一GPIO TX/RXの注意事項](https://docs.espressif.com/projects/esp-idf/en/v5.0.9/esp32/api-reference/peripherals/uart.html)、[MicroPython ESP32 UART実装](https://github.com/micropython/micropython/blob/v1.29.0/ports/esp32/machine_uart.c)、[ESP32 API](https://docs.micropython.org/en/latest/esp32/quickref.html)。テストは`node tests/atom.js`、`python tests/atom_runtime.py`。実機検証を代替するものではありません。

## 表示言語

右上メニューの **Language / 言語** で「日本語」「English」を選べます。選択はブラウザーに保存します。USB接続・配置したブロック・入力値・ボード選択・編集履歴を保ったまま切り替え、ボードへの書き込みは行いません。ユーザーが入力した文字列・変数名・パスワードや、既存のシリアル出力は翻訳しません。転送等の処理中は切り替えを無効にします。

メニュー・ブロック・ツールチップ・配線図・初期ファーム案内・HELP・エラー・AI依頼文を翻訳します。生成コメントとWi-Fi JOGのスマホ画面は生成時の言語になります。保存済みWi-Fi画面を変えるには「保存して実行」で更新してください。HELP末尾は両言語共通で `made by pscmps` と表示します。GitHubのREADMEとAIガイドにも英語版があります。

## できること

- Blocklyでプログラムを組み立てる
- 生成されたMicroPythonコードを確認・コピーする
- Web SerialでMicroPython REPLへ接続する
- プログラムを一時実行する
- `main.py`として保存し、ボード起動時に自動実行する
- ブロックをブラウザー内へ自動保存する
- RP2040 / RP2350のPIOでSCS009 / SCS0009へ1線式半二重コマンドを送る
- 基板を選ぶと、SCS009のDATA端子候補をその基板で外部に出ているGPIOへ絞る
- 選択した基板、DATA GPIO、SCS009、外部電源の配線を簡略図で確認する
- 書き込み用Web Serial接続で4軸JOGを操作する
- Pico W / Pico 2 WがWi-Fi親機となり、スマホ向けJOGページを配信する
- PC／Android版Chromeから、今のサイトのままPico W / Pico 2 Wへ無線でプログラム保存（試験対応）
- ブロック本体のダブルクリックで複製する（開始ブロックは対象外、数値・選択欄は編集を優先）
- UARTの各軸を、別ブロックでSCS009のIDへ割り当てる
- Seeed Studio XIAO RP2040 / RP2350を選び、D番号とGPIO番号を併記した配線図・初期ファーム案内を使う
- XL330 / STS3215のPIO半二重通信（Ping・位置読取り・トルク・単回転位置移動）
- 通常のPWMサーボの接続、角度指定、パルス幅指定、出力停止
- USB / Wi-Fi JOGの各キー組をXL330・STS3215・PWMサーボにも個別に割り当てる
- ADC・GPIO入出力・四則演算・範囲変換・変数・条件分岐・時間・文字列の基本ブロック
- 計算した値をPWM / SCS009 / XL330 / STS3215へ渡す位置指令ブロック
- メニューから対話AIへの依頼テンプレートをコピーし、返答のJSONを編集可能なブロックへ取り込む

## 同じサイトからWi-Fi書き込み（試験対応）

USBが標準です。無線は **Pico W / Pico 2 W、MicroPython 1.29以降、PC／Android版Chrome 142以降** を対象にした試作で、実機・Android端末では未検証です。iPhone版ChromeもSafari系のエンジンなので対応対象に含めません。[ChromeのLANアクセス許可](https://developer.chrome.com/blog/local-network-access)を使い、HTTPSのGitHub PagesからPicoのHTTP APIへ直接送信します。ダウンロード・スマホへのプログラム保存・Pico側ページへの移動・中継サーバーは不要です。

1. **初回はPC＋USB**：通常のMicroPython UF2を入れ、ボードを選んで接続。メニューの「Wi-Fi書き込み」で「初回だけ」を開き、ルーターの2.4 GHz Wi-Fi名とパスワードを入力して「USBで初回設定・プログラム保存」。現在の処理を停止し、受信モジュール・設定・現在のブロックのプログラムを保存して無線待機にします。専用UF2は不要です。
2. **接続設定**：表示されたIP・64桁の接続キーを使用。スマホでも同じサイト・同じボードを選び、この2項目を入力します。必要なら「この端末に接続設定を保存」を選択。ブラウザーのローカルネットワーク接続許可を許可します。
3. **送信**：接続方法を「Wi-Fi」にして「無線接続を確認」。画面を閉じて「保存して実行」。ボードへ直接転送し、保存後に再起動します。再起動の要求まで確認し、ユーザープログラムの正常動作までは確認しません。
4. **次回**：ボードの電源を入れ直す／RUN–GNDでリセットし、**再起動後3秒以内にBOOTを押して離す**。約20秒以内にルーターへ接続したら同じサイトから接続・送信。BOOTを押したままリセットするとUF2モードなので注意。初回設定は繰り返しません。

### 範囲・安全性・復旧

- 受信機能は書き込み待機だけで動きます。実行中の無線停止・一時実行・ログ配信・無線JOG転送は今回の対象外。これらは従来どおりUSB、Wi-Fi JOGは既存の専用APで使います。AP型JOGから書き込みへ戻すときはスマホもルーターへ接続し直します。
- 信頼できるLAN専用。HTTPは暗号化しません。256-bitのランダム接続キー＋Origin制限で保護しますが、キーやコードをLAN内の盗聴から守るTLSではありません。ルーターのポート転送は設定しないでください。ゲストWi-Fiの端末間隔離は不可。Pico側は2.4 GHz、スマホ側は同じLANへ届くなら5 GHzでも可。
- Wi-Fiパスワードとキーはボードの`picoblocks-wifi.json`に保存。PC側にWi-Fiパスワードを永続保存しません。接続設定の保存を選んだ端末にはIPとキーをlocalStorageへ保存します（同じブラウザーを他人と共有する場合は選ばない）。再設定でキーが変わります。
- プログラムは最大128 KiB、768-byte単位で一時ファイルへ転送しSHA-256を検証。LittleFSの同一ディレクトリrenameで`main.py`を置換。切断・不完全転送・検証失敗は旧プログラムを維持。commitの返答が失われた場合は保存状態を断定せず再送します。実機の電源断耐性は未検証です。
- USB保存でも`_picoblocks_wifi.py`と設定は残り、BOOT待機から利用できます。初回に置く`main.py`は現在のブロック内容に置き換わります。他のツールが`main.py`を上書きした場合は初回設定をやり直してください。受信機能の更新もUSB初回設定から行います。
- IP変更時はUSBシリアルの`PICOBLOCKS_UPLOAD`行またはルーターで確認。DHCP予約推奨。`.local`は自動登録しません。Wi-Fi接続失敗時はUSB REPLへ戻るので再設定できます。接続キー紛失・受信不具合もUSBで復旧します。

自動テスト：`node tests/wifi.js`、`python tests/wifi_runtime.py`。本物の受信コードへのHTTP/CORS・認証・部分転送・改ざん・上限・commit・再起動要求のテストを含みます。ブラウザーのLAN権限と実ボードでの確認は別途必要です。

## 対話AIとブロックを作る

右上のメニュー →「対話AIとプログラムを作る」から依頼文をコピーします。使用ボード・ピン・ブロック仕様・仕様URLが含まれます。「作りたい動き」を書き足してChatGPTなどに渡し、返答のJSONを同じ画面へ貼り付けて取り込みます。URLにアクセスできないツールでも使えるよう、仕様自体も依頼文へ含めています。

取り込みは現在のブロックを置き換え、直前の状態を1件保存します。「取り込み前に戻す」で復元可能です。形式や配線の競合を検査し、自動実行はしません。任意のPythonを貼り付けてブロック化する機能ではありません。AIへ自動送信せず、現在のプログラムやWi-Fiパスワードもテンプレートに含めません。

詳細とサンプルは [AI_GUIDE.md](AI_GUIDE.md)。基本ブロックは左の「基本」ツリーにまとめています。ADCは各基板で利用できるGP26〜29だけを表示します。入力は0〜3.3 V、5 V不可。USBシリアル表示に加え、GEEKだけ「LCD文字表示」が使えます。サーボカテゴリはPWM → SCS009 → XL330 → STS3215 → STS3235です。

### 開発時のテスト

サイト自体は引き続きビルド不要の静的ファイルです。`devDependencies`のパッケージは開発テスト専用です。ホスト側の検査にはNode.js 18以上（npmを含む）とPython 3.8以上が必要です。Pythonは標準ライブラリのみを使い、pipの追加インストールは不要です。

リポジトリのルートで実行します。Windows / macOS / Linuxで同じ手順です。

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm test
```

`npm ci`は既存の`package-lock.json`に固定された依存を導入します。PowerShellの実行ポリシーで`npm.ps1`が拒否される場合は、`npm`を`npm.cmd`に置き換えてください。

`npm test`は`tests/*.js`と`tests/*_runtime.py`を自動列挙し、各ファイルを独立したプロセスで実行します。現在は**JavaScript 15本＋Python 12本＝27本**です。失敗しても残りを実行し、最後に成功数・失敗数・失敗ファイル名を表示します。テスト失敗、起動エラー、対象ファイルなし、Python不足はいずれも非ゼロ終了です。Python不足時は実行前に停止します。Python側もNodeを呼ぶため、両方の実行環境とnpm依存が必要です。

| 対象 | JavaScript (`tests/`) | Python (`tests/`) |
| --- | --- | --- |
| 高度なブロック・IRQ・タイマー | `advanced.js` | `advanced_runtime.py` |
| ATOM Lite | `atom.js` | `atom_runtime.py` |
| 基本ブロック・取り込み | `basics.js` | `basics_runtime.py` |
| コントローラメニュー | `controller_menu.js` | — |
| 開発中ボード・サンプルの表示設定 | `development.js` | — |
| G-code・モーターシールド | `gcode.js` | `gcode_runtime.py` |
| サーボ生成・プロトコル・PWM | `generation.js` | `servo_runtime.py` |
| HELP・初回案内 | `help.js` | — |
| 日英切替・生成コード | `i18n.js` | `i18n_runtime.py` |
| JOGのUI・指令 | `jog_ui.js` | `jog_runtime.py` |
| 実行・保存・起動ゲート | `modes.js` | `boot_runtime.py` |
| 手書きPythonブロック | `python_blocks.js` | `python_blocks_runtime.py` |
| サンプル | `samples.js` | `samples_runtime.py` |
| Wi-Fi書き込み | `wifi.js` | `wifi_runtime.py` |
| 配線図 | `wiring.js` | — |
| GEEK LCD | — | `display_runtime.py` |

ランナー自体の回帰検査は`npm run test:runner`で実行します（別の11項目）。一時フォルダーで失敗の伝播、Pythonの検出・選択、空白入りパス、別の作業ディレクトリ、`PYTHONOPTIMIZE`下のassert、空のテスト群などを確認し、終了時に片付けます。追加のnpm依存は不要です。

[Host tests](.github/workflows/host-tests.yml)はmain向けPRとmainへのpushで、Ubuntu 24.04 / Windows Server 2022、Node.js 22 / Python 3.12を使い、27本とランナー11項目を実行します。CIはホスト側の模擬テストのみで、サイトの配信や実機操作は行いません。macOS・最小対応バージョンの組み合わせはこのCIの対象外です。

切り分け用に`npm run test:js`、`npm run test:python`でも同じrunnerを使えます。単独ファイルは従来どおりルートから`node tests/advanced.js`や`python tests/advanced_runtime.py`で実行できます。

Pythonの自動検出順はWindowsで`py -3` → `python` → `python3`、macOS / Linuxで`python3` → `python`です。特定のPythonを使う場合は環境変数`PYTHON`に実行ファイルのパスだけを設定します（引数は含めません）。明示したパスが使えなければ失敗し、別のPythonへ切り替えません。

```powershell
$env:PYTHON = 'C:\path with spaces\python.exe'
npm.cmd test
```

```sh
PYTHON=/path/to/python3 npm test
```

runnerはPythonをUTF-8モードで実行し、`PYTHONOPTIMIZE`等のPython環境設定を無視してassert検査の無効化を防ぎます。対応ボードの候補・入力検査・取り込み保護・復元、サーボ通信、JOG、起動・保存、LCD、日英切替、高度なブロック、サンプル、Wi-Fi受信処理、手書きPython、G-code・モーターシールド、開発中機能の表示設定を、生成Pythonの構文検査と模擬ハードウェアで確認します。

公式PIOアセンブラによる追加検査は`npm test`には含みません。別途用意したMicroPython v1.29.0の`ports/rp2/modules/rp2.py`を使い、`python tests/servo_runtime.py --pio-assembler /path/to/rp2.py`で実行します。通常の27本が成功しても、この追加検査や実機のADC精度・通信波形・ボタン・LCD・サーボ動作・ブラウザーのLAN権限を検証したことにはなりません。テストはUSBや実ボードへ接続しません。

## 追加サーボの使い方

左の「XL330」「STS3215」「PWMサーボ」からブロックを置きます。接続ブロックは初期化用で、接続だけでトルクONや移動はしません。複数の接続があると配線ガイドで表示対象を選べます。図のコネクタは端子機能の模式図です。実物の端子順・向き・線色を示すものではありません。

### XL330 / STS3215

1. 接続ブロックでDATAのGPIOと通信速度を選びます。初期値はXL330が57,600 bps、STS3215が1 Mbpsです。サーボ側に保存された速度と一致させてください。
2. 無負荷で「接続を確認」「現在位置を読む」を実行し、シリアル欄で応答を確認します。
3. 標準の単回転位置モードで「トルクON」→「位置へ移動」を実行します。位置は0〜4095です。トルクONの前に現在位置を目標へ書き込みます。
4. JOGを使う場合はUARTまたはWi-Fi JOG開始ブロックに加え、サーボの「JOGを割り当て」ブロックを置きます。SCS以外には暗黙のID割り当てを行いません。トルクONも明示的に置きます。初期のJOG指令位置は割り当てブロックの中央値なので、実機位置に合わせてから小さい増減幅で試してください。

XL330はDYNAMIXEL Protocol 2.0のCRC・バイトスタッフィング、STS3215はチェックサム・リトルエンディアン形式をPythonへ移植しています。応答のID、長さ、CRC/チェックサム、サーボエラーを検査し、応答がなければタイムアウトにします。XL330はStatus Return Level=2など、書き込みへの応答が有効な設定を前提とします。

今回の移植範囲は通信と基本操作です。以前のC版にあるG-code、原点設定、多回転の有効化・移動はまだ含みません。XL330はOperating Mode=3かつ速度ベースのProfile、STS3215は標準の単回転位置設定を検査します。以前多回転に設定した個体は移動を拒否します。EEPROM、ID、通信速度、動作モードを自動で書き換えることはありません。

PIOはGPIO1本を送信中だけ出力にし、その後入力へ戻します。受信の開始もPIO内で切り替えます。Wi-Fiが使うPIOを避けるためPIO0だけを使用し、SCS009・XL330・STS3215の接続ブロックは合計2個まで、各種類1個までです。同種の複数台は同じDATA線に接続してIDで区別します。異なる種類には別GPIOを指定します。

XL330は外部3.7〜6.0 V電源（初回5 V）、DATAへの220 Ω直列保護抵抗を推奨します。STS3215は手元の製品バリエーションの定格電圧を確認してください。いずれもボードと共通GNDにし、サーボ電源を3V3へ接続しません。GPIOは3.3 V信号です。最初は電流制限した外部電源で1台ずつ確認してください。

### PWMサーボ

複数台を配置すると、配線ガイドは全PWMチャンネルのコネクタをまとめて表示します。信号線とコネクタ枠の色は番号ごとに固定されます。図の色・端子順は物理プラグの規格ではありません。

「接続」で番号（1〜16）と信号GPIOを指定します。「角度」は0〜180°、「パルス幅」はµsです。PWM周期は50 Hz固定、初期設定は0°=1000 µs、180°=2000 µsです。サーボの仕様・機械的な可動域に合わせて調整してください。500〜2500 µsの範囲内で上下限を設定でき、範囲外の指令は拒否します。接続時は出力0、停止ブロックでパルスを停止し、次の角度指定で再開します。

電源はサーボ用外部電源を使い、GNDを共通にします。複数台は番号とGPIOを分けます。同じPWMチャンネルを共有するGPIO（この対応ボードでは16番違い）の同時利用を検出します。JOGの値は度単位です。「停止」は信号停止で、保持力の解除を保証するものではありません。上部のプログラム停止だけでは保持トルクやPWM出力が残ることがあるため、必要な停止・トルクOFFブロックを明示的に実行してください。

### STS3235・複数台配線の追加

サーボカテゴリはPWM → SCS009 → XL330 → STS3215 → STS3235の順です。SCS009内の小分類は廃止し、接続・トルク・移動・値入力・JOG割り当てを一つの一覧にしています。

STS3235はSTS系のlittle-endianパケット・メモリテーブルを使い、STS3215の通信処理を共有します。Ping、位置読取り、トルク、単回転位置0〜4095、速度値1〜3400、加速度値1〜100、USB／Wi-Fi JOGに対応します。EEPROM・ID・動作モードは変更せず、接続だけでは動作させません。PIOバスは従来と同じ最大2種類、異なる種類は別GPIOです。実機動作は未検証です。

- [Feetech STS3235仕様](https://www.feetechrc.com/12v-30kg-metal-shell-metal-tooth-iron-core-motor-magnetic-coding-double-shaft-ttl-series-steering-gear.html)
- [Waveshare ST3235公式のSMS_STS制御例](https://www.waveshare.com/wiki/ST3235_Servo)

シリアル配線図は操作・JOGブロックのIDと有効なSCS標準JOG割り当てから台数を決めます。同一IDは1台にまとめ、ID未指定は仮コネクタ1個です。DATA・V+・GNDを各コネクタのIN/OUTへつなぐデイジーチェーンとして描きます。図は実機検出でもID設定でもありません。各個体のIDを事前に設定し、定格電圧・台数に応じた電源容量・配線容量を確認してください。

配線図の初期表示は「すべてのサーボ」です。PWMと異なるシリアル系も同じ基板から同時に描き、選択欄で1種類だけに絞れます。PWM1〜16は番号ごとの固定色、SCS009はオレンジ、XL330は紫、STS3215はピンク、STS3235は青緑の専用色です。PWMの色はシリアル専用色と重複しません。凡例・GPIO・信号線・コネクタ枠の色をそろえ、追加・削除や表示切替でも変えません。左右のGPIOは近い側へ、GEEKのコネクタは下へ信号線を引き出し、基板で隠れないようにしています。V+は種類ごとに分離し、GNDだけを共通にします。

コントローラの「速度500」はミリ秒ではなくサーボの速度レジスタへ渡す生値です。「増減幅」は入力1回の位置差で、速度とは別です。PWMには速度レジスタがないため、JOGは角度の増減幅だけを指定します。

### XIAOの対応範囲

標準のXIAO RP2040とXIAO RP2350に対応します（Plus、ESP32、nRF系は対象外）。両側のD0〜D10と5V/GND/3V3の14端子を図示し、接続GPIOはその11本から選びます。RP2350背面の追加パッドは今回の選択対象外です。D3はRP2040でGP29、RP2350でGP5なので、D番号とGP番号を混同しないでください。XIAOのこの2機種にはWi-Fiがないため、Wi-Fi JOG欄は表示されません。

- [XIAO RP2040専用MicroPython](https://micropython.org/download/SEEED_XIAO_RP2040/)
- [XIAO RP2350専用MicroPython](https://micropython.org/download/SEEED_XIAO_RP2350/)（通常のArm版）
- [Seeed公式RP2040ピン情報](https://wiki.seeedstudio.com/XIAO-RP2040/) / [RP2350ピン情報](https://wiki.seeedstudio.com/xiao_rp2350_arduino/)
- [ROBOTIS XL330-M077-T仕様](https://emanual.robotis.com/docs/en/dxl/x/xl330-m077/)
- [MicroPython PWM API](https://docs.micropython.org/en/latest/library/machine.PWM.html)

移植元は既存の `dynamixel-pio-xl330-m077-t-rp2040` C実装（参照コミット `1522efc`）の通信部です。元リポジトリのファイルや設定は変更していません。

### 検証

`node tests/generation.js`、`python tests/servo_runtime.py`、`python tests/jog_runtime.py`で、機種別生成、CRC・スタッフィング・チェックサム、異常応答、位置・PWM上下限、USB / HTTP指令を検査できます。生成された28プログラムをPython構文検査しています。MicroPython v1.29.0の公式PIOアセンブラでも命令と命令メモリ容量を確認しています。**Python移植版の実機通信・サーボ動作は未検証です。** C版での実機検証結果とは区別してください。

## 使い方

### GEEK内蔵LCDの文字表示

RP2040-GEEK / RP2350-GEEKでは「基本 → LCD文字表示」を使用できます。Pico / XIAOではカテゴリを隠し、LCDブロックを残してボードを変更した場合は実行・保存を拒否します。

- 「LCDに〜を改行して表示」: 文字列・数値・変数を表示。15文字で折り返し、8行を超えると上へスクロール。
- 「LCDの〜行目に〜を表示」: 1〜8行目を上書き。15文字まで。以前の長い文字列は残りません。改行ログの挿入位置は変えません。
- 「LCDの文字をすべて消す」: 全画面を黒くし、ログの挿入位置を1行目へ戻します。
- 「USBシリアル表示をLCDにも表示する／しない」: その実行後の `basic_print` のみを複写。受信データ・JOGプロトコル・サーボの内部ログ・すべてのPython printを自動複写するものではありません。

標準8×8フォントを2倍にして白文字・黒背景で描きます。英数字と半角記号に対応し、日本語等は `?` に置換します。図形、任意色、日本語フォント、USB受信文字列の自動表示は今回の範囲外です。くり返し更新には100 ms程度の待ち時間を入れてください。

ST7789、SPI1 24 MHz、DC=GP8 / CS=GP9 / SCK=GP10 / MOSI=GP11 / RST=GP12 / BL=GP25。横240×縦135、MADCTL=0x70、RAMオフセット(40,53)。SPI初期化がGP8をMISOへ設定する古いファームも考慮し、初期化後にGP8をD/C出力に戻します。バックライトはPWMを使わずON/OFFのみなのでサーボPWMチャンネルを消費しません。PIOも使用しません。

全画面RGBバッファを置かず、120バイトの文字用モノクロバッファと480バイトの送信用行バッファで描きます。ドライバは生成プログラム内に含め、最初の表示時に初期化します。追加ライブラリや専用UF2は不要です。**実機でのLCD表示は未検証**です。

参照した既存実装は [GEEK用Cドライバ](https://github.com/pscmps/dynamixel-pio-xl330-m077-t-rp2040/blob/1522efcbecaf9a2fe6a8c7b3629f5df566a5518a/firmware/pico-sdk-rp2040-geek/src/rp2040_geek_lcd.c)（Pico SDK版）です。指定されたRθ関連Zephyr版は未特定で、直接移植したものではありません。端子情報は [Zephyr公式GEEKボード資料](https://docs.zephyrproject.org/latest/boards/waveshare/rp2040_geek/doc/index.html) と [Waveshare RP2350-GEEK回路図](https://files.waveshare.com/wiki/RP2350-GEEK/RP2350-GEEK.pdf) を照合しています。フォントは [MicroPython framebuf](https://docs.micropython.org/en/v1.29.0/library/framebuf.html) の標準フォントを使用し、既存Cフォントのデータは複製していません。

`python tests/display_runtime.py` でSPI初期化・画面範囲・2倍描画・折り返し・上書き・複写・エラー時CS解除・生成Python構文を検査できます。

### 基本操作

1. 画面右側で使用するボードを選びます。
2. 「初期ファームを書き込む」を開き、機種別の手順でMicroPythonを書き込みます。
3. PC版のChromeまたはEdgeで公開ページを開きます。
4. USBでボードを接続し、「RPボードを接続」を押します。
5. ブロックを組み、「今すぐ実行」または「保存して実行」を押します。

### 書き込み待機と単独実行

画面右側は「初回の初期ファーム」「次回からの書き込み・保存しない場合」「電源の注意」に絞っています。JOG・Wi-Fi・配線・トラブル対処は右上メニューの **HELP** を開いてください。ブロック配置エリアの初回案内は「次回から表示しない」で非表示を記憶します。HELPの「初回案内をもう一度表示」で戻せます。案内の表示状態は、実機にファームが入っているかどうかの判定ではありません。

「保存して実行」は、生成プログラムと起動ゲートを `main.py` に保存します。保存中は一時ファイルへ書いて内容を照合してから置き換えます。通常の試運転や接続だけでは保存内容は変わりません。初期UF2は従来どおり各機種用のMicroPythonを使用し、特別なファームへの変更は不要です。

- 通常の電源ON／RSTでは、ユーザープログラムの開始前に3秒間BOOTを確認し、その後に保存プログラムを実行します。
- **電源ON／RSTを離した後**に3秒以内にBOOT（BOOTSEL）を押すと、その起動だけユーザープログラムを実行せずREPLへ戻ります。次回の普通の再起動ではまた自動実行します。
- BOOTを押したまま電源ON／RSTすると、Python待機ではなくROMのUF2モードになります。BOOTを離して再起動してください。
- 純正Pico / Pico W / Pico 2 / Pico 2 WにはRSTボタンがありません。電源入れ直し、またはRUN–GND間に追加したリセットボタンを使います。GEEK / XIAOではRST／RESETを使えます。
- 接続中に「書き込み待機」を押すと、Ctrl-Cからraw REPLへ移り、soft resetで以前のPWM・PIO・ネットワーク等を片付けてから通常REPLへ戻ります。raw REPLのsoft resetではmain.pyは再実行されません。保存ファイルは消しません。
- 「今すぐ実行」は保存を変更しない一時実行です。無限ループでも完了待ちにはせず、停止ボタンで中断できます。
- 「停止」はPythonの中断です。PWMなどが残る場合があります。「書き込み待機」で周辺機能をリセットしても、バスサーボの保持トルクは残る場合があります。いずれも緊急停止の代替ではありません。
- USBを抜いてもボードとサーボへの適切な給電が続けば動作を継続します。電源も切れたら、次回給電時に最後に保存したmain.pyが起動します。Wi-Fi JOGはPC不要です。
- BOOTを読むAPIがない／読み取りに失敗するファームでは、勝手に実行せず書き込み待機に入ります。対応する新しい機種別MicroPythonへ更新してください。

右側のモード表示はこの接続で確認できた状態です。再接続直後は「モード未確認」となり、自動的に保存プログラムを止めたり起動したりしません。BOOT待機は**この版で保存し直したプログラム**にだけ追加されます。旧main.pyや一時実行には追加されません。

USB / Wi-FiのJOG割り当ては共通です。Wi-FiだけならUART開始ブロックは不要です。両方から操作すると、ボードの処理順に同じ指令位置を更新します（排他ロックや片側優先はなし）。同じ軸への複数の割り当ては拒否します。

参考: [MicroPython起動手順・raw REPLのsoft reset](https://docs.micropython.org/en/latest/reference/reset_boot.html)、[BOOTSEL API](https://docs.micropython.org/en/latest/library/rp2.html#rp2.bootsel_button)、[RP2040/RP2350対応の実装](https://github.com/micropython/micropython/blob/v1.29.0/ports/rp2/modrp2.c)、[Picoリセット操作](https://www.raspberrypi.com/news/how-to-add-a-reset-button-to-your-raspberry-pi-pico/)。起動ゲートと保存処理は模擬環境で検査済みですが、各基板の実ボタン操作・USB再接続・サーボ実機動作は未検証です。

左側の「基本」「UART」は開閉できるツリーです。「SCS009」内にはPIO通信の準備、トルクON/OFF、位置移動ブロックがあります。「プログラム開始」はワークスペースに最初から1個だけ固定され、ツリーから追加したり削除したりできません。GEEKでは「基本 → LCD文字表示」が使えます。

「UART」→「接続」または「Wi-Fi JOG」の開始ブロックを置くと、右上のメニューから「コントローラ」を開けます。USBでもWi-Fiでも、上/下がID1、右/左がID2、W/SがID3、D/AがID4の増減、Spaceが4軸の中央復帰です。スマホでは画面上の同じボタンをタップします。キーを離すと追加指令は止まります（サーボの保持トルクは解除しません）。

SCS009接続ブロックがあれば標準でID1〜4へ対応します。割り当てブロックで各キー組のID・中央値・増減幅・速度を変更できます。接続ブロックがなければ汎用の4軸値だけを更新します。内部の軸名は上下=Y、左右=X、W/S=Z、A/D=Rです。USBの`DELTA 軸 ±1`、`CENTER`とWi-Fiの指令は同じ位置管理を使い、表示にはボードから返された指令位置を使います。従来の`JOG 軸 絶対位置`も受け付けます。表示はサーボから読み取った実測位置ではありません。

Pico W / Pico 2 Wを選ぶと「Wi-Fi JOG」欄が現れます。開始ブロックでWi-Fi名（初期値`PicoBlocks-JOG`）とパスワード（初期値`picoblocks`）を設定し、USBで実行またはmain.pyに保存します。スマホをそのWi-Fiへ接続し、シリアル欄に表示されたHTTPアドレス（通常`http://192.168.4.1/`）をブラウザで開いてください。初回保存後はボードへの給電だけで使えます。このWi-Fiはインターネットに接続しません。操作ページは外部ライブラリ不要でPicoから配信され、GitHub Pagesをスマホで開く必要はありません。

Wi-Fi JOGには各機種用の最新安定版MicroPython（1.29以降）を使用してください。[公式WLAN仕様](https://docs.micropython.org/en/latest/rp2/quickref.html#networking)に合わせてアクセスポイントを生成します。W非搭載ボードへ切り替えても作成中のWi-Fiブロックは保存されますが、書き込み・実行時に機種の不一致を表示します。

書き込みとコントローラは同じWeb Serial接続を共用します。追加のUSB-UARTアダプタやTX/RX配線は不要です。上部の「RPボードを接続」で一度ポートを選び、書き込み時はMicroPython REPL、操作時は生成したプログラムの標準入力へ切り替えます。

画面左端の「配線ガイド」は、選択中の基板とSCS009接続ブロックのDATA GPIOに連動します。「配線」ボタンで細いツールタブまで折りたたみ、もう一度押すと開けます。SCS009接続ブロックがない間は基板の端子配置だけを表示し、サーボ、外部電源、配線、専用の注意書きは表示しません。ブロックを置くと、DATA、サーボ用外部電源のV+、ボードと外部電源の共通GNDを色分けして表示します。

Web SerialはHTTPSまたはlocalhostでのみ利用できます。Safari / Firefoxでは利用できません。

## 対応基板とPIO端子

PIOは特定のGPIOだけに固定されているわけではなく、RP2040 / RP2350ではGPIOへ柔軟に割り当てられます。このエディターでは誤配線を減らすため、SCS009接続ブロックの候補を各基板で外部コネクターに出ている端子へ限定します。

| 選択する基板 | SCS009 DATAで選べるGPIO | 本体LEDブロック |
| --- | --- | --- |
| Raspberry Pi Pico | GP0〜GP22、GP26〜GP28 | 対応（GP25） |
| Raspberry Pi Pico W | GP0〜GP22、GP26〜GP28 | 対応（`LED`） |
| Raspberry Pi Pico 2 | GP0〜GP22、GP26〜GP28 | 対応（GP25） |
| Raspberry Pi Pico 2 W | GP0〜GP22、GP26〜GP28 | 対応（`LED`） |
| M5Stack ATOM Lite（開発中・動作未確認） | G19, 21, 22, 23, 25, 26, 32, 33 | RGBの白色点灯（G27） |
| Waveshare RP2350-GEEK | GP2、GP3、GP4、GP5、GP28、GP29 | 非表示 |
| Waveshare RP2040-GEEK | GP2、GP3、GP4、GP5、GP28、GP29 | 非表示 |

GEEK基板のLCDやmicroSDに内部接続された端子は候補に含めていません。

## MicroPythonの初回書き込み

画面で基板を選ぶと、該当するダウンロード先とボタン操作が表示されます。

- Raspberry Pi Pico / Pico W / Pico 2 / Pico 2 W: USBを外し、`BOOTSEL`を押したままUSB接続します。`RPI-RP2`または`RP2350`ドライブが見えたら、機種に合う公式UF2をコピーします。Pico 2系は通常のArm版を選びます。
- RP2040-GEEK / RP2350-GEEK: 機種に対応するWaveshare公式ファームZIPを展開します。USB接続後に`BOOT`と`RESET`を同時押しし、`RESET`、`BOOT`の順で離して、表示されたドライブへUF2をコピーします。
- UF2コピー後はボードが自動再起動します。データ通信対応USBケーブルで接続し直し、Chrome / Edgeの「RPボードを接続」からMicroPythonのシリアルポートを選びます。

ダウンロード先: [Pico](https://micropython.org/download/RPI_PICO/) / [Pico W](https://micropython.org/download/RPI_PICO_W/) / [Pico 2](https://micropython.org/download/RPI_PICO2/) / [Pico 2 W](https://micropython.org/download/RPI_PICO2_W/) / [RP2040-GEEK用ZIP](https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2040-Board.zip) / [RP2350-GEEK用ZIP](https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2350A-Board.zip)

## 配線図について

シリアルサーボ（SCS009・XL330・STS3215・STS3235）は `GPIO → 220 Ω直列抵抗 → DATA` で表示します。GPIO側に通信バスごと1本、その先の各IDへはデイジーチェーン接続です。PWMサーボには追加しません。ATOMの条件付き2.2 kΩプルアップは別部品で、220 ΩよりDATA側に接続します。どちらも電圧変換や5 V入力保護ではありません。

配線ガイドはFritzing部品、製品写真、メーカーのピンアウト画像を複製していません。公式資料に記載された端子番号・信号名を参照し、四角形・円・線だけで独自に描画する簡略図です。正確な向きやコネクター形状の代用ではないため、実配線前に画面下の「公式ピン情報」も確認してください。

- Pico系は左右40端子すべての物理ピン番号と信号名を表示します。
- 各端子へカーソルを合わせると、物理ピン番号またはコネクター内の端子番号を表示します。
- GEEK系はH1（GP2 / GND / GP3）、H2（GP4 / GND / GP5）、H3（3V3 / GP28 / GP29 / GND）をコネクター単位で表示します。

- [Raspberry Pi Picoシリーズ公式ピン配置](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html)
- [RP2040-GEEK公式資料](https://www.waveshare.com/wiki/RP2040-GEEK)
- [RP2350-GEEK公式資料](https://www.waveshare.com/wiki/RP2350-GEEK)

## SCS009 / SCS0009

生成コードはMicroPythonの`rp2.StateMachine`を使い、1本のDATAピンを送信中だけ出力、それ以外はHi-Z入力に切り替えます。Feetech SCS1.1の書き込みパケットを生成し、トルク有効化（アドレス`0x28`）と、目標位置・時間・速度の連続書き込み（先頭アドレス`0x2A`）に対応します。

- 接続ブロック: DATA GPIOと通信レートのみ指定
- 初期値: GP2、1 Mbps
- 位置: 0〜1023（SCS009では約0〜300°）
- 時間値: 0〜65535の生値
- 速度値: 0〜1023の生値

サーボ電源をRPボードの3.3Vから取らないでください。定格に合う外部電源と共通GNDを使います。PIOが同じピンの送受信方向を切り替えますが、電圧変換は行いません。DATAを直結できるかは上の信号レベル節で確認してください。PIO State Machine番号は内部で管理します。SCS009は送信専用で、応答読み取り・ID変更・EEPROM書き換えには未対応です。

## ローカル表示

任意の静的HTTPサーバーでこのフォルダーを配信してください。例:

```sh
python -m http.server 4173
```

## GitHub Pages

リポジトリのPages設定で `Deploy from a branch` を選び、`main` ブランチの `/ (root)` を公開元に指定します。

## 現在の範囲

これはUIと通信の枠組みを確認するための試作版です。SCS009への送信パケット生成は実装済みですが、実機での波形・動作確認は別途必要です。
