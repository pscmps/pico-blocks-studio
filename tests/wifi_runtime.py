"""Run the actual MicroPython upload logic under CPython; no board is contacted."""
import sys
sys.dont_write_bytecode = True
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import types

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wifi_receiver', ROOT / 'firmware/_picoblocks_wifi.py')
wifi = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wifi)
ticks = [100]
wifi.time = types.SimpleNamespace(ticks_ms=lambda:ticks[0], ticks_diff=lambda a,b:a-b)
# Windows rename cannot replace files; emulate RP2 LittleFS's atomic replace.
wifi.os = types.SimpleNamespace(remove=os.remove, rename=os.replace, sync=lambda:None, urandom=os.urandom)
config = {'board':'picow','key':'ab'*32,'ssid':'test','password':'not-a-real-password'}
headers = {'origin':wifi.ORIGIN,'x-picoblocks-key':config['key'],'content-type':'application/json'}

def post(upload, path, data):
    return upload.handle('POST',path,headers,json.dumps(data).encode())

def begin(upload, program):
    status, response = post(upload,'/begin',{'size':len(program),'sha256':hashlib.sha256(program).hexdigest()})
    assert status == 200
    return response['ticket']

def chunks(upload, program, ticket):
    for offset in range(0,len(program),768):
        data=program[offset:offset+768]
        status,response=post(upload,'/chunk',{'ticket':ticket,'offset':offset,'data':base64.b64encode(data).decode()})
        assert status == 200 and response['offset'] == offset+len(data)

class Socket:
    def __init__(self, data): self.data=data; self.sent=b''; self.closed=False
    def recv(self,n):
        part,self.data=self.data[:min(n,31)],self.data[min(n,31):]
        return part
    def settimeout(self,t): pass
    def send(self,data): self.sent+=data[:17];return min(len(data),17)
    def close(self): self.closed=True

original_cwd = os.getcwd()
with tempfile.TemporaryDirectory(prefix='picoblocks-wifi-test-') as directory:
    try:
        os.chdir(directory)
        old=b'print("old")\n'
        Path('main.py').write_bytes(old)
        upload=wifi.Upload(config)
        for origin in [None,'https://evil.example','null','http://pscmps.github.io']:
            bad=dict(headers);bad['origin']=origin
            assert upload.handle('POST','/begin',bad,b'{}')[0]==403
        for key in ['', '00'*32]:
            bad=dict(headers);bad['x-picoblocks-key']=key
            assert upload.handle('POST','/begin',bad,b'{}')[0]==401
        assert not Path(wifi.TEMP).exists()
        assert upload.handle('OPTIONS','/begin',{'origin':wifi.ORIGIN},b'')[0]==204
        assert upload.handle('GET','/status',headers,b'')[1]['board']=='picow'
        assert post(upload,'/../main.py',{})[0]==404
        assert post(upload,'/run',{})[0]==404
        for size in [0,-1,131073,True,'12']:
            assert post(upload,'/begin',{'size':size,'sha256':'0'*64})[0]==400
        for body in [b'not-json',b'[]',b'null']:
            assert upload.handle('POST','/begin',headers,body)[0]==400
        program=('print("日本語 ☀")\n'*170).encode()
        ticket=begin(upload,program)
        assert post(upload,'/commit',{'ticket':ticket})[0]==409
        assert Path('main.py').read_bytes()==old
        assert post(upload,'/chunk',{'ticket':ticket,'offset':1,'data':'YQ=='})[0]==409
        chunks(upload,program,ticket)
        assert Path('main.py').read_bytes()==old
        # Tampering staged data cannot replace the previous program.
        Path(wifi.TEMP).write_bytes(b'corrupted')
        assert post(upload,'/commit',{'ticket':ticket})[0]==422
        assert Path('main.py').read_bytes()==old
        ticket=begin(upload,program);chunks(upload,program,ticket)
        ticks[0]+=120001
        assert post(upload,'/commit',{'ticket':ticket})[0]==409
        assert Path('main.py').read_bytes()==old
        # A second browser replaces the ticket; the first cannot append or commit.
        first=begin(upload,program); second=begin(upload,program)
        assert first!=second and post(upload,'/commit',{'ticket':first})[0]==409
        chunks(upload,program,second)
        replace=wifi.os.rename
        def fail(*args): raise OSError('full disk')
        wifi.os.rename=fail
        assert post(upload,'/commit',{'ticket':second})[0]==507
        assert Path('main.py').read_bytes()==old
        wifi.os.rename=replace
        ticket=begin(upload,program);chunks(upload,program,ticket)
        assert post(upload,'/commit',{'ticket':ticket})==(200,{'saved':True})
        assert Path('main.py').read_bytes()==program
        assert not upload.reset
        assert post(upload,'/run',{})==(200,{'restarting':True}) and upload.reset

        request=b'OPTIONS /begin HTTP/1.1\r\nHost: 192.168.1.4\r\nOrigin: https://pscmps.github.io\r\nAccess-Control-Request-Headers: x-picoblocks-key,content-type\r\n\r\n'
        peer=Socket(request)
        status,result=upload.handle(*wifi.read_request(peer));wifi.respond(peer,status,result)
        assert b'204' in peer.sent and b'Access-Control-Allow-Origin: https://pscmps.github.io' in peer.sent
        assert b'X-PicoBlocks-Key' in peer.sent and b'Content-Length: 0' in peer.sent
        for raw in [b'bad\r\n\r\n',b'GET / HTTP/1.1\r\n'+b'x'*2100+b'\r\n\r\n',
                    b'POST /begin HTTP/1.1\r\nContent-Length: 2049\r\n\r\n',
                    b'POST /begin HTTP/1.1\r\nContent-Length: 2\r\nContent-Length: 2\r\n\r\n{}',
                    b'POST /begin HTTP/1.1\r\nTransfer-Encoding: chunked\r\n\r\n',
                    b'POST /begin HTTP/1.1\r\nContent-Length: 4\r\n\r\n{}']:
            try: wifi.read_request(Socket(raw))
            except (ValueError,UnicodeError): pass
            else: raise AssertionError('Malformed request accepted')

        # The real USB installer writes only its fixed paths and a managed main.py.
        script="""
globalThis.PicoBoot=require('./boot.js');
const Wifi=require('./wifi.js'),fs=require('fs'),vm=require('vm');
const app=fs.readFileSync('app.js','utf8');
vm.runInThisContext(app.slice(app.indexOf('  function bytesLiteral'),app.indexOf('  async function connect()')));
process.stdout.write(Wifi.installCommand(fs.readFileSync('firmware/_picoblocks_wifi.py','utf8'),{board:'picow',key:'ab'.repeat(32),ssid:'quote\\"日本語',password:'not-real'},'print(123)',bytesLiteral));
"""
        command=subprocess.check_output(['node','-e',script],cwd=ROOT,text=True,encoding='utf-8')
        compile(command,'<USB install>','exec')
        real_import=__import__
        def importer(name,*args):
            if name=='os':return wifi.os
            if name=='sys':return types.SimpleNamespace(implementation=types.SimpleNamespace(_machine='Raspberry Pi Pico W with RP2040'))
            return real_import(name,*args)
        import builtins
        builtin_map=dict(vars(builtins));builtin_map['__import__']=importer
        exec(command,{'__builtins__':builtin_map})
        assert Path('_picoblocks_wifi.py').read_bytes()==(ROOT/'firmware/_picoblocks_wifi.py').read_bytes()
        assert json.loads(Path('picoblocks-wifi.json').read_text(encoding='utf-8'))['ssid']=='quote"日本語'
        assert '_picoblocks_wifi.serve()' in Path('main.py').read_text(encoding='utf-8')
        compile(Path('main.py').read_text(encoding='utf-8'),'main.py','exec')
        # Same USB provisioning path, now for classic ESP32; existing files are
        # replaced without losing the ATOM-specific front-button boot gate.
        atom_command=subprocess.check_output(['node','-e',script.replace("board:'picow'", "board:'atom_lite'")],cwd=ROOT,text=True,encoding='utf-8')
        def atom_importer(name,*args):
            if name=='sys':return types.SimpleNamespace(platform='esp32',implementation=types.SimpleNamespace(_machine='Generic ESP32 module with ESP32'))
            return importer(name,*args)
        builtin_map['__import__']=atom_importer
        exec(atom_command,{'__builtins__':builtin_map})
        assert json.loads(Path('picoblocks-wifi.json').read_text(encoding='utf-8'))['board']=='atom_lite'
        assert 'Pin(39, Pin.IN)' in Path('main.py').read_text(encoding='utf-8')
        assert 'import rp2' not in Path('main.py').read_text(encoding='utf-8')
        def wrong_chip(name,*args):
            if name=='sys':return types.SimpleNamespace(platform='esp32',implementation=types.SimpleNamespace(_machine='Generic ESP32S3 module with ESP32S3'))
            return importer(name,*args)
        builtin_map['__import__']=wrong_chip
        before=Path('main.py').read_bytes()
        try:exec(atom_command,{'__builtins__':builtin_map})
        except ValueError:pass
        else:raise AssertionError('Wrong ESP32 variant must be rejected')
        assert Path('main.py').read_bytes()==before
        # Full listener lifecycle with a simulated WLAN and machine.reset.
        events=[]
        class WLAN:
            def __init__(self, interface): self.interface=interface
            def active(self, value): events.append(('active',self.interface,value))
            def connect(self,*args): events.append(('connect',self.interface))
            def isconnected(self): return True
            def ifconfig(self): return ('192.168.1.4',None,None,None)
        run_peer=Socket(('POST /run HTTP/1.1\r\nOrigin: '+wifi.ORIGIN+'\r\nX-PicoBlocks-Key: '+config['key']+'\r\nContent-Type: application/json\r\nContent-Length: 2\r\n\r\n{}').encode())
        class Listener:
            def setsockopt(self,*args): pass
            def bind(self,target): events.append(('bind',target))
            def listen(self,n): pass
            def settimeout(self,n): pass
            def accept(self): return run_peer,('192.168.1.5',12345)
            def close(self): events.append(('close',))
        real_upload=wifi.Upload
        class Committed(real_upload):
            def __init__(self, config): super().__init__(config);self.committed=True
        wifi.Upload=Committed
        wifi.time.sleep_ms=lambda ms:ticks.__setitem__(0,ticks[0]+ms)
        modules={name:sys.modules.get(name) for name in ['network','socket','machine']}
        sys.modules['network']=types.SimpleNamespace(WLAN=WLAN,AP_IF=1,STA_IF=0)
        sys.modules['socket']=types.SimpleNamespace(socket=Listener,SOL_SOCKET=1,SO_REUSEADDR=2)
        sys.modules['machine']=types.SimpleNamespace(reset=lambda:events.append(('reset',)))
        try:
            wifi.serve()
            assert ('active',1,False) in events and ('active',0,False) in events
            assert ('active',0,True) in events and ('bind',('0.0.0.0',80)) in events
            assert b'"restarting": true' in run_peer.sent and run_peer.closed
            assert events[-2:]==[('reset',),('close',)]
            # Failed Wi-Fi never reaches accept or runs the saved program.
            events.clear()
            WLAN.isconnected=lambda self:False
            try: wifi.serve()
            except OSError: pass
            else: raise AssertionError('Missing Wi-Fi timeout')
            assert not any(event[0] in ('bind','reset') for event in events)
        finally:
            wifi.Upload=real_upload
            for name,value in modules.items():
                if value is None:sys.modules.pop(name,None)
                else:sys.modules[name]=value
    finally: os.chdir(original_cwd)
print('PASS: actual receiver auth/CORS, limits, chunks, corruption/expiry/concurrency, atomic commit/failure, reboot guard, HTTP framing, USB installer, WLAN reset/start/timeout and listener cleanup')
