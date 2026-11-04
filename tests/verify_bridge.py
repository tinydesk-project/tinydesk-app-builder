"""Exercise the HTTP bridge against a one-client, passive-only fake TinyDesk FTP server."""
from collections import Counter
import http.client
import importlib.util
import json
from pathlib import Path
import posixpath
import socket
import socketserver
import sys
import threading
import time
from urllib.parse import quote

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('board_bridge', ROOT / 'tools/board_bridge.py')
bridge_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge_module)


class FakeFTP(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True

    def __init__(self):
        self.files = {'/root/café notes.py': b'original\n'}
        self.dirs = {'/', '/root', '/root/Desktop'}
        self.lock = threading.Lock()
        self.clients = 0
        self.max_clients = 0
        self.connects = 0
        self.commands = Counter()
        self.size_paths = []
        self.wrong_size = False
        super().__init__(('127.0.0.1', 0), FTPHandler)

    def handle_error(self, *args):
        pass


class FTPHandler(socketserver.StreamRequestHandler):
    def handle(self):
        registered = False
        passive = None
        cwd, rename_from, binary = '/root', None, False
        self.connection.settimeout(120)

        def reply(text):
            self.wfile.write((text + '\r\n').encode('utf-8'))
            self.wfile.flush()

        def path(value):
            return posixpath.normpath(value if value.startswith('/') else posixpath.join(cwd, value))

        with self.server.lock:
            if self.server.clients:
                reply('421 One client only.')
                return
            self.server.clients += 1
            self.server.connects += 1
            self.server.max_clients = max(self.server.max_clients, self.server.clients)
            registered = True
        try:
            reply('220 TinyDesk fake FTP')
            while True:
                raw = self.rfile.readline(4096)
                if not raw:
                    break
                command, _, value = raw.decode('utf-8').rstrip('\r\n').partition(' ')
                command = command.upper()
                self.server.commands[command] += 1
                target = path(value)
                if command == 'USER':
                    reply('331 Password required.')
                elif command == 'PASS':
                    reply('230 Logged in.' if value == 'fake-secret' else '530 Login incorrect.')
                elif command == 'PWD':
                    reply('257 "%s" is current directory.' % cwd)
                elif command in ('CWD', 'CDUP'):
                    next_path = path('..' if command == 'CDUP' else value)
                    if next_path in self.server.dirs:
                        cwd = next_path
                        reply('250 Directory changed.')
                    else:
                        reply('550 Path not found.')
                elif command == 'TYPE':
                    binary = value == 'I'
                    reply('200 Type set.')
                elif command == 'PASV':
                    if passive:
                        passive.close()
                    passive = socket.socket()
                    passive.bind(('127.0.0.1', 0))
                    passive.listen(1)
                    passive.settimeout(5)
                    port = passive.getsockname()[1]
                    reply('227 Entering Passive Mode (127,0,0,1,%d,%d)' % (port // 256, port % 256))
                elif command in ('LIST', 'RETR', 'STOR'):
                    if passive is None:
                        reply('425 Use PASV first.')
                        continue
                    if command == 'LIST' and target not in self.server.dirs or command == 'RETR' and target not in self.server.files:
                        reply('550 Path not found.')
                        passive.close()
                        passive = None
                        continue
                    if command != 'LIST' and not binary:
                        reply('550 Binary TYPE I required.')
                        continue
                    reply('150 Opening data connection.')
                    data, _ = passive.accept()
                    data.settimeout(5)
                    with data:
                        if command == 'LIST':
                            records = []
                            for name in sorted(self.server.dirs | set(self.server.files)):
                                if name != target and posixpath.dirname(name) == target:
                                    size = len(self.server.files[name]) if name in self.server.files else 0
                                    records.append('%srw-r--r-- 1 tdsh tdsh %10d Jan 01 00:00 %s\r\n' % ('d' if name in self.server.dirs else '-', size, posixpath.basename(name)))
                            data.sendall(''.join(records).encode('utf-8'))
                        elif command == 'RETR':
                            data.sendall(self.server.files[target])
                        else:
                            chunks = []
                            while True:
                                chunk = data.recv(4096)
                                if not chunk:
                                    break
                                chunks.append(chunk)
                            self.server.files[target] = b''.join(chunks)
                    passive.close()
                    passive = None
                    reply('226 Transfer complete.')
                elif command == 'SIZE':
                    self.server.size_paths.append(target)
                    if target not in self.server.files:
                        reply('550 Path not found.')
                    else:
                        reply('213 %d' % (len(self.server.files[target]) - int(self.server.wrong_size)))
                elif command == 'MKD':
                    if target in self.server.dirs or target in self.server.files:
                        reply('550 Already exists.')
                    else:
                        self.server.dirs.add(target)
                        reply('257 "%s" created.' % target)
                elif command == 'DELE':
                    if target not in self.server.files:
                        reply('550 Path not found.')
                    else:
                        del self.server.files[target]
                        reply('250 Deleted.')
                elif command == 'RMD':
                    if target not in self.server.dirs:
                        reply('550 Path not found.')
                    elif any(name.startswith(target + '/') for name in set(self.server.files) | self.server.dirs):
                        reply('550 Directory not empty.')
                    else:
                        self.server.dirs.remove(target)
                        reply('250 Removed.')
                elif command == 'RNFR':
                    if target not in self.server.files:
                        reply('550 Path not found.')
                    else:
                        rename_from = target
                        reply('350 Ready for RNTO.')
                elif command == 'RNTO' and rename_from:
                    self.server.files[target] = self.server.files.pop(rename_from)
                    rename_from = None
                    reply('250 Renamed.')
                elif command == 'QUIT':
                    with self.server.lock:
                        self.server.clients -= 1
                        registered = False
                    reply('221 Goodbye.')
                    break
                elif command == 'NOOP':
                    reply('200 OK.')
                else:
                    reply('502 Unsupported command.')
        finally:
            if passive:
                passive.close()
            if registered:
                with self.server.lock:
                    self.server.clients -= 1


def verify():
    ftp = FakeFTP()
    bridge = bridge_module.BridgeServer(port=0, max_upload=32768, idle_seconds=2)
    threads = [threading.Thread(target=s.serve_forever, daemon=True) for s in (ftp, bridge)]
    for thread in threads:
        thread.start()
    checks = 0

    def check(condition, message):
        nonlocal checks
        assert condition, message
        checks += 1

    def request(method, path, data=None, token=True, origin='http://localhost:4174', headers=None):
        fields = {'Origin': origin}
        if token:
            fields['X-Builder-Token'] = bridge.token if token is True else token
        if headers:
            fields.update(headers)
        if data is not None and not isinstance(data, bytes):
            data = json.dumps(data).encode('utf-8')
            fields['Content-Type'] = 'application/json'
        connection = http.client.HTTPConnection('127.0.0.1', bridge.server_port, timeout=10)
        connection.request(method, path, body=data, headers=fields)
        response = connection.getresponse()
        payload = response.read()
        result = json.loads(payload) if response.getheader('Content-Type', '').startswith('application/json') else payload
        status, response_headers = response.status, dict(response.getheaders())
        connection.close()
        return status, result, response_headers

    def connect():
        return request('POST', '/connect', {'host': '127.0.0.1', 'port': ftp.server_address[1], 'user': 'root', 'password': 'fake-secret'})

    try:
        check(bridge.server_address[0] == '127.0.0.1', 'loopback binding')
        check(request('GET', '/list', token=False)[0] == 403, 'token required')
        check(request('GET', '/list', token='wrong')[0] == 403, 'wrong token refused')
        check(request('GET', '/list', origin='https://evil.example')[0] == 403, 'foreign origin refused')
        check(request('GET', '/list', headers={'Host': 'evil.example'})[0] == 403, 'foreign Host refused')
        status, _, headers = request('OPTIONS', '/upload', token=False, origin='null', headers={'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'X-Builder-Token'})
        check(status == 200 and headers.get('Access-Control-Allow-Origin') == 'null' and ftp.connects == 0, 'preflight is local-only and performs no FTP operation')
        status, result, headers = connect()
        check(status == 200 and result == {'cwd': '/root'}, 'FTP connect and PWD')
        check(headers.get('Access-Control-Allow-Origin') == 'http://localhost:4174', 'local origin CORS')
        status, result, headers = request('GET', '/list?path=/root', origin='null')
        check(status == 200 and {'name': 'café notes.py', 'dir': False, 'size': 9} in result, 'LIST preserves spaces and UTF-8')
        check(headers.get('Access-Control-Allow-Origin') == 'null', 'file:// origin CORS')
        check(any(e == {'name': 'Desktop', 'dir': True, 'size': 0} for e in result), 'directory listing')
        payload = b'\x00binary\r\n' + bytes(range(256))
        path = '/root/upload é.bin'
        route = '?path=' + quote(path)
        status, result, _ = request('PUT', '/upload' + route, payload)
        check(status == 200 and result['size'] == len(payload) and ftp.files[path] == payload, 'binary upload')
        check(path in ftp.size_paths, 'upload verified with SIZE')
        check(request('GET', '/download' + route)[1] == payload, 'binary download matches')
        renamed = '/root/renamed é.bin'
        check(request('POST', '/rename', {'from': path, 'to': renamed})[0] == 200 and renamed in ftp.files, 'rename')
        check(request('POST', '/mkdir', {'from': '/root/new folder'})[0] == 200, 'mkdir')
        check(request('POST', '/delete', {'from': renamed})[0] == 200 and renamed not in ftp.files, 'delete')
        check(request('POST', '/rmdir', {'from': '/root/new folder'})[0] == 200, 'rmdir')
        status, result, _ = request('GET', '/list?path=/missing')
        check(status == 400 and result['error'] == '550 Path not found.', '550 reply passed through')
        before = ftp.commands['STOR']
        check(request('PUT', '/upload?path=/root/large.bin', b'x' * 32769)[0] == 413 and ftp.commands['STOR'] == before, 'upload size limit before FTP')
        check(request('GET', '/list?path=/root%0AQUIT')[0] == 400, 'control-character injection refused')
        design = (ROOT / 'tests/fixtures/two_pages.py').read_bytes()
        check(request('PUT', '/upload?path=/root/Desktop/design.py', design)[0] == 200 and request('GET', '/download?path=/root/Desktop/design.py')[1] == design, 'generated design transfers unchanged')
        check(connect()[0] == 200 and ftp.max_clients == 1 and ftp.connects == 2, 'second connect replaces the only connection')
        check('fake-secret' not in repr(bridge.session.__dict__), 'session retains no password')
        ftp.wrong_size = True
        status, result, _ = request('PUT', '/upload?path=/root/bad.bin', b'123')
        check(status == 502 and 'SIZE' in result['error'], 'SIZE mismatch is an error')
        ftp.wrong_size = False
        check(connect()[0] == 200, 'reconnect after transfer error')
        deadline = time.monotonic() + 5
        while bridge.session.ftp is not None and time.monotonic() < deadline:
            time.sleep(.05)
        check(bridge.session.ftp is None, 'idle connection closed')
        check(request('GET', '/list')[0] == 400, 'idle session asks for reconnect')
        check(connect()[0] == 200 and request('POST', '/disconnect', {})[0] == 200 and bridge.session.ftp is None, 'explicit disconnect')
        check(not any(ftp.commands[c] for c in ['PORT', 'MLSD', 'MDTM', 'REST', 'APPE']) and ftp.commands['PASV'] > 0, 'passive mode and supported commands only')
    finally:
        bridge.shutdown()
        bridge.server_close()
        ftp.shutdown()
        ftp.server_close()
        for thread in threads:
            thread.join(timeout=2)
    print('PASS: %d bridge checks (token/CORS, one passive FTP connection, files, SIZE, limits, idle cleanup).' % checks)


if __name__ == '__main__':
    verify()
