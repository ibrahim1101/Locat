"""Standalone Locat Remote development server. Python 3.10+, standard library only."""
import argparse
import json
import ssl
import threading
import time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from session import Session, Denied

ROOT = Path(__file__).parent

def make_handler(session, origin):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass  # Never log bearer credentials or pairing data.

        def reply(self, status, value, content='application/json'):
            data = json.dumps(value).encode() if content == 'application/json' else value
            self.send_response(status)
            self.send_header('Content-Type', content)
            self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('Referrer-Policy', 'no-referrer')
            self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; media-src 'self' blob:; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'")
            self.end_headers()
            self.wfile.write(data)

        def valid_host(self):
            return self.headers.get('Host') == origin.split('://', 1)[1]

        def do_GET(self):
            if not self.valid_host():
                return self.reply(403, {'error': 'Host denied'})
            files = {'/': ('index.html', 'text/html'), '/app.js': ('app.js', 'text/javascript'), '/style.css': ('style.css', 'text/css')}
            if self.path not in files:
                return self.reply(404, {'error': 'Not found'})
            name, content = files[self.path]
            self.reply(200, (ROOT / name).read_bytes(), content)

        def do_POST(self):
            if not self.valid_host() or self.headers.get('Origin') != origin:
                return self.reply(403, {'error': 'Origin denied'})
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= 65536 or self.headers.get('Content-Type') != 'application/json':
                    return self.reply(400, {'error': 'Invalid request'})
                self.connection.settimeout(5)
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict):
                    raise ValueError()
                if self.path == '/pair':
                    code = body.get('code')
                    if not isinstance(code, str) or len(code) > 64:
                        raise ValueError()
                    result = session.pair(code)
                elif self.path == '/action':
                    token = self.headers.get('Authorization', '').removeprefix('Bearer ')
                    result = session.action(token, body)
                else:
                    return self.reply(404, {'error': 'Not found'})
                self.reply(200, result)
            except Denied as e:
                self.reply(403, {'error': str(e)})
            except (ValueError, TypeError, KeyError):
                self.reply(400, {'error': 'Invalid request'})
    return Handler

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--bind', default='127.0.0.1')
    p.add_argument('--port', type=int, default=8765)
    p.add_argument('--origin', default='http://127.0.0.1:8765')
    p.add_argument('--cert'); p.add_argument('--key')
    p.add_argument('--enable-windows-input', action='store_true')
    p.add_argument('--enable-native-capture', action='store_true')
    args = p.parse_args()
    if args.bind != '127.0.0.1' and not (args.cert and args.key and args.origin.startswith('https://')):
        p.error('Network binding requires TLS certificate/key and an HTTPS origin')
    sink = None
    if args.enable_windows_input:
        from windows_input import WindowsInput
        sink = WindowsInput()
    capture = None
    if args.enable_native_capture:
        from windows_capture import WindowsCapture
        capture = WindowsCapture()
    session = Session(input_sink=sink, capture=capture)
    server = ThreadingHTTPServer((args.bind, args.port), make_handler(session, args.origin))
    server.daemon_threads = True
    if args.cert:
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.load_cert_chain(args.cert, args.key)
        server.socket = context.wrap_socket(server.socket, server_side=True)
    print(f'Open {args.origin}\nHost credential (paste locally): {session.host_token}')
    def expire():
        while True:
            time.sleep(1)
            with session.lock:
                if session.client_token and (session.clock() > session.deadline or session.clock() - session.last_client_seen > 5 or (session.state == 'approved' and session.clock() - session.last_host_seen > 5)):
                    session.revoke()
    threading.Thread(target=expire, daemon=True).start()
    try:
        server.serve_forever()
    finally:
        with session.lock:
            session.revoke()
        server.server_close()

if __name__ == '__main__':
    main()
