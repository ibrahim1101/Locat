import http.client
import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from server import make_handler
from session import Session

class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.s=Session()
        self.server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(self.s,'http://127.0.0.1:8765'))
        threading.Thread(target=self.server.serve_forever,daemon=True).start()
    def tearDown(self):self.server.shutdown();self.server.server_close()
    def request(self,path,body,headers=None,method='POST'):
        c=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=2)
        h={'Host':'127.0.0.1:8765','Origin':'http://127.0.0.1:8765','Content-Type':'application/json'}
        h.update(headers or {})
        c.request(method,path,json.dumps(body),h);r=c.getresponse();data=r.read();status=r.status;headers=dict(r.getheaders());c.close()
        return status,data,headers
    def test_origin_denied(self):
        self.assertEqual(self.request('/pair',{'code':self.s.pair_code},{'Origin':'https://evil.example'})[0],403)
    def test_host_denied(self):
        self.assertEqual(self.request('/pair',{'code':self.s.pair_code},{'Host':'evil.example'})[0],403)
    def test_auth_required(self):self.assertEqual(self.request('/action',{'type':'approve'})[0],403)
    def test_pair_approve_poll_revoke(self):
        status,data,_=self.request('/pair',{'code':self.s.pair_code});self.assertEqual(status,200)
        token=json.loads(data)['token'];host={'Authorization':'Bearer '+self.s.host_token};client={'Authorization':'Bearer '+token}
        self.assertEqual(self.request('/action',{'type':'approve'},host)[0],200)
        self.assertEqual(self.request('/action',{'type':'poll'},client)[0],200)
        self.assertEqual(self.request('/action',{'type':'disconnect'},host)[0],200)
        self.assertEqual(self.request('/action',{'type':'poll'},client)[0],403)
    def test_size_and_content_type(self):
        self.assertEqual(self.request('/pair',{'code':'a'*70000})[0],400)
        self.assertEqual(self.request('/pair',{}, {'Content-Type':'text/plain'})[0],400)
    def test_static_allowlist(self):
        self.assertEqual(self.request('/session.py',{},method='GET')[0],404)
    def test_security_headers(self):
        status,_,headers=self.request('/',{},method='GET');self.assertEqual(status,200)
        self.assertEqual(headers['Cache-Control'],'no-store');self.assertIn("frame-ancestors 'none'",headers['Content-Security-Policy'])
    def test_non_object_json(self):self.assertEqual(self.request('/pair',[])[0],400)

class ClientOriginTests(unittest.TestCase):
    def test_explicit_packaged_origin_preflight_and_pairing(self):
        session=Session()
        server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(session,'http://127.0.0.1:8765',['https://tauri.localhost']))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2)
            h={'Host':'127.0.0.1:8765','Origin':'https://tauri.localhost','Content-Type':'application/json'}
            c.request('OPTIONS','/pair',headers=h);r=c.getresponse();self.assertEqual(r.status,200);self.assertEqual(r.getheader('Access-Control-Allow-Origin'),'https://tauri.localhost');r.read()
            c.request('POST','/pair',json.dumps({'code':session.pair_code}),h);r=c.getresponse();self.assertEqual(r.status,200);token=json.loads(r.read())['token']
            h['Authorization']='Bearer '+token
            c.request('POST','/action',json.dumps({'type':'approve','control':True}),h);r=c.getresponse();self.assertEqual(r.status,403);r.read();c.close()
        finally:server.shutdown();server.server_close()
    def test_unconfigured_origin_has_no_cors_permission(self):
        session=Session();server=ThreadingHTTPServer(('127.0.0.1',0),make_handler(session,'http://127.0.0.1:8765'))
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            c=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=2)
            c.request('OPTIONS','/pair',headers={'Host':'127.0.0.1:8765','Origin':'https://evil.example'});r=c.getresponse()
            self.assertEqual(r.status,403);self.assertIsNone(r.getheader('Access-Control-Allow-Origin'));r.read();c.close()
        finally:server.shutdown();server.server_close()
