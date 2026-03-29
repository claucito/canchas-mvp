const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==================== SPORTS ====================
const SPORTS = [
  { id: 'futbol5', name: 'Fútbol 5', emoji: '⚽' },
  { id: 'futbol7', name: 'Fútbol 7', emoji: '⚽' },
  { id: 'paddle', name: 'Paddle', emoji: '🎾' },
  { id: 'basket', name: 'Basket', emoji: '🏀' },
  { id: 'tenis', name: 'Tenis', emoji: '🎾' },
  { id: 'voley', name: 'Vóley', emoji: '🏐' },
];

app.get('/api/sports', (req, res) => {
  res.json(SPORTS);
});

// ==================== COURTS ====================
app.get('/api/courts', (req, res) => {
  const { sport, active } = req.query;
  let query = 'SELECT * FROM courts WHERE 1=1';
  const params = [];

  if (sport) {
    query += ' AND sport = ?';
    params.push(sport);
  }
  if (active !== undefined) {
    query += ' AND active = ?';
    params.push(active === 'true' ? 1 : 0);
  }

  const courts = db.prepare(query).all(...params);
  res.json(courts.map(c => ({
    ...c,
    sport_info: SPORTS.find(s => s.id === c.sport) || { name: c.sport, emoji: '🏟️' }
  })));
});

app.get('/api/courts/:id', (req, res) => {
  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.id);
  if (!court) return res.status(404).json({ error: 'Cancha no encontrada' });
  
  res.json({
    ...court,
    sport_info: SPORTS.find(s => s.id === court.sport) || { name: court.sport, emoji: '🏟️' }
  });
});

app.post('/api/courts', (req, res) => {
  const { name, sport, location, price_hour } = req.body;
  
  if (!name || !sport) {
    return res.status(400).json({ error: 'Nombre y deporte son requeridos' });
  }

  const result = db.prepare(
    'INSERT INTO courts (name, sport, location, price_hour) VALUES (?, ?, ?, ?)'
  ).run(name, sport, location || '', price_hour || 0);

  const newCourt = db.prepare('SELECT * FROM courts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newCourt);
});

app.put('/api/courts/:id', (req, res) => {
  const { name, sport, location, price_hour, active } = req.body;
  const existing = db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Cancha no encontrada' });

  db.prepare(`
    UPDATE courts SET name = ?, sport = ?, location = ?, price_hour = ?, active = ?
    WHERE id = ?
  `).run(
    name ?? existing.name,
    sport ?? existing.sport,
    location ?? existing.location,
    price_hour ?? existing.price_hour,
    active ?? existing.active,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.id));
});

app.delete('/api/courts/:id', (req, res) => {
  db.prepare('DELETE FROM courts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== SLOTS (availability) ====================
app.get('/api/courts/:id/slots', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Fecha requerida (YYYY-MM-DD)' });

  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(req.params.id);
  if (!court) return res.status(404).json({ error: 'Cancha no encontrada' });

  const bookings = db.prepare(
    'SELECT time FROM bookings WHERE court_id = ? AND date = ?'
  ).all(req.params.id, date);

  const bookedTimes = new Set(bookings.map(b => b.time));

  // Generate slots from 08:00 to 23:00
  const slots = [];
  for (let h = 8; h <= 23; h++) {
    const time = `${h.toString().padStart(2, '0')}:00`;
    slots.push({
      time,
      available: !bookedTimes.has(time)
    });
  }

  res.json({ court: { id: court.id, name: court.name }, date, slots });
});

// ==================== BOOKINGS ====================
app.get('/api/bookings', (req, res) => {
  const { court_id, date, client_phone } = req.query;
  let query = 'SELECT b.*, c.name as court_name, c.sport FROM bookings b JOIN courts c ON b.court_id = c.id WHERE 1=1';
  const params = [];

  if (court_id) { query += ' AND b.court_id = ?'; params.push(court_id); }
  if (date) { query += ' AND b.date = ?'; params.push(date); }
  if (client_phone) { query += ' AND b.client_phone = ?'; params.push(client_phone); }

  const bookings = db.prepare(query).all(...params);
  res.json(bookings);
});

app.post('/api/bookings', (req, res) => {
  const { court_id, date, time, client_name, client_phone } = req.body;

  // Validate
  if (!court_id || !date || !time || !client_name || !client_phone) {
    return res.status(400).json({ error: 'Todos los campos son requeridos' });
  }

  // Phone format validation (simple)
  if (!/^[\d\s\-\+]{8,15}$/.test(client_phone)) {
    return res.status(400).json({ error: 'Teléfono inválido' });
  }

  // Check court exists
  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(court_id);
  if (!court) return res.status(404).json({ error: 'Cancha no encontrada' });

  // Check not already booked
  const existing = db.prepare(
    'SELECT * FROM bookings WHERE court_id = ? AND date = ? AND time = ?'
  ).get(court_id, date, time);

  if (existing) {
    return res.status(409).json({ error: 'Horario ya reservado' });
  }

  const result = db.prepare(
    'INSERT INTO bookings (court_id, date, time, client_name, client_phone) VALUES (?, ?, ?, ?, ?)'
  ).run(court_id, date, time, client_name, client_phone);

  const newBooking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...newBooking, court_name: court.name });
});

app.delete('/api/bookings/:id', (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ error: 'Reserva no encontrada' });

  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ==================== GAMES ====================
app.get('/api/games', (req, res) => {
  const { court_id, date } = req.query;
  let query = `
    SELECT g.*, c.name as court_name, c.sport, c.location,
           (SELECT COUNT(*) FROM game_participants WHERE game_id = g.id) as participants_count
    FROM games g
    JOIN courts c ON g.court_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (court_id) { query += ' AND g.court_id = ?'; params.push(court_id); }
  if (date) { query += ' AND g.date = ?'; params.push(date); }

  query += ' ORDER BY g.date ASC, g.time ASC';

  const games = db.prepare(query).all(...params);
  res.json(games.map(g => ({
    ...g,
    sport_info: SPORTS.find(s => s.id === g.sport) || { name: g.sport, emoji: '🏟️' },
    spots_left: g.players_needed - g.participants_count,
    is_full: g.participants_count >= g.players_needed
  })));
});

app.post('/api/games', (req, res) => {
  const { court_id, date, time, players_needed, title } = req.body;

  if (!court_id || !date || !time || players_needed === undefined) {
    return res.status(400).json({ error: 'court_id, date, time y players_needed son requeridos' });
  }

  const court = db.prepare('SELECT * FROM courts WHERE id = ?').get(court_id);
  if (!court) return res.status(404).json({ error: 'Cancha no encontrada' });

  const result = db.prepare(
    'INSERT INTO games (court_id, date, time, players_needed, title) VALUES (?, ?, ?, ?, ?)'
  ).run(court_id, date, time, players_needed, title || `${court.name} - ${date} ${time}`);

  const newGame = db.prepare('SELECT * FROM games WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...newGame, court_name: court.name });
});

app.post('/api/games/:id/join', (req, res) => {
  const { name, phone } = req.body;
  const gameId = req.params.id;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nombre y teléfono son requeridos' });
  }

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  if (!game) return res.status(404).json({ error: 'Juego no encontrado' });

  const currentCount = db.prepare(
    'SELECT COUNT(*) as count FROM game_participants WHERE game_id = ?'
  ).get(gameId).count;

  if (currentCount >= game.players_needed) {
    return res.status(409).json({ error: 'El juego ya está completo' });
  }

  const result = db.prepare(
    'INSERT INTO game_participants (game_id, name, phone) VALUES (?, ?, ?)'
  ).run(gameId, name, phone);

  res.status(201).json({ 
    id: result.lastInsertRowid, 
    game_id: gameId, 
    name, 
    phone 
  });
});

app.delete('/api/games/:id/leave', (req, res) => {
  const { phone } = req.body;
  const gameId = req.params.id;

  const participant = db.prepare(
    'SELECT * FROM game_participants WHERE game_id = ? AND phone = ?'
  ).get(gameId, phone);

  if (!participant) return res.status(404).json({ error: 'No estás anotado en este juego' });

  db.prepare('DELETE FROM game_participants WHERE id = ?').run(participant.id);
  res.json({ success: true });
});

app.get('/api/games/:id/participants', (req, res) => {
  const participants = db.prepare(
    'SELECT * FROM game_participants WHERE game_id = ? ORDER BY created_at ASC'
  ).all(req.params.id);

  res.json(participants);
});

// ==================== HEALTH ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Server] Canchas MVP running on http://0.0.0.0:${PORT}`);
});
