# PicoBlocks Studio

RP2040 / RP2350 + MicroPython向けの、ブラウザーだけで使えるブロックプログラミング環境のプロトタイプです。

## できること

- Blocklyでプログラムを組み立てる
- 生成されたMicroPythonコードを確認・コピーする
- Web SerialでMicroPython REPLへ接続する
- プログラムを一時実行する
- `main.py`として保存し、ボード起動時に自動実行する
- ブロックをブラウザー内へ自動保存する

## 使い方

1. RP2040 / RP2350ボードへ公式MicroPythonファームウェアを書き込みます。
2. PC版のChromeまたはEdgeで公開ページを開きます。
3. USBでボードを接続し、「RPボードを接続」を押します。
4. ブロックを組み、「今すぐ実行」または「main.pyに保存」を押します。

Web SerialはHTTPSまたはlocalhostでのみ利用できます。Safari / Firefoxでは利用できません。

## ローカル表示

任意の静的HTTPサーバーでこのフォルダーを配信してください。例:

```sh
python -m http.server 4173
```

## GitHub Pages

リポジトリのPages設定で `Deploy from a branch` を選び、`main` ブランチの `/ (root)` を公開元に指定します。

## 現在の範囲

これはUIと通信の枠組みを確認するための最小版です。ブロックはLED、GPIO、待機、表示、繰り返しのみです。実機差を吸収するボード定義や、モーター・サーボ向けAPIは次の段階で追加できます。
