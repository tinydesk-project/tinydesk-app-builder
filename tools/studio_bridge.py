"""Loopback-only, token-protected HTTP to TinyDesk's passive FTP server."""
import argparse
import ftplib
import hmac
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
import posixpath
import re
import secrets
import socket
import threading
import time
from urllib.parse import parse_qs, urlsplit


def parse_list_line(line):
    match = re.match(r'^([d-])[rwxstST-]{9}\s+\d+\s+\S+\s+\S+\s+(\d+)\s+\S{3}\s+\d{1,2}\s+\d{2}:\d{2} (.*)$', line)
    if not match:
        raise ValueError('Unrecognized FTP LIST line: ' + line)
    return {'name': match[3], 'dir': match[1] == 'd', 'size': int(match[2])}


def board_path(value, default):
    if not isinstance(value, str) or any(c in value for c in '\r\n\0'):
        raise ValueError('Invalid board path.')
    return posixpath.normpath(value if value.startswith('/') else posixpath.join(default, value))


def allowed_origin(origin):
    if origin in (None, 'null'):
        return True
    try:
        parts = urlsplit(origin)
        return (parts.scheme == 'http' and parts.hostname in ('localhost', '127.0.0.1')
                and parts.username is None and parts.password is None
                and parts.path == '' and not parts.query and not parts.fragment
                and (parts.port is None or 1 <= parts.port <= 65535))
    except ValueError:
        return False


class Session:
    def __init__(self, idle_seconds=30):
        self.lock = threading.RLock()
        self.ftp = None
        self.cwd = '/'
        self.last_used = 0
        self.idle_seconds = idle_seconds
        self.stopped = threading.Event()
        self.reaper = threading.Thread(target=self.reap, daemon=True)
        self.reaper.start()

    def close(self):
        ftp, self.ftp = self.ftp, None
        if ftp:
            try:
                ftp.quit()
            except (ftplib.Error, OSError, EOFError):
                ftp.close()

    def reap(self):
        while not self.stopped.wait(min(1, self.idle_seconds / 2)):
            with self.lock:
                if self.ftp and time.monotonic() - self.last_used >= self.idle_seconds:
                    self.close()

    def connect(self, body):
        self.close()
        host, user = body.get('host'), body.get('user', 'root')
        port = int(body.get('port', 21))
        if not isinstance(host, str) or not host.strip() or any(c in host for c in '\r\n\0') or not 1 <= port <= 65535:
            raise ValueError('Enter a host and an FTP port from 1 to 65535.')
        if not isinstance(user, str) or any(c in user for c in '\r\n\0'):
            raise ValueError('Invalid user name.')
        password = body.pop('password', '')
        if not isinstance(password, str) or any(c in password for c in '\r\n\0'):
            raise ValueError('Invalid password.')
        ftp = ftplib.FTP(timeout=20)
        ftp.encoding = 'utf-8'
        try:
            ftp.connect(host.strip(), port)
            ftp.login(user, password)
            ftp.set_pasv(True)
            self.cwd = ftp.pwd()
            self.ftp = ftp
            self.last_used = time.monotonic()
            return {'cwd': self.cwd}
        except Exception:
            ftp.close()
            raise
        finally:
            password = None  # Credentials are not retained in session state or logs.

    def require(self):
        if self.ftp is None:
            raise ValueError('Not connected. Connect again; idle connections close after 30 seconds.')
        self.last_used = time.monotonic()
        return self.ftp

    def stop(self):
        self.stopped.set()
        self.reaper.join(timeout=2)
        with self.lock:
            self.close()


class BridgeServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, port=8765, token=None, max_upload=4 * 1024 * 1024, idle_seconds=30):
        self.token = token or secrets.token_urlsafe(32)
        self.max_upload = max_upload
        super().__init__(('127.0.0.1', port), BridgeHandler)
        self.session = Session(idle_seconds)

    def server_close(self):
        session = getattr(self, 'session', None)
        if session:
            session.stop()
        super().server_close()


class BridgeHandler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, *args):
        pass  # No request bodies, paths or credentials are logged.

    def trusted(self):
        try:
            host = urlsplit('http://' + self.headers.get('Host', '')).hostname
        except ValueError:
            return False
        return host in ('127.0.0.1', 'localhost') and allowed_origin(self.headers.get('Origin'))

    def authorized(self):
        supplied = self.headers.get('X-Studio-Token', '')
        return hmac.compare_digest(supplied.encode('utf-8'), self.server.token.encode('utf-8'))

    def respond(self, status, data, binary=False):
        payload = data if binary else json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/octet-stream' if binary else 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(payload)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Connection', 'close')
        origin = self.headers.get('Origin')
        if self.trusted() and (self.authorized() or self.command == 'OPTIONS') and origin is not None:
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Headers', 'X-Studio-Token, Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()
        self.wfile.write(payload)
        self.close_connection = True

    def body(self, limit):
        try:
            size = int(self.headers.get('Content-Length', '-1'))
        except ValueError:
            raise ValueError('Invalid Content-Length.')
        if size < 0:
            raise ValueError('Content-Length is required.')
        if size > limit:
            raise OverflowError('Upload exceeds the configured size limit (%d bytes).' % limit)
        self.connection.settimeout(20)
        payload = self.rfile.read(size)
        if len(payload) != size:
            raise ValueError('Incomplete request body.')
        return payload

    def reject(self, status, message):
        self.respond(status, {'error': message})
        # Send a FIN before draining a rejected body. Closing a socket with
        # unread upload bytes can otherwise reset it and discard the 413/403
        # response on Windows. Draining is bounded and never retains the data.
        try:
            self.connection.shutdown(socket.SHUT_WR)
            self.connection.settimeout(.25)
            remaining = max(0, int(self.headers.get('Content-Length', '0')))
            deadline = time.monotonic() + 1
            while remaining and time.monotonic() < deadline:
                chunk = self.rfile.read1(min(65536, remaining))
                if not chunk:
                    break
                remaining -= len(chunk)
        except (OSError, ValueError):
            pass

    def do_OPTIONS(self):
        # Browser preflights cannot contain the token value. They grant no FTP
        # operation; every subsequent API request still requires the token.
        if not self.trusted():
            self.respond(403, {'error': 'Origin or Host is not allowed.'})
        else:
            self.respond(200, {})

    def dispatch(self):
        if not self.trusted() or not self.authorized():
            self.reject(403, 'A valid X-Studio-Token and a local page origin are required.')
            return
        parsed = urlsplit(self.path)
        path = parse_qs(parsed.query, keep_blank_values=True).get('path', [''])[0]
        try:
            body = {}
            upload = None
            if self.command == 'PUT':
                upload = self.body(self.server.max_upload)
            elif self.command == 'POST':
                raw = self.body(65536)
                body = json.loads(raw or b'{}')
                if not isinstance(body, dict):
                    raise ValueError('Expected a JSON object.')
            with self.server.session.lock:
                session = self.server.session
                if self.command == 'POST' and parsed.path == '/connect':
                    result = session.connect(body)
                elif self.command == 'POST' and parsed.path == '/disconnect':
                    session.close()
                    result = {}
                else:
                    ftp = session.require()
                    target = board_path(path, session.cwd)
                    if self.command == 'GET' and parsed.path == '/list':
                        listing = []
                        ftp.retrlines('LIST ' + target, listing.append)
                        result = [parse_list_line(line) for line in listing]
                    elif self.command == 'GET' and parsed.path == '/download':
                        content = io.BytesIO()
                        ftp.retrbinary('RETR ' + target, content.write)
                        self.respond(200, content.getvalue(), binary=True)
                        return
                    elif self.command == 'PUT' and parsed.path == '/upload':
                        ftp.storbinary('STOR ' + target, io.BytesIO(upload))
                        actual = ftp.size(target)
                        if actual != len(upload):
                            raise OSError('Upload verification failed: SIZE returned %s; expected %d.' % (actual, len(upload)))
                        result = {'size': actual}
                    elif self.command == 'POST' and parsed.path in ('/mkdir', '/delete', '/rmdir', '/rename'):
                        raw_source = body.get('from', body.get('path'))
                        if not isinstance(raw_source, str) or not raw_source:
                            raise ValueError('A source path is required.')
                        if parsed.path == '/rename' and (not isinstance(body.get('to'), str) or not body['to']):
                            raise ValueError('A destination path is required.')
                        source = board_path(raw_source, session.cwd)
                        if parsed.path == '/mkdir':
                            ftp.mkd(source)
                        elif parsed.path == '/delete':
                            ftp.delete(source)
                        elif parsed.path == '/rmdir':
                            ftp.rmd(source)
                        else:
                            ftp.rename(source, board_path(body.get('to', ''), session.cwd))
                        result = {}
                    else:
                        self.respond(404, {'error': 'Unknown endpoint or method.'})
                        return
                session.last_used = time.monotonic()
                self.respond(200, result)
        except OverflowError as exc:
            self.reject(413, str(exc))
        except (ValueError, TypeError, ftplib.error_perm) as exc:
            self.respond(400, {'error': str(exc)})
        except (OSError, EOFError, ftplib.Error) as exc:
            # A failed data transfer can leave the control channel out of sync.
            with self.server.session.lock:
                self.server.session.close()
            self.respond(502, {'error': str(exc) or 'The FTP connection closed.'})

    do_GET = dispatch
    do_POST = dispatch
    do_PUT = dispatch


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--max-upload', type=int, default=4 * 1024 * 1024, help='Maximum bytes per upload (default 4194304)')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535 or args.max_upload < 1:
        parser.error('Use a port from 1 to 65535 and a positive --max-upload byte count.')
    server = BridgeServer(args.port, max_upload=args.max_upload)
    print('TinyDesk Studio bridge: http://127.0.0.1:%d' % server.server_port, flush=True)
    print('Paste this token into Studio: %s' % server.token, flush=True)
    print('Start FTP on your board with: ftp start (as root).', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
