"""In-memory, single-client session authority. No Locat account/database access."""
import secrets
import time
import threading

class Denied(Exception):
    pass

class Session:
    def __init__(self, clock=time.monotonic, input_sink=None):
        self.clock, self.input_sink = clock, input_sink
        self.lock = threading.RLock()
        self.host_token = secrets.token_urlsafe(32)
        self.pair_code = secrets.token_urlsafe(16)
        self.expires = clock() + 300
        self.client_token = None
        self.state = 'idle'
        self.control = False
        self.deadline = 0
        self.last_client_seen = 0
        self.last_host_seen = clock()
        self.last_seq = -1
        self.events = {'host': [], 'client': []}
        self.window, self.count = clock(), 0

    def auth(self, token):
        if secrets.compare_digest(token, self.host_token):
            self.last_host_seen = self.clock()
            return 'host'
        if self.client_token and secrets.compare_digest(token, self.client_token):
            if self.clock() > self.deadline or self.clock() - self.last_client_seen > 5 or (self.state == 'approved' and self.clock() - self.last_host_seen > 5):
                self.revoke()
                raise Denied('Session expired')
            self.last_client_seen = self.clock()
            return 'client'
        raise Denied('Unauthorized')

    def revoke(self):
        self.state, self.control = 'closed', False
        self.client_token = None
        self.events = {'host': [], 'client': []}
        if self.input_sink:
            self.input_sink.release()

    def action(self, token, body):
        with self.lock:
            role = self.auth(token)
            kind = body.get('type')
            if kind == 'status':
                return {'state': self.state, 'control': self.control}
            if kind == 'poll':
                result, self.events[role] = self.events[role], []
                return {'events': result, 'state': self.state, 'control': self.control}
            if kind == 'disconnect':
                self.revoke()
                return {'state': self.state}
            if kind == 'approve' and role == 'host' and self.state == 'pending':
                self.state = 'approved'
                self.control = body.get('control') is True and self.input_sink is not None
                return {'state': self.state, 'control': self.control}
            if kind == 'revoke-control' and role == 'host':
                self.control = False
                if self.input_sink:
                    self.input_sink.release()
                return {'control': False}
            if kind == 'pairing' and role == 'host':
                self.revoke()
                self.pair_code, self.expires = secrets.token_urlsafe(16), self.clock() + 300
                self.state = 'idle'
                return {'code': self.pair_code}
            if self.state != 'approved':
                raise Denied('Host approval required')
            if kind == 'signal':
                value = body.get('signal')
                if not isinstance(value, dict) or value.get('type') not in ('offer', 'answer', 'candidate'):
                    raise Denied('Invalid signal')
                if (value['type'] == 'offer' and role != 'host') or (value['type'] == 'answer' and role != 'client'):
                    raise Denied('Invalid signal direction')
                target = 'client' if role == 'host' else 'host'
                if len(self.events[target]) >= 128:
                    raise Denied('Queue full')
                self.events[target].append(value)
                return {'ok': True}
            if kind == 'input' and role == 'client' and self.control:
                seq = body.get('seq')
                if type(seq) is not int or seq <= self.last_seq:
                    raise Denied('Replay')
                now = self.clock()
                if now - self.window >= 1:
                    self.window, self.count = now, 0
                self.count += 1
                if self.count > 240:
                    raise Denied('Input rate exceeded')
                event = validate_input(body.get('event'))
                try:
                    self.input_sink.apply(event)
                except Exception as exc:
                    self.revoke()
                    raise Denied('Native input failed; session revoked') from exc
                self.last_seq = seq
                return {'ok': True}
            raise Denied('Action denied')

    def pair(self, code):
        with self.lock:
            if self.state != 'idle' or self.clock() > self.expires or not secrets.compare_digest(code, self.pair_code):
                raise Denied('Pairing unavailable')
            self.client_token = secrets.token_urlsafe(32)
            self.deadline = self.clock() + 1800
            self.last_client_seen = self.clock()
            self.state, self.last_seq = 'pending', -1
            return {'token': self.client_token, 'state': self.state}

KEYS = {'ArrowUp': 0x26, 'ArrowDown': 0x28, 'ArrowLeft': 0x25, 'ArrowRight': 0x27,
        'Space': 0x20, 'Enter': 0x0D, 'Escape': 0x1B, 'Tab': 9, 'Backspace': 8}
KEYS.update({f'Key{c}': ord(c) for c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'})
KEYS.update({f'Digit{c}': ord(c) for c in '0123456789'})

def validate_input(event):
    if not isinstance(event, dict):
        raise Denied('Invalid input')
    kind = event.get('kind')
    if kind == 'move':
        for axis in ('x', 'y'):
            v = event.get(axis)
            if type(v) not in (int, float) or not 0 <= v <= 1:
                raise Denied('Invalid coordinate')
        return {'kind': kind, 'x': event['x'], 'y': event['y']}
    if kind == 'button' and type(event.get('button')) is int and event['button'] in (0, 1, 2) and type(event.get('down')) is bool:
        return {'kind': kind, 'button': event['button'], 'down': event['down']}
    if kind == 'key' and event.get('code') in KEYS and type(event.get('down')) is bool:
        return {'kind': kind, 'code': event['code'], 'down': event['down']}
    raise Denied('Unsupported input')
