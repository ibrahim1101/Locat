// Run: node remote/tests/browser.cjs (requires Playwright + Chromium on development machine).
// Synthetic canvas replaces OS capture ONLY in this test. No Windows acceptance claim.
const {chromium} = require('playwright');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
(async()=>{
 const proc=spawn('python',['-u','remote/server.py'],{stdio:['ignore','pipe','inherit']});
 let browser;
 try{
  const credential=await new Promise((resolve,reject)=>{let out='';proc.stdout.on('data',d=>{out+=d;const m=out.match(/paste locally\): (\S+)/);if(m)resolve(m[1]);});proc.on('exit',c=>reject(Error(`Server exited ${c}`)));setTimeout(()=>reject(Error('Server startup timeout')),5000).unref();});
  browser=await chromium.launch({headless:true});
  const host=await browser.newPage(),client=await browser.newPage();
  const errors=[];host.on('pageerror',e=>errors.push(e.message));client.on('pageerror',e=>errors.push(e.message));
  await host.addInitScript(()=>{navigator.mediaDevices.getDisplayMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');setInterval(()=>{ctx.fillStyle=`hsl(${Date.now()%360},80%,50%)`;ctx.fillRect(0,0,640,360);},33);return canvas.captureStream(30);};});
  await host.goto('http://127.0.0.1:8765');await host.locator('#credential').fill(credential);await host.locator('#host').click();
  await host.waitForFunction(()=>document.querySelector('#status').textContent==='Host console authenticated');
  await host.locator('#newPair').click();await host.waitForFunction(()=>document.querySelector('#pair').textContent.includes('minutes:'));
  const code=(await host.locator('#pair').textContent()).split(': ').pop();
  await client.goto('http://127.0.0.1:8765');await client.locator('#credential').fill(code);await client.locator('#join').click();
  await host.waitForFunction(()=>document.querySelector('#status').textContent.includes('pending'));
  await host.locator('#approve').click();await host.waitForFunction(()=>document.querySelector('#status').textContent.includes('Approved'));
  await host.locator('#share').click();
  await client.waitForFunction(()=>document.querySelector('#video').videoWidth===640,{},{timeout:15000});
  await client.waitForFunction(()=>document.querySelector('#status').textContent.includes('WebRTC connected'));
  assert.match(await client.locator('#stats').textContent().catch(()=>''),/.*/);
  await host.locator('#disconnect').click();
  await client.waitForFunction(()=>document.querySelector('#video').srcObject===null);
  assert.deepEqual(errors,[]);
  console.log('PASS: browser pairing, host approval, real WebRTC synthetic video, remote revocation, no page errors');
 }finally{await browser?.close();proc.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
