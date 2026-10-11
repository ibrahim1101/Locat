const $ = id => document.getElementById(id);
let token = '', role = '', peer, stream, polling = false, seq = 0, approved = false, control = false;
let generation = 0, candidates = [], inputChain = Promise.resolve(), lastMove = 0;
const held = new Set();
function status(text) { $('status').textContent = text; }
async function request(path, body) {
  const response = await fetch(path, {method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`}, body:JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Request failed');
  return result;
}
const action = body => request('/action', body);
function dispose() {
  generation++; approved = control = false;
  if (peer) { peer.onconnectionstatechange = null; peer.close(); peer = null; }
  if (stream) { stream.getTracks().forEach(t => {t.onended = null; t.stop();}); stream = null; }
  $('video').srcObject = null; candidates = []; held.clear();
}
async function disconnect() {
  try { if(token) await action({type:'disconnect'}); } finally { dispose(); token = ''; status('Disconnected; host authorization revoked'); }
}
function guarded(fn) { return () => fn().catch(e => status(e.message)); }
$('host').onclick = guarded(async () => {
  await disconnect(); token = $('credential').value.trim(); $('credential').value = '';
  await action({type:'status'}); role = 'host'; $('hostPanel').hidden = false;
  status('Host console authenticated'); poll();
});
$('join').onclick = guarded(async () => {
  await disconnect(); const code = $('credential').value.trim(); $('credential').value = '';
  const result = await request('/pair', {code}); token = result.token; role = 'client'; $('hostPanel').hidden = true;
  status('Waiting for explicit host approval'); poll();
});
$('newPair').onclick = guarded(async () => {
  dispose(); const result = await action({type:'pairing'});
  $('pair').textContent = `One-use invitation, valid 5 minutes: ${result.code}`; status('Waiting for viewer');
});
$('approve').onclick = guarded(async () => {
  const result = await action({type:'approve', control:$('control').checked});
  control = result.control; approved = true; status(`Approved: ${control ? 'view and control' : 'view only'}`);
});
function createPeer() {
  if(peer) peer.close();
  const connection = new RTCPeerConnection({iceServers:[]}); peer = connection;
  connection.onicecandidate = e => { if(e.candidate) action({type:'signal', signal:{type:'candidate', candidate:e.candidate.toJSON()}}).catch(e => status(e.message)); };
  connection.ontrack = e => { $('video').srcObject = e.streams[0]; $('video').play().catch(() => status('Tap video to play')); };
  connection.onconnectionstatechange = () => {
    status(`WebRTC ${connection.connectionState} · ${control ? 'control enabled' : 'view only'}`);
    if(['failed','closed','disconnected'].includes(connection.connectionState)) disconnect().catch(e => status(e.message));
  };
  return connection;
}
async function settings() {
  const width = Number($('resolution').value), fps = Number($('fps').value), bitrate = Number($('bitrate').value);
  if(!Number.isFinite(bitrate) || bitrate < 1 || bitrate > 50) throw new Error('Bitrate must be 1–50 Mbps');
  if(stream) await stream.getVideoTracks()[0].applyConstraints({width:{ideal:width},height:{ideal:width*9/16},frameRate:{ideal:fps,max:fps}});
  if(peer) for(const sender of peer.getSenders()) if(sender.track?.kind === 'video') {
    const params = sender.getParameters(); if(!params.encodings?.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = bitrate*1000000; params.encodings[0].maxFramerate = fps;
    await sender.setParameters(params);
  }
}
$('settings').onclick = guarded(settings);
$('revokeControl').onclick = guarded(async () => {await action({type:'revoke-control'}); control=false; status('Control revoked; viewing remains approved');});
$('share').onclick = guarded(async () => {
  if(role !== 'host' || !approved) throw new Error('Approve a viewer first');
  if(stream || peer) throw new Error('Disconnect and pair again before selecting another screen');
  stream = await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
  const track = stream.getVideoTracks()[0]; track.contentHint = 'motion'; track.onended = () => disconnect().catch(e => status(e.message));
  $('video').srcObject = stream;
  const connection = createPeer(); stream.getTracks().forEach(t => connection.addTrack(t, stream));
  await settings(); await connection.setLocalDescription(await connection.createOffer());
  await action({type:'signal',signal:{type:'offer',sdp:connection.localDescription.sdp}});
});
$('disconnect').onclick = guarded(disconnect);
async function receive(signal) {
  if(signal.type === 'offer') {
    const connection = createPeer(); await connection.setRemoteDescription({type:'offer',sdp:signal.sdp});
    for(const candidate of candidates) await connection.addIceCandidate(candidate); candidates = [];
    await connection.setLocalDescription(await connection.createAnswer());
    await action({type:'signal',signal:{type:'answer',sdp:connection.localDescription.sdp}});
  } else if(signal.type === 'answer') {
    if(!peer) throw new Error('No pending offer');
    await peer.setRemoteDescription({type:'answer',sdp:signal.sdp});
    for(const candidate of candidates) await peer.addIceCandidate(candidate); candidates = [];
  } else if(peer?.remoteDescription) await peer.addIceCandidate(signal.candidate);
  else candidates.push(signal.candidate);
}
async function poll() {
  if(polling) return; polling = true;
  try {
    while(token) {
      const current = generation, result = await action({type:'poll'});
      if(current !== generation) continue;
      approved = result.state === 'approved'; control = result.control;
      if(result.state === 'closed') { dispose(); status('Session revoked'); if(role === 'client') {token=''; break;} }
      if(result.state === 'pending') status('Viewer pending host approval');
      for(const signal of result.events) await receive(signal);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  } catch(e) { dispose(); token = ''; status(e.message); } finally { polling = false; }
}
function input(event) {
  if(role !== 'client' || !approved || !control || peer?.connectionState !== 'connected') return;
  const current = generation, n = ++seq;
  inputChain = inputChain.then(async () => {if(current === generation && token) await action({type:'input',seq:n,event});}).catch(e => {status(e.message);});
}
function position(e) {
  const rect = $('video').getBoundingClientRect(), video = $('video');
  if(!video.videoWidth || !video.videoHeight) return null;
  const scale = Math.min(rect.width / video.videoWidth, rect.height / video.videoHeight);
  const w = video.videoWidth*scale, h = video.videoHeight*scale;
  const x = (e.clientX - rect.left - (rect.width-w)/2)/w, y = (e.clientY - rect.top - (rect.height-h)/2)/h;
  return x>=0 && x<=1 && y>=0 && y<=1 ? {kind:'move',x,y} : null;
}
$('video').onpointermove = e => {const now = performance.now(); if(now-lastMove<33)return; lastMove=now; const p=position(e); if(p)input(p);};
$('video').onpointerdown = e => {const p=position(e); if(!p)return; e.preventDefault(); $('video').focus(); $('video').setPointerCapture(e.pointerId); input(p); input({kind:'button',button:e.pointerType==='touch'?0:e.button,down:true});};
$('video').onpointerup = e => input({kind:'button',button:e.pointerType==='touch'?0:e.button,down:false});
$('video').onpointercancel = () => {for(let button=0;button<3;button++)input({kind:'button',button,down:false});};
$('video').oncontextmenu = e => e.preventDefault();
$('video').onkeydown = e => {if(e.repeat)return; e.preventDefault();held.add(e.code);input({kind:'key',code:e.code,down:true});};
$('video').onkeyup = e => {e.preventDefault();held.delete(e.code);input({kind:'key',code:e.code,down:false});};
function releaseKeys() {for(const code of held)input({kind:'key',code,down:false});held.clear();for(let button=0;button<3;button++)input({kind:'button',button,down:false});}
$('video').onblur = releaseKeys;
document.addEventListener('visibilitychange', () => {if(document.hidden) releaseKeys();});
// Explicit controller-to-keyboard emulation, not a virtual XInput controller.
let padHeld = new Set();
setInterval(() => {
  const next = new Set();
  if($('gamepad').checked && document.activeElement === $('video') && !document.hidden) {
    const pad = Array.from(navigator.getGamepads?.() || []).find(Boolean);
    if(pad) {if(pad.axes[0]<-.35)next.add('KeyA');if(pad.axes[0]>.35)next.add('KeyD');if(pad.axes[1]<-.35)next.add('KeyW');if(pad.axes[1]>.35)next.add('KeyS');
      [ 'Space','Escape','KeyE','KeyR'].forEach((code,i)=>{if(pad.buttons[i]?.pressed)next.add(code);});
      ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].forEach((code,i)=>{if(pad.buttons[i+12]?.pressed)next.add(code);});}
  }
  for(const code of padHeld)if(!next.has(code))input({kind:'key',code,down:false});
  for(const code of next)if(!padHeld.has(code))input({kind:'key',code,down:true});
  padHeld = next;
},50);
setInterval(async () => {
  if(!peer)return;
  const report=await peer.getStats(); const lines=[];
  report.forEach(r=>{if(r.type==='inbound-rtp' && r.kind==='video')lines.push(`Received ${r.frameWidth}×${r.frameHeight}, ${r.framesPerSecond || '?'} FPS; packets lost ${r.packetsLost}`);if(r.type==='outbound-rtp'&&r.kind==='video')lines.push(`Encoded ${r.framesPerSecond || '?'} FPS; encoder ${r.encoderImplementation || 'browser-selected'}`);});
  $('stats').textContent=lines.join('\n');
},2000);
