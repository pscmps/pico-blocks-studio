# PicoBlocks Studio — Block JSON guide for chat AI, v1

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

This is **block JSON exchange**, not arbitrary Python-to-block conversion, pasted Python execution, or external code loading. AI output is not guaranteed correct; a person must verify ranges and wiring.

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
