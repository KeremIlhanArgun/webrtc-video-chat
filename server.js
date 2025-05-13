// server.js
const express   = require('express');
const app       = express();
const path      = require('path');
const http      = require('http');
const WebSocket = require('ws');

const server = http.createServer(app);
const wss    = new WebSocket.Server({ server });
let clients  = [];

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', ws => {
  clients.push(ws);

  // Sadece 2 client bağlandığında rolleri bildir
  if (clients.length === 2) {
    clients.forEach((client, idx) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({
          type: 'role',
          isOfferer: idx === 0   // ilk bağlanan offerer
        }));
      }
    });
  }

  ws.on('message', msg => {
    // Gelen offer/answer/candidate mesajını diğerine yayınla
    wss.clients.forEach(c => {
      if (c !== ws && c.readyState === WebSocket.OPEN) {
        c.send(msg);
      }
    });
  });

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

server.listen(3000, () => {
  console.log('Sunucu http://localhost:3000 adresinde çalışıyor');
});
