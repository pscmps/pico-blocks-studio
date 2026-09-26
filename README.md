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

## 使い方

1. 画面右側で使用するボードを選びます。
2. 「初期ファームを書き込む」を開き、機種別の手順でMicroPythonを書き込みます。
3. PC版のChromeまたはEdgeで公開ページを開きます。
4. USBでボードを接続し、「RPボードを接続」を押します。
5. ブロックを組み、「今すぐ実行」または「main.pyに保存」を押します。

左側の「基本」「SCS009」は開閉できるツリーです。「SCS009」内にはPIO通信の準備、トルクON/OFF、位置移動ブロックがあります。「プログラム開始」はワークスペースに最初から1個だけ固定され、ツリーから追加したり削除したりできません。LCDは機種ごとに処理が異なるため、表示カテゴリは設けていません。

画面左端の「配線ガイド」は、選択中の基板とSCS009接続ブロックのDATA GPIOに連動します。「配線」ボタンで細いツールタブまで折りたたみ、もう一度押すと開けます。図中ではDATA、サーボ用外部電源のV+、ボードと外部電源の共通GNDを色分けしています。

Web SerialはHTTPSまたはlocalhostでのみ利用できます。Safari / Firefoxでは利用できません。

## 対応基板とPIO端子

PIOは特定のGPIOだけに固定されているわけではなく、RP2040 / RP2350ではGPIOへ柔軟に割り当てられます。このエディターでは誤配線を減らすため、SCS009接続ブロックの候補を各基板で外部コネクターに出ている端子へ限定します。

| 選択する基板 | SCS009 DATAで選べるGPIO | 本体LEDブロック |
| --- | --- | --- |
| Raspberry Pi Pico | GP0〜GP22、GP26〜GP28 | 対応（GP25） |
| Raspberry Pi Pico 2 W | GP0〜GP22、GP26〜GP28 | 対応（`LED`） |
| Waveshare RP2350-GEEK | GP2、GP3、GP4、GP5、GP28、GP29 | 非表示 |
| Waveshare RP2040-GEEK | GP2、GP3、GP4、GP5、GP28、GP29 | 非表示 |

GEEK基板のLCDやmicroSDに内部接続された端子は候補に含めていません。

## MicroPythonの初回書き込み

画面で基板を選ぶと、該当するダウンロード先とボタン操作が表示されます。

- Raspberry Pi Pico / Pico 2 W: USBを外し、`BOOTSEL`を押したままUSB接続します。`RPI-RP2`または`RP2350`ドライブが見えたら、機種に合う公式UF2をコピーします。
- RP2040-GEEK / RP2350-GEEK: 機種に対応するWaveshare公式ファームZIPを展開します。USB接続後に`BOOT`と`RESET`を同時押しし、`RESET`、`BOOT`の順で離して、表示されたドライブへUF2をコピーします。
- UF2コピー後はボードが自動再起動します。データ通信対応USBケーブルで接続し直し、Chrome / Edgeの「RPボードを接続」からMicroPythonのシリアルポートを選びます。

ダウンロード先: [Raspberry Pi Pico](https://micropython.org/download/RPI_PICO/) / [Raspberry Pi Pico 2 W](https://micropython.org/download/RPI_PICO2_W/) / [RP2040-GEEK用ZIP](https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2040-Board.zip) / [RP2350-GEEK用ZIP](https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2350A-Board.zip)

## 配線図について

配線ガイドはFritzing部品、製品写真、メーカーのピンアウト画像を複製していません。公式資料に記載された端子番号・信号名を参照し、四角形・円・線だけで独自に描画する簡略図です。正確な向きやコネクター形状の代用ではないため、実配線前に画面下の「公式ピン情報」も確認してください。

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
