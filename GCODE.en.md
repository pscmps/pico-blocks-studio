# Gcode / PlotterFlow

[Japanese](GCODE.md)

Nine blocks at the bottom of **Advanced blocks → Gcode** cover XY steps/mm, STEP/DIR drivers, PWM pen, controller initialization, USB line input, execute-and-reply, startup message, parsing and modal state. **Menu → Samples → PlotterFlow / Gcode receiver** loads the Pico 2 or Pico 2 W example. This replaces the board selection and blocks, keeps one restorable backup and does not run automatically.

## External hardware is required

**Never connect stepper motors directly to GPIO. Each axis needs an external STEP/DIR driver (such as a suitable TMC2209 carrier) and a rated external motor supply.**

| Function | Sample connection |
|---|---|
| X STEP / Y STEP | GP2 / GP3 (consecutive GPIOs) |
| X DIR / Y DIR | GP4 / GP5 |
| Shared EN | GP7, active Low |
| PWM pen | GP12, 50 Hz, up 1000 us / down 1800 us |
| XY scale | 80 steps/mm each |
| Driver VM | External motor supply positive |
| Driver VIO | Pico 3V3, only on compatible carriers |
| GND | Common to Pico, both drivers, motor supply and pen supply |

The left diagram shows functional terminals, not physical pin order or motor wire colors. Identify coil pairs A/B and wire with power off; avoid unplugging powered motors. Never connect VM to GPIO, 3V3 or VIO. Use a separately rated pen supply, not Pico power for motors or servos.

TMC UART, current and microstep configuration are not implemented. Configure the carrier according to its manual and match steps/mm to actual travel. Design EN to stay inactive during reset, with appropriate external biasing. Resistor values, supply ratings and current settings depend on the specific carrier. The [official TMC2209 documentation](https://www.analog.com/en/products/TMC2209.html) describes the IC, not every carrier board.

## Workflow

1. Install standard MicroPython and load the sample. Check pins, steps/mm and safe pen pulses.
2. Upload using **Save and run**. Motors start disabled; the pen moves to its up position.
3. Disconnect USB in PicoBlocks, then connect the same port from PlotterFlow using its experimental MicroPython RP STEP/DIR XY profile. One port cannot be open in two sites simultaneously.
4. Query M115; only enable with M17 after checking hardware and physical stopping arrangements. M18 disables the drivers.

Close PlotterFlow's port before reconnecting here for write mode. Existing HELP covers BOOT and startup behavior. Keep this program separate from USB/Wi-Fi JOG, PIO serial servos, interrupts and timers.

## Source mapping and intentional changes

Source: pscmps [plotterflow-micropython-rp / firmware/rp_stepdir](https://github.com/pscmps/plotterflow-micropython-rp/tree/0e4917ee24309520e9e147308ff75fe1d22e56f1/firmware/rp_stepdir), commit `0e4917ee24309520e9e147308ff75fe1d22e56f1`. Exact reference files are under `tests/fixtures/plotterflow`. No LICENSE file was present in the source repository at inspection; no new license is assigned to those reference files here.

- `board_config.py`: XY, STEP/DIR and PWM pen settings blocks.
- `main.py`: program start, four setup blocks, startup print, forever loop, USB line input and nonempty-line execute-and-reply print.
- `gcode.py`, `planner.py`, `protocol.py`: parser, modal state, XY interpolation and controller in generated Python. Parse-only returns a dictionary such as `{"command":"G1","words":{"G":1.0,"X":2.0}}`.
- `update_store.py` is not ported: PicoBlocks already provides saving, write mode and Wi-Fi upload. The generated program is self-contained.

**This recreates settings, receive flow and command behavior, not a byte-for-byte firmware image.** Ordinary command replies, coordinates, modal state and synchronized step sequences are compared with the pinned source. Intentional fixes:

- Avoid unavailable `findall` and optional `re.sub` APIs on MicroPython; preserve STOP during whitespace trimming.
- Explicit two-pin PIO SET configuration; drain FIFO and finish the last pulse before changing DIR.
- Reinitialize the state machine to flush FIFOs on stop instead of relying on `restart()`; support both EN polarities.
- Generate step events incrementally and do not retain an unbounded history.
- On program interruption or uncaught failure, disable drivers, stop PIO, set STEP Low and release PWM.
- As in the source, per-line exceptions produce `error:...` and keep receiving; they do not necessarily disable drivers.

## Prototype limitations

Supported: G0/G1, G90/G91, G20/G21, G92, M17/M18, M3/M5, M115 and STOP (0x85). G92 changes internal coordinates; it is not homing. Source G92 unit behavior and the distinction between Z and M3/M5 state are preserved. The `pen_down` state is the last M3/M5 command, not Z motion or measured position.

F is stored but does not control pulse speed. The source's 1 MHz PIO clock and FIFO delivery do not guarantee a constant feed rate or acceleration. The unused source MAX_FEED_MM_MIN setting is not exposed. No acceleration, homing, limits, travel bounds, feedback, arcs or real-time STOP. An `ok` reply is not measured arrival.

STOP cannot interrupt waiting for newline or Python queue processing. Provide a physical drive-power cutoff and test unloaded first. **Hardware, waveforms, lost steps and actual USB interoperability with PlotterFlow remain untested.**

Tests: `npm test` and `python tests/gcode_runtime.py`. The latter compares 1012 parser inputs, 1000 XY paths, command replies/state/step sequences, both EN polarities, FIFO reset and both generated receiver loops using fake GPIO/PIO.

References: [MicroPython re](https://docs.micropython.org/en/v1.29.0/library/re.html), [rp2](https://docs.micropython.org/en/v1.29.0/library/rp2.html).
