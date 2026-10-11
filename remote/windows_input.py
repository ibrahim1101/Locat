"""Opt-in Windows primary-monitor input bridge; no elevation or background service."""
import ctypes
import sys
from session import KEYS

class WindowsInput:
    def __init__(self):
        if sys.platform != 'win32':
            raise RuntimeError('Windows input requires Windows')
        self.user = ctypes.windll.user32
        self.held = set()

    def apply(self, e):
        if e['kind'] == 'move':
            self.user.SetCursorPos(round(e['x'] * (self.user.GetSystemMetrics(0) - 1)),
                                   round(e['y'] * (self.user.GetSystemMetrics(1) - 1)))
        else:
            key = (e['kind'], e.get('code', e.get('button')))
            if e['down']:
                self.held.add(key)
            else:
                self.held.discard(key)
            if e['kind'] == 'key':
                self.user.keybd_event(KEYS[e['code']], 0, 0 if e['down'] else 2, 0)
            else:
                down, up = ((2, 4), (32, 64), (8, 16))[e['button']]
                self.user.mouse_event(down if e['down'] else up, 0, 0, 0, 0)

    def release(self):
        for kind, code in list(self.held):
            self.apply({'kind': kind, 'code' if kind == 'key' else 'button': code, 'down': False})
