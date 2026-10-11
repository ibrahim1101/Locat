"""Checks native dispatch contracts using a fake user32, never the real desktop."""
import unittest
from windows_input import WindowsInput

class FakeUser:
    def __init__(self):self.calls=[]
    def GetSystemMetrics(self,index):return (1920,1080)[index]
    def SetCursorPos(self,*args):self.calls.append(('move',args))
    def keybd_event(self,*args):self.calls.append(('key',args))
    def mouse_event(self,*args):self.calls.append(('button',args))

class WindowsDispatchTests(unittest.TestCase):
    def setUp(self):
        self.sink=WindowsInput.__new__(WindowsInput);self.sink.user=FakeUser();self.sink.held=set()
    def test_primary_monitor_coordinates(self):
        self.sink.apply({'kind':'move','x':1,'y':1});self.assertEqual(self.sink.user.calls,[('move',(1919,1079))])
    def test_key_release_on_revoke(self):
        self.sink.apply({'kind':'key','code':'KeyW','down':True});self.sink.release()
        self.assertEqual(self.sink.user.calls[-1],('key',(87,0,2,0)));self.assertEqual(self.sink.held,set())
    def test_mouse_release_on_revoke(self):
        for button in range(3):self.sink.apply({'kind':'button','button':button,'down':True})
        self.sink.release();self.assertEqual(self.sink.held,set())
        self.assertEqual({call[1][0] for call in self.sink.user.calls[-3:]},{4,16,64})
