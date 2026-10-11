import struct
import unittest
import zlib
from session import Session, Denied
from windows_capture import png_from_bgra

class PNGTests(unittest.TestCase):
    def test_rgb_and_top_down_rows(self):
        png=png_from_bgra(1,2,bytes([0,0,255,255, 255,0,0,255]))
        self.assertEqual(png[:8],b'\x89PNG\r\n\x1a\n')
        chunks={};offset=8
        while offset<len(png):
            size=struct.unpack('!I',png[offset:offset+4])[0];kind=png[offset+4:offset+8];data=png[offset+8:offset+8+size]
            crc=struct.unpack('!I',png[offset+8+size:offset+12+size])[0];self.assertEqual(crc,zlib.crc32(kind+data))
            chunks[kind]=data;offset+=12+size
        self.assertEqual(struct.unpack('!2I5B',chunks[b'IHDR']),(1,2,8,2,0,0,0))
        self.assertEqual(zlib.decompress(chunks[b'IDAT']),b'\0\xff\0\0\0\0\0\xff')
    def test_frame_bounds(self):
        for w,h,p in [(0,1,b''),(1921,1,b''),(1,1,b'')]:
            with self.assertRaises(ValueError):png_from_bgra(w,h,p)

class CaptureAuthorityTests(unittest.TestCase):
    def setUp(self):
        class FakeCapture:
            def frame(self,width):return {'width':width,'height':720,'png':'fake'}
        self.now=100.;self.s=Session(clock=lambda:self.now,capture=FakeCapture());self.c=self.s.pair(self.s.pair_code)['token']
    def frame(self,token,width=1280):return self.s.action(token,{'type':'capture','width':width})
    def test_pending_denied(self):
        with self.assertRaises(Denied):self.frame(self.s.host_token)
    def test_client_capture_denied(self):
        self.s.action(self.s.host_token,{'type':'approve'})
        with self.assertRaises(Denied):self.frame(self.c)
    def test_approved_host_and_limit(self):
        self.s.action(self.s.host_token,{'type':'approve'});self.assertEqual(self.frame(self.s.host_token)['width'],1280)
        with self.assertRaises(Denied):self.frame(self.s.host_token)
        self.now+=.1;self.assertEqual(self.frame(self.s.host_token)['width'],1280)
    def test_invalid_width(self):
        self.s.action(self.s.host_token,{'type':'approve'})
        with self.assertRaises(Denied):self.frame(self.s.host_token,999999)
    def test_capture_failure_revokes(self):
        self.s.action(self.s.host_token,{'type':'approve'})
        def fail(width):raise OSError('test')
        self.s.capture.frame=fail
        with self.assertRaises(Denied):self.frame(self.s.host_token)
        self.assertIsNone(self.s.client_token)
