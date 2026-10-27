'use strict';
const crypto = require('crypto');
const VERSION = '45.1.0';
const TICKET_TTL_MS = 60_000;
const FRAME_MARKER = 0xA5;
const FRAME_VERSION = 0x01;
const tickets = new Map();
const peers = new Set();
const rate = new WeakMap();

function issueTicket(user) {
  const ticket = crypto.randomBytes(24).toString('hex');
  tickets.set(ticket, { user: { id: user?.id || user?.username || 'unknown', username: user?.username || 'operator', role: user?.role || 'operator' }, expiresAt: Date.now() + TICKET_TTL_MS, used: false });
  return { ticket, expiresAt: tickets.get(ticket).expiresAt };
}
function consumeTicket(ticket) {
  const rec = tickets.get(String(ticket || ''));
  if (!rec || rec.used || rec.expiresAt < Date.now()) { tickets.delete(String(ticket || '')); return null; }
  rec.used = true; tickets.delete(String(ticket || '')); return rec.user;
}
function cleanupTickets() { const now = Date.now(); for (const [k,v] of tickets) if (v.expiresAt < now || v.used) tickets.delete(k); }
function frame(operatorIndex, x, y) {
  const b = Buffer.alloc(9);
  b.writeUInt8(FRAME_MARKER, 0); b.writeUInt8(FRAME_VERSION, 1);
  b.writeUInt8(operatorIndex & 0xff, 2); b.writeUInt16BE(Math.max(0, Math.min(65535, Math.round(x * 65535))), 3);
  b.writeUInt16BE(Math.max(0, Math.min(65535, Math.round(y * 65535))), 5);
  b.writeUInt16BE(Math.floor(Date.now() / 30000) & 0xffff, 7);
  return b;
}
function parse(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length !== 9 || buffer[0] !== FRAME_MARKER || buffer[1] !== FRAME_VERSION) return null;
  const slice = Math.floor(Date.now() / 30000) & 0xffff, sent = buffer.readUInt16BE(7);
  if (Math.abs(sent - slice) > 1) return null;
  return { operatorIndex: buffer[2], x: buffer.readUInt16BE(3) / 65535, y: buffer.readUInt16BE(5) / 65535 };
}
function allow(socket) {
  const now = Date.now(), r = rate.get(socket) || { at: now, count: 0 };
  if (now - r.at >= 1000) { r.at = now; r.count = 0; }
  r.count += 1; rate.set(socket, r); return r.count <= 30;
}
function summary() { return { version: VERSION, authenticated: true, ticketTtlMs: TICKET_TTL_MS, connectedOperators: peers.size, binaryTelemetry: true, maxFramesPerSecond: 30 }; }
module.exports = { VERSION, issueTicket, consumeTicket, cleanupTickets, frame, parse, allow, peers, summary };
