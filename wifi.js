/* Direct HTTPS editor -> local HTTP API. No downloads, proxies or Pico-hosted UI. */
const PicoWifi = (() => {
  const t = (...args) => globalThis.PicoI18n ? globalThis.PicoI18n.t(...args) : typeof args[0] === 'string' ? args[0] : String.raw({raw:args[0]}, ...args.slice(1));
  const MAX = 131072, CHUNK = 768;
  function address(value) {
    const input = value.trim().replace(/\/$/, '');
    const url = new URL(input.includes('://') ? input : 'http://' + input);
    const octets = url.hostname.split('.').map(Number);
    const privateIP = /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) && octets.every(n => n >= 0 && n <= 255) &&
      (octets[0] === 10 || octets[0] === 192 && octets[1] === 168 || octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31);
    if (url.protocol !== 'http:' || url.username || url.password || url.port || url.search || url.hash || url.pathname !== '/' ||
        !(privateIP || /^[a-z0-9-]+\.local$/i.test(url.hostname))) throw new Error(t('同じLANのIPアドレス、または.local名を入力してください。'));
    return url.origin;
  }
  const hex = bytes => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
  function newKey() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
  class Client {
    constructor(host, key, board, fetcher = globalThis.fetch.bind(globalThis)) {
      this.host = address(host);
      if (!/^[a-f0-9]{64}$/.test(key)) throw new Error(t('接続キーは64桁です。初回設定したPCからコピーしてください。'));
      this.key = key; this.board = board; this.fetcher = fetcher;
    }
    async request(path, data) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await this.fetcher(this.host + path, {
          method: data === undefined ? 'GET' : 'POST', mode:'cors', credentials:'omit', cache:'no-store', redirect:'error',
          headers: {'X-PicoBlocks-Key':this.key, ...(data === undefined ? {} : {'Content-Type':'application/json'})},
          body: data === undefined ? undefined : JSON.stringify(data), signal:controller.signal,
        });
        if (response.status === 401) throw new Error(t('接続キーが違います。'));
        const result = await response.json();
        if (!response.ok) throw new Error(t`ボードが要求を拒否しました (${response.status}): ${result.error || ''}`);
        return result;
      } catch (error) {
        if (error.name === 'AbortError' || error instanceof TypeError) throw new Error(t('応答がありません。書き込み待機・IP・同じLAN・ブラウザーのローカルネットワーク許可を確認してください。'));
        throw error;
      } finally { clearTimeout(timer); }
    }
    async status() {
      const result = await this.request('/status');
      if (result.protocol !== 1 || result.mode !== 'WRITE' || result.board !== this.board || result.max !== MAX)
        throw new Error(t('ボード選択または受信機能のバージョンが一致しません。USBで初回設定を確認してください。'));
      return result;
    }
    async upload(source, progress = () => {}) {
      const bytes = new TextEncoder().encode(source);
      if (!bytes.length || bytes.length > MAX) throw new Error(t('無線書き込みは128 KiBまでです。USBを使用してください。'));
      await this.status();
      const sha256 = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
      const {ticket} = await this.request('/begin', {size:bytes.length, sha256});
      if (!/^[a-f0-9]{32}$/.test(ticket)) throw new Error(t('受信機能の応答が不正です。'));
      for (let offset = 0; offset < bytes.length; offset += CHUNK) {
        const chunk = bytes.subarray(offset, offset + CHUNK);
        const result = await this.request('/chunk', {ticket, offset, data:btoa(String.fromCharCode(...chunk))});
        if (result.offset !== offset + chunk.length) throw new Error(t('転送位置が一致しません。もう一度送信してください。'));
        progress(Math.round(result.offset / bytes.length * 100));
      }
      // A lost commit reply is ambiguous: never claim the previous file is still present.
      const result = await this.request('/commit', {ticket});
      if (result.saved !== true) throw new Error(t('保存完了を確認できませんでした。'));
    }
  }
  function installCommand(receiver, config, source, bytesLiteral) {
    if (!['picow','pico2w','atom_lite'].includes(config.board) || !/^[a-f0-9]{64}$/.test(config.key)) throw new Error('Invalid configuration');
    // Install only the receiver/config and the explicitly requested current program.
    let command = 'import os, sys\n';
    const model = config.board === 'picow' ? 'Raspberry Pi Pico W' : 'Raspberry Pi Pico 2 W';
    command += config.board === 'atom_lite'
      ? "if sys.platform != 'esp32' or not getattr(sys.implementation, '_machine', '').endswith('with ESP32'):\n    raise ValueError('ATOM Lite needs standard ESP32_GENERIC firmware, not S3/C3 or UIFlow')\n"
      : `if not getattr(sys.implementation, '_machine', '').startswith(${JSON.stringify(model)}):\n    raise ValueError('Select the matching Pico W / Pico 2 W firmware and board')\n`;
    for (const [path, value] of [['_picoblocks_wifi.py',receiver],['picoblocks-wifi.json',JSON.stringify(config)]]) {
      command += `_pb_data = ${bytesLiteral(value)}\nwith open('${path}.tmp', 'wb') as _pb_file:\n    if _pb_file.write(_pb_data) != len(_pb_data):\n        raise OSError('Incomplete write')\nwith open('${path}.tmp', 'rb') as _pb_file:\n    if _pb_file.read() != _pb_data:\n        raise OSError('Verification failed')\nos.rename('${path}.tmp', '${path}')\nos.sync()\n`;
    }
    return command + PicoBoot.saveCommand(source, bytesLiteral, config.board) + '\ndel _pb_data\nimport gc\ngc.collect()\n';
  }

  let ui, client = null, board = '', busy = false;
  const $ = selector => document.querySelector(selector);
  const selected = () => !!ui && $('#transportSelect').value === 'wifi';
  function connected() { return !!client; }
  function render() {
    if (!ui) return;
    $('#transportSelect').disabled = busy;
    for (const id of ['wifiInstall','wifiCheck','wifiHost','wifiKey','wifiSsid','wifiPassword','wifiRemember']) $("#" + id).disabled = busy;
  }
  function setBusy(value) { busy = value; render(); }
  function configure(next, supported) {
    if (!ui) return;
    if (board !== next) client = null;
    board = next;
    $('#wifiTransport').hidden = !supported;
    $('#wifiMenuItem').hidden = !supported;
    if (!supported) $('#transportSelect').value = 'usb';
    ui.changed();
  }
  function message(text) { $('#wifiStatus').textContent = text; }
  function saveSettings() {
    try {
      if ($('#wifiRemember').checked) localStorage.setItem('picoblocks-wifi-v1', JSON.stringify({host:$('#wifiHost').value, key:$('#wifiKey').value}));
      else localStorage.removeItem('picoblocks-wifi-v1');
    } catch { /* Storage restrictions do not prevent sending. */ }
  }
  async function connect() {
    if (busy) return;
    ui.busy(true);
    client = null;
    try {
      const candidate = new Client($('#wifiHost').value, $('#wifiKey').value.trim(), board);
      await candidate.status();
      client = candidate;
      saveSettings();
      message(t('無線の書き込み待機に接続しました。この画面を閉じて「保存して実行」を押してください。'));
      ui.mode('WRITE');
    } catch (error) {
      message(error.message); ui.toast(error.message, 'error');
    } finally { ui.busy(false); }
  }
  function open() { ui.closeMenu(); $('#wifiDialog').showModal(); }
  async function upload(source) {
    if (!client || busy) { open(); return; }
    ui.busy(true);
    let saved = false;
    try {
      await client.upload(PicoBoot.wrap(source, board), percent => ui.progress(t`Wi-Fi転送中 ${percent}%`));
      saved = true;
      const result = await client.request('/run', {});
      if (!result.restarting) throw new Error(t('再起動を確認できませんでした。'));
      ui.mode('BOOT');
      ui.toast(t('保存完了。再起動を要求しました。実行中は無線書き込み接続が切れます。'), 'success');
    } catch (error) {
      const detail = saved ? t('保存済みですが、再起動の応答を確認できません。ボードを確認してください。') : t('転送が完了していません。保存状態が不明な場合は書き込み待機へ戻し、再送してください。');
      ui.toast(detail + ' ' + error.message, 'error');
    } finally { client = null; ui.busy(false); }
  }
  function init(callbacks) {
    ui = callbacks;
    try {
      const previous = JSON.parse(localStorage.getItem('picoblocks-wifi-v1'));
      if (previous) { $('#wifiHost').value = previous.host || ''; $('#wifiKey').value = previous.key || ''; $('#wifiRemember').checked = true; }
    } catch { /* Invalid stored settings are ignored. */ }
    $('#wifiMenuItem').addEventListener('click', open);
    $('#wifiClose').addEventListener('click', () => $('#wifiDialog').close());
    $('#wifiDialog').addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    $('#wifiCheck').addEventListener('click', connect);
    $('#transportSelect').addEventListener('change', () => { client = null; ui.changed(); if (selected()) open(); });
    for (const id of ['wifiHost','wifiKey']) $('#'+id).addEventListener('input', () => { client = null; ui.changed(); });
    $('#wifiRemember').addEventListener('change', saveSettings);
    $('#wifiInstall').addEventListener('click', async () => {
      if (busy) return;
      if (!ui.hasUSB()) { message(t('初回設定はPCでUSB接続してから行ってください。')); return; }
      const ssid = $('#wifiSsid').value, password = $('#wifiPassword').value;
      if (!ssid || new TextEncoder().encode(ssid).length > 32 || password.length < 8 || password.length > 63) {
        message(t('Wi-Fi名と8〜63文字のパスワードを入力してください。')); return;
      }
      const config = {board, ssid, password, key:newKey()};
      client = null;
      $('#wifiKey').value = config.key; // Retain the new key even if LAN startup fails.
      message(t('USBで受信機能と現在のプログラムを保存し、Wi-Fiへ接続しています…'));
      ui.busy(true);
      try {
        const response = await fetch('./firmware/_picoblocks_wifi.py', {cache:'no-store'});
        if (!response.ok) throw new Error(t('受信機能を取得できませんでした。'));
        const host = await ui.install(await response.text(), config);
        $('#wifiHost').value = address(host);
        saveSettings();
        message(t('初回設定が完了しました。スマホでは下のIPと接続キーを入力します。接続方法をWi-Fiに切り替えてください。'));
      } catch (error) {
        message(t('初回設定を完了できませんでした。USBのシリアル表示を確認してください。') + ' ' + error.message);
      } finally { $('#wifiPassword').value = ''; ui.busy(false); }
    });
    render();
  }
  return {Client, address, installCommand, init, configure, selected, connected, setBusy, open, upload};
})();
if (typeof module !== 'undefined') module.exports = PicoWifi;
