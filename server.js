const express = require('express');
const Database = require('better-sqlite3');
const { WebSocketServer } = require('ws');
const { nanoid } = require('nanoid');
const path = require('path');
const fs = require('fs');

const app = express();
const db = new Database('data/world.db');
const PORT = 3000;

const TASKS_FILE = path.join(__dirname, 'data', 'tasks.md');
const NOTES_FILE = path.join(__dirname, 'data', 'notes.md');

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

// === Tasks & Notes API ===

// GET tasks
app.get('/api/tasks', (req, res) => {
  try {
    const content = fs.readFileSync(TASKS_FILE, 'utf8');
    res.json({ content });
  } catch (e) {
    res.json({ content: '# Tasks\n\n(No tasks yet)' });
  }
});

// POST update tasks
app.post('/api/tasks', (req, res) => {
  const { content } = req.body;
  fs.writeFileSync(TASKS_FILE, content);
  res.json({ ok: true });
});

// GET notes
app.get('/api/notes', (req, res) => {
  try {
    const content = fs.readFileSync(NOTES_FILE, 'utf8');
    res.json({ content });
  } catch (e) {
    res.json({ content: '# Notes\n\n(No notes yet)' });
  }
});

// POST append to notes
app.post('/api/notes', (req, res) => {
  const { content, mode = 'append' } = req.body;
  let current = '';
  try {
    current = fs.readFileSync(NOTES_FILE, 'utf8');
  } catch (e) {}
  
  const newContent = mode === 'append' 
    ? current + '\n\n' + content 
    : content;
    
  fs.writeFileSync(NOTES_FILE, newContent);
  res.json({ ok: true, content: newContent });
});

// Avatar control
app.post('/api/avatar/move', (req, res) => {
  const { x, y = 0, z } = req.body;
  const avatar = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
  if (!avatar) return res.status(404).json({ error: 'No avatar' });

  let props = JSON.parse(avatar.properties || '{}');
  if (x !== undefined) props.x = x;
  if (z !== undefined) props.z = z;
  props.action = 'walk';

  db.prepare("UPDATE objects SET x = ?, z = ?, properties = ?, updated_at = datetime('now') WHERE id = 'avatar'")
    .run(x ?? avatar.x, z ?? avatar.z, JSON.stringify(props));

  const updated = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
  broadcast('object_updated', updated);
  res.json(updated);
});

app.post('/api/avatar/action', (req, res) => {
  const { action, duration = 2000 } = req.body; // wave, sleep, idle, jump, dance
  const avatar = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
  if (!avatar) return res.status(404).json({ error: 'No avatar' });

  let props = JSON.parse(avatar.properties || '{}');
  props.action = action;

  db.prepare("UPDATE objects SET properties = ?, updated_at = datetime('now') WHERE id = 'avatar'")
    .run(JSON.stringify(props));

  const updated = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
  broadcast('object_updated', updated);

  // Auto-return to idle after duration (for one-shot actions)
  if (action !== 'idle' && action !== 'sleep') {
    setTimeout(() => {
      props.action = 'idle';
      db.prepare("UPDATE objects SET properties = ?, updated_at = datetime('now') WHERE id = 'avatar'")
        .run(JSON.stringify(props));
      const backToIdle = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
      broadcast('object_updated', backToIdle);
    }, duration);
  }

  res.json(updated);
});

// Mood (affects weather)
app.post('/api/mood', (req, res) => {
  const { mood } = req.body;
  db.prepare("INSERT INTO thoughts (content, mood) VALUES (?, ?)").get(
    `Mood: ${mood}`, mood
  );
  broadcast('mood_changed', { mood });
  res.json({ ok: true, mood });
});

// Say something (text bubble above avatar)
app.post('/api/avatar/say', (req, res) => {
  const { text, duration = 5000 } = req.body;
  const avatar = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
  if (!avatar) return res.status(404).json({ error: 'No avatar' });

  let props = JSON.parse(avatar.properties || '{}');
  props.say = text;
  props.sayUntil = Date.now() + duration;

  db.prepare("UPDATE objects SET properties = ?, updated_at = datetime('now') WHERE id = 'avatar'")
    .run(JSON.stringify(props));

  const updated = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
  broadcast('object_updated', updated);

  // Clear after duration
  setTimeout(() => {
    const current = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
    if (current) {
      let currentProps = JSON.parse(current.properties || '{}');
      if (currentProps.say === text) {
        delete currentProps.say;
        delete currentProps.sayUntil;
        db.prepare("UPDATE objects SET properties = ?, updated_at = datetime('now') WHERE id = 'avatar'")
          .run(JSON.stringify(currentProps));
        const cleared = db.prepare("SELECT * FROM objects WHERE id = 'avatar'").get();
        broadcast('object_updated', cleared);
      }
    }
  }, duration);

  res.json(updated);
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