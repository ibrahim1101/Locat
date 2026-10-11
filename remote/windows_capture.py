"""Opt-in primary-monitor GDI prototype. CPU PNG frames, not DXGI/hardware capture."""
import base64
import ctypes
from ctypes import wintypes
import struct
import sys
import zlib


def png_from_bgra(width, height, pixels):
    """Encode top-down BGRA pixels as opaque RGB PNG, with no third-party package."""
    if not 1 <= width <= 1920 or not 1 <= height <= 1920 or len(pixels) != width * height * 4:
        raise ValueError('Invalid bounded frame')
    rgb = bytearray(width * height * 3)
    rgb[0::3], rgb[1::3], rgb[2::3] = pixels[2::4], pixels[1::4], pixels[0::4]
    rows = b''.join(b'\0' + rgb[y*width*3:(y+1)*width*3] for y in range(height))
    def chunk(kind, data):
        return struct.pack('!I', len(data)) + kind + data + struct.pack('!I', zlib.crc32(kind + data))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows, 1)) + chunk(b'IEND', b''))


class BitmapInfoHeader(ctypes.Structure):
    _fields_ = [('size', wintypes.DWORD), ('width', wintypes.LONG), ('height', wintypes.LONG),
                ('planes', wintypes.WORD), ('bits', wintypes.WORD), ('compression', wintypes.DWORD),
                ('image_size', wintypes.DWORD), ('xppm', wintypes.LONG), ('yppm', wintypes.LONG),
                ('used', wintypes.DWORD), ('important', wintypes.DWORD)]


class WindowsCapture:
    def __init__(self):
        if sys.platform != 'win32':
            raise RuntimeError('Native capture requires Windows')
        self.user = ctypes.WinDLL('user32', use_last_error=True)
        self.gdi = ctypes.WinDLL('gdi32', use_last_error=True)
        # Pointer-safe signatures are required on 64-bit Windows.
        for dll, name, result, args in (
            (self.user, 'GetDC', wintypes.HDC, [wintypes.HWND]),
            (self.user, 'ReleaseDC', ctypes.c_int, [wintypes.HWND, wintypes.HDC]),
            (self.gdi, 'CreateCompatibleDC', wintypes.HDC, [wintypes.HDC]),
            (self.gdi, 'CreateCompatibleBitmap', wintypes.HBITMAP, [wintypes.HDC, ctypes.c_int, ctypes.c_int]),
            (self.gdi, 'SelectObject', wintypes.HANDLE, [wintypes.HDC, wintypes.HANDLE]),
            (self.gdi, 'DeleteObject', wintypes.BOOL, [wintypes.HANDLE]),
            (self.gdi, 'DeleteDC', wintypes.BOOL, [wintypes.HDC]),
            (self.gdi, 'StretchBlt', wintypes.BOOL, [wintypes.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int,
                                                 wintypes.HDC, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_int, wintypes.DWORD]),
            (self.gdi, 'GetDIBits', ctypes.c_int, [wintypes.HDC, wintypes.HBITMAP, wintypes.UINT, wintypes.UINT,
                                                ctypes.c_void_p, ctypes.c_void_p, wintypes.UINT]),
        ):
            fn = getattr(dll, name); fn.restype = result; fn.argtypes = args
        self.user.SetProcessDPIAware()

    def frame(self, requested_width):
        if type(requested_width) is not int or requested_width not in (1280, 1920):
            raise ValueError('Native capture width must be 1280 or 1920')
        sw, sh = self.user.GetSystemMetrics(0), self.user.GetSystemMetrics(1)
        if sw <= 0 or sh <= 0:
            raise OSError('No primary display')
        width = min(requested_width, sw)
        height = min(1920, max(1, round(width * sh / sw)))
        screen = self.user.GetDC(None); memory = bitmap = previous = None
        if not screen:
            raise OSError('GetDC failed')
        try:
            memory = self.gdi.CreateCompatibleDC(screen)
            bitmap = self.gdi.CreateCompatibleBitmap(screen, width, height)
            if not memory or not bitmap:
                raise OSError('Capture allocation failed')
            previous = self.gdi.SelectObject(memory, bitmap)
            if not previous or previous == ctypes.c_void_p(-1).value:
                previous = None
                raise OSError('SelectObject failed')
            if not self.gdi.StretchBlt(memory, 0, 0, width, height, screen, 0, 0, sw, sh, 0x00CC0020):
                raise OSError('StretchBlt failed')
            self.gdi.SelectObject(memory, previous); previous = None
            header = BitmapInfoHeader(ctypes.sizeof(BitmapInfoHeader), width, -height, 1, 32, 0,
                                      width * height * 4, 0, 0, 0, 0)
            pixels = ctypes.create_string_buffer(width * height * 4)
            if self.gdi.GetDIBits(memory, bitmap, 0, height, pixels, ctypes.byref(header), 0) != height:
                raise OSError('GetDIBits failed')
            return {'width': width, 'height': height, 'png': base64.b64encode(png_from_bgra(width, height, pixels.raw)).decode('ascii')}
        finally:
            if previous: self.gdi.SelectObject(memory, previous)
            if bitmap: self.gdi.DeleteObject(bitmap)
            if memory: self.gdi.DeleteDC(memory)
            self.user.ReleaseDC(None, screen)
