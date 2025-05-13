// public/script.js
const localVideo  = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const startBtn    = document.getElementById('startBtn');
const hangupBtn   = document.getElementById('hangupBtn');
const socket = new WebSocket(
  (location.protocol === 'https:' ? 'wss' : 'ws') + '://' + location.host
);

let pc;                     // PeerConnection referansı
let roleResolve;           
const rolePromise = new Promise(res => { roleResolve = res; });

// 1) Kamerayı hazırla
const readyStream = navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then(stream => {
    localVideo.srcObject = stream;
    return stream;
  })
  .catch(err => console.error('getUserMedia error:', err));

// 2) Signaling mesajları
socket.onmessage = async event => {
  const raw = event.data instanceof Blob ? await event.data.text() : event.data;
  const msg = JSON.parse(raw);

  if (msg.type === 'role') {
    roleResolve(msg.isOfferer);
    return;
  }
  if (!pc) return;  // pc henüz yoksa bekle

  switch(msg.type) {
    case 'offer':
      await readyStream;
      await pc.setRemoteDescription(msg.offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.send(JSON.stringify({ type:'answer', answer }));
      startBtn.disabled = true;
      hangupBtn.disabled = false;
      break;

    case 'answer':
      await pc.setRemoteDescription(msg.answer);
      startBtn.disabled = true;
      hangupBtn.disabled = false;
      break;

    case 'candidate':
      await pc.addIceCandidate(msg.candidate);
      break;
  }
};

// 3) PeerConnection yaratıp handler’ları bağlayan fonksiyon
function createPeerConnection() {
  const iceConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  pc = new RTCPeerConnection(iceConfig);

  // ICE adayları
  pc.onicecandidate = ev => {
    if (ev.candidate) {
      socket.send(JSON.stringify({ type:'candidate', candidate: ev.candidate }));
    }
  };

  // Uzaktan akışı göster
  pc.ontrack = ev => {
    remoteVideo.srcObject = ev.streams[0];
  };

  // Dilersen durum değişimini logla
  pc.oniceconnectionstatechange = () => {
    console.log('ICE state:', pc.iceConnectionState);
  };

  // Local stream’i ekle
  readyStream.then(stream => {
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
  });
}

// 4) Çağrıyı başlatan buton
startBtn.onclick = async () => {
  // Yeni bir PeerConnection kur
  createPeerConnection();

  const isOfferer = await rolePromise;
  if (!isOfferer) return alert('Siz answerer’sınız, diğer taraftan başlatın.');

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  socket.send(JSON.stringify({ type:'offer', offer }));

  startBtn.disabled = true;
  hangupBtn.disabled = false;
};

// 5) Hangup: PC’yi kapat, reset
hangupBtn.onclick = () => {
  if (pc) {
    pc.getSenders().forEach(sender => pc.removeTrack(sender));
    pc.close();
    pc = null;
  }
  remoteVideo.srcObject = null;
  startBtn.disabled = false;
  hangupBtn.disabled = true;
};
