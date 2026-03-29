# SPEC.md — Canchas: Reserva de Horas + Cupos Libres

## 1. Concept & Vision

Una app MVP para reservar canchas deportivas y publicar cuando faltan jugadores para completar un partido. Minimalista pero funcional — sin fricciones, focalizada en lo esencial: ver disponibilidad, reservar, y anotarse cuando falta gente.

**Nombre:** Canchas

---

## 2. Design Language

- **Estética:** Sporty-modern, verde energía sobre fondo oscuro
- **Colores:**
  - Primary: `#00d26a` (verde campo)
  - Secondary: `#1a1a2e` (fondo oscuro)
  - Accent: `#ff6b35` (naranja para CTAs y alertas)
  - Background: `#0f0f1a`
  - Text: `#ffffff` / `#a0a0b0`
- **Tipografía:** Inter (Google Fonts), fallback sans-serif
- **Iconos:** Emojis unicode (⚽🏀🎾) — simple y sin dependencias extra
- **UI:** Tailwind via CDN para velocidad de desarrollo

---

## 3. Layout & Structure

**Pages:**

1. **`/` — Home/Dashboard**
   - Selector de deporte
   - Lista de canchas disponibles
   - Botón "Reservar" en cada una

2. **`/court/:id` — Detalle de Cancha**
   - Info de la cancha (deporte, ubicación, precio)
   - Calendario con horarios disponibles
   - Formulario de reserva

3. **`/games` — Juegos que faltan jugadores**
   - Cards de partidos publicados donde faltan X jugadores
   - Botón "Me anoto" para filling the gap

4. **`/my-bookings` — Mis Reservas**
   - Lista de reservas propias
   - Juegos en los que estoy anotado

5. **`/admin` — Admin (simplificado)**
   - Crear/editar canchas
   - Publicar juego con cupos faltantes

---

## 4. Features & Interactions

### 4.1 Canchas
- CRUD de canchas (nombre, deporte, ubicación, precio/hora)
- Deportes soportados: Fútbol 5, Fútbol 7, Paddle, Basket, Tenis, Vóley
- Horarios disponibles: 08:00 a 23:00, bloques de 1 hora

### 4.2 Reservas
- Seleccionar fecha + hora + cancha
- Nombre del responsable + teléfono (validado)
- Guardar en SQLite
- No permitir doble-booking (disponible vs reservado)

### 4.3 Juegos con Cupos Faltantes
- El admin (o usuario) publica: "Cancha X, Fecha Y, Hora Z, faltan N jugadores"
-others can sign up until full
- Verwho's already signed up

### 4.4 Participantes
- Anotarse en un juego abierto
- Datos: nombre + teléfono
- Lista visible de inscriptos

---

## 5. Component Inventory

### CourtCard
- Nombre + deporte (emoji) + ubicación
- Precio/hora
- Badge "Disponible" o "No disponible"
- Hover: slight lift + glow

### TimeSlot
- Hora (HH:00)
- Estado: disponible (verde), reservado (rojo/tachado)
- Click: abre modal de reserva

### GameCard
- Cancha + fecha/hora
- Deportista + deporte
- Progreso: "3/10 anotados"
- Barra de progreso visual
- CTA: "Me anoto" (si hay lugar)

### BookingModal
- Campos: nombre, teléfono
- Validación inline
- Submit → guardar → cerrar modal → refresh

### AlertToast
- Success (verde), Error (rojo), Info (azul)
- Aparece top-right, se auto-dismiss en 3s

---

## 6. Technical Approach

### Stack
- **Runtime:** Node.js v24
- **Backend:** Express.js
- **Frontend:** HTML5 + Vanilla JS + Tailwind (CDN)
- **Database:** SQLite (better-sqlite3)
- **Ports:** App en `:3000`, nginx reverse-proxy en `:80`

### API Endpoints

```
GET    /api/courts              → lista de canchas
POST   /api/courts              → crear cancha
GET    /api/courts/:id          → detalle cancha
GET    /api/courts/:id/slots?date=YYYY-MM-DD  → horarios disponibles

GET    /api/bookings            → todas las reservas
POST   /api/bookings            → crear reserva
DELETE /api/bookings/:id        → cancelar reserva

GET    /api/games               → juegos abiertos
POST   /api/games               → publicar juego
POST   /api/games/:id/join      → anotarse
DELETE /api/games/:id/leave     → desanotarse

GET    /api/sports              → lista de deportes
```

### Data Model

```sql
CREATE TABLE courts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sport TEXT NOT NULL,        -- 'futbol5', 'paddle', 'basket', etc.
  location TEXT,
  price_hour REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court_id INTEGER REFERENCES courts(id),
  date TEXT NOT NULL,         -- YYYY-MM-DD
  time TEXT NOT NULL,         -- HH:00
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(court_id, date, time)
);

CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  court_id INTEGER REFERENCES courts(id),
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  players_needed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id INTEGER REFERENCES games(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Security
- Input sanitization en todos los endpoints
- Phone validation (regex básico)
- No SQL injection (parameterized queries via better-sqlite3)
- CORS configurado

### Deployment
- Repo: `claucito/canchas-mvp`
- nginx reverse-proxy: `/` → `localhost:3000`
- systemd service opcional para mantener vivo el proceso
