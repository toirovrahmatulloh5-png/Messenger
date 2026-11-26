// Мини-мессенджер без зависимостей. Запуск: node server.js
// Регистрация: имя, фамилия (необязательно), юзернейм. Номер телефона не нужен.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const PUBLIC = path.join(__dirname, 'public');

// ---------- хранилище ----------
let db = { users: {}, messages: [] };
try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(DATA_FILE + '.tmp', JSON.stringify(db), err => {
      if (!err) fs.rename(DATA_FILE + '.tmp', DATA_FILE, () => {});
    });
  }, 200);
}
const hash = k => crypto.createHash('sha256').update(k).digest('hex');
const newKey = () => {
  const h = crypto.randomBytes(12).toString('hex').toUpperCase();
  return h.match(/.{4}/g).join('-'); // XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
};
const publicUser = u => ({ username: u.username, name: u.name, surname: u.surname });

function userByKey(key) {
  if (!key) return null;
  const h = hash(String(key).trim().toUpperCase());
  return Object.values(db.users).find(u => u.keyHash === h) || null;
}

// ---------- realtime (SSE) ----------
const streams = new Map(); // username -> Set<res>
function push(username, event, payload) {
  for (const res of streams.get(username) || []) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}

// ---------- утилиты ----------
function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}
function body(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => { s += c; if (s.length > 20000) { reject(new Error('too big')); req.destroy(); } });
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { reject(new Error('bad json')); } });
  });
}
const hits = new Map(); // простая защита от спама регистраций
function limited(ip, max, windowMs) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(ip, arr);
  return arr.length > max;
}
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

// ---------- сервер ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.socket.remoteAddress;
  try {
    if (url.pathname.startsWith('/api/')) {
      // регистрация
      if (req.method === 'POST' && url.pathname === '/api/register') {
        if (limited('reg' + ip, 10, 3600e3)) return json(res, 429, { error: 'Слишком много попыток, попробуй позже' });
        const b = await body(req);
        const name = String(b.name || '').trim().slice(0, 40);
        const surname = String(b.surname || '').trim().slice(0, 40);
        const username = String(b.username || '').trim().replace(/^@/, '').toLowerCase();
        if (!name) return json(res, 400, { error: 'Введи имя' });
        if (!/^[a-z0-9_]{3,20}$/.test(username))
          return json(res, 400, { error: 'Юзернейм: 3–20 символов, латиница, цифры и _' });
        if (db.users[username]) return json(res, 409, { error: 'Этот юзернейм уже занят' });
        const key = newKey();
        db.users[username] = { username, name, surname, keyHash: hash(key), created: Date.now() };
        save();
        return json(res, 200, { key, user: publicUser(db.users[username]) });
      }
      // вход по ключу
      if (req.method === 'POST' && url.pathname === '/api/login') {
        if (limited('login' + ip, 20, 600e3)) return json(res, 429, { error: 'Слишком много попыток' });
        const b = await body(req);
        const u = userByKey(b.key);
        if (!u) return json(res, 401, { error: 'Неверный ключ' });
        return json(res, 200, { key: String(b.key).trim().toUpperCase(), user: publicUser(u) });
      }

      // дальше нужна авторизация
      const key = (req.headers.authorization || '').replace(/^Bearer /, '') || url.searchParams.get('key');
      const me = userByKey(key);
      if (!me) return json(res, 401, { error: 'Не авторизован' });

      if (req.method === 'GET' && url.pathname === '/api/me') return json(res, 200, publicUser(me));

      if (req.method === 'GET' && url.pathname === '/api/users') {
        const q = (url.searchParams.get('q') || '').trim().replace(/^@/, '').toLowerCase();
        if (!q) return json(res, 200, []);
        const list = Object.values(db.users)
          .filter(u => u.username !== me.username &&
            (u.username.includes(q) || (u.name + ' ' + u.surname).toLowerCase().includes(q)))
          .slice(0, 20).map(publicUser);
        return json(res, 200, list);
      }

      if (req.method === 'GET' && url.pathname === '/api/chats') {
        const last = new Map();
        for (const m of db.messages) {
          if (m.from !== me.username && m.to !== me.username) continue;
          const other = m.from === me.username ? m.to : m.from;
          last.set(other, m);
        }
        const chats = [...last.entries()].map(([other, m]) => ({
          user: publicUser(db.users[other]), last: m
        })).sort((a, b) => b.last.ts - a.last.ts);
        return json(res, 200, chats);
      }

      if (req.method === 'GET' && url.pathname === '/api/messages') {
        const other = url.searchParams.get('with');
        const msgs = db.messages.filter(m =>
          (m.from === me.username && m.to === other) || (m.from === other && m.to === me.username)).slice(-200);
        return json(res, 200, msgs);
      }

      if (req.method === 'POST' && url.pathname === '/api/send') {
        if (limited('send' + me.username, 60, 60e3)) return json(res, 429, { error: 'Слишком быстро' });
        const b = await body(req);
        const text = String(b.text || '').trim().slice(0, 4000);
        const to = String(b.to || '');
        if (!text) return json(res, 400, { error: 'Пустое сообщение' });
        if (!db.users[to]) return json(res, 404, { error: 'Пользователь не найден' });
        const m = { id: crypto.randomUUID(), from: me.username, to, text, ts: Date.now() };
        db.messages.push(m); save();
        push(to, 'message', { message: m, user: publicUser(me) });
        push(me.username, 'message', { message: m, user: publicUser(db.users[to]) });
        return json(res, 200, m);
      }

      // сигналы для звонков (WebRTC): сервер только пересылает их собеседнику
      if (req.method === 'POST' && url.pathname === '/api/signal') {
        if (limited('sig' + me.username, 600, 60e3)) return json(res, 429, { error: 'Слишком быстро' });
        const b = await body(req);
        const to = String(b.to || '');
        const type = String(b.type || '');
        if (!db.users[to] || !['offer', 'answer', 'ice', 'hangup', 'reject', 'busy'].includes(type))
          return json(res, 400, { error: 'Неверный сигнал' });
        const online = (streams.get(to)?.size || 0) > 0;
        if (online) push(to, 'signal', { from: publicUser(me), type, data: b.data ?? null });
        return json(res, 200, { delivered: online });
      }

      if (req.method === 'GET' && url.pathname === '/api/stream') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache',
          Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        res.write('retry: 2000\n\n');
        if (!streams.has(me.username)) streams.set(me.username, new Set());
        streams.get(me.username).add(res);
        const ping = setInterval(() => res.write(': ping\n\n'), 25000);
        req.on('close', () => { clearInterval(ping); streams.get(me.username)?.delete(res); });
        return;
      }
      return json(res, 404, { error: 'Не найдено' });
    }

    // статика
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.normalize(path.join(PUBLIC, p));
    if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) {
    json(res, 400, { error: e.message || 'Ошибка запроса' });
  }
});

server.listen(PORT, () => console.log(`Мессенджер запущен: http://localhost:${PORT}`));
