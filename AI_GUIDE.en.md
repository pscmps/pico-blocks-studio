# PicoBlocks Studio — Block JSON guide for chat AI, v1

## Advanced blocks

### Gcode / PlotterFlow

Gcode is the last Advanced category: an RP2040 / RP2350 prototype, not ATOM. Connect one each of `gcode_planner` (X/Y steps/mm), `gcode_stepper` (X_STEP/Y_STEP/X_DIR/Y_DIR/ENABLE/ACTIVE_LOW), `gcode_pen` (PIN/FREQ/UP/DOWN), and `gcode_controller` directly in the start chain. Y_STEP must equal X_STEP + 1; all six GPIOs must differ. Do not mix with JOG, serial servos, interrupts or timers.

`gcode_read` waits for a USB newline and returns text. Store it in a variable; if nonempty, pass it to the LINE input of the standalone statement block `gcode_execute`. It executes Gcode once and sends ok or error over USB; no `basic_print` is needed. `gcode_reply` is only for importing legacy programs; do not use it in new programs. `gcode_ready` uses BOARD for the startup-message name; `gcode_parse` returns command/words; `gcode_state` KEY is x/y/z/feed/absolute/mm/enabled/pen_down. Use execute/reply/state after controller setup.

External STEP/DIR drivers (e.g. TMC) and external supplies are required: never connect motors directly. TMC UART, current and microstep configuration are separate. No F speed control, acceleration, homing, limits or immediate stopping; hardware untested. See [GCODE.en.md](GCODE.en.md) for source differences. Use these blocks rather than hiding the whole firmware in one Python-body block.

### Functions with a Python body

`adv_python_function` accepts a name in `fields.NAME` and a Python function body in `fields.CODE`. Omit `def`; read the argument as `arg` and return a result with `return`. Maximum 16384 characters; encode JSON string newlines as `\n`. Names must be unique across these and ordinary `adv_function` blocks. Connect directly in the `program_start.next` chain. Use a same-name `adv_call` (value) or `adv_call_do` (statement) to pass an argument. Definitions do not execute on their own.

Definition: `{"type":"adv_python_function","fields":{"NAME":"double","CODE":"result = arg * 2\nreturn result"}}`

Call: `{"type":"adv_call","fields":{"NAME":"double"},"inputs":{"ARG":{"block":{"type":"basic_number","fields":{"NUM":3}}}}}`

Pass a list/dictionary for multiple arguments. Local names are separate from block variables; place imports in the body. Syntax, GPIO conflicts and infinite loops are not automatically checked. Code executes with normal Python privileges on the board, never automatically on import; review every imported body. Long operations can block JOG/timers. Names are encoded internally, so another block function cannot be called directly by its display name from a Python body.

Use `basic_write` and `basic_wait` in new programs. `gpio_write` / `wait_ms` are legacy import types, no longer shown in the toolbox. LED lives under Input / output.

Place `adv_function`, `adv_irq`, `adv_timer`, `adv_i2c_setup` and `adv_spi_setup` directly in the `program_start.next` chain, not inside functions/conditions/loops. Function names and timer/bus IDs within a type must be unique. Functions are hoisted; hardware/timer setup executes in sequence. Set up buses before use, including calls to functions using them. All named variables are global and initialize to 0; argument values are local to each call.

List indexes start at zero. Assign lists/dictionaries to variables before use. Invalid types/ranges raise Python exceptions. I2C uses 8-bit register addresses. SPI uses 8-bit MSB-first transfers, active-low CS, maximum 4096 bytes. Numeric fields are decimal; GPIOs are strings. PERIOD and DEBOUNCE are milliseconds. The table groups related inputs; the prompt catalog is authoritative for each block's exact fields.

IRQ/timer event loops are automatic: no infinite loop is needed just to keep events alive. Handlers are deferred/cooperative, not concurrent or real-time. Avoid long waits/infinite loops inside handlers. See README for limits and hardware status.

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

### Example: count button presses, print once per second

Connect a button between GP0 and GND; do not apply external voltage. The pull-up and 30 ms debounce are selected. IRQs are coalesced, not a precision pulse counter. The timer runs in software.

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


JOG bindings retain `SPEED` as a hidden compatibility field. Omit it in new JSON to use defaults; do not ask users for a raw speed value. Existing values can be preserved. Follow the signal-level and pull-up conditions in the [README](README.en.md); never describe a pull-up as a 5 V-to-3.3 V level shifter. Direct-wiring success with STS3235/XL330 is user-reported, not a guarantee for every condition.

## ATOM Lite (in development / hardware untested)

Use `board: "atom_lite"` for ESP32-PICO-D4 ATOM Lite, not AtomS3. GPIOs: 19, 21, 22, 23, 25, 26, 32, 33; ADC: 32/33 only. USB/Wi-Fi JOG uses the same block format as Pico W. SCS009, XL330, STS3215, STS3235, PWM and basic blocks are available; LCD is not. Single-wire UART is selected automatically for serial servos (two types maximum). GPIO27 is the white RGB LED and GPIO39 the write-mode button. DATA must be 3.3 V-compatible, with external servo power and common GND; never wire 5 V signals directly. An external 3.3 V pull-up may be needed. Explicitly state hardware is untested. See the README's ATOM Lite section for firmware/wiring. The RP-specific ADC/PIO notes below do not apply to ATOM Lite.

[日本語](AI_GUIDE.md) · English · [README](README.en.md)

App: https://pscmps.github.io/pico-blocks-studio/

This guide: https://raw.githubusercontent.com/pscmps/pico-blocks-studio/main/AI_GUIDE.en.md

## Workflow

1. Select the board in the app. Choose English in the menu for an English prompt and catalog.
2. Menu → “Build with a chat AI” → “Copy prompt”.
3. Paste into ChatGPT or another chat tool. Fill in “WHAT I WANT TO BUILD” with your goal, wiring, servo models / IDs, and safe travel ranges.
4. Paste the JSON part of the reply into the app and choose “Import blocks (replace)”.
5. Check blocks, board selection, wiring, and generated Python before manually running.

Import replaces current blocks. One pre-import backup, including board selection, is kept in the browser and can be restored. Nothing is sent to an AI automatically. The prompt excludes the current program and actual Wi-Fi password.

This is **block JSON exchange**. Python bodies may be supplied only inside `adv_python_function.fields.CODE`; entire Python files are not converted into ordinary blocks. AI output is not guaranteed correct; a person must verify code, ranges and wiring.

Language affects labels and explanations, not JSON block types, field keys, dropdown values, protocol commands, or board IDs. Do not translate those identifiers. User-written text and variable names are preserved when changing the app language.

## Output contract

Reply with exactly one JSON code block. Minimal structure:

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

- Exactly one top-level block: `program_start`. Connect all other instructions below it.
- Chain statements with `next: {"block": {...}}`.
- Values, conditions, and loop bodies use `inputs: {"INPUT_NAME": {"block": {...}}}`.
- Numeric fields are JSON numbers. Dropdown and text fields are JSON strings. GPIO dropdowns use GPIO-number strings, not XIAO D numbers.
- Omitted fields use catalog `default` values. Do not omit intended GPIOs or values.
- IDs, coordinates, extraState, mutation, enabled, internal variable IDs, etc. are unnecessary. Variables use their `NAME` string.
- Maximum 300,000 characters, 500 blocks, and 80 levels of nesting. Unknown types, out-of-range values, and invalid connections are rejected.
- Import also selects the JSON `board`. It never runs or uploads automatically.

## Boards and pins

| board | GPIO choices | ADC choices | Wi-Fi JOG |
| --- | --- | --- | --- |
| pico / picow / pico2 / pico2w | 0–22, 26, 27, 28 | 26, 27, 28 | picow / pico2w only |
| rp2040_geek / rp2350_geek | 2, 3, 4, 5, 28, 29 | 28, 29 | No |
| xiao_rp2040 | 26, 27, 28, 29, 6, 7, 0, 1, 2, 4, 3 | 26, 27, 28, 29 | No |
| xiao_rp2350 | 26, 27, 28, 5, 6, 7, 0, 1, 2, 4, 3 | 26, 27, 28 | No |
| atom_lite (development / untested) | 19, 21, 22, 23, 25, 26, 32, 33 | 32, 33 | Experimental |

XIAO GPIO choices are listed in D0–D10 order; rear pads are excluded.

ADC uses `read_u16()`, returning 0–65535 for inputs of 0–3.3 V. Never apply 5 V. `VOLT` estimates voltage with a 3.3 V reference. Do not share servo pins with ADC or digital GPIO. Input pull settings on a shared input pin must agree.

## Basic blocks

The exact types, field ranges, and dropdown choices are included in the **prompt copied from the app**. The table below summarizes input names. Value blocks must not be connected to `next`.

| type | fields | inputs | Result / action |
| --- | --- | --- | --- |
| basic_number | NUM: number | — | Number |
| basic_math | OP: ADD/SUB/MUL/DIV/MOD | A, B: number | Arithmetic / remainder |
| basic_unary | OP: ABS/ROUND/FLOOR/SQRT | VALUE: number | Absolute value / rounding / floor / square root |
| basic_limit | — | VALUE, MIN, MAX | Clamp to limits |
| basic_map | — | VALUE, IN_MIN, IN_MAX, OUT_MIN, OUT_MAX | Map range and clamp |
| basic_random | — | MIN, MAX | Random integer, MIN ≤ MAX |
| basic_compare | OP: EQ/NE/LT/LE/GT/GE | A, B: number | Boolean |
| basic_boolean | VALUE: TRUE/FALSE | — | Boolean |
| basic_logic | OP: AND/OR | A, B: boolean | Logical operation |
| basic_not | — | VALUE: boolean | Negation |
| basic_get | NAME: string | — | Variable value |
| basic_set | NAME: string | VALUE: any | Assign variable |
| basic_change | NAME: string | VALUE: number | Increment variable |
| basic_if | — | IF: boolean, DO/ELSE: statements | Conditional |
| basic_repeat | — | TIMES: number, DO: statements | Counted loop |
| basic_while | — | IF: boolean, DO: statements | Conditional loop |
| forever_loop | — | DO: statements | Infinite loop; no next |
| basic_wait | — | MS: number | Wait in milliseconds |
| basic_ticks | — | — | Millisecond counter |
| basic_elapsed | — | START, END | Wrap-safe elapsed time |
| basic_adc | PIN: GPIO string, MODE: RAW/VOLT | — | Analog input |
| basic_read | PIN: GPIO string, PULL: UP/DOWN/NONE | — | Digital input, 0/1 |
| basic_write | PIN: GPIO string | VALUE: number/boolean | LOW if zero, otherwise HIGH |
| basic_text | TEXT: string | — | String |
| basic_join | — | A, B: any | Join as strings |
| basic_print | — | VALUE: any | USB serial output; LCD only if mirroring is enabled |

Variables start at 0. Equal `NAME` strings identify the same variable. Division by zero, square roots of negative numbers, equal input endpoints in range mapping, and numeric operations on strings can cause runtime errors. `ROUND` uses Python `round()` (ties to even). Add delays in long loops. Use `basic_elapsed`, not direct subtraction, because the clock wraps.

The basic set does not include generic I2C / SPI, interrupts, or arbitrary Python functions. GEEK-specific LCD blocks are described below.

## Servos and JOG

- Category order: PWM servo → SCS009 → XL330 → STS3215 → STS3235. SCS009 has no subcategories.
- `pwm_setup`: `CHANNEL` 1–16, `PIN` a GPIO string, `MIN_US/MAX_US` pulse widths at 0° / 180°. Defaults 1000 / 2000 µs; adjust to the servo specification.
- `scs009_setup`, `xl330_setup`, `sts3215_setup`, `sts3235_setup`: `PIN` and `BAUD` strings. One connection per type, up to two PIO servo types in total. PWM is separate.
- Connection, GPIO, ADC, and variable initialization is generated at the program top. Putting setup in a condition or loop does not make initialization conditional. Place setup directly below Program start.
- `pwm_value`: `CHANNEL` plus numeric input `VALUE` (0–180°).
- `scs009_value`: `ID` plus numeric input `VALUE` (0–1023, approximately 300°). Time value 0, speed value 500.
- `xl330_value`, `sts3215_value`, `sts3235_value`: `ID` plus numeric `VALUE` (0–4095). Default speed values 20 for XL330 and 500 for STS; acceleration 20.
- Use `*_move` for fixed positions with detailed speed settings. Narrow travel limits further to suit the mechanism.
- Explicitly use `*_torque` with `ID` and `STATE: "1"` before moving serial servos. Connection alone does not enable torque. XL330 / STS3215 / STS3235 support standard single-turn position mode only.
- STS3235 uses `sts3235_setup/ping/read/torque/move/value/bind`, with the same fields as STS3215.
- `SPEED` is a raw model-specific servo speed value, not milliseconds. JOG `STEP` is position change per key input.
- For multiple PWM servos, use unique channels and GPIOs. Wiring connectors and signals are color-coded per channel. For serial servos, use one connection per type and different IDs in actions / mappings; the diagram shows an ID-based daisy chain.
- Mixed wiring shows all types. Serial models have dedicated colors distinct from PWM. Keep V+ separate by type and share GND. Configure unique physical IDs beforehand. Diagram colors do not represent physical wire colors.
- `uart_controller_setup` receives JOG over the same USB connection used for uploads. Only W-equipped Pico boards support `wifi_jog_setup`, using `SSID/PASSWORD` to create an access point.
- JOG `AXIS`: Y (↑↓), X (←→), Z (W/S), R (A/D). Mapping blocks: `uart_scs_bind`, `xl330_bind`, `sts3215_bind`, `sts3235_bind`, `pwm_bind`. Set `ID` (channel for PWM), `CENTER`, `STEP`, and `SPEED` for serial servos.
- Mappings are shared by USB and Wi-Fi; PWM and other mappings work with Wi-Fi-only JOG. Use only one mapping per AXIS. Concurrent USB / Wi-Fi commands update the same position without priority or locking.
- Use a correctly rated external supply for each servo and common GND. Never put 5 V / higher supply voltage on GPIO, and do not power servos from the PC USB port.
- “Save & run” includes a three-second BOOT window in `main.py`. Normal power-on runs standalone; pressing BOOT within three seconds after startup enters write mode for that boot only. Initialization and motion begin after the window. This differs from UF2 mode entered by holding BOOT during reset.
- Interrupting Python can leave PWM or holding torque active. Provide appropriate stop / torque-off blocks and a physical power cutoff.

## GEEK LCD blocks

Available only on `rp2040_geek` / `rp2350_geek`:

| type | fields | inputs | Action |
| --- | --- | --- | --- |
| lcd_print | — | VALUE: any | Print with a new line; wrap and scroll |
| lcd_line | ROW: number 1–8 | VALUE: any | Clear and overwrite a row; clip to 15 characters |
| lcd_clear | — | — | Clear screen; reset log insertion to row 1 |
| lcd_usb_mirror | ENABLED: "1"/"0" | — | Enable / disable mirroring of subsequent basic_print output |

VALUE accepts text, numbers, variables, or other compatible expressions. Display: 15 columns × 8 rows, white on black, ASCII letters / digits / symbols. Japanese and other unsupported characters become `?`. No connection / initialization block is needed. USB input and JOG traffic are not automatically displayed. Use roughly 100 ms between repeated updates. The driver is embedded in generated Python; no extra library is required. Hardware display operation remains unverified.

## Example: print ADC to USB serial

Read a 0–3.3 V analog signal on GP26 every 100 ms. Match the board and wiring to the actual hardware.

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

To map ADC to a PWM angle, use `basic_map` with input 0–65535 and output, for example, 45–135, then connect it to `pwm_value.inputs.VALUE.block`. Add a servo connection on a separate GPIO and a suitable external supply.

References: [MicroPython RP2 quick reference](https://docs.micropython.org/en/latest/rp2/quickref.html), [Blockly serialization](https://developers.google.com/blockly/guides/configure/web/serialization).
