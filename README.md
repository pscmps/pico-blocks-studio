# PicoBlocks Studio

日本語 · [English](README.en.md) · [エディターを開く](https://pscmps.github.io/pico-blocks-studio/)

RP2040 / RP2350 + MicroPython向けの、ブラウザーだけで使えるブロックプログラミング環境のプロトタイプです。

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
- ブロック本体のダブルクリックで複製する（開始ブロックは対象外、数値・選択欄は編集を優先）
- UARTの各軸を、別ブロックでSCS009のIDへ割り当てる
- Seeed Studio XIAO RP2040 / RP2350を選び、D番号とGPIO番号を併記した配線図・初期ファーム案内を使う
- XL330 / STS3215のPIO半二重通信（Ping・位置読取り・トルク・単回転位置移動）
- 通常のPWMサーボの接続、角度指定、パルス幅指定、出力停止
- USB / Wi-Fi JOGの各キー組をXL330・STS3215・PWMサーボにも個別に割り当てる
- ADC・GPIO入出力・四則演算・範囲変換・変数・条件分岐・時間・文字列の基本ブロック
- 計算した値をPWM / SCS009 / XL330 / STS3215へ渡す位置指令ブロック
- メニューから対話AIへの依頼テンプレートをコピーし、返答のJSONを編集可能なブロックへ取り込む

## 対話AIとブロックを作る

右上のメニュー →「対話AIとプログラムを作る」から依頼文をコピーします。使用ボード・ピン・ブロック仕様・仕様URLが含まれます。「作りたい動き」を書き足してChatGPTなどに渡し、返答のJSONを同じ画面へ貼り付けて取り込みます。URLにアクセスできないツールでも使えるよう、仕様自体も依頼文へ含めています。

取り込みは現在のブロックを置き換え、直前の状態を1件保存します。「取り込み前に戻す」で復元可能です。形式や配線の競合を検査し、自動実行はしません。任意のPythonを貼り付けてブロック化する機能ではありません。AIへ自動送信せず、現在のプログラムやWi-Fiパスワードもテンプレートに含めません。

詳細とサンプルは [AI_GUIDE.md](AI_GUIDE.md)。基本ブロックは左の「基本」ツリーにまとめています。ADCは各基板で利用できるGP26〜29だけを表示します。入力は0〜3.3 V、5 V不可。USBシリアル表示に加え、GEEKだけ「LCD文字表示」が使えます。サーボカテゴリはPWM → SCS009 → XL330 → STS3215 → STS3235です。

### 開発時のテスト

サイト自体は引き続きビルド不要の静的ファイルです。Node側のBlocklyは開発テスト専用です。

```sh
npm ci --ignore-scripts
npm test
python tests/basics_runtime.py
python tests/servo_runtime.py
python tests/jog_runtime.py
python tests/boot_runtime.py
python tests/display_runtime.py
python tests/i18n_runtime.py
```

基本ブロック・8ボードの候補・入力検査・取り込み失敗時の保護・バックアップ復元・Python構文と模擬実行を検査します。実機のADC精度やサーボ動作はこの検査には含みません。

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

サーボ電源をRPボードの3.3Vから取らないでください。GNDを共通にした外部電源を使用し、DATA線は選択したGPIOへ直接接続します。PIOが同じピンを送信中だけ出力、終了後はHi-Z入力へ戻すため、外付けの半二重変換回路は不要です。PIO State Machine番号は内部で管理し、ブロックには表示しません。現段階は送信専用で、応答読み取り・ID変更・EEPROM書き換えには未対応です。

## ローカル表示

任意の静的HTTPサーバーでこのフォルダーを配信してください。例:

```sh
python -m http.server 4173
```

## GitHub Pages

リポジトリのPages設定で `Deploy from a branch` を選び、`main` ブランチの `/ (root)` を公開元に指定します。

## 現在の範囲

これはUIと通信の枠組みを確認するための試作版です。SCS009への送信パケット生成は実装済みですが、実機での波形・動作確認は別途必要です。
