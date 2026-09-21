const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./game.db');

const weaponStats = {
  glock: { name: 'Glock', damage: 9, price: 0 },
  knife: { name: 'Knife', damage: 6, price: 300 },
  mp5: { name: 'MP5', damage: 13, price: 250 },
  ak47: { name: 'AK47', damage: 19, price: 650 },
  rpg: { name: 'RPG', damage: 35, price: 12500 }
};

const difficultyStats = {
  weak: { label: 'ضعيف', min: 1, max: 15 },
  medium: { label: 'متوسط', min: 15, max: 30 },
  hard: { label: 'صعب', min: 30, max: 60 },
  global: { label: 'عالمي', min: 100, max: 300 }
};

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      coins INTEGER DEFAULT 0,
      weapon TEXT DEFAULT 'glock',
      damage INTEGER DEFAULT 9,
      speed INTEGER DEFAULT 1,
      level INTEGER DEFAULT 1
    )
  `);
});

const players = new Map();

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Server is running' });
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('register', ({ username, password }) => {
    const cleanUsername = String(username || '').trim();
    if (!cleanUsername || cleanUsername.length < 2) {
      return socket.emit('register_result', { ok: false, message: 'اسم المستخدم قصير جدًا' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [cleanUsername], (err, row) => {
      if (err) return socket.emit('register_result', { ok: false, message: 'DB error' });
      if (row) return socket.emit('register_result', { ok: false, message: 'اسم المستخدم موجود' });

      db.run(
        'INSERT INTO users (username, password, coins, weapon, damage, speed, level) VALUES (?, ?, 0, "glock", 9, 1, 1)',
        [cleanUsername, String(password || '')],
        (insertErr) => {
          if (insertErr) {
            return socket.emit('register_result', { ok: false, message: 'فشل التسجيل' });
          }

          socket.emit('register_result', { ok: true, message: 'تم التسجيل بنجاح' });
        }
      );
    });
  });

  socket.on('login', ({ username, password }) => {
    const cleanUsername = String(username || '').trim();
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [cleanUsername, String(password || '')], (err, row) => {
      if (err) return socket.emit('login_result', { ok: false, message: 'DB error' });
      if (!row) {
        return socket.emit('login_result', { ok: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
      }

      players.set(socket.id, {
        username: row.username,
        coins: row.coins,
        weapon: row.weapon,
        damage: row.damage,
        speed: row.speed,
        level: row.level
      });

      socket.emit('login_result', {
        ok: true,
        user: {
          username: row.username,
          coins: row.coins,
          weapon: row.weapon,
          damage: row.damage,
          speed: row.speed,
          level: row.level
        }
      });
    });
  });

  socket.on('buy_weapon', ({ weapon, price }) => {
    const p = players.get(socket.id);
    if (!p) return;

    db.get('SELECT coins, weapon, damage FROM users WHERE username = ?', [p.username], (err, row) => {
      if (err || !row) return;
      if (row.coins < Number(price)) {
        return socket.emit('shop_result', { ok: false, message: 'لا توجد عملة كافية' });
      }

      const selected = weaponStats[weapon] || weaponStats.glock;
      const newCoins = row.coins - Number(price);

      db.run(
        'UPDATE users SET coins = ?, weapon = ?, damage = ? WHERE username = ?',
        [newCoins, weapon, selected.damage, p.username],
        (updateErr) => {
          if (updateErr) {
            return socket.emit('shop_result', { ok: false, message: 'فشل الشراء' });
          }

          p.coins = newCoins;
          p.weapon = weapon;
          p.damage = selected.damage;

          socket.emit('shop_result', {
            ok: true,
            message: 'تم شراء السلاح',
            user: { weapon, damage: selected.damage, coins: newCoins }
          });
        }
      );
    });
  });

  socket.on('battle', ({ difficulty }) => {
    const p = players.get(socket.id);
    if (!p) return;

    const config = difficultyStats[difficulty] || difficultyStats.weak;
    const reward = Math.floor(Math.random() * (config.max - config.min + 1)) + config.min;

    db.get('SELECT coins FROM users WHERE username = ?', [p.username], (err, row) => {
      if (err || !row) return;

      const newCoins = row.coins + reward;
      db.run('UPDATE users SET coins = ? WHERE username = ?', [newCoins, p.username], (updateErr) => {
        if (updateErr) return;

        p.coins = newCoins;
        socket.emit('battle_result', {
          ok: true,
          reward,
          totalCoins: newCoins,
          difficulty: config.label
        });
      });
    });
  });

  socket.on('disconnect', () => {
    players.delete(socket.id);
    console.log('User disconnected:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
