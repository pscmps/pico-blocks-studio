/* MicroPython ports of the user's XL330 / STS3215 C protocol implementations.
 * No EEPROM configuration is changed automatically. See README for scope. */
const ServoBlocks = (() => {
  const models = {
    xl330: { name: "XL330", colour: 204, center: 2048, max: 4095, speed: 20, baud: "57600" },
    sts3215: { name: "STS3215", colour: 330, center: 2048, max: 4095, speed: 500, baud: "1000000" },
    pwm: { name: "PWMサーボ", colour: 42, center: 90, max: 180, speed: 0 },
    sts3235: { name: "STS3235", colour: 350, center: 2048, max: 4095, speed: 500, baud: "1000000" },
  };
  const axes = [["↑ ↓", "Y"], ["← →", "X"], ["W S", "Z"], ["A D", "R"]];
  const num = (name, value, min, max) => ({ type: "field_number", name, value, min, max, precision: 1 });
  function register(Blockly, pinOptions) {
    const defs = [];
    for (const [key, m] of Object.entries(models)) {
      Blockly.Blocks[key + "_setup"] = { init() {
        this.appendDummyInput().appendField(m.name + "を接続");
        this.appendDummyInput().appendField(key === "pwm" ? "信号" : "DATA").appendField(new Blockly.FieldDropdown(pinOptions), "PIN");
        if (key === "pwm") {
          this.appendDummyInput().appendField("番号").appendField(new Blockly.FieldNumber(1, 1, 16, 1), "CHANNEL");
          this.appendDummyInput().appendField("0°").appendField(new Blockly.FieldNumber(1000, 500, 2500, 1), "MIN_US").appendField("µs / 180°").appendField(new Blockly.FieldNumber(2000, 500, 2500, 1), "MAX_US").appendField("µs");
          this.setTooltip("50 HzのPWM出力。接続だけでは動かしません。サーボの仕様に合わせてパルス幅を調整してください。");
        } else {
          const baud = [["57600 bps", "57600"], ["115200 bps", "115200"], ["1 Mbps", "1000000"]];
          this.appendDummyInput().appendField("通信速度").appendField(new Blockly.FieldDropdown(baud), "BAUD");
          this.setFieldValue(m.baud, "BAUD");
          this.setTooltip("GPIO 1本でPIO半二重通信。接続だけではトルクを有効にしません。1種類につき接続ブロックは1個です。");
        }
        this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(m.colour);
      }};
      const add = (suffix, content) => defs.push({ type: key + "_" + suffix, previousStatement: null, nextStatement: null, colour: m.colour, ...content });
      const id = () => num("ID", 1, 0, key === "xl330" ? 252 : 253);
      if (key !== "pwm") {
        add("ping", { message0: `${m.name} ID %1 の接続を確認`, args0: [id()], tooltip: "Ping応答をシリアル欄へ表示します。移動しません。" });
        add("read", { message0: `${m.name} ID %1 の現在位置を読む`, args0: [id()], tooltip: "サーボから読み取った実測位置をシリアル欄へ表示します。" });
        add("torque", { message0: `${m.name} ID %1 のトルクを %2`, args0: [id(), { type: "field_dropdown", name: "STATE", options: [["ON", "1"], ["OFF", "0"]] }], tooltip: "ON時は現在位置を目標へ設定してから有効化します。標準の単回転位置モード専用です。" });
        add("move", { message0: `${m.name} ID %1 を位置 %2 へ`, args0: [id(), num("POSITION", m.center, 0, m.max)], message1: "速度値 %1  加速度値 %2", args1: [num("SPEED", m.speed, 1, key === "xl330" ? 100 : 3400), num("ACCEL", 20, 1, 100)], tooltip: "0〜4095の単回転位置。先にトルクONを置いてください。EEPROMや動作モードは変更しません。" });
      } else {
        add("move", { message0: "PWMサーボ %1 を %2 °へ", args0: [num("CHANNEL", 1, 1, 16), num("ANGLE", 90, 0, 180)] });
        add("pulse", { message0: "PWMサーボ %1 のパルス幅を %2 µsに", args0: [num("CHANNEL", 1, 1, 16), num("PULSE", 1500, 500, 2500)], tooltip: "接続ブロックで設定した上下限の範囲内だけを出力します。" });
        add("stop", { message0: "PWMサーボ %1 の出力を停止", args0: [num("CHANNEL", 1, 1, 16)], tooltip: "PWM信号を停止します。保持力の挙動はサーボに依存します。" });
      }
      add("bind", { message0: `JOGの %1 を ${m.name} ${key === "pwm" ? "番号" : "ID"} %2 に割り当て`, args0: [{ type: "field_dropdown", name: "AXIS", options: axes }, num("ID", 1, key === "pwm" ? 1 : 0, key === "pwm" ? 16 : key === "xl330" ? 252 : 253)], message1: "中央 %1  増減幅 %2" + (key === "pwm" ? "（度）" : "  速度値 %3"), args1: [num("CENTER", m.center, 0, m.max), num("STEP", key === "pwm" ? 2 : 10, 1, m.max), ...(key === "pwm" ? [] : [num("SPEED", m.speed, 1, key === "xl330" ? 100 : 3400)])] });
    }
    for (const def of defs) {
      if (def.args1?.some(field => field.name === "SPEED")) {
        def.message1 = def.message1.replace("速度値", "速度値（機種固有）");
        def.tooltip = (def.tooltip || "") + " 速度値はサーボへ渡す設定値です。時間（ms）ではなく、同じ値でも機種によって速さが異なります。";
      }
    }
    Blockly.defineBlocksWithJsonArray(defs);
  }
  function toolbox() {
    return Object.entries(models).map(([key, m]) => ({ kind: "category", name: m.name, colour: String(m.colour), contents: ["setup", ...(key === "pwm" ? ["move", "pulse", "stop"] : ["ping", "read", "torque", "move"]), "value", "bind"].map(s => ({ kind: "block", type: key + "_" + s, ...(s === "value" ? {inputs: {VALUE: {shadow: {type:"basic_number",fields:{NUM:m.center}}}}} : {}) })) }));
  }
  function statement(block) {
    const [model, op] = block.type.split("_");
    if (!models[model]) return null;
    const n = name => Number(block.getFieldValue(name));
    if (op === "setup" || op === "bind") return "pass  # サーボ接続・JOG設定は先頭で準備済み\n";
    if (model === "pwm") {
      const method = { move: `angle(${n("ANGLE")})`, pulse: `pulse(${n("PULSE")})`, stop: "stop()" }[op];
      return method ? `pwm_servos[${n("CHANNEL")}].${method}\n` : null;
    }
    if (op === "ping" || op === "read") return `print("${models[model].name} ID ${n("ID")} ${op}:", ${model}.${op === "read" ? "position" : "ping"}(${n("ID")}))\n`;
    if (op === "torque") return `${model}.torque(${n("ID")}, ${n("STATE") ? "True" : "False"})\n`;
    if (op === "move") return `${model}.move(${n("ID")}, ${n("POSITION")}, ${n("SPEED")}, ${n("ACCEL")})\n`;
    return null;
  }
  function runtime(blocks) {
    const setups = blocks.filter(b => /^(xl330|sts3215|sts3235|pwm)_setup$/.test(b.type));
    let code = setups.some(b => b.type !== "pwm_setup") ? BUS_DRIVER : "";
    if (setups.some(b => b.type === "xl330_setup")) code += XL330_DRIVER;
    if (setups.some(b => /^sts(3215|3235)_setup$/.test(b.type))) code += STS_DRIVER;
    if (setups.some(b => b.type === "pwm_setup")) code += PWM_DRIVER + "\npwm_servos = {}\n";
    let nextSm = blocks.some(b => b.type === "scs009_setup") ? 2 : 0;
    for (const b of setups) {
      const n = name => Number(b.getFieldValue(name));
      if (b.type === "pwm_setup") code += `pwm_servos[${n("CHANNEL")}] = PWMServo(${n("PIN")}, ${n("MIN_US")}, ${n("MAX_US")})\n`;
      else {
        const key = b.type.split("_")[0];
        code += `${key} = ${key === "xl330" ? "XL330" : key === "sts3235" ? "STS3235" : "STS3215"}(ServoBus(${n("PIN")}, ${n("BAUD")}, ${nextSm}))\n`;
        nextSm += 2;
      }
    }
    return code;
  }
  const BUS_DRIVER = String.raw`
import rp2

# TX releases the line and opens the RX gate entirely inside PIO.
# Only PIO0 is used: up to two buses, leaving PIO1 free for Pico W Wi-Fi.
@rp2.asm_pio(out_init=rp2.PIO.IN_HIGH, set_init=rp2.PIO.IN_HIGH,
             sideset_init=rp2.PIO.IN_HIGH, out_shiftdir=rp2.PIO.SHIFT_RIGHT)
def _servo_tx():
    pull()
    out(y, 32)
    set(pindirs, 1).side(1)
    label("byte")
    pull()
    set(x, 7).side(0) [7]
    label("bit")
    out(pins, 1) [6]
    jmp(x_dec, "bit")
    nop().side(1) [7]
    jmp(y_dec, "byte")
    set(pindirs, 0)
    irq(rel(4))

@rp2.asm_pio(in_shiftdir=rp2.PIO.SHIFT_RIGHT, autopush=True,
             push_thresh=8, fifo_join=rp2.PIO.JOIN_RX)
def _servo_rx():
    wait(1, irq, rel(7))
    wrap_target()
    wait(0, pin, 0)
    set(x, 7) [10]
    label("bit")
    in_(pins, 1)
    jmp(x_dec, "bit") [6]
    wait(1, pin, 0)
    wrap()

def _bounded(value, low, high):
    value = int(value)
    if not low <= value <= high:
        raise ValueError('Servo value out of range: ' + str(value))
    return value

def _le(value, size):
    return bytes((int(value) >> (8 * i)) & 255 for i in range(size))

class ServoBus:
    def __init__(self, pin, baud, sm):
        self.pin = Pin(pin, Pin.IN, Pin.PULL_UP)
        self.baud = int(baud)
        self.tx = rp2.StateMachine(sm, _servo_tx, freq=self.baud * 8,
                                  out_base=self.pin, set_base=self.pin, sideset_base=self.pin)
        self.rx = rp2.StateMachine(sm + 1)
        self.tx.active(1)
        self.tx.exec('set(pindirs, 0)')

    def exchange(self, packet, protocol, timeout_ms=80):
        self.rx.active(0)
        while self.rx.rx_fifo():
            self.rx.get()
        self.tx.exec('irq(clear, rel(4))')
        self.rx.init(_servo_rx, freq=self.baud * 8, in_base=self.pin)
        self.rx.active(1)
        header = b'\xff\xff\xfd\x00' if protocol == 2 else b'\xff\xff'
        response = bytearray()
        deadline = time.ticks_add(time.ticks_ms(), timeout_ms)
        try:
            self.tx.put(len(packet) - 1)
            for value in packet:
                self.tx.put(value)
            while time.ticks_diff(deadline, time.ticks_ms()) > 0:
                if not self.rx.rx_fifo():
                    continue
                response.append(self.rx.get() >> 24)
                while len(response) >= len(header) and response[:len(header)] != header:
                    del response[0]
                if len(response) >= (7 if protocol == 2 else 4):
                    total = 7 + response[5] + (response[6] << 8) if protocol == 2 else response[3] + 4
                    if total < (11 if protocol == 2 else 6) or total > 128:
                        raise ValueError('Invalid servo packet length')
                    if len(response) == total:
                        return response
            raise OSError('Servo timeout: check ID, baud, power, and status return setting')
        finally:
            # Never leave DATA driven after a timeout or interruption.
            self.tx.active(0)
            self.tx.init(_servo_tx, freq=self.baud * 8, out_base=self.pin,
                         set_base=self.pin, sideset_base=self.pin)
            self.tx.exec('set(pindirs, 0)')
            self.tx.active(1)
            self.rx.active(0)
`;
  const XL330_DRIVER = String.raw`
class XL330:
    def __init__(self, bus):
        self.bus = bus

    @staticmethod
    def crc(data):
        crc = 0
        for value in data:
            crc ^= value << 8
            for _ in range(8):
                crc = ((crc << 1) ^ (0x8005 if crc & 0x8000 else 0)) & 0xffff
        return crc

    @staticmethod
    def packet(servo_id, instruction, params=b''):
        _bounded(servo_id, 0, 252)
        body = bytearray()
        for value in bytes([instruction]) + params:
            body.append(value)
            if body[-3:] == b'\xff\xff\xfd':
                body.append(0xfd)
        packet = b'\xff\xff\xfd\x00' + bytes([servo_id]) + _le(len(body) + 2, 2) + body
        return packet + _le(XL330.crc(packet), 2)

    def request(self, servo_id, instruction, params=b''):
        data = self.bus.exchange(self.packet(servo_id, instruction, params), 2)
        if len(data) < 11 or data[:4] != b'\xff\xff\xfd\x00' or data[4] != servo_id or len(data) != 7 + data[5] + (data[6] << 8):
            raise ValueError('XL330 invalid response')
        if self.crc(data[:-2]) != data[-2] + (data[-1] << 8):
            raise ValueError('XL330 CRC mismatch')
        body = bytes(data[7:-2]).replace(b'\xff\xff\xfd\xfd', b'\xff\xff\xfd')
        if body[0] != 0x55 or body[1] != 0:
            raise OSError('XL330 status error: ' + str(body[1]))
        return body[2:]

    def read(self, servo_id, address, size):
        data = self.request(servo_id, 2, _le(address, 2) + _le(size, 2))
        if len(data) != size:
            raise ValueError('XL330 read length mismatch')
        return data

    def write(self, servo_id, address, data):
        self.request(servo_id, 3, _le(address, 2) + data)

    def ping(self, servo_id):
        data = self.request(servo_id, 1)
        if len(data) != 3:
            raise ValueError('XL330 ping length mismatch')
        return {'model': data[0] + (data[1] << 8), 'firmware': data[2]}

    def position(self, servo_id):
        data = self.read(servo_id, 132, 4)
        value = sum(data[i] << (i * 8) for i in range(4))
        return value - 0x100000000 if value & 0x80000000 else value

    def check_mode(self, servo_id):
        if self.read(servo_id, 11, 1)[0] != 3 or self.read(servo_id, 10, 1)[0] & 4:
            raise ValueError('XL330 needs position mode 3 and velocity-based profile; settings are not changed automatically')

    def move(self, servo_id, position, speed=20, acceleration=20):
        position = _bounded(position, 0, 4095)
        speed = _bounded(speed, 1, 100)
        acceleration = _bounded(acceleration, 1, 100)
        self.check_mode(servo_id)
        self.write(servo_id, 108, _le(acceleration, 4) + _le(speed, 4) + _le(position, 4))

    def torque(self, servo_id, enabled):
        if enabled:
            self.move(servo_id, self.position(servo_id))
        self.write(servo_id, 64, bytes([1 if enabled else 0]))
`;
  const STS_DRIVER = String.raw`
class STS3215:
    def __init__(self, bus):
        self.bus = bus

    @staticmethod
    def packet(servo_id, instruction, params=b''):
        _bounded(servo_id, 0, 253)
        body = bytes([servo_id, len(params) + 2, instruction]) + params
        return b'\xff\xff' + body + bytes([(~sum(body)) & 255])

    def request(self, servo_id, instruction, params=b''):
        data = self.bus.exchange(self.packet(servo_id, instruction, params), 1)
        if len(data) < 6 or data[:2] != b'\xff\xff' or data[2] != servo_id or len(data) != data[3] + 4:
            raise ValueError('STS invalid response')
        if ((~sum(data[2:-1])) & 255) != data[-1]:
            raise ValueError('STS checksum mismatch')
        if data[4]:
            raise OSError('STS status error: ' + str(data[4]))
        return data[5:-1]

    def read(self, servo_id, address, size):
        data = self.request(servo_id, 2, bytes([address, size]))
        if len(data) != size:
            raise ValueError('STS read length mismatch')
        return data

    def write(self, servo_id, address, data):
        self.request(servo_id, 3, bytes([address]) + data)

    def ping(self, servo_id):
        self.request(servo_id, 1)
        return True

    def position(self, servo_id):
        data = self.read(servo_id, 56, 2)
        raw = data[0] | (data[1] << 8)
        return -(raw & 0x7fff) if raw & 0x8000 else raw

    def check_mode(self, servo_id):
        if self.read(servo_id, 33, 1)[0] != 0 or self.read(servo_id, 18, 1)[0] & 16 or self.read(servo_id, 11, 2) == b'\x00\x00':
            raise ValueError('STS needs single-turn position mode; multi-turn EEPROM settings are not changed automatically')

    def move(self, servo_id, position, speed=500, acceleration=20):
        position = _bounded(position, 0, 4095)
        speed = _bounded(speed, 1, 3400)
        acceleration = _bounded(acceleration, 1, 100)
        self.check_mode(servo_id)
        self.write(servo_id, 41, bytes([acceleration]) + _le(position, 2) + b'\x00\x00' + _le(speed, 2))

    def torque(self, servo_id, enabled):
        if enabled:
            self.move(servo_id, self.position(servo_id))
        self.write(servo_id, 40, bytes([1 if enabled else 0]))

# STS3235 uses the STS little-endian control table and single-turn commands.
class STS3235(STS3215):
    pass
`;
  const PWM_DRIVER = String.raw`
from machine import PWM

class PWMServo:
    def __init__(self, pin, minimum=1000, maximum=2000):
        self.minimum, self.maximum = int(minimum), int(maximum)
        if not 500 <= self.minimum < self.maximum <= 2500:
            raise ValueError('PWM pulse range must satisfy 500 <= min < max <= 2500 us')
        self.pin = Pin(pin, Pin.OUT, value=0)
        self.pwm = PWM(self.pin, freq=50, duty_u16=0)

    def pulse(self, microseconds):
        value = int(microseconds)
        if not self.minimum <= value <= self.maximum:
            raise ValueError('PWM pulse is outside the configured range')
        self.pwm.duty_ns(value * 1000)

    def angle(self, degrees):
        degrees = float(degrees)
        if not 0 <= degrees <= 180:
            raise ValueError('PWM angle must be 0..180')
        self.pulse(round(self.minimum + (self.maximum - self.minimum) * degrees / 180))

    def stop(self):
        self.pwm.duty_u16(0)
`;
  return { models, register, toolbox, statement, runtime, BUS_DRIVER, XL330_DRIVER, STS_DRIVER, PWM_DRIVER };
})();
if (typeof module !== "undefined") module.exports = ServoBlocks;
