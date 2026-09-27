# PicoBlocks Studio — 対話AI向けブロックJSONガイド v1

## 高度なブロック

### Python本文から関数ブロックを作る

`adv_python_function`の`fields.NAME`に名前、`fields.CODE`にPython関数の本文を指定できます。`def`行は不要で、引数は`arg`、戻り値は`return`。本文は16384文字まで、JSON文字列内の改行は`\n`です。通常の`adv_function`と名前を重複させず、`program_start`直下のnext列へ置きます。同名の`adv_call`（結果）または`adv_call_do`（実行）から引数を渡します。定義だけでは実行されません。

定義例：`{"type":"adv_python_function","fields":{"NAME":"double","CODE":"result = arg * 2\nreturn result"}}`

呼び出し例：`{"type":"adv_call","fields":{"NAME":"double"},"inputs":{"ARG":{"block":{"type":"basic_number","fields":{"NUM":3}}}}}`

複数の引数は配列・辞書にまとめます。ローカル変数はブロックの変数名と別で、importは本文へ。文法・GPIO競合・無限ループは自動検査されず、通常Pythonと同じ権限でボード上で実行されます。自動実行されることはありませんが、取り込んだ本文は必ず確認してください。長い処理はJOG・タイマーを妨げます。関数名は生成時に内部名へ変換されるため、本文から別のブロック関数を表示名で直接呼ぶことはできません。

新規では `basic_write` / `basic_wait` を使用。`gpio_write` / `wait_ms` は旧データ読込み用でツリーには出しません。本体LEDは入出力へ移しました。

`adv_function` / `adv_irq` / `adv_timer` / `adv_i2c_setup` / `adv_spi_setup` は `program_start.next` の直列へ置き、関数・条件・ループの中に入れないでください。関数名、同じ種類のタイマー番号・バス番号は重複不可。関数定義は先頭へまとめますが、接続・タイマー開始は配置順に実行します。関数内で使う場合も先にバスを接続してください。名前付き変数は全体で共有・初期値0。「引数の値」は呼出しごとの値です。

配列は0始まり。配列・辞書は変数へ代入後に操作します。型や範囲の違いはPython例外になります。I2Cは8ビットレジスタ、SPIは8ビット・MSB先頭・Low有効CS、最大4096バイト転送。数値フィールドは10進数、GPIOは文字列。タイマーPERIODとDEBOUNCEはmsです。表は共通入力名をまとめたもので、各ブロックに存在する項目は依頼文のカタログを優先してください。

イベント待受ループは自動生成されるので、そのための無限ループは追加不要。ハンドラーは遅延・協調実行で同時実行やリアルタイムを保証せず、長い待ちや無限ループは避けます。制限・実機状況はREADMEを参照。

| type | fields | inputs |
|---|---|---|
| adv_list_empty / adv_list_new | — | A, B, C (new) |
| adv_list_get / adv_list_set / adv_list_append / adv_list_pop | — | LIST, INDEX, VALUE |
| adv_length / adv_contains / adv_slice | — | VALUE, ITEM, START, END |
| adv_for_each | NAME | LIST, DO |
| adv_array / adv_bytes | TYPE: B/h/i/f (array) | LIST |
| adv_dict_empty / adv_dict_keys | — | DICT (keys) |
| adv_dict_set / adv_dict_get | — | DICT, KEY, VALUE / DEFAULT |
| adv_function | NAME | DO, RETURN |
| adv_arg | — | — |
| adv_call / adv_call_do | NAME | ARG |
| adv_flow | ACTION: BREAK/CONTINUE | — |
| adv_try | — | DO, EXCEPT, FINALLY |
| adv_convert | TYPE: int/float/str/bool | VALUE |
| adv_split / adv_replace | — | TEXT, SEP / OLD, NEW |
| adv_json_encode / adv_json_decode | — | VALUE / TEXT |
| adv_bitwise | OP: AND/OR/XOR/SHL/SHR | A, B |
| adv_math | OP: sin/cos/tan/log/exp/radians/degrees | VALUE |
| adv_irq | PIN, EDGE: FALLING/RISING/BOTH, PULL: UP/DOWN/NONE, DEBOUNCE: 0–5000 | DO |
| adv_irq_stop | PIN | — |
| adv_timer | TIMER: 1–8, PERIOD: 1–86400000, MODE: REPEAT/ONCE | DO |
| adv_timer_stop | TIMER | — |
| adv_pwm / adv_pwm_stop | PIN, FREQ: 1–100000 (pwm) | DUTY: 0–65535 (pwm) |
| adv_i2c_setup | BUS: 1–2, SCL, SDA, FREQ: 1000–400000 | — |
| adv_i2c_scan | BUS | — |
| adv_i2c_read / adv_i2c_write | BUS, ADDRESS: 8–119, REGISTER: 0–255, SIZE: 1–256 (read) | DATA (write) |
| adv_spi_setup | BUS: 1–2, SCK, MOSI, MISO, CS, FREQ: 1000–1000000, POLARITY/PHASE: 0/1 | — |
| adv_spi_transfer | BUS | DATA |
| adv_ticks_us / adv_elapsed_us | — | START, END (elapsed) |
| adv_mem_free / adv_gc | — | — |

### 例：ボタン回数を数え、1秒ごとに表示

GP0とGNDの間にボタンを接続し、GP0へ外部電圧を入れません。プルアップ・30 msの連続反応抑制を選択。IRQは集約されるため厳密なパルス計数用途ではありません。タイマーはソフトウェア方式です。

```json
{
  "format": "picoblocks",
  "version": 1,
  "board": "pico",
  "workspace": {
    "blocks": {
      "languageVersion": 0,
      "blocks": [
        {
          "type": "program_start",
          "next": {
            "block": {
              "type": "adv_irq",
              "fields": {
                "PIN": "0",
                "EDGE": "FALLING",
                "PULL": "UP",
                "DEBOUNCE": 30
              },
              "inputs": {
                "DO": {
                  "block": {
                    "type": "basic_change",
                    "fields": {
                      "NAME": "count"
                    },
                    "inputs": {
                      "VALUE": {
                        "block": {
                          "type": "basic_number",
                          "fields": {
                            "NUM": 1
                          },
                          "inputs": {}
                        }
                      }
                    }
                  }
                }
              },
              "next": {
                "block": {
                  "type": "adv_timer",
                  "fields": {
                    "TIMER": 1,
                    "PERIOD": 1000,
                    "MODE": "REPEAT"
                  },
                  "inputs": {
                    "DO": {
                      "block": {
                        "type": "basic_print",
                        "fields": {},
                        "inputs": {
                          "VALUE": {
                            "block": {
                              "type": "basic_get",
                              "fields": {
                                "NAME": "count"
                              },
                              "inputs": {}
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      ]
    }
  }
}
```


JOGの割り当てブロックでは`SPEED`は非表示の互換フィールドです。新規JSONでは省略して既定値を使用し、ユーザーに生の速度値を尋ねないでください。過去の値は保持できます。信号レベルとプルアップの条件は[README](README.md)を参照し、「抵抗で5 Vを3.3 Vに変換できる」と説明しないでください。STS3235・XL330の直結動作実績はユーザー申告で、全条件の保証ではありません。

日本語 · [English](AI_GUIDE.en.md) · [README](README.md)

メニューでEnglishを選ぶと、依頼文・ブロックカタログ・ガイドリンクも英語になります。JSONのtype、フィールド名、選択値、ボードIDは言語によらず同じです。これらの識別子は翻訳しないでください。

アプリ: https://pscmps.github.io/pico-blocks-studio/

この文書のURL: https://raw.githubusercontent.com/pscmps/pico-blocks-studio/main/AI_GUIDE.md

## 使い方

1. アプリで使用ボードを選択する。
2. 右上のメニュー →「対話AIとプログラムを作る」→「依頼文をコピー」。
3. ChatGPT等へ貼り付け、「作りたい動き」に目的・配線・サーボの型番とID・安全な動作範囲を記入する。
4. AIの返答のJSON部分をアプリへ貼り付け、「ブロックへ取り込む（置換）」を押す。
5. ブロック・選択ボード・配線・生成Pythonを確認してから手動で実行する。

取り込みは現在のブロックを置き換える。直前の状態とボード選択はブラウザ内に1件保存し、「取り込み前に戻す」で戻せる。AIへの自動送信はしない。テンプレートには現在のプログラムや実際のWi-Fiパスワードを含めない。

これは**ブロックJSONの受け渡し**。Python本文は`adv_python_function.fields.CODE`内に限って指定できる。Pythonファイル全体を通常ブロックへ変換する機能ではない。AIが正しく作れる保証はないため、コード・範囲・配線を人が確認する。

## 出力契約

### ATOM Lite（開発中・動作未確認）

`board: "atom_lite"`を指定できる。ESP32-PICO-D4のATOM Liteのみ（AtomS3不可）。GPIOは19, 21, 22, 23, 25, 26, 32, 33、ADCは32, 33のみ。USB / Wi-Fi JOGの形式はPico Wと同じ。SCS009・XL330・STS3215・STS3235・PWM・基本ブロックを使用でき、LCDは不可。シリアルサーボは単線UARTを自動使用し合計2種類まで。GPIO27は白色RGB点灯、GPIO39は書き込み待機用ボタン。信号は3.3 V互換、サーボは外部給電・共通GND。5 V直結禁止で外付け3.3 Vプルアップが必要な場合がある。実機未確認を必ず伝える。詳しくはREADMEのATOM Lite節に従う。以下のRP専用ADC / PIO説明は適用しない。

返答はJSONコードブロック1つにする。最小形:

```json
{
  "format": "picoblocks",
  "version": 1,
  "board": "pico",
  "workspace": {
    "blocks": {
      "languageVersion": 0,
      "blocks": [{"type": "program_start"}]
    }
  }
}
```

- トップレベルのブロックは `program_start` 1個のみ。ほかはすべてその下につなぐ。
- 直列処理は `next: {"block": {...}}`。
- 値・条件・ループの中身は `inputs: {"入力名": {"block": {...}}}`。
- 数値フィールドはJSON数値。選択式・文字フィールドはJSON文字列。GPIOの選択値はD番号でなくGPIO番号の文字列。
- 省略したフィールドはカタログの `default` になる。意図した数値・GPIOは省略しない。
- ID、座標、extraState、mutation、enabled、変数の内部ID等は不要。変数は `NAME` 文字列で扱う。
- 最大300,000文字、500ブロック、接続の深さ80段。未知の型、範囲外の数値、不正な接続は取り込まない。
- ボード選択もJSONの `board` に切り替わる。実行・書き込みは自動で始まらない。

## ボードとピン

| board | GPIO候補 | ADC候補 | Wi-Fi JOG |
| --- | --- | --- | --- |
| pico / picow / pico2 / pico2w | 0〜22, 26, 27, 28 | 26, 27, 28 | picow / pico2wのみ |
| rp2040_geek / rp2350_geek | 2, 3, 4, 5, 28, 29 | 28, 29 | なし |
| xiao_rp2040 | 26, 27, 28, 29, 6, 7, 0, 1, 2, 4, 3 | 26, 27, 28, 29 | なし |
| xiao_rp2350 | 26, 27, 28, 5, 6, 7, 0, 1, 2, 4, 3 | 26, 27, 28 | なし |
| atom_lite（開発中・動作未確認） | 19, 21, 22, 23, 25, 26, 32, 33 | 32, 33 | 試験対応 |

XIAOのGPIO候補の順番はD0〜D10に対応。背面パッドは今回対象外。

ADCは `read_u16()` の0〜65535、入力0〜3.3 V。5 Vを入れない。`VOLT` は基準3.3 Vを仮定した概算。GPIOはADC・入力・出力・サーボで重複利用しない。同じ入力ピンのプル設定は揃える。

## 基本ブロック

カタログの正確な型・フィールド範囲・選択肢は**アプリでコピーしたテンプレート**に含まれる。以下は入力名の早見表。値ブロックは `next` に接続しない。

| type | fields | inputs | 結果/動作 |
| --- | --- | --- | --- |
| basic_number | NUM: 数値 | — | 数値 |
| basic_math | OP: ADD/SUB/MUL/DIV/MOD | A, B: 数値 | 四則演算・余り |
| basic_unary | OP: ABS/ROUND/FLOOR/SQRT | VALUE: 数値 | 絶対値/丸め/床/平方根 |
| basic_limit | — | VALUE, MIN, MAX | 上下限へ制限 |
| basic_map | — | VALUE, IN_MIN, IN_MAX, OUT_MIN, OUT_MAX | 範囲変換、範囲外は制限 |
| basic_random | — | MIN, MAX | 整数乱数、MIN ≤ MAX |
| basic_compare | OP: EQ/NE/LT/LE/GT/GE | A, B: 数値 | 真偽値 |
| basic_boolean | VALUE: TRUE/FALSE | — | 真偽値 |
| basic_logic | OP: AND/OR | A, B: 真偽値 | 論理演算 |
| basic_not | — | VALUE: 真偽値 | 否定 |
| basic_get | NAME: 文字列 | — | 変数の値 |
| basic_set | NAME: 文字列 | VALUE: 任意 | 変数へ代入 |
| basic_change | NAME: 文字列 | VALUE: 数値 | 変数を加算 |
| basic_if | — | IF: 真偽値, DO/ELSE: 処理 | 条件分岐 |
| basic_repeat | — | TIMES: 数値, DO: 処理 | 回数くり返し |
| basic_while | — | IF: 真偽値, DO: 処理 | 条件くり返し |
| forever_loop | — | DO: 処理 | 無限ループ、next不可 |
| basic_wait | — | MS: 数値 | ミリ秒待機 |
| basic_ticks | — | — | ミリ秒カウンタ |
| basic_elapsed | — | START, END | 折り返し対応の時間差 |
| basic_adc | PIN: GPIO文字列, MODE: RAW/VOLT | — | アナログ入力 |
| basic_read | PIN: GPIO文字列, PULL: UP/DOWN/NONE | — | デジタル入力0/1 |
| basic_write | PIN: GPIO文字列 | VALUE: 数値/真偽値 | ゼロならLOW、それ以外HIGH |
| basic_text | TEXT: 文字列 | — | 文字列 |
| basic_join | — | A, B: 任意 | 文字列として結合 |
| basic_print | — | VALUE: 任意 | USBシリアルへ表示（LCDではない） |

変数はプログラム先頭で0に初期化される。同じ `NAME` は同じ変数。除算の0、負数の平方根、範囲変換の同じ入力上下限、文字列の数値演算等は実行時エラーになる。`ROUND` はPythonの `round()`（ちょうど半分は偶数側）。長いループには待機を入れる。時刻は折り返すため単純な引き算ではなく `basic_elapsed` を使う。

今回の基本セットにI2C/SPIの汎用通信、割り込み、任意のPython関数は含めない。GEEK専用LCDブロックは下記を参照。

## サーボとJOG

- ツリー順はPWMサーボ → SCS009 → XL330 → STS3215 → STS3235。SCS009も小分類なしの一覧です。
- `pwm_setup` の `CHANNEL` は1〜16、`PIN` はGPIO文字列、`MIN_US/MAX_US` は0度/180度のパルス幅。通常初期値1000/2000 µs、サーボ仕様に合わせる。
- `scs009_setup` / `xl330_setup` / `sts3215_setup` は `PIN` と `BAUD` の文字列を指定する。接続は各種類1個、PIO通信は合計最大2種類。PWMは別枠。
- 接続・GPIO・ADC・変数の初期化はプログラム先頭にまとめる。接続ブロックを条件やループ内に入れても条件付き初期化にはならない。接続は開始直下に置く。
- `pwm_value` は `CHANNEL` と数値入力 `VALUE`（0〜180度）。
- `scs009_value` は `ID` と数値入力 `VALUE`（0〜1023、約300度）。時間値0・速度値500。
- `xl330_value` / `sts3215_value` は `ID` と数値入力 `VALUE`（0〜4095）。速度値は20/500、加速度値20。
- 固定値の細かな速度指定には従来の `*_move` を使う。可動範囲は機構に合わせてさらに狭める。
- バスサーボには `*_torque` の `ID` と `STATE: "1"` を明示してから動かす。接続だけではトルクONにしない。XL330/STS3215/STS3235は標準の単回転位置モード専用。STS3235は `sts3235_setup/ping/read/torque/move/value/bind` を使い、フィールドはSTS3215と同じです。
- `SPEED` はサーボへ送る速度の生値で、msではありません。JOGの `STEP` はキー1回あたりの位置差です。
- GEEK2機種だけ `lcd_print`（VALUEを改行表示）、`lcd_line`（ROW:1〜8とVALUEで指定行を上書き）、`lcd_clear`、`lcd_usb_mirror`（ENABLED:"1"/"0"、basic_printだけを複写）が使えます。VALUEにはbasic_text・数値・変数を接続できます。15文字×8行、白文字、英数字と半角記号のみ。日本語は?へ置換されます。改行表示は折り返し・スクロール、指定行は15文字で切り詰めです。追加の接続・初期化ブロックは不要です。USB受信やJOG通信をLCDへ自動転送しません。
- PWMは番号・GPIOを分けて接続を追加すると、配線図のコネクタが番号別に色分けされます。シリアルサーボは同種の接続ブロック1個と異なるIDの操作・割り当てを使い、配線図にはIDごとのデイジーチェーンが描かれます。混在時は全種類を同じ図へ描き、シリアル系にはPWMと重複しない種類別の固定色を使います。V+は種類ごとに分離しGNDを共通にします。実機のIDは事前に別々に設定し、図の色と実物の線色を混同しないでください。
- `uart_controller_setup` は書き込み用USBと同じ口でJOGを受信。W付きPicoのみ `wifi_jog_setup` の `SSID/PASSWORD` でアクセスポイントを作れる。
- JOGの `AXIS` はY（↑↓）、X（←→）、Z（WS）、R（AD）。割り当ては `uart_scs_bind` / `xl330_bind` / `sts3215_bind` / `pwm_bind`。`ID`（PWMは番号）、`CENTER`、`STEP`、バスサーボは `SPEED` を指定する。
- 各サーボへ適合する外部電源を使いGNDを共通化する。5 V/高電圧の電源をGPIOへ入れない。PCのUSBからサーボを給電しない。
- JOG割り当てはUSB / Wi-Fiで共用する。Wi-Fi開始だけでもPWM等の割り当てを使用できる。同じAXISへの割り当ては1個だけ。
- 「保存して実行」で起動前の3秒BOOT受付もmain.pyへ保存される。通常は単独で自動実行、起動後3秒以内のBOOTでその回だけ書き込み待機。初期化やサーボ動作はこの受付時間が終わってから始まる。BOOTを保持したままリセットするUF2モードとは別。
- アプリの停止でPythonを中断しても、PWM出力やバスサーボのトルクが残る場合がある。必要な出力停止・トルクOFFと物理的に電源を切る手段を用意する。

## 例: ADCの値をUSBシリアルへ表示

GP26に0〜3.3 Vのアナログ信号を入力し、100 msごとに読み取る。ボード・配線は実機に合わせる。

```json
{
  "format": "picoblocks", "version": 1, "board": "pico",
  "workspace": {"blocks": {"languageVersion": 0, "blocks": [
    {"type": "program_start", "next": {"block": {
      "type": "forever_loop", "inputs": {"DO": {"block": {
        "type": "basic_print", "inputs": {"VALUE": {"block": {
          "type": "basic_adc", "fields": {"PIN": "26", "MODE": "RAW"}
        }}}, "next": {"block": {
          "type": "basic_wait", "inputs": {"MS": {"block": {
            "type": "basic_number", "fields": {"NUM": 100}
          }}}
        }}
      }}}
    }}}
  ]}}
}
```

ADCからPWM角度へ変換したい場合は `basic_map` の入力を0〜65535、出力を例えば45〜135とし、それを `pwm_value.inputs.VALUE.block` へ接続する。サーボの接続ブロックと別のGPIO・外部電源が必要。

参考: [MicroPython RP2 quick reference](https://docs.micropython.org/en/latest/rp2/quickref.html)、[Blockly serialization](https://developers.google.com/blockly/guides/configure/web/serialization)。
