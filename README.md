# PicoBlocks Studio

RP2040 / RP2350 + MicroPython向けの、ブラウザーだけで使えるブロックプログラミング環境のプロトタイプです。

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

「接続」で番号（1〜16）と信号GPIOを指定します。「角度」は0〜180°、「パルス幅」はµsです。PWM周期は50 Hz固定、初期設定は0°=1000 µs、180°=2000 µsです。サーボの仕様・機械的な可動域に合わせて調整してください。500〜2500 µsの範囲内で上下限を設定でき、範囲外の指令は拒否します。接続時は出力0、停止ブロックでパルスを停止し、次の角度指定で再開します。

電源はサーボ用外部電源を使い、GNDを共通にします。複数台は番号とGPIOを分けます。同じPWMチャンネルを共有するGPIO（この対応ボードでは16番違い）の同時利用を検出します。JOGの値は度単位です。「停止」は信号停止で、保持力の解除を保証するものではありません。上部のプログラム停止だけでは保持トルクやPWM出力が残ることがあるため、必要な停止・トルクOFFブロックを明示的に実行してください。

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

1. 画面右側で使用するボードを選びます。
2. 「初期ファームを書き込む」を開き、機種別の手順でMicroPythonを書き込みます。
3. PC版のChromeまたはEdgeで公開ページを開きます。
4. USBでボードを接続し、「RPボードを接続」を押します。
5. ブロックを組み、「今すぐ実行」または「main.pyに保存」を押します。

左側の「基本」「UART」「SCS009」は開閉できるツリーです。「SCS009」内にはPIO通信の準備、トルクON/OFF、位置移動ブロックがあります。「プログラム開始」はワークスペースに最初から1個だけ固定され、ツリーから追加したり削除したりできません。LCDは機種ごとに処理が異なるため、表示カテゴリは設けていません。

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
