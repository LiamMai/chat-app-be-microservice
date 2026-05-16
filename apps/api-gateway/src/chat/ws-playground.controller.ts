import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';

/**
 * Serves a browser-based WebSocket test playground at GET /api/ws-playground
 *
 * Not a production feature — dev/staging only.
 * Mirrors what Swagger does for REST, but for Socket.IO real-time events.
 */
@ApiExcludeController()
@Controller('api/ws-playground')
export class WsPlaygroundController {
  @Get()
  serve(@Res() res: Response) {
    res.setHeader('Content-Type', 'text/html');
    res.send(HTML);
  }
}

const HTML = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WebSocket Playground</title>
  <script src="https://cdn.socket.io/4.8.0/socket.io.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #1a1a2e; color: #e0e0e0; display: flex; flex-direction: column;
           height: 100vh; }
    header { background: #16213e; padding: 16px 24px; border-bottom: 1px solid #0f3460;
             display: flex; align-items: center; gap: 12px; }
    header h1 { font-size: 18px; color: #e94560; }
    header span { font-size: 12px; color: #888; }
    .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge.off  { background: #555; color: #ccc; }
    .badge.on   { background: #1a7a1a; color: #7fff7f; }

    .layout { display: flex; flex: 1; overflow: hidden; }

    .sidebar { width: 320px; min-width: 320px; background: #16213e;
               border-right: 1px solid #0f3460; display: flex; flex-direction: column;
               padding: 16px; gap: 12px; overflow-y: auto; }
    .sidebar h2 { font-size: 13px; color: #888; text-transform: uppercase;
                  letter-spacing: 1px; margin-bottom: 4px; }
    input, select, textarea {
      width: 100%; background: #0f3460; border: 1px solid #1a4a8a; border-radius: 6px;
      color: #e0e0e0; padding: 8px 10px; font-size: 13px; outline: none; }
    input:focus, textarea:focus { border-color: #e94560; }
    textarea { resize: vertical; min-height: 80px; font-family: monospace; }
    button { width: 100%; padding: 9px; border: none; border-radius: 6px; font-size: 13px;
             font-weight: 600; cursor: pointer; transition: opacity .15s; }
    button:hover { opacity: .85; }
    .btn-connect    { background: #e94560; color: #fff; }
    .btn-disconnect { background: #555;    color: #fff; }
    .btn-send       { background: #0f3460; color: #7fb3ff; border: 1px solid #1a4a8a; }
    .btn-quick      { background: #0a2040; color: #aac8ff; border: 1px solid #1a3a6a;
                      font-size: 12px; padding: 6px; margin-top: 2px; }
    .section { display: flex; flex-direction: column; gap: 6px; }
    hr { border: none; border-top: 1px solid #0f3460; margin: 4px 0; }

    .log-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .log-toolbar { background: #16213e; border-bottom: 1px solid #0f3460;
                   padding: 8px 16px; display: flex; align-items: center; gap: 8px;
                   font-size: 13px; }
    .log-toolbar button { width: auto; padding: 4px 12px; font-size: 12px;
                          background: #0f3460; color: #aaa; border: 1px solid #1a4a8a; }
    #log { flex: 1; overflow-y: auto; padding: 12px 16px; font-family: monospace;
           font-size: 13px; line-height: 1.6; }
    .log-row { padding: 3px 0; border-bottom: 1px solid #1a1a2e; word-break: break-all; }
    .log-row.info  { color: #7fb3ff; }
    .log-row.recv  { color: #7fff7f; }
    .log-row.send  { color: #ffd700; }
    .log-row.error { color: #ff6b6b; }
    .log-row .ts   { color: #555; margin-right: 8px; font-size: 11px; }
    .log-row .evt  { color: #e94560; margin-right: 6px; font-weight: 600; }
  </style>
</head>
<body>
<header>
  <h1>⚡ WebSocket Playground</h1>
  <span>Namespace: /chat</span>
  <span id="statusBadge" class="badge off">DISCONNECTED</span>
</header>

<div class="layout">
  <!-- Sidebar -->
  <div class="sidebar">

    <div class="section">
      <h2>Connection</h2>
      <input id="token" placeholder="Paste accessToken here" />
      <button class="btn-connect" onclick="connect()">Connect</button>
      <button class="btn-disconnect" onclick="disconnect()">Disconnect</button>
    </div>

    <hr />

    <div class="section">
      <h2>Join / Leave Room</h2>
      <input id="roomId" placeholder="roomId (MongoDB ObjectId)" />
      <button class="btn-quick" onclick="emit('join_room',  { roomId: roomIdVal() })">join_room</button>
      <button class="btn-quick" onclick="emit('leave_room', { roomId: roomIdVal() })">leave_room</button>
    </div>

    <hr />

    <div class="section">
      <h2>Send Message</h2>
      <input id="msgContent" placeholder="Message content" />
      <button class="btn-quick" onclick="sendMsg()">send_message</button>
    </div>

    <hr />

    <div class="section">
      <h2>Typing</h2>
      <button class="btn-quick" onclick="emit('typing_start', { roomId: roomIdVal() })">typing_start</button>
      <button class="btn-quick" onclick="emit('typing_stop',  { roomId: roomIdVal() })">typing_stop</button>
    </div>

    <hr />

    <div class="section">
      <h2>Heartbeat</h2>
      <button class="btn-quick" onclick="emit('heartbeat', {})">heartbeat</button>
    </div>

    <hr />

    <div class="section">
      <h2>Custom Event</h2>
      <input  id="customEvt"  placeholder="event name" value="join_room" />
      <textarea id="customData" placeholder='{ "roomId": "..." }'>{ "roomId": "" }</textarea>
      <button class="btn-send" onclick="sendCustom()">Send</button>
    </div>

  </div>

  <!-- Log -->
  <div class="log-area">
    <div class="log-toolbar">
      <span>Event log</span>
      <button onclick="clearLog()">Clear</button>
    </div>
    <div id="log"></div>
  </div>
</div>

<script>
  let socket = null;

  const LISTEN_EVENTS = [
    'joined_room', 'left_room',
    'new_message', 'message_edited', 'message_deleted', 'message_read',
    'reaction_added', 'reaction_removed',
    'user_typing',
    'user_online', 'user_offline',
    'heartbeat_ack',
  ];

  function ts() {
    return new Date().toLocaleTimeString('en', { hour12: false });
  }

  function addLog(cls, event, data) {
    const el = document.getElementById('log');
    const row = document.createElement('div');
    row.className = 'log-row ' + cls;
    const payload = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    row.innerHTML =
      '<span class="ts">' + ts() + '</span>' +
      '<span class="evt">' + event + '</span>' +
      payload;
    el.appendChild(row);
    el.scrollTop = el.scrollHeight;
  }

  function clearLog() { document.getElementById('log').innerHTML = ''; }

  function setStatus(connected) {
    const b = document.getElementById('statusBadge');
    b.textContent   = connected ? 'CONNECTED' : 'DISCONNECTED';
    b.className     = 'badge ' + (connected ? 'on' : 'off');
  }

  function roomIdVal() { return document.getElementById('roomId').value.trim(); }

  function connect() {
    if (socket?.connected) { addLog('info', 'info', 'Already connected'); return; }
    const token = document.getElementById('token').value.trim();
    if (!token) { addLog('error', 'error', 'Paste an accessToken first'); return; }

    socket = io('/chat', {
      auth: { token },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setStatus(true);
      addLog('info', 'connect', { socketId: socket.id });
    });

    socket.on('disconnect', (reason) => {
      setStatus(false);
      addLog('info', 'disconnect', { reason });
    });

    socket.on('connect_error', (err) => {
      addLog('error', 'connect_error', err.message);
    });

    LISTEN_EVENTS.forEach((evt) => {
      socket.on(evt, (data) => addLog('recv', evt, data));
    });
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    setStatus(false);
  }

  function emit(event, data) {
    if (!socket?.connected) { addLog('error', 'error', 'Not connected'); return; }
    socket.emit(event, data);
    addLog('send', event, data);
  }

  function sendMsg() {
    const content = document.getElementById('msgContent').value.trim();
    if (!content) return;
    emit('send_message', { roomId: roomIdVal(), content });
    document.getElementById('msgContent').value = '';
  }

  function sendCustom() {
    const event = document.getElementById('customEvt').value.trim();
    let data = {};
    try { data = JSON.parse(document.getElementById('customData').value); } catch {}
    emit(event, data);
  }

  // Allow Enter key in message input
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('msgContent').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
    });
  });
</script>
</body>
</html>`;
