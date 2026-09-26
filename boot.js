/* Boot gate is installed only by Save and run, never by a temporary run. */
const PicoBoot = (() => {
  function wrap(source, board = 'pico') {
    const buttonCode = board === 'atom_lite'
      ? "from machine import Pin\n        _button = Pin(39, Pin.IN)\n        button = lambda: not _button.value()"
      : "import rp2\n        button = rp2.bootsel_button";
    return `# PicoBlocks managed main.py — boot gate v1
def _picoblocks_should_run():
    import time
    print('PICOBLOCKS_BOOT_WINDOW')
    try:
        ${buttonCode}
        started = time.ticks_ms()
        while time.ticks_diff(time.ticks_ms(), started) < 3000:
            if button():
                print('PICOBLOCKS_MODE WRITE')
                return False
            time.sleep_ms(20)
    except Exception:
        # Fail closed if the firmware cannot read BOOTSEL.
        print('PICOBLOCKS_MODE WRITE')
        print('PICOBLOCKS_ERROR Write-mode button unavailable; use current board firmware')
        return False
    print('PICOBLOCKS_MODE RUN')
    return True

if _picoblocks_should_run():
${source.split('\n').map(line => '    ' + line).join('\n')}
    print('PICOBLOCKS_FINISHED')
else:
    # Optional receiver is a separate file and survives USB/Wi-Fi program saves.
    try:
        import _picoblocks_wifi
    except ImportError:
        pass
    else:
        try:
            _picoblocks_wifi.serve()
        except Exception as _pb_wifi_error:
            print('PICOBLOCKS_UPLOAD_ERROR', _pb_wifi_error)
`;
  }
  function saveCommand(source, bytesLiteral, board = 'pico') {
    // Same-directory rename on the RP port's LittleFS replaces the file atomically.
    // If transfer or write fails, the old main.py is not truncated.
    return `import os
_pb_data = ${bytesLiteral(wrap(source, board))}
with open('main.py.picoblocks.tmp', 'wb') as _pb_file:
    if _pb_file.write(_pb_data) != len(_pb_data):
        raise OSError('Incomplete program write')
with open('main.py.picoblocks.tmp', 'rb') as _pb_file:
    if _pb_file.read() != _pb_data:
        raise OSError('Program verification failed')
os.rename('main.py.picoblocks.tmp', 'main.py')
os.sync()
print('PICOBLOCKS_SAVED')
`;
  }
  return {wrap, saveCommand};
})();
if (typeof module !== 'undefined') module.exports = PicoBoot;
