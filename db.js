const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'canchas.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sport TEXT NOT NULL,
    location TEXT,
    price_hour REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_id INTEGER REFERENCES courts(id),
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_phone TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(court_id, date, time)
  );

  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_id INTEGER REFERENCES courts(id),
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    players_needed INTEGER DEFAULT 0,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS game_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER REFERENCES games(id),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed some initial courts if empty
const courtCount = db.prepare('SELECT COUNT(*) as count FROM courts').get();
if (courtCount.count === 0) {
  const insert = db.prepare('INSERT INTO courts (name, sport, location, price_hour) VALUES (?, ?, ?, ?)');
  insert.run('Cancha Central', 'futbol5', 'Av. Brasil 1234', 800);
  insert.run('Paddle Pro', 'paddle', 'Pocitos, Juan Díaz 2345', 600);
  insert.run('Sport Arena', 'basket', 'Pereira 5678', 500);
  insert.run('Tennis Club', 'tenis', 'Malvín, Perimetral 890', 700);
  insert.run('F5 Express', 'futbol5', 'Centro, Yi 1122', 650);
  insert.run('Multi Court', 'voley', 'Buena Vista, Italia 3344', 450);
  console.log('[DB] Initial courts seeded');
}

module.exports = db;
