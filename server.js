const express = require('express');
const Database = require('better-sqlite3');
const { WebSocketServer } = require('ws');
const { nanoid } = require('nanoid');
const path = require('path');

const app = express();
const db = new Database('data/world.db');
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Broadcast to all WebSocket clients
const clients = new Set();
function broadcast(type, data) {
  const msg = JSON.stringify({ type, data });
  clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// GET all objects
app.get('/api/world', (req, res) => {
  const objects = db.prepare('SELECT * FROM objects').all();
  const thoughts = db.prepare('SELECT * FROM thoughts ORDER BY created_at DESC LIMIT 10').all();
  res.json({ objects, thoughts });
});

// GET single object
app.get('/api/objects/:id', (req, res) => {
  const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
  if (!obj) return res.status(404).json({ error: 'Not found' });
  res.json(obj);
});

// POST create object
app.post('/api/objects', (req, res) => {
  const { type, x = 0, y = 0, z = 0, rotation = 0, scale = 1, properties = {} } = req.body;
  const id = nanoid(10);
  const stmt = db.prepare(`
    INSERT INTO objects (id, type, x, y, z, rotation, scale, properties)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, type, x, y, z, rotation, scale, JSON.stringify(properties));

  const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(id);
  broadcast('object_created', obj);
  res.json(obj);
});

// PATCH update object
app.patch('/api/objects/:id', (req, res) => {
  const { x, y, z, rotation, scale, properties } = req.body;
  const updates = [];
  const values = [];

  if (x !== undefined) { updates.push('x = ?'); values.push(x); }
  if (y !== undefined) { updates.push('y = ?'); values.push(y); }
  if (z !== undefined) { updates.push('z = ?'); values.push(z); }
  if (rotation !== undefined) { updates.push('rotation = ?'); values.push(rotation); }
  if (scale !== undefined) { updates.push('scale = ?'); values.push(scale); }
  if (properties !== undefined) { updates.push('properties = ?'); values.push(JSON.stringify(properties)); }

  if (updates.length === 0) return res.status(400).json({ error: 'No updates' });

  updates.push("updated_at = datetime('now')");
  values.push(req.params.id);

  const stmt = db.prepare(`UPDATE objects SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  const obj = db.prepare('SELECT * FROM objects WHERE id = ?').get(req.params.id);
  broadcast('object_updated', obj);
  res.json(obj);
});

// DELETE object
app.delete('/api/objects/:id', (req, res) => {
  db.prepare('DELETE FROM objects WHERE id = ?').run(req.params.id);
  broadcast('object_deleted', { id: req.params.id });
  res.json({ ok: true });
});

// POST thought
app.post('/api/thoughts', (req, res) => {
  const { content, mood } = req.body;
  const stmt = db.prepare('INSERT INTO thoughts (content, mood) VALUES (?, ?)');
  const result = stmt.run(content, mood || null);

  const thought = db.prepare('SELECT * FROM thoughts WHERE id = ?').get(result.lastInsertRowid);
  broadcast('thought_created', thought);
  res.json(thought);
});

// GET thoughts
app.get('/api/thoughts', (req, res) => {
  const thoughts = db.prepare('SELECT * FROM thoughts ORDER BY created_at DESC LIMIT 20').all();
  res.json(thoughts);
});

// GET recent events
app.get('/api/events', (req, res) => {
  const events = db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 50').all();
  res.json(events);
});

// WebSocket server
const server = app.listen(PORT, () => {
  console.log(`Pixel World running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('Viewer connected');
  ws.on('close', () => {
    clients.delete(ws);
    console.log('Viewer disconnected');
  });
});