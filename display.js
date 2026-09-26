/* GEEK ST7789 text output. Pinning/orientation follow the existing GEEK C
 * implementation and Waveshare schematics; MicroPython supplies the font. */
const GeekDisplay = (() => {
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === "string" ? args[0] : String.raw({raw: args[0]}, ...args.slice(1));

  const supported = board => board === "rp2040_geek" || board === "rp2350_geek";
  const uses = blocks => blocks.some(b => b.type.startsWith("lcd_"));
  function register(Blockly) {
    const value = {type:"input_value", name:"VALUE"};
    Blockly.defineBlocksWithJsonArray([
      {type:"lcd_print", message0:t("LCDに %1 を改行して表示"), args0:[value], tooltip:t("GEEK内蔵LCDへ表示。英数字・記号で1行15文字、8行。長文は折り返し、下端でスクロールします。日本語は?に置換します。")},
      {type:"lcd_line", message0:t("LCDの %1 行目に %2 を表示"), args0:[{type:"field_number",name:"ROW",value:1,min:1,max:8,precision:1},value], tooltip:t("指定行を消して上書き。15文字まで。短い値に変わっても前の文字は残りません。")},
      {type:"lcd_clear", message0:t("LCDの文字をすべて消す"), tooltip:t("画面を黒くして、次の改行表示を1行目から始めます。")},
      {type:"lcd_usb_mirror", message0:t("USBシリアル表示をLCDにも %1"), args0:[{type:"field_dropdown",name:"ENABLED",options:[[t("表示する"),"1"],[t("表示しない"),"0"]]}], tooltip:t("「USBシリアルへ表示」ブロックの文字列をLCDへも表示します。USB受信・JOG通信・内部ログは対象外です。")},
    ].map(def=>({previousStatement:null,nextStatement:null,colour:175,...def})));
  }
  function toolbox(board) {
    if (!supported(board)) return [];
    const text = {shadow:{type:"basic_text",fields:{TEXT:"Hello, GEEK!"}}};
    return [{kind:"category",name:t("LCD文字表示"),colour:"#398e86",contents:[
      {kind:"block",type:"lcd_print",inputs:{VALUE:text}},
      {kind:"block",type:"lcd_line",inputs:{VALUE:text}},
      {kind:"block",type:"lcd_clear"}, {kind:"block",type:"lcd_usb_mirror"},
    ]}];
  }
  function statement(block, expression, blocks) {
    const value = () => expression(block.getInputTargetBlock("VALUE"), "''");
    switch(block.type) {
      case "lcd_print": return `_get_lcd().println(${value()})\n`;
      case "lcd_line": return `_get_lcd().line(${Number(block.getFieldValue("ROW"))}, ${value()})\n`;
      case "lcd_clear": return "_get_lcd().clear()\n";
      case "lcd_usb_mirror": return `_lcd_mirror = ${block.getFieldValue("ENABLED") === "1" ? "True" : "False"}\n`;
      case "basic_print": return uses(blocks) ? `_lcd_serial_print(${value()})\n` : null;
      default: return null;
    }
  }
  function runtime(blocks) { return uses(blocks) ? DRIVER : ""; }
  const DRIVER = String.raw`
from machine import SPI
import framebuf

class GeekTextLCD:
    # 240x135 landscape, 15 columns x 8 rows, 2x standard 8x8 font.
    def __init__(self):
        self.bl = Pin(25, Pin.OUT, value=0)
        self.cs = Pin(9, Pin.OUT, value=1)
        self.rst = Pin(12, Pin.OUT, value=1)
        self.spi = SPI(1, baudrate=24000000, polarity=0, phase=0,
                       sck=Pin(10), mosi=Pin(11))
        # SPI1 defaults MISO to GP8 on older firmware. We only transmit;
        # restore GP8 to GPIO output AFTER SPI init so it remains LCD D/C.
        self.dc = Pin(8, Pin.OUT, value=0)
        self.glyph = framebuf.FrameBuffer(bytearray(120), 120, 8, framebuf.MONO_HLSB)
        self.pixels = bytearray(480)
        self.lines = [''] * 8
        self.cursor = 0
        self.rst.value(0)
        time.sleep_ms(20)
        self.rst.value(1)
        time.sleep_ms(120)
        self.command(0x01)
        time.sleep_ms(150)
        self.command(0x11)
        time.sleep_ms(120)
        self.command(0x3a, b'\x55')
        self.command(0x36, b'\x70')
        self.command(0x21)
        self.command(0x13)
        self.command(0x29)
        time.sleep_ms(20)
        self.clear()
        self.bl.value(1)

    def command(self, cmd, data=None):
        self.cs.value(0)
        try:
            self.dc.value(0)
            self.spi.write(bytes([cmd]))
            if data is not None:
                self.dc.value(1)
                self.spi.write(data)
        finally:
            self.cs.value(1)

    def window(self, y, height):
        # Visible window inside ST7789 RAM, matching the existing GEEK C driver.
        y0, y1 = y + 53, y + 53 + height - 1
        self.command(0x2a, b'\x00\x28\x01\x17')
        self.command(0x2b, bytes([y0 >> 8, y0 & 255, y1 >> 8, y1 & 255]))
        self.command(0x2c)

    @staticmethod
    def clean(value):
        text = str(value)[:512].replace('\r\n', '\n').replace('\r', '\n').replace('\t', '    ')
        return ''.join(c if c == '\n' or 32 <= ord(c) <= 126 else '?' for c in text)

    def clear(self):
        self.lines = [''] * 8
        self.cursor = 0
        for i in range(480):
            self.pixels[i] = 0
        self.window(0, 135)
        self.dc.value(1)
        self.cs.value(0)
        try:
            for _ in range(135):
                self.spi.write(self.pixels)
        finally:
            self.cs.value(1)

    def draw_row(self, row):
        self.glyph.fill(0)
        self.glyph.text(self.lines[row], 0, 0, 1)
        self.window(row * 16, 16)
        self.dc.value(1)
        self.cs.value(0)
        try:
            for y in range(8):
                for x in range(120):
                    v = 255 if self.glyph.pixel(x, y) else 0
                    i = x * 4
                    self.pixels[i] = v
                    self.pixels[i + 1] = v
                    self.pixels[i + 2] = v
                    self.pixels[i + 3] = v
                self.spi.write(self.pixels)
                self.spi.write(self.pixels)
        finally:
            self.cs.value(1)

    def line(self, row, value):
        row = int(row)
        if not 1 <= row <= 8:
            raise ValueError('LCD row must be 1..8')
        self.lines[row - 1] = self.clean(value).split('\n')[0][:15]
        self.draw_row(row - 1)

    def println(self, value):
        rows = []
        for paragraph in self.clean(value).split('\n'):
            rows.extend([paragraph[i:i + 15] for i in range(0, len(paragraph), 15)] or [''])
        for line in rows:
            if self.cursor >= 8:
                self.lines = self.lines[1:] + ['']
                self.cursor = 7
            self.lines[self.cursor] = line
            self.cursor += 1
        for row in range(8):
            self.draw_row(row)

_lcd = None
_lcd_mirror = False

def _get_lcd():
    global _lcd
    if _lcd is None:
        _lcd = GeekTextLCD()
    return _lcd

def _lcd_serial_print(value):
    print(value)
    if _lcd_mirror:
        _get_lcd().println(value)
`;
  return {supported,uses,register,toolbox,statement,runtime,DRIVER};
})();
if (typeof module !== "undefined") module.exports = GeekDisplay;
