# PicoBlocks Studio

## Gcode / PlotterFlow

The new Motor Shield boards appear only when **HELP → Show features in development** is enabled at the bottom of HELP (off by default, saved in this browser). Dedicated blocks and samples follow the same preference. Existing programs are preserved when turned off.

**Motor Shield v0.7** adds six configurations: Pico / Pico W / Pico 2 / Pico 2 W, RP2350-LCD-1.47-A and RP2350-Touch-LCD-2 / -C (camera/FPC removed). Includes board selection, a dedicated setup block, connector/pin diagram and USB Gcode samples. Zero boards are excluded. TMC initialization, homing, limit-stop and LCD support are not implemented; hardware is untested. [Pins, power and usage](GCODE.en.md#plotterflow-motor-shield-v07).

**Advanced blocks → Gcode** and **Menu → Samples** provide a PlotterFlow STEP/DIR XY + PWM pen receiver for Pico 2 / Pico 2 W. Settings, USB line input, Gcode execution and replies are editable blocks. External drivers (e.g. TMC) for both axes and external supplies are required and shown in the left wiring guide. TMC UART configuration is not included.

Compared against the pinned source with host tests; hardware untested. F speed control and immediate STOP are not implemented. See [GCODE.en.md](GCODE.en.md) for setup, intentional compatibility/safety fixes and limitations.

## Create a block with Python

**Advanced blocks → Create blocks (Python)** contains a function definition with a multiline code field. Connect it directly under Program start and enter a name and body, without `def`. Read the argument as `arg`, return a result with `return`, and call it from a same-name function-result or function-run block. For example, `return arg * 2` returns 6 when passed 3.

Enter inserts a newline, Tab adds four spaces, and Ctrl+Enter or clicking outside commits. Bodies allow 16384 characters and survive duplication, saving, language changes and JSON import. For multiple arguments, pass a list or dictionary. Local variables are separate from block variable names; place necessary imports in the body.

Definitions do not run by themselves; calls execute on the board. This is neither a browser Python interpreter nor an entire Python-file-to-block converter. Body syntax and GPIO conflicts cannot be checked automatically; syntax errors appear in the serial console at execution time. Use only trusted code. Long operations and infinite loops can block JOG and timers.

The field uses the official Blockly [@blockly/field-multilineinput](https://www.npmjs.com/package/@blockly/field-multilineinput) 5.0.17 plugin (Apache-2.0), pinned for Blockly 11.2.2 compatibility.

## Sample programs

Open **Samples** in the menu to load a USB JOG example for three matching PWM, SCS009, XL330, STS3215 or STS3235 servos. Wi-Fi JOG is also available on Pico W, Pico 2 W and ATOM Lite. GPIOs follow the selected board; GEEK samples add LCD model/key labels, not measured positions.

- Up/down = ID/channel 1, left/right = 2, W/S = 3, Space = center all three. A/D are not assigned to a servo.
- Loading replaces blocks without running or writing to hardware. Restore previous blocks keeps one pre-load state, separately from the chat-import backup.
- Configure serial servo IDs 1/2/3, baud rates and position-control mode beforehand. XL330 uses 57,600 bps; SCS/STS use 1 Mbps. Samples do not reconfigure these settings; running enables torque. PWM uses 50 Hz and 1000–2000 us, with no output until a JOG command.
- Check external power, common GND and signal levels; disconnect the load for testing. The first JOG command or Space may cause a large move toward center. Adjust centers, steps and pulse widths for your hardware.
- Wi-Fi samples use a board-hosted access point. Change the sample SSID/password before the first USB run, connect your phone to that Wi-Fi and open the URL printed in the serial console. USB JOG also works. This is separate from wireless programming over your home network.

All 60 supported board/model/transport combinations are generated and syntax-checked; mock tests verify JOG commands target only the three servos. Hardware is untested, including experimental ATOM Lite. Explicit JOG bindings no longer auto-fill unassigned axes with SCS IDs; legacy four-axis defaults remain when there are no binding blocks.

## Consolidated basic tools and advanced blocks (2026-09-27)

Removed Motion: board LED and GPIO output now live under Basic → Input / output; waits live under Time / loops. Use the single-line `basic_write` and `basic_wait` in new programs. Saved `gpio_write` / `wait_ms` blocks remain importable.

Advanced blocks appears directly below Basic and adds 45 blocks:

- Lists, typed numeric arrays, bytes and dictionaries
- One-argument functions with return values; for-each, break/continue, try/except/finally
- GPIO interrupts and software timers, including stop/debounce
- Type conversion, text split/replace, JSON, bit operations and trigonometry
- General PWM; software I2C scan and 8-bit register access; software SPI transfer
- Microsecond ticks/differences, free memory and garbage collection

No initial firmware reinstall is needed; helpers are included in generated Python. Exposed GPIO choices follow all nine boards. Validation checks GPIO conflicts, RP PWM slice conflicts, and function/control-block placement. The existing servo wiring diagram does not yet draw I2C/SPI peripherals.

### Event execution

`Pin.irq(hard=False)` only sets a flag. Nested blocks execute in the main dispatcher, not within the IRQ: servo I/O, allocations and waits do not run in the interrupt handler. Software timers use `ticks_ms/ticks_diff/ticks_add`, not hardware Timer objects. Waits, loops and statement boundaries dispatch events and JOG. An event loop is appended automatically; finally detaches IRQs on exit.

Handlers are serialized. Long operations or another handler delay dispatch. Bursts of edges and missed timer intervals are coalesced, not counted exactly. Not for high-speed counting, precise periodic output or safety systems. Avoid long waits and infinite loops inside handlers.

List indexes start at zero; invalid types/ranges raise Python exceptions. I2C/SPI require 3.3 V signals; I2C needs pull-ups to 3.3 V. Check peripheral specifications and keep GPIO/I2C/SPI/PWM pins separate from board/servo uses. **This is a prototype of common features, not the entire MicroPython API. Hardware timing, communication and waveforms remain untested.** File operations, RTC setting, sleep, WDT, threads, asyncio and arbitrary PIO are not included.

Sources: [IRQ constraints](https://docs.micropython.org/en/v1.29.0/reference/isr_rules.html), [Pin](https://docs.micropython.org/en/v1.29.0/library/machine.Pin.html), [I2C](https://docs.micropython.org/en/v1.29.0/library/machine.I2C.html), [SPI](https://docs.micropython.org/en/v1.29.0/library/machine.SPI.html), [PWM](https://docs.micropython.org/en/v1.29.0/library/machine.PWM.html), [array](https://docs.micropython.org/en/v1.29.0/library/array.html).

Tests: `node tests/advanced.js`, `python tests/advanced_runtime.py`. Cover 45 blocks, nine board catalogs, 78 compiled programs, collections/functions, simulated IRQ/timer dispatch and cleanup, and SPI CS release on errors.

[日本語](README.md) · English · [Open the editor](https://pscmps.github.io/pico-blocks-studio/)

A browser-based block programming prototype for RP2040 / RP2350 boards running MicroPython.

## JOG and signal levels (updated 2026-09-27)

Raw speed is hidden in shared USB/Wi-Fi JOG bindings; set Center and Step only. New bindings internally default to 500 for SCS009/STS3215/STS3235 and 20 for XL330. These are servo settings, not board speed or milliseconds. Existing serialized `SPEED` values remain supported. Explicit position-move blocks still expose servo speed.

SCS009 (documented as SCS0009), STS3215 and STS3235: manufacturer sheets specify High 2–5 V and Low 0–0.45 V. They do not separate TX/RX limits or specify the internal pull-up voltage, so replies cannot be guaranteed to stay below 3.3 V.

XL330: ROBOTIS specifies 3.3 V logic with 5 V compatibility. This applies to the servo, not 5 V tolerance on the ESP32.

The user reported successful direct wiring with STS3235 and XL330 on 2026-09-27. Board, wiring and baud details are not recorded; this does not validate every board or condition in this app.

A pull-up returns a released DATA line to High; it does not translate voltage. Adding a resistor to 3.3 V does not make a 5 V driver or existing 5 V pull-up safe. If voltage is unknown, do not connect GPIO directly: obtain manufacturer confirmation or measure with the board disconnected. A 5 V bus needs level translation suitable for its baud and bidirectional half-duplex operation.

2.2 kΩ, rated at least 1/8 W, is a trial starting point only for a verified 3.3 V bus. It is not manufacturer-specified or guaranteed at 1 Mbps. Low-state current/power are about 1.5 mA/5 mW. Check sink-current limits, existing parallel pull-ups, capacitance and rise time. It is not a mandatory addition to an already stable bus.

Direction switching via PIO/single-wire UART and voltage translation are separate matters. Supply servo V+ externally and share GND. ESP32 GPIO tolerance is 3.6 V; never connect 5 V directly.

[SCS0009 (PDF)](https://www.feetechrc.com/Data/feetechrc/upload/file/20201231/6374501159851026569964966.pdf) · [STS3215 (PDF)](https://files.seeedstudio.com/products/Feetech/108090023_STS3215-C001_Datasheet.pdf) · [STS3235 (PDF)](https://www.feetechrc.com/Data/feetechrc/upload/file/20211211/6377481273721644411048359.pdf) · [XL330 / ROBOTIS](https://emanual.robotis.com/docs/en/dxl/x/xl330-m077/) · [ESP32 / Espressif](https://docs.espressif.com/projects/esp-faq/en/latest/hardware-related/hardware-design.html)

## ATOM Lite (in development / hardware untested)

Experimental **M5Stack ATOM Lite / ESP32-PICO-D4** support, not AtomS3. Includes USB upload/JOG, Wi-Fi upload/JOG, SCS009 / XL330 / STS3215 / STS3235, PWM and basic blocks. LCD stays GEEK-only. **No hardware, signal-waveform or power-loss testing has been performed.**

- First install stable [standard ESP32_GENERIC MicroPython](https://micropython.org/download/ESP32_GENERIC/) 1.29+ with LittleFS, not UIFlow, S3/C3, UF2 or custom FAT builds. Back up files, then follow official esptool instructions: `erase-flash`, then `write-flash 0x1000` with the downloaded `.bin`. **Erasing removes existing UIFlow, files and settings.** The front button is not the firmware bootloader button.
- After restart, use Connect board to select the FTDI USB serial port (115200 bps). If missing, consult [M5Stack's official FTDI driver instructions](https://docs.m5stack.com/en/core/ATOM%20Lite).
- Grove yellow G26 and white G32 are selectable as `G26 (Grove)` / `G32 (Grove)`. Black is GND, red is 5 V. G32 also supports ADC; G26/ADC2 is excluded from ADC choices to avoid Wi-Fi conflicts.
- The left schematic shows an optional pull-up per serial bus: **board expansion 3V3 → 2.2 kΩ (1/8 W or higher) → DATA**. None is added for PWM. Grove has no 3.3 V pin: take it from the board, never from Grove red/5 V or servo V+. This resistor does not protect a 5 V DATA bus.
- 2.2 kΩ is a trial starting value for short wiring: approximately 1.5 mA Low-state current and 5 mW at 3.3 V. At 1 kΩ these become 3.3 mA and 11 mW. Check both devices' sink-current ratings and existing pull-ups in parallel. Rise time depends on capacitance: an ideal 100 pF bus reaches 75% in about 0.30 µs with 2.2 kΩ. This does not guarantee 1 Mbps; verify waveforms/replies and adjust within 1–2.2 kΩ if needed. Hardware untested. This engineering estimate follows [Espressif's one-wire UART topology](https://github.com/espressif/arduino-esp32/blob/master/libraries/ESP32/examples/Serial/OneWire_UART_Two_Boards/OneWire_UART_Two_Boards.ino), not a resistor value specified by M5Stack.
- Saved programs auto-start after 3 seconds. To enter write mode, power cycle and press the **front button (GPIO39)** within 3 seconds. BOOT in general instructions means this button on ATOM Lite. The UI's Enter write mode also works over USB.
- Use the same Wi-Fi menu as Pico W: provision the receiver/current program once from a PC over USB, then save directly from this site on PC/Android Chrome on the same LAN. Wi-Fi JOG uses a separate access-point mode. Both are hardware-unverified.
- Serial servos use **shared-GPIO TX/RX with open-drain UART**, not PIO. UART0 stays reserved for USB; UART1/2 are assigned automatically, allowing two serial servo types. Blocks take only GPIO and baud. TX echo is removed before status parsing. Errors close the UART and release the pin; restart the program to retry.
- **No half-duplex converter IC does not mean unconditional direct wiring.** DATA must be 3.3 V-compatible; never connect 5 V signals directly. The weak internal pull-up may need an external 3.3 V pull-up depending on baud, wiring length and capacitance. Communication quality, including at 1 Mbps, is unverified. Use rated external servo power with common GND; start unloaded with slow motion.
- GPIOs: 19 / 21 / 22 / 23 / 25 / 26 / 32 / 33. ADC uses ADC1 pins 32/33 for Wi-Fi coexistence; voltage estimates are approximate. LED blocks switch the GPIO27 RGB LED on in white or off. GPIO39 (button), GPIO12 (IR) and internal/USB pins are excluded.
- The original wiring schematic groups expansion/Grove connectors and includes 3V3, 5V and GND. Check official pin information for physical orientation and order.

References: [ESP-IDF shared TX/RX precautions](https://docs.espressif.com/projects/esp-idf/en/v5.0.9/esp32/api-reference/peripherals/uart.html), [MicroPython ESP32 UART](https://github.com/micropython/micropython/blob/v1.29.0/ports/esp32/machine_uart.c), [ESP32 APIs](https://docs.micropython.org/en/latest/esp32/quickref.html). Tests: `node tests/atom.js`, `python tests/atom_runtime.py`. These do not replace hardware validation.

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

## Direct Wi-Fi upload (experimental)

USB remains the default. The prototype targets **Pico W / Pico 2 W, MicroPython 1.29+, desktop / Android Chrome 142+**. Hardware and Android-device testing are still pending. Chrome on iPhone uses the Safari-family engine and is not included in this support target. Using [Chrome's Local Network Access permission](https://developer.chrome.com/blog/local-network-access), this HTTPS editor sends directly to the board's HTTP API. No download, phone file, board-hosted upload page, or relay is involved.

1. **Once, on a PC over USB:** install the normal board-specific MicroPython UF2, select the board and connect. Open Menu → Wi-Fi upload → First time, enter the router's 2.4 GHz Wi-Fi credentials, then USB setup & save program. This stops the current program, installs the receiver and credentials, replaces `main.py` with the current blocks, and starts the write-mode receiver. No custom UF2 is needed.
2. **Pair:** use the displayed IP and 64-character device key. On a phone, open this same editor, select the same board and enter those values. Optionally remember connection settings. Grant the browser's local-network permission when prompted.
3. **Send:** select Wi-Fi as the upload connection, check the connection, close the dialog, then Save & run. The program goes directly to the board. After saving, the editor requests a reboot; it does not verify that the user program runs correctly.
4. **Next time:** power-cycle or reset using RUN–GND, then **press and release BOOT within 3 seconds AFTER reset**. Wait up to about 20 seconds for Wi-Fi, then reconnect and send from this editor. Holding BOOT through reset enters UF2 mode instead. No repeated USB setup is needed.

### Scope, safety and recovery

- The receiver runs only in write mode, not while the user program runs. Wireless stop, temporary execution, log streaming and JOG transport are not included. USB remains available; existing Wi-Fi JOG still uses its own AP. When leaving AP JOG to upload, reconnect the phone to the router's Wi-Fi too.
- Trusted LAN only: HTTP is unencrypted. A random 256-bit device key and exact Origin checks control access, but do not provide TLS confidentiality against LAN eavesdropping. Never expose the port through a router. Guest-network client isolation prevents access. Pico needs 2.4 GHz; the phone can use 5 GHz if bridged to the same LAN.
- Wi-Fi credentials and key live in `picoblocks-wifi.json` on the board. The editor does not persist the Wi-Fi password. Opt-in browser storage remembers the IP and key in localStorage; avoid it on shared browsers. Running setup again rotates the key.
- Up to 128 KiB, in 768-byte chunks, staged to a temporary file and SHA-256 verified before LittleFS same-directory rename replaces `main.py`. Interrupted / corrupt uploads preserve the old program. A lost commit response has an unknown save outcome: reconnect in write mode and resend. Real power-loss resilience is untested.
- USB Save & run preserves the separate receiver and credentials, including the BOOT hook. Setup replaces `main.py` with the current blocks. If another tool replaces `main.py`, repeat setup. Receiver upgrades and lost-key recovery also use USB setup.
- If DHCP changes the address, check the USB `PICOBLOCKS_UPLOAD` log or router. DHCP reservation is useful. The receiver does not register a `.local` name. Wi-Fi startup failure returns to USB REPL so credentials can be corrected.

Automated tests: `node tests/wifi.js`, `python tests/wifi_runtime.py`. They cover the actual receiver's HTTP/CORS parsing, authentication, partial/corrupt/oversize transfers, commit and restart request. Browser LAN permission and real-board checks remain separate.

## Boards and pins

PIO is not limited to a dedicated UART pin pair. The editor intentionally offers only the supported board's exposed connector pins, excluding internal LCD / microSD connections on GEEK boards.

| Board | Available servo DATA / GPIO pins | Onboard LED |
| --- | --- | --- |
| Raspberry Pi Pico | GP0–22, GP26–28 | GP25 |
| Raspberry Pi Pico W | GP0–22, GP26–28 | `LED` |
| Raspberry Pi Pico 2 | GP0–22, GP26–28 | GP25 |
| Raspberry Pi Pico 2 W | GP0–22, GP26–28 | `LED` |
| M5Stack ATOM Lite (development / untested) | G19, 21, 22, 23, 25, 26, 32, 33 | RGB white on/off (G27) |
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

Serial servos (SCS009, XL330, STS3215 and STS3235) are drawn as `GPIO -> 220 ohm series resistor -> DATA`: one resistor at the GPIO end of each bus, followed by the daisy-chained IDs. PWM servo wiring is unchanged. ATOM's conditional 2.2 kohm pull-up is a separate component connected on the DATA side of the 220 ohm resistor. Neither resistor provides voltage translation or 5 V input protection.

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
