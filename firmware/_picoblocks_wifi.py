"""PicoBlocks LAN uploader v1. Runs ONLY in the BOOT-selected write mode.

Trusted LAN only: HTTP is not encrypted. No UI, REPL, arbitrary file paths,
or unauthenticated mutation endpoints are exposed.
"""
import os
import json
import time
import hashlib
import binascii

ORIGIN = "https://pscmps.github.io"
MAX_PROGRAM = 131072
CHUNK = 768
TEMP = "main.py.picoblocks.wifi.tmp"


class Upload:
    def __init__(self, config):
        self.config = config
        self.pending = None
        self.committed = False
        self.reset = False

    def abandon(self):
        self.pending = None
        try:
            os.remove(TEMP)
        except OSError:
            pass

    def authorized(self, key):
        expected = self.config["key"]
        if len(key) != len(expected):
            return False
        diff = 0
        for a, b in zip(key, expected):
            diff |= ord(a) ^ ord(b)
        return diff == 0

    def handle(self, method, path, headers, body):
        # CORS is not authentication: check both Origin and the device key.
        if headers.get("origin") != ORIGIN:
            return 403, {"error": "Origin not allowed"}
        if method == "OPTIONS":
            if path not in ("/status", "/begin", "/chunk", "/commit", "/run"):
                return 404, {"error": "Not found"}
            return 204, {}
        if not self.authorized(headers.get("x-picoblocks-key", "")):
            return 401, {"error": "Incorrect device key"}
        if self.pending and time.ticks_diff(time.ticks_ms(), self.pending["updated"]) > 120000:
            self.abandon()
        if method == "GET" and path == "/status":
            return 200, {"protocol": 1, "board": self.config["board"], "mode": "WRITE", "max": MAX_PROGRAM}
        if method != "POST":
            return 405, {"error": "Method not allowed"}
        if headers.get("content-type", "").split(";")[0] != "application/json":
            return 415, {"error": "Expected JSON"}
        try:
            data = json.loads(body)
            if not isinstance(data, dict):
                raise ValueError()
            if path == "/begin":
                size, digest = data.get("size"), data.get("sha256", "")
                if type(size) is not int or not 1 <= size <= MAX_PROGRAM:
                    return 400, {"error": "Program must be 1..131072 bytes"}
                if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
                    return 400, {"error": "Invalid SHA-256"}
                self.abandon()
                self.committed = False
                with open(TEMP, "wb"):
                    pass
                ticket = binascii.hexlify(os.urandom(16)).decode()
                self.pending = {"size": size, "sha256": digest, "offset": 0, "ticket": ticket, "updated": time.ticks_ms()}
                return 200, {"ticket": ticket, "offset": 0}
            if path in ("/chunk", "/commit"):
                state = self.pending
                if not state or data.get("ticket") != state["ticket"]:
                    return 409, {"error": "Upload expired or replaced; resend the program"}
                state["updated"] = time.ticks_ms()
                if path == "/chunk":
                    block = binascii.a2b_base64(data["data"])
                    if data.get("offset") != state["offset"] or not 1 <= len(block) <= CHUNK or state["offset"] + len(block) > state["size"]:
                        return 409, {"error": "Invalid chunk or offset; resend the program"}
                    with open(TEMP, "ab") as target:
                        if target.write(block) != len(block):
                            raise OSError("Incomplete write")
                    state["offset"] += len(block)
                    return 200, {"offset": state["offset"]}
                if state["offset"] != state["size"]:
                    return 409, {"error": "Program is incomplete"}
                digest = hashlib.sha256()
                with open(TEMP, "rb") as source:
                    while True:
                        block = source.read(1024)
                        if not block:
                            break
                        digest.update(block)
                if binascii.hexlify(digest.digest()).decode() != state["sha256"]:
                    self.abandon()
                    return 422, {"error": "SHA-256 mismatch; old program kept"}
                # RP2 uses LittleFS: same-directory rename atomically replaces main.py.
                os.rename(TEMP, "main.py")
                os.sync()
                self.pending = None
                self.committed = True
                return 200, {"saved": True}
            if path == "/run" and self.committed:
                self.reset = True
                return 200, {"restarting": True}
            return 404, {"error": "Not found or no committed program"}
        except (ValueError, KeyError, TypeError):
            return 400, {"error": "Invalid request"}
        except OSError:
            self.abandon()
            return 507, {"error": "Storage error; check the board over USB"}


def read_request(client):
    started = time.ticks_ms()
    client.settimeout(1)
    data = b""
    while b"\r\n\r\n" not in data:
        if len(data) > 2048 or time.ticks_diff(time.ticks_ms(), started) > 10000:
            raise ValueError("Header limit")
        part = client.recv(256)
        if not part:
            raise ValueError("Incomplete header")
        data += part
    head, body = data.split(b"\r\n\r\n", 1)
    if len(head) > 2048:
        raise ValueError("Header limit")
    lines = head.decode().split("\r\n")
    method, path, version = lines[0].split(" ")
    headers = {}
    for line in lines[1:]:
        key, value = line.split(":", 1)
        key = key.strip().lower()
        if key in headers:
            raise ValueError("Duplicate header")
        headers[key] = value.strip()
    if "transfer-encoding" in headers:
        raise ValueError("Chunked HTTP not supported")
    length = int(headers.get("content-length", "0"))
    if not 0 <= length <= 2048:
        raise ValueError("Body limit")
    while len(body) < length:
        if time.ticks_diff(time.ticks_ms(), started) > 10000:
            raise ValueError("Request timeout")
        part = client.recv(min(256, length - len(body)))
        if not part:
            raise ValueError("Incomplete body")
        body += part
    if len(body) != length:
        raise ValueError("Body length mismatch")
    return method, path, headers, body


def respond(client, status, result):
    body = b"" if status == 204 else json.dumps(result).encode()
    head = ("HTTP/1.1 %d Response\r\nContent-Type: application/json\r\n"
            "Access-Control-Allow-Origin: %s\r\nVary: Origin\r\n"
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
            "Access-Control-Allow-Headers: Content-Type, X-PicoBlocks-Key\r\n"
            "Cache-Control: no-store\r\nConnection: close\r\nContent-Length: %d\r\n\r\n") % (status, ORIGIN, len(body))
    data = head.encode() + body
    while data:
        sent = client.send(data[:512])
        if not sent:
            raise OSError("Connection closed")
        data = data[sent:]


def serve():
    import network
    import socket
    import machine
    with open("picoblocks-wifi.json", "rb") as source:
        config = json.loads(source.read().decode("utf-8"))
    if config.get("board") not in ("picow", "pico2w", "atom_lite") or len(config.get("key", "")) != 64:
        raise ValueError("Invalid PicoBlocks Wi-Fi config")
    network.WLAN(network.AP_IF).active(False)
    wlan = network.WLAN(network.STA_IF)
    # A raw-REPL soft reset can preserve the old network association.
    wlan.active(False)
    wlan.active(True)
    wlan.connect(config["ssid"], config["password"])
    started = time.ticks_ms()
    while not wlan.isconnected():
        if time.ticks_diff(time.ticks_ms(), started) > 20000:
            raise OSError("Wi-Fi unavailable; recover or reconfigure over USB")
        time.sleep_ms(100)
    server = socket.socket()
    try:
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind(("0.0.0.0", 80))
        server.listen(1)
        server.settimeout(1)
        upload = Upload(config)
        upload.abandon()  # Remove only our own interrupted staging file.
        print("PICOBLOCKS_UPLOAD http://%s" % wlan.ifconfig()[0])
        while not upload.reset:
            try:
                client, _ = server.accept()
            except OSError:
                continue
            try:
                request = read_request(client)
                status, result = upload.handle(*request)
                respond(client, status, result)
            except (OSError, ValueError, UnicodeError):
                pass  # Malformed or stalled requests cannot mutate a program.
            finally:
                client.close()
        time.sleep_ms(250)
        machine.reset()
    finally:
        server.close()
