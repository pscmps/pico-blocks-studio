# PicoBlocks Studio

[日本語](README.md) · English · [Open the editor](https://pscmps.github.io/pico-blocks-studio/)

A browser-based block programming prototype for RP2040 / RP2350 boards running MicroPython.

## Language

Open the top-right menu and choose **Language / 言語 → English** or **日本語**. The preference is remembered in this browser. Switching redraws the editor without disconnecting USB or uploading a program. Blocks, field values, board selection, and undo history are preserved. User-written text, variable names, passwords, and existing serial output are not translated.

Menus, block labels, tooltips, wiring diagrams, firmware instructions, HELP, validation messages, and the chat-AI prompt are localized. Generated comments and the board-hosted Wi-Fi JOG page use the language selected when the program is generated. To change an already saved Wi-Fi page, save the program again. The language selector is disabled during upload / other busy operations. HELP ends with `made by pscmps` in both languages.

## Features

- Build programs with Blockly and inspect or copy generated MicroPython.
- Connect to MicroPython REPL using Web Serial, run temporarily, or save as `main.py` for startup execution.
- Autosave blocks in the browser; double-click a block body to duplicate it (not Program start; fields remain editable).
- Control SCS009 / SCS0009 over single-wire PIO half-duplex communication.
- Use XL330, STS3215, and STS3235 blocks for Ping, position reading, torque, and single-turn movement.
- Connect standard PWM servos, set angles or pulse widths, and stop their outputs.
- Use ADC, digital GPIO, arithmetic, range mapping, variables, conditions, loops, timing, and text blocks.
- Feed calculated values into servo position blocks.
- Use four-axis JOG over the same USB connection, or a phone-friendly Wi-Fi access point on Pico W / Pico 2 W.
- Map JOG axes to serial servo IDs or PWM channels.
- View original schematic pinouts and multi-servo wiring, including XIAO D / GPIO labels.
- Display text on the built-in LCD of RP2040-GEEK / RP2350-GEEK.
- Copy a chat-AI request template and import the returned JSON as editable blocks.

## Quick start

1. Select your board on the right.
2. Open “First time: install MicroPython” and follow its board-specific instructions.
3. Use desktop Chrome or Edge with a data-capable USB cable.
4. Click “Connect board” and select the MicroPython serial port.
5. Connect blocks below the existing “Program start”, then use “Run now” or “Save & run”.

Web Serial needs HTTPS or localhost. This editor's USB workflow does not support Safari / Firefox. Initial firmware installation uses a UF2 drive, not the Web Serial upload button.

The right sidebar contains only first-time firmware setup, subsequent uploads, and power precautions. Other topics are in the menu's HELP. The first-time overlay can be dismissed permanently using its checkbox and restored from HELP. The overlay is not a hardware firmware detector.

## Boards and pins

PIO is not limited to a dedicated UART pin pair. The editor intentionally offers only the supported board's exposed connector pins, excluding internal LCD / microSD connections on GEEK boards.

| Board | Available servo DATA / GPIO pins | Onboard LED |
| --- | --- | --- |
| Raspberry Pi Pico | GP0–22, GP26–28 | GP25 |
| Raspberry Pi Pico W | GP0–22, GP26–28 | `LED` |
| Raspberry Pi Pico 2 | GP0–22, GP26–28 | GP25 |
| Raspberry Pi Pico 2 W | GP0–22, GP26–28 | `LED` |
| Waveshare RP2040-GEEK | GP2, 3, 4, 5, 28, 29 | Hidden |
| Waveshare RP2350-GEEK | GP2, 3, 4, 5, 28, 29 | Hidden |
| Seeed Studio XIAO RP2040 | GP26, 27, 28, 29, 6, 7, 0, 1, 2, 4, 3 (D0–D10) | GP25, active-low |
| Seeed Studio XIAO RP2350 | GP26, 27, 28, 5, 6, 7, 0, 1, 2, 4, 3 (D0–D10) | GP25, active-low |

ADC choices are the available GP26–29 pins. Inputs must be **0–3.3 V, never 5 V**. Voltage readout is an estimate based on a 3.3 V reference.

XIAO support covers the standard RP2040 and RP2350, not Plus, ESP32, or nRF variants. The diagram includes the 14 side pins (D0–D10 plus 5V / GND / 3V3); RP2350 rear pads are excluded. D3 is GP29 on RP2040 but GP5 on RP2350. Neither of these XIAO boards has Wi-Fi.

## Installing MicroPython for the first time

Selecting a board changes the firmware link and button instructions.

- Pico / Pico W / Pico 2 / Pico 2 W: unplug USB, hold BOOTSEL, and reconnect USB. Copy the matching official UF2 to the `RPI-RP2` or `RP2350` drive. Choose the normal Arm build for Pico 2 models.
- RP2040-GEEK / RP2350-GEEK: extract the matching Waveshare firmware ZIP. Connect USB, press BOOT and RESET together, release RESET, then BOOT. Copy the UF2 to the drive that appears.
- XIAO: unplug USB, hold BOOT while reconnecting, then release it. If already connected, hold BOOT, press and release RESET, then release BOOT. Use the firmware for the exact XIAO model.
- The board restarts after copying the UF2. Connect through “Connect board” in desktop Chrome / Edge.

Downloads: [Pico](https://micropython.org/download/RPI_PICO/) · [Pico W](https://micropython.org/download/RPI_PICO_W/) · [Pico 2](https://micropython.org/download/RPI_PICO2/) · [Pico 2 W](https://micropython.org/download/RPI_PICO2_W/) · [RP2040-GEEK ZIP](https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2040-Board.zip) · [RP2350-GEEK ZIP](https://files.waveshare.com/wiki/RP2350-Plus/WAVESHARE-RP2350A-Board.zip) · [XIAO RP2040](https://micropython.org/download/SEEED_XIAO_RP2040/) · [XIAO RP2350](https://micropython.org/download/SEEED_XIAO_RP2350/).

Wi-Fi JOG targets MicroPython 1.29 or later for the selected W board.

## Write mode and standalone execution

“Save & run” writes the generated program and a startup gate to `main.py`. It first writes and verifies a temporary file, then replaces the saved program. Merely connecting or using “Run now” does not replace it. No custom initial UF2 is required.

- At power-on / reset, a three-second BOOT window runs before user initialization and servo actions, then the saved program starts.
- Press BOOT / BOOTSEL **within three seconds after releasing reset / powering on** to skip the program for that boot and return to REPL. The next normal boot auto-runs again.
- Holding BOOT during reset / power-on enters ROM UF2 mode instead. Release BOOT and restart.
- Original Pico boards have no RST button. Cycle power or add a button between RUN and GND. GEEK / XIAO can use RESET.
- While connected, “Write mode” interrupts Python, enters raw REPL, soft-resets PWM / PIO / networking, and returns to normal REPL. A soft reset in raw REPL does not rerun `main.py`. Saved files remain intact.
- “Run now” is temporary; even infinite loops do not block the upload UI. Use Stop to interrupt.
- “Stop” interrupts Python but may leave PWM outputs active. Even Write mode may leave a serial servo's holding torque enabled. Neither is an emergency stop; provide appropriate output-stop / torque-off operations and a physical power cutoff.
- Without USB, execution continues if the board and servos remain correctly powered. After a power cycle, the last saved program starts again. Wi-Fi JOG does not need a PC.
- If BOOT detection is missing or fails, the startup gate stays in write mode instead of moving unexpectedly. Update to compatible MicroPython.

The mode label shows only the state observed over the current connection. “Mode unknown” after reconnecting does not stop or start the saved program. The BOOT gate is added only when saved with this version, not to old `main.py` files or temporary runs.

References: [MicroPython boot / raw REPL reset](https://docs.micropython.org/en/latest/reference/reset_boot.html), [BOOTSEL API](https://docs.micropython.org/en/latest/library/rp2.html#rp2.bootsel_button), [RP2 implementation](https://github.com/micropython/micropython/blob/v1.29.0/ports/rp2/modrp2.c), [Pico reset button](https://www.raspberrypi.com/news/how-to-add-a-reset-button-to-your-raspberry-pi-pico/). Startup and saving are tested with simulated peers; physical buttons, reconnection, and actual servo operation remain unverified.

## USB / Wi-Fi JOG

Add a UART connection block or a Wi-Fi JOG start block to enable “Controller” in the menu. The USB cable used for uploads also carries JOG commands; no USB-UART adapter or extra TX / RX wiring is needed. Uploading uses REPL; controller operation uses the generated program's standard input.

| Keys | Axis | Default SCS009 ID |
| --- | --- | --- |
| Up / Down | Y | 1 |
| Right / Left | X | 2 |
| W / S | Z | 3 |
| D / A | R | 4 |
| Space | All axes | Return to configured centers |

An SCS009 connection enables the default ID1–4 mappings. Mapping blocks override the ID, center, step, and speed. Other servo models require explicit mappings. Without a mapped servo, the controller updates generic values only. Releasing a key stops further increments, not holding torque.

USB sends `DELTA axis ±1` and `CENTER`; legacy `JOG axis absolute-position` is also accepted. USB and HTTP share the same commanded positions. Displayed values come back from the board but are **not measured servo positions**.

Mappings are shared by USB and Wi-Fi. Wi-Fi-only JOG needs no UART start block. If both controllers are used, commands modify the same position in processing order, with no exclusive lock or priority. Only one mapping per axis is allowed.

“Speed value 500” is a raw servo speed setting, not 500 ms. Step is the position difference per input. Equal speed values can mean different physical speeds on different models. PWM JOG uses an angle step, not a speed register.

For Pico W / Pico 2 W, set the Wi-Fi name (default `PicoBlocks-JOG`) and password (default `picoblocks`) in the Wi-Fi start block. Run or save over USB, connect your phone to that Wi-Fi, then open the address printed in Serial (usually `http://192.168.4.1/`). The board hosts the page without external libraries or internet; opening GitHub Pages on the phone is unnecessary. After saving, external power is sufficient. Unsupported boards retain existing Wi-Fi blocks but cannot run / save them.

The access point follows the [MicroPython WLAN API](https://docs.micropython.org/en/latest/rp2/quickref.html#networking).

## Servos

Categories appear in this order: PWM servo → SCS009 → XL330 → STS3215 → STS3235. SCS009 is one flat list. Program start is placed once by default and cannot be added from the toolbox or deleted. Initialization blocks belong directly below it.

### SCS009 / SCS0009

The generated driver uses `rp2.StateMachine` to drive one DATA pin only during transmission and return it to high-impedance input afterward. No external half-duplex converter is needed. State machine numbers are managed internally.

Feetech SCS1.1 packets support torque enable at `0x28` and contiguous goal position / time / speed writes starting at `0x2A`.

- Connection: DATA GPIO and baud rate only; defaults GP2 / 1 Mbps.
- Position: 0–1023, approximately 0–300° on SCS009.
- Time: raw 0–65535; speed: raw 0–1023.
- This SCS implementation is transmit-only: no response reading, ID changes, or EEPROM writes.

Power servos externally at their rated voltage and share GND with the board. Never power them from 3V3 or put servo supply voltage onto a GPIO.

### XL330 / STS3215 / STS3235

1. Choose DATA GPIO and baud rate. XL330 defaults to 57,600 bps, STS models to 1 Mbps; match the servo's saved baud rate.
2. With no mechanical load, run Ping and Read position and inspect Serial.
3. In standard single-turn position mode, explicitly enable torque, then command a position from 0–4095. Torque enable first writes the measured position as the goal.
4. For JOG, add a UART or Wi-Fi start block, an explicit servo mapping, and torque enable. Match the configured center to the actual mechanism and start with small steps.

The Python ports implement DYNAMIXEL Protocol 2.0 CRC / byte stuffing for XL330, and checksum / little-endian packets for STS models. They check response ID, length, checksum / CRC, servo errors, and timeouts. XL330 assumes write responses are enabled, for example Status Return Level 2.

The scope is communication and basic motion, not the earlier C project's G-code, homing, or multiturn features. XL330 checks Operating Mode 3 and velocity-based Profile settings; STS checks standard single-turn position mode. Previously configured multiturn units are rejected. EEPROM, ID, baud rate, and operating mode are not changed automatically.

Only PIO0 is used to avoid Wi-Fi PIO resources. Up to two serial servo types may be connected, one block per type. Multiple units of the same type share DATA and use different IDs. Different types require separate GPIOs; PWM connections are separate from this limit.

XL330 needs 3.7–6.0 V external power (start at 5 V); a 220 Ω DATA series protection resistor is recommended. Check the exact voltage rating of your STS variant. Use a common GND and begin with one unloaded servo on a current-limited supply. GPIO signals are 3.3 V.

STS3235 shares STS3215's packet / register implementation: Ping, measured position, torque, single-turn positions 0–4095, speed values 1–3400, acceleration values 1–100, and USB / Wi-Fi JOG. Hardware operation is unverified.

References: [ROBOTIS XL330-M077-T](https://emanual.robotis.com/docs/en/dxl/x/xl330-m077/), [Feetech STS3235](https://www.feetechrc.com/12v-30kg-metal-shell-metal-tooth-iron-core-motor-magnetic-coding-double-shaft-ttl-series-steering-gear.html), [Waveshare ST3235 SMS_STS example](https://www.waveshare.com/wiki/ST3235_Servo).

The communication source is the existing `dynamixel-pio-xl330-m077-t-rp2040` C implementation at commit `1522efc`. Its original files and settings were not modified. Hardware results from that C version do not establish verification of this Python port.

### PWM servos

Use one connection per unique channel (1–16) and GPIO. Set an angle from 0–180°, or a pulse width in µs. Frequency is fixed at 50 Hz; defaults are 1000 µs at 0° and 2000 µs at 180°. Adjust limits for your servo and mechanism, within 500–2500 µs. Out-of-range commands are rejected.

Connection starts with no output. Stop disables pulses; a later angle command resumes output. GPIOs that share a PWM channel (16 apart on the supported boards) cannot be used together. Holding behavior after pulse removal depends on the servo. Use an external servo supply and common GND. See the [MicroPython PWM API](https://docs.micropython.org/en/latest/library/machine.PWM.html).

## Wiring guide

The collapsible left panel follows the board and connection blocks. With no servo connection blocks, it shows only the board pinout, not phantom servos or power wiring. “All servos” displays mixed types together; the selector can isolate one type.

- Pico diagrams label all 40 physical pins. Hover for physical pin numbers.
- GEEK diagrams group H1 (GP2 / GND / GP3), H2 (GP4 / GND / GP5), and H3 (3V3 / GP28 / GP29 / GND). Hover for connector pin numbers.
- XIAO labels both D and GPIO numbers.
- PWM1–16 have stable channel-specific colors for connectors and signals.
- Serial colors are model-specific and distinct from PWM: SCS009 orange, XL330 purple, STS3215 pink, STS3235 teal.
- Serial connectors are derived from unique IDs in action / JOG blocks, including active SCS defaults. With no ID, one placeholder is shown. DATA / V+ / GND are drawn as an IN / OUT daisy chain.
- Colors remain stable as devices are added, removed, or filtered. Signals route outside the board outline. V+ is separated by type; GND is common.

This is a functional diagram, not hardware discovery, ID configuration, or a physical plug specification. Configure unique IDs beforehand. Verify physical pin order, orientation, voltage, supply capacity, and wire capacity; do not join incompatible supply voltages. Colors do not specify real cable colors.

The diagrams are original rectangles, circles, and lines based on factual pin information, not copied Fritzing parts, product photos, or manufacturer artwork. Check official references before wiring: [Pico series](https://www.raspberrypi.com/documentation/microcontrollers/pico-series.html), [RP2040-GEEK](https://www.waveshare.com/wiki/RP2040-GEEK), [RP2350-GEEK](https://www.waveshare.com/wiki/RP2350-GEEK), [XIAO RP2040](https://wiki.seeedstudio.com/XIAO-RP2040/), [XIAO RP2350](https://wiki.seeedstudio.com/xiao_rp2350_arduino/).

## GEEK LCD text

Choose RP2040-GEEK / RP2350-GEEK for “Basics → LCD text”. The category is hidden on Pico / XIAO, and retaining LCD blocks on an unsupported board prevents run / save.

- **LCD print … on a new line:** accepts text, numbers, or variables; wraps at 15 characters and scrolls after 8 rows.
- **LCD row … show …:** overwrites rows 1–8, clipped to 15 characters, with no stale trailing text. Does not move the log insertion row.
- **LCD clear all text:** clears to black and resets log insertion to row 1.
- **Mirror USB serial prints to LCD:** mirrors only subsequent `basic_print` blocks, not received data, JOG traffic, internal servo logs, or arbitrary Python `print()` calls.

The standard 8×8 font is doubled to 16×16, white on black. ASCII letters, numbers, and symbols are supported; Japanese / other unsupported characters become `?`. Shapes, arbitrary colors, Japanese fonts, and automatic USB-receive display are out of scope. Add around 100 ms between repeated updates.

Driver: ST7789, SPI1 at 24 MHz, DC=GP8 / CS=GP9 / SCK=GP10 / MOSI=GP11 / RST=GP12 / BL=GP25. Landscape 240×135, MADCTL `0x70`, RAM offset `(40,53)`. GP8 is restored to D/C output after SPI initialization for older firmware that defaults MISO to GP8. Backlight is on/off, not PWM, and the driver uses no PIO.

A 120-byte monochrome text buffer and a 480-byte RGB565 row buffer avoid a full-screen RGB buffer. The driver is embedded in generated Python and initialized on first display use. No extra library or custom UF2 is needed. **LCD operation has not been verified on hardware.**

Reference implementation: the existing [Pico SDK GEEK C driver](https://github.com/pscmps/dynamixel-pio-xl330-m077-t-rp2040/blob/1522efcbecaf9a2fe6a8c7b3629f5df566a5518a/firmware/pico-sdk-rp2040-geek/src/rp2040_geek_lcd.c). The requested Rθ-related Zephyr repository was not identified, so this is not a direct port of it. Pins were cross-checked against [Zephyr's GEEK board documentation](https://docs.zephyrproject.org/latest/boards/waveshare/rp2040_geek/doc/index.html) and the [RP2350-GEEK schematic](https://files.waveshare.com/wiki/RP2350-GEEK/RP2350-GEEK.pdf). Text uses [MicroPython framebuf](https://docs.micropython.org/en/v1.29.0/library/framebuf.html)'s built-in font, not copied C font data.

## Build blocks with a chat AI

Menu → “Build with a chat AI” → “Copy prompt”. Add your goal, wiring, servo models / IDs, and safe ranges. The template includes the selected board, pins, block catalog, and guide URL, so tools without URL access can still use it. Paste the returned JSON into the same dialog.

Import replaces current blocks, keeps one pre-import backup, validates format / wiring conflicts, and never auto-runs. “Restore before import” restores blocks and board selection. This is JSON block exchange, not Python-to-block conversion or arbitrary Python execution. Nothing is automatically sent to an AI; the template excludes your current program and Wi-Fi password. See the full [AI block JSON guide](AI_GUIDE.en.md).

## Development and verification

The site consists of static files and needs no build. Blockly and Acorn in `devDependencies` are for tests only.

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

Tests cover eight board catalogs, generation, import validation / restoration, pin conflicts, servo CRC / stuffing / checksum and malformed replies, range limits, USB / HTTP commands, startup / save behavior, mixed wiring, and LCD initialization / windows / scaling / wrapping / overwriting / mirroring / CS cleanup. Localization tests check translation coverage, placeholders, both language catalogs, prompt / mobile pages, and preservation of user text. Generated programs are syntax-checked and exercised with mocked hardware. Earlier PIO tests also checked assembly and instruction-memory limits against MicroPython v1.29.0.

These are not tests of physical ADC accuracy, electrical waveforms, buttons, LCDs, or servo motion. This remains a prototype requiring hardware validation and appropriate safety measures.

Serve locally with any static server, for example:

```sh
python -m http.server 4173
```

For GitHub Pages, select **Deploy from a branch**, branch **main**, directory **/ (root)** in repository Pages settings.
