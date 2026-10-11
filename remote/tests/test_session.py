import math
import threading
import unittest
from session import Session, Denied, validate_input

class Sink:
    def __init__(self): self.events = []; self.releases = 0
    def apply(self, event): self.events.append(event)
    def release(self): self.releases += 1

class SecurityTests(unittest.TestCase):
    def setUp(self):
        self.now = 100.; self.sink = Sink()
        self.s = Session(clock=lambda:self.now, input_sink=self.sink)
        self.host = self.s.host_token
    def pair(self): return self.s.pair(self.s.pair_code)['token']
    def approve(self, token, control=True): self.s.action(self.host, {'type':'approve','control':control})
    def send(self, token, seq=1, event=None):
        return self.s.action(token, {'type':'input','seq':seq,'event':event or {'kind':'key','code':'KeyW','down':True}})
    def test_wrong_pairing(self):
        with self.assertRaises(Denied): self.s.pair('wrong')
    def test_expired_pairing(self):
        self.now += 301
        with self.assertRaises(Denied): self.pair()
    def test_one_use(self):
        self.pair()
        with self.assertRaises(Denied): self.pair()
    def test_concurrent_pairing_one_winner(self):
        wins=[]
        def attempt():
            try: wins.append(self.pair())
            except Denied: pass
        threads=[threading.Thread(target=attempt) for _ in range(20)]
        for t in threads:t.start()
        for t in threads:t.join()
        self.assertEqual(len(wins),1)
    def test_unknown_token(self):
        with self.assertRaises(Denied): self.s.action('wrong', {'type':'status'})
    def test_client_cannot_approve(self):
        c=self.pair()
        with self.assertRaises(Denied):self.s.action(c, {'type':'approve','control':True})
    def test_input_before_approval(self):
        c=self.pair()
        with self.assertRaises(Denied):self.send(c)
        self.assertEqual(self.sink.events,[])
    def test_signal_before_approval(self):
        self.pair()
        with self.assertRaises(Denied):self.s.action(self.host,{'type':'signal','signal':{'type':'offer'}})
    def test_view_only(self):
        c=self.pair();self.approve(c,False)
        with self.assertRaises(Denied):self.send(c)
    def test_no_native_sink_view_only(self):
        self.s.input_sink=None;c=self.pair();self.approve(c)
        self.assertFalse(self.s.control)
    def test_replay(self):
        c=self.pair();self.approve(c);self.send(c)
        with self.assertRaises(Denied):self.send(c)
        self.assertEqual(len(self.sink.events),1)
    def test_invalid_sequence(self):
        c=self.pair();self.approve(c)
        for seq in (True, '1', -1, 1.1):
            with self.assertRaises(Denied):self.send(c,seq)
    def test_host_cannot_inject(self):
        c=self.pair();self.approve(c)
        with self.assertRaises(Denied):self.send(self.host)
    def test_revocation(self):
        c=self.pair();self.approve(c);self.send(c)
        self.s.action(self.host,{'type':'disconnect'})
        with self.assertRaises(Denied):self.send(c,2)
        self.assertEqual(self.sink.releases,1)
    def test_client_disconnect(self):
        c=self.pair();self.s.action(c,{'type':'disconnect'})
        self.assertIsNone(self.s.client_token)
    def test_timeout(self):
        c=self.pair();self.approve(c);self.now+=6
        with self.assertRaises(Denied):self.send(c)
        self.assertEqual(self.sink.releases,1)
    def test_hard_expiry(self):
        c=self.pair();self.approve(c);self.s.deadline=self.now-1
        with self.assertRaises(Denied):self.send(c)
    def test_rotating_invitation_clears_queue(self):
        c=self.pair();self.approve(c);self.s.action(self.host,{'type':'signal','signal':{'type':'offer'}})
        old=self.s.pair_code;self.s.action(self.host,{'type':'pairing'})
        self.assertNotEqual(old,self.s.pair_code);self.assertEqual(self.s.events['client'],[])
        with self.assertRaises(Denied):self.send(c)
    def test_signal_direction(self):
        c=self.pair();self.approve(c)
        with self.assertRaises(Denied):self.s.action(c,{'type':'signal','signal':{'type':'offer'}})
        with self.assertRaises(Denied):self.s.action(self.host,{'type':'signal','signal':{'type':'answer'}})
    def test_queue_bound(self):
        c=self.pair();self.approve(c)
        for _ in range(128):self.s.action(self.host,{'type':'signal','signal':{'type':'candidate'}})
        with self.assertRaises(Denied):self.s.action(self.host,{'type':'signal','signal':{'type':'candidate'}})
    def test_poll_drains_only_own_queue(self):
        c=self.pair();self.approve(c);self.s.action(self.host,{'type':'signal','signal':{'type':'offer','sdp':'test'}})
        self.assertEqual(self.s.action(self.host,{'type':'poll'})['events'],[])
        self.assertEqual(len(self.s.action(c,{'type':'poll'})['events']),1)
        self.assertEqual(self.s.action(c,{'type':'poll'})['events'],[])
    def test_rate_limit(self):
        c=self.pair();self.approve(c)
        for i in range(240):self.send(c,i)
        with self.assertRaises(Denied):self.send(c,241)
        self.now+=1.1;self.send(c,242)
    def test_input_validation(self):
        invalid=[None,{}, {'kind':'move','x':math.nan,'y':0}, {'kind':'move','x':math.inf,'y':0},
                 {'kind':'move','x':True,'y':0}, {'kind':'move','x':-1,'y':0},
                 {'kind':'key','code':'MetaLeft','down':True}, {'kind':'button','button':True,'down':True},
                 {'kind':'key','code':'KeyW','down':'true'}, {'kind':'exec','command':'cmd.exe'}]
        for event in invalid:
            with self.subTest(event=event),self.assertRaises(Denied):validate_input(event)
    def test_touch_coordinates(self):
        self.assertEqual(validate_input({'kind':'move','x':0,'y':1}),{'kind':'move','x':0,'y':1})

if __name__ == '__main__':unittest.main()
