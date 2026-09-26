/* Shared USB / Wi-Fi JOG model and board-hosted controller. */
const PicoJog = (() => {
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === "string" ? args[0] : String.raw({raw: args[0]}, ...args.slice(1));

  const axes = ["Y", "X", "Z", "R"];
  const keys = { ArrowUp: ["Y", 1], ArrowDown: ["Y", -1], ArrowLeft: ["X", -1], ArrowRight: ["X", 1], KeyW: ["Z", 1], KeyS: ["Z", -1], KeyA: ["R", -1], KeyD: ["R", 1] };
  function defaults(scs) {
    return Object.fromEntries(axes.map((axis, index) => [axis, { id: scs ? index + 1 : null, center: 511, step: 10, speed: 500 }]));
  }
  function label(config) {
    if (config.id === null) return t("汎用値");
    const target = config.target || "scs009";
    return target === "pwm" ? `PWM ${config.id} · °` : `${target.toUpperCase()} ID ${config.id}`;
  }
  function mobilePage(config) {
    const labels = { Y: ["↑", "↓"], X: ["→", "←"], Z: ["W", "S"], R: ["D", "A"] };
    return t`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PicoBlocks JOG</title>
<style>body{font:16px system-ui;color:#273345;background:#fafafa;max-width:520px;margin:auto;padding:24px}h1{font-size:24px}p{color:#697485}section{display:grid;grid-template-columns:1fr 70px 70px 70px;align-items:center;gap:8px;padding:18px 0;border-bottom:1px solid #e1e5eb}button{touch-action:manipulation;font:600 20px system-ui;border:1px solid #dedbea;border-radius:12px;background:#f2f0fb;color:#51458a;min-height:58px}button:disabled{opacity:.4}output{text-align:center;font-variant-numeric:tabular-nums}.center{width:100%;margin-top:24px;font-size:16px}</style>
<h1>PicoBlocks JOG</h1><p id="status">接続を確認しています…</p>
${axes.map(axis => `<section><span>${label(config[axis])}</span><button disabled data-axis="${axis}" data-dir="-1">${labels[axis][1]}</button><output id="${axis}">—</output><button disabled data-axis="${axis}" data-dir="1">${labels[axis][0]}</button></section>`).join("")}
<button disabled class="center" id="center">中央へ戻す · Space</button><p>各行のボタン、または同じキーで操作できます。<br>ボタン1回／キー入力1回で設定した幅だけ動きます。</p>
<script>
const keys=${JSON.stringify(keys)};let busy=false,online=false,lastKey=0;
async function request(path){if(busy)return;busy=true;try{const r=await fetch(path,{method:path==='/state'?'GET':'POST',cache:'no-store',signal:AbortSignal.timeout(2000)});if(!r.ok)throw Error();const v=await r.json();for(const a of Object.keys(v))document.getElementById(a).textContent=v[a];online=true;document.getElementById('status').textContent='接続済み · 表示は指令位置です';}catch(e){online=false;document.getElementById('status').textContent='通信できません。PicoのWi-Fi接続を確認してください。';}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=!online);}}
document.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>request('/jog/'+b.dataset.axis+'/'+b.dataset.dir));
document.getElementById('center').onclick=()=>request('/center');
document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target.closest('input,textarea,select,[contenteditable=true]'))return;if(!keys[e.code]&&e.code!=='Space')return;e.preventDefault();if(!online||document.hidden)return;if(e.repeat&&Date.now()-lastKey<100)return;lastKey=Date.now();if(e.code==='Space'){if(!e.repeat)request('/center');}else request('/jog/'+keys[e.code].join('/'));});
request('/state');setInterval(()=>{if(!document.hidden)request('/state')},1500);
</script></html>`;
  }
  function runtime(config, wifi) {
    const pyConfig = JSON.stringify(config).replace(/null/g, "None");
    let code = `
_jog_config = ${pyConfig}
controller_values = {a: c['center'] for a, c in _jog_config.items()}
_controller_input = select.poll()
_controller_input.register(sys.stdin, select.POLLIN)
_controller_buffer = ''
_controller_discard = False

def _apply_controller_value(axis, value):
    config = _jog_config[axis]
    value = max(config.get('min', 0), min(config.get('max', 1023), int(value)))
    if config['id'] is not None:
        target = config.get('target', 'scs009')
        if target == 'pwm':
            pwm_servos[config['id']].angle(value)
        elif target == 'xl330':
            xl330.move(config['id'], value, config['speed'])
        elif target == 'sts3215':
            sts3215.move(config['id'], value, config['speed'])
        elif target == 'sts3235':
            sts3235.move(config['id'], value, config['speed'])
        else:
            scs009.move(config['id'], value, 0, config['speed'])
    controller_values[axis] = value

def _jog_delta(axis, direction):
    if axis not in _jog_config or direction not in (-1, 1):
        raise ValueError('Invalid JOG command')
    _apply_controller_value(axis, controller_values[axis] + _jog_config[axis]['step'] * direction)

def _jog_center():
    for axis in _jog_config:
        _apply_controller_value(axis, _jog_config[axis]['center'])

def _jog_report():
    print('PICOBLOCKS_STATE ' + json.dumps(controller_values))

def _controller_usb_poll():
    global _controller_buffer, _controller_discard
    for _ in range(64):
        if not _controller_input.poll(0):
            break
        char = sys.stdin.read(1)
        if not char:
            break
        if char == '\\n':
            line = _controller_buffer
            _controller_buffer = ''
            if _controller_discard:
                _controller_discard = False
                continue
            parts = line.strip().split()
            try:
                if parts == ['CENTER']:
                    _jog_center()
                elif len(parts) == 3 and parts[1] in _jog_config:
                    if parts[0] == 'DELTA':
                        _jog_delta(parts[1], int(parts[2]))
                    elif parts[0] == 'JOG':
                        _apply_controller_value(parts[1], int(parts[2]))
                _jog_report()
            except (ValueError, OSError) as error:
                print('PICOBLOCKS_ERROR ' + str(error))
        elif not _controller_discard:
            _controller_buffer += char
            if len(_controller_buffer) > 80:
                _controller_buffer = ''
                _controller_discard = True
`;
    if (wifi) code += wifiRuntime(wifi, mobilePage(config));
    code += `
def _controller_poll():
    _controller_usb_poll()
    ${wifi ? "_wifi_poll()" : "pass"}

def _controller_wait(ms):
    end = time.ticks_add(time.ticks_ms(), ms)
    while time.ticks_diff(end, time.ticks_ms()) > 0:
        _controller_poll()
        time.sleep_ms(5)
`;
    return code;
  }
  function wifiRuntime(wifi, html) {
    return `
import network
import socket
if '_wifi_server' in globals():
    _wifi_server.close()
    for item in _wifi_clients:
        item[0].close()
_wifi_ssid = ${JSON.stringify(wifi.ssid)}
_wifi_password = ${JSON.stringify(wifi.password)}
if not (1 <= len(_wifi_ssid.encode()) <= 32) or not (8 <= len(_wifi_password) <= 63) or not all(32 <= ord(c) <= 126 for c in _wifi_password):
    raise ValueError('Wi-Fi: SSID 1-32 bytes, password 8-63 ASCII characters')
_wifi_ap = network.WLAN(network.AP_IF)
_wifi_ap.active(False)
_wifi_ap.config(ssid=_wifi_ssid, key=_wifi_password, security=network.WLAN.SEC_WPA_WPA2)
_wifi_ap.active(True)
_wifi_deadline = time.ticks_add(time.ticks_ms(), 10000)
while not _wifi_ap.active():
    if time.ticks_diff(_wifi_deadline, time.ticks_ms()) <= 0:
        raise RuntimeError('Wi-Fi start timeout')
    time.sleep_ms(50)
_wifi_server = socket.socket()
_wifi_server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
_wifi_server.bind(('0.0.0.0', 80))
_wifi_server.listen(2)
_wifi_server.setblocking(False)
_wifi_clients = []
_wifi_page = ${JSON.stringify(html)}.encode('utf-8')
print('PICOBLOCKS_WIFI http://' + _wifi_ap.ifconfig()[0] + '/')

def _wifi_response(status, body, content_type='application/json'):
    return ('HTTP/1.1 ' + status + '\\r\\nContent-Type: ' + content_type + '\\r\\nCache-Control: no-store\\r\\nConnection: close\\r\\nContent-Length: ' + str(len(body)) + '\\r\\n\\r\\n').encode() + body

def _wifi_route(raw):
    try:
        head = raw.decode().split('\\r\\n')
        method, path, version = head[0].split()
        headers = {}
        for line in head[1:]:
            if ':' in line:
                key, value = line.split(':', 1)
                headers[key.lower()] = value.strip()
        if method == 'GET' and path == '/':
            return _wifi_response('200 OK', _wifi_page, 'text/html; charset=utf-8')
        if method == 'GET' and path == '/state':
            return _wifi_response('200 OK', json.dumps(controller_values).encode())
        if method != 'POST':
            return _wifi_response('405 Method Not Allowed', b'{}')
        if headers.get('origin') != 'http://' + headers.get('host', ''):
            return _wifi_response('403 Forbidden', b'{}')
        if path == '/center':
            _jog_center()
        elif path.startswith('/jog/'):
            _, _, axis, direction = path.split('/')
            _jog_delta(axis, int(direction))
        else:
            return _wifi_response('404 Not Found', b'{}')
        _jog_report()
        return _wifi_response('200 OK', json.dumps(controller_values).encode())
    except (ValueError, KeyError, UnicodeError):
        return _wifi_response('400 Bad Request', b'{}')
    except OSError as error:
        print('PICOBLOCKS_ERROR ' + str(error))
        return _wifi_response('503 Service Unavailable', b'{}')

def _wifi_poll():
    try:
        client, addr = _wifi_server.accept()
        client.setblocking(False)
        if len(_wifi_clients) >= 2:
            client.close()
        else:
            _wifi_clients.append([client, b'', None, 0, time.ticks_ms()])
    except OSError:
        pass
    for item in _wifi_clients[:]:
        client, request, response, offset, started = item
        close = time.ticks_diff(time.ticks_ms(), started) > 3000
        try:
            if not close and response is None:
                try:
                    data = client.recv(512)
                except OSError as error:
                    if error.args[0] not in (11, 35):
                        raise
                    continue
                if not data:
                    close = True
                else:
                    request += data
                    item[1] = request
                    if len(request) > 2048:
                        close = True
                    elif b'\\r\\n\\r\\n' in request:
                        item[2] = _wifi_route(request)
            elif not close:
                try:
                    sent = client.send(memoryview(response)[offset:offset + 512])
                    item[3] += sent
                    close = not sent or item[3] >= len(response)
                except OSError as error:
                    if error.args[0] not in (11, 35):
                        raise
        except OSError:
            close = True
        if close:
            client.close()
            _wifi_clients.remove(item)
`;
  }
  return { axes, keys, defaults, runtime, mobilePage, label };
})();
if (typeof module !== "undefined") module.exports = PicoJog;
