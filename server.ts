import express from 'express';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type {
  CallStatus,
  CallType,
  ChatSummary,
  MessageRecord,
  PublicGroup,
  PublicUser,
  SignalType,
} from './src/types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const DIST_DIR = path.join(__dirname, 'dist');

const AVATAR_COLORS = [
  '#4E8FD9',
  '#34A87B',
  '#D97B4E',
  '#8B6CE3',
  '#D95B7A',
  '#3C9FB8',
  '#C4903A',
  '#5D7FE3',
];

interface UserRecord {
  username: string;
  name: string;
  surname: string;
  bio?: string;
  avatar?: string;
  avatarColor?: string;
  keyHash: string;
  created: number;
  lastSeen?: number;
}

interface GroupRecord {
  id: string;
  name: string;
  description: string;
  avatar: string;
  avatarColor: string;
  owner: string;
  members: string[];
  created: number;
}

interface DatabaseSchema {
  users: Record<string, UserRecord>;
  groups: Record<string, GroupRecord>;
  messages: MessageRecord[];
}

interface ActiveCall {
  id: string;
  from: string;
  to: string;
  callType: CallType;
  startedAt: number;
  answeredAt: number | null;
}

// ---------- Persistent JSON Store ----------
let db: DatabaseSchema = { users: {}, groups: {}, messages: [] };
try {
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
  if (parsed && typeof parsed === 'object') {
    db = {
      users: parsed.users && typeof parsed.users === 'object' ? parsed.users : {},
      groups: parsed.groups && typeof parsed.groups === 'object' ? parsed.groups : {},
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map((m) => ({
            ...m,
            type: m.type === 'call' ? 'call' : m.type === 'system' ? 'system' : 'text',
            chatKind: m.chatKind === 'group' ? 'group' : 'dm',
          }))
        : [],
    };
  }
} catch {
  // Fresh database on first run
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function save(): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = `${DATA_FILE}.tmp`;
    fs.writeFile(tmp, JSON.stringify(db, null, 2), (err) => {
      if (!err) {
        fs.rename(tmp, DATA_FILE, () => {});
      }
    });
  }, 150);
}

const hashKey = (k: string): string => crypto.createHash('sha256').update(k).digest('hex');

const newKey = (): string => {
  const h = crypto.randomBytes(12).toString('hex').toUpperCase();
  return h.match(/.{4}/g)?.join('-') ?? h;
};

const pickAvatarColor = (seed: string): string => {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};

// ---------- Realtime SSE & Active Calls ----------
const streams = new Map<string, Set<express.Response>>();
const activeCalls = new Map<string, ActiveCall>();

function isOnline(username: string): boolean {
  return (streams.get(username)?.size ?? 0) > 0;
}

function publicUser(u: UserRecord): PublicUser {
  return {
    username: u.username,
    name: u.name,
    surname: u.surname || '',
    bio: u.bio || '',
    avatar: u.avatar || '',
    avatarColor: u.avatarColor || pickAvatarColor(u.username),
    created: u.created || Date.now(),
    lastSeen: u.lastSeen || u.created || Date.now(),
    online: isOnline(u.username),
  };
}

function publicGroup(g: GroupRecord, includeMembersInfo = false): PublicGroup {
  const validMembers = g.members.filter((m) => Boolean(db.users[m]));
  const base: PublicGroup = {
    id: g.id,
    name: g.name,
    description: g.description || '',
    avatar: g.avatar || '',
    avatarColor: g.avatarColor || pickAvatarColor(g.id),
    owner: g.owner,
    members: validMembers,
    memberCount: validMembers.length,
    created: g.created,
  };
  if (includeMembersInfo) {
    base.membersInfo = validMembers
      .map((username) => publicUser(db.users[username]))
      .sort((a, b) => Number(b.online) - Number(a.online));
  }
  return base;
}

function enrichMessage(m: MessageRecord): MessageRecord {
  if (m.chatKind === 'group' && db.users[m.from]) {
    return { ...m, sender: publicUser(db.users[m.from]) };
  }
  return m;
}

function userByKey(key: string | undefined | null): UserRecord | null {
  if (!key || typeof key !== 'string') return null;
  const normalized = key.trim().toUpperCase();
  if (!normalized) return null;
  const h = hashKey(normalized);
  return Object.values(db.users).find((u) => u.keyHash === h) ?? null;
}

function push(username: string, event: string, payload: unknown): void {
  const clients = streams.get(username);
  if (!clients) return;
  const frame = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    res.write(frame);
  }
}

function broadcastPresence(username: string): void {
  const user = db.users[username];
  if (!user) return;
  const payload = {
    username,
    online: isOnline(username),
    lastSeen: user.lastSeen || Date.now(),
  };
  for (const target of streams.keys()) {
    push(target, 'presence', payload);
  }
}

function isUserInCall(username: string): boolean {
  for (const call of activeCalls.values()) {
    if (call.from === username || call.to === username) return true;
  }
  return false;
}

function recordCallMessage(
  from: string,
  to: string,
  callType: CallType,
  callStatus: CallStatus,
  durationSec: number,
  ts: number,
): MessageRecord {
  const msg: MessageRecord = {
    id: crypto.randomUUID(),
    type: 'call',
    chatKind: 'dm',
    from,
    to,
    callType,
    callStatus,
    durationSec,
    ts,
  };
  db.messages.push(msg);
  save();

  const fromUser = db.users[from];
  const toUser = db.users[to];
  if (fromUser && toUser) {
    push(to, 'message', { message: msg, user: publicUser(fromUser) });
    push(from, 'message', { message: msg, user: publicUser(toUser) });
  }
  return msg;
}

function finalizeCall(callId: string, signalType: SignalType): MessageRecord | null {
  const call = activeCalls.get(callId);
  if (!call) return null;
  activeCalls.delete(callId);

  let status: CallStatus = 'cancelled';
  let durationSec = 0;

  if (call.answeredAt !== null) {
    status = 'completed';
    durationSec = Math.max(1, Math.round((Date.now() - call.answeredAt) / 1000));
  } else if (signalType === 'reject') {
    status = 'declined';
  } else if (signalType === 'busy') {
    status = 'busy';
  } else if (signalType === 'missed') {
    status = 'missed';
  } else {
    status = 'cancelled';
  }

  return recordCallMessage(
    call.from,
    call.to,
    call.callType,
    status,
    durationSec,
    call.answeredAt ?? Date.now(),
  );
}

// ---------- Rate Limiting & Input Validation ----------
const hits = new Map<string, number[]>();
function limited(bucket: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(bucket) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(bucket, arr);
  return arr.length > max;
}

function validateAvatarDataUrl(val: unknown): string | null {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed === '') return '';
  if (trimmed.length > 350_000) return null;
  if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(trimmed)) return null;
  return trimmed;
}

// ---------- Express App ----------
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '512kb' }));

// Registration (no phone / SIM required, optional avatar & color)
app.post('/api/register', (req, res) => {
  const ip = req.ip || 'unknown';
  if (limited(`reg:${ip}`, 15, 3600_000)) {
    return res.status(429).json({ error: 'Слишком много попыток, попробуй позже' });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = String(body.name || '').trim().slice(0, 40);
  const surname = String(body.surname || '').trim().slice(0, 40);
  const bio = String(body.bio || '').trim().slice(0, 160);
  const username = String(body.username || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  if (!name) return res.status(400).json({ error: 'Введите имя' });
  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Юзернейм: 3–20 символов, латиница, цифры и _' });
  }
  if (db.users[username]) {
    return res.status(409).json({ error: 'Этот юзернейм уже занят' });
  }

  let avatar = '';
  if (body.avatar !== undefined && body.avatar !== '') {
    const validated = validateAvatarDataUrl(body.avatar);
    if (validated === null) {
      return res.status(400).json({ error: 'Поддерживаются только PNG, JPEG или WebP до 250 КБ' });
    }
    avatar = validated;
  }

  let avatarColor = pickAvatarColor(username);
  if (typeof body.avatarColor === 'string' && AVATAR_COLORS.includes(body.avatarColor.trim())) {
    avatarColor = body.avatarColor.trim();
  }

  const key = newKey();
  const now = Date.now();
  const record: UserRecord = {
    username,
    name,
    surname,
    bio,
    avatar,
    avatarColor,
    keyHash: hashKey(key),
    created: now,
    lastSeen: now,
  };
  db.users[username] = record;
  save();
  return res.json({ key, user: publicUser(record) });
});

// Key login
app.post('/api/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (limited(`login:${ip}`, 25, 600_000)) {
    return res.status(429).json({ error: 'Слишком много попыток' });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const rawKey = String(body.key || '').trim().toUpperCase();
  const u = userByKey(rawKey);
  if (!u) return res.status(401).json({ error: 'Неверный ключ доступа' });
  u.lastSeen = Date.now();
  save();
  return res.json({ key: rawKey, user: publicUser(u) });
});

interface AuthedRequest extends express.Request {
  me?: UserRecord;
}

function requireAuth(req: AuthedRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  const me = userByKey(token);
  if (!me) return res.status(401).json({ error: 'Не авторизован' });
  req.me = me;
  next();
}

app.get('/api/me', requireAuth, (req: AuthedRequest, res) => {
  return res.json(publicUser(req.me!));
});

// Update own profile
app.patch('/api/me', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const body = (req.body ?? {}) as Record<string, unknown>;
  const previousUsername = me.username;

  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 40);
    if (!name) return res.status(400).json({ error: 'Имя не может быть пустым' });
    me.name = name;
  }

  if (body.surname !== undefined) {
    me.surname = String(body.surname).trim().slice(0, 40);
  }

  if (body.bio !== undefined) {
    me.bio = String(body.bio).trim().slice(0, 160);
  }

  if (body.avatarColor !== undefined) {
    const color = String(body.avatarColor).trim();
    if (!AVATAR_COLORS.includes(color)) {
      return res.status(400).json({ error: 'Некорректный цвет профиля' });
    }
    me.avatarColor = color;
  }

  if (body.avatar !== undefined) {
    const validated = validateAvatarDataUrl(body.avatar);
    if (validated === null) {
      return res.status(400).json({ error: 'Поддерживаются только PNG, JPEG или WebP до 250 КБ' });
    }
    me.avatar = validated;
  }

  if (body.username !== undefined) {
    const nextUsername = String(body.username).trim().replace(/^@/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(nextUsername)) {
      return res.status(400).json({ error: 'Юзернейм: 3–20 символов, латиница, цифры и _' });
    }
    if (nextUsername !== previousUsername) {
      if (db.users[nextUsername]) {
        return res.status(409).json({ error: 'Этот юзернейм уже занят' });
      }
      delete db.users[previousUsername];
      me.username = nextUsername;
      db.users[nextUsername] = me;

      for (const m of db.messages) {
        if (m.from === previousUsername) m.from = nextUsername;
        if (m.to === previousUsername) m.to = nextUsername;
        if (m.systemTarget === previousUsername) m.systemTarget = nextUsername;
      }
      for (const g of Object.values(db.groups)) {
        if (g.owner === previousUsername) g.owner = nextUsername;
        g.members = g.members.map((member) =>
          member === previousUsername ? nextUsername : member,
        );
      }
      const userStreams = streams.get(previousUsername);
      if (userStreams) {
        streams.delete(previousUsername);
        streams.set(nextUsername, userStreams);
      }
      for (const call of activeCalls.values()) {
        if (call.from === previousUsername) call.from = nextUsername;
        if (call.to === previousUsername) call.to = nextUsername;
      }
    }
  }

  save();
  const updated = publicUser(me);
  for (const target of streams.keys()) {
    push(target, 'profile', { user: updated, previousUsername });
  }
  return res.json({ user: updated, previousUsername });
});

// Rotate secret access key
app.post('/api/me/rotate-key', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const nextKey = newKey();
  me.keyHash = hashKey(nextKey);
  save();
  return res.json({ key: nextKey });
});

// Search users or list directory
app.get('/api/users', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const q = String(req.query.q || '')
    .trim()
    .replace(/^@/, '')
    .toLowerCase();

  const others = Object.values(db.users).filter((u) => u.username !== me.username);
  const filtered = q
    ? others.filter(
        (u) =>
          u.username.includes(q) ||
          `${u.name} ${u.surname}`.toLowerCase().includes(q),
      )
    : others;

  const sorted = filtered
    .map(publicUser)
    .sort((a, b) => Number(b.online) - Number(a.online) || b.lastSeen - a.lastSeen)
    .slice(0, 30);

  return res.json(sorted);
});

// Fetch specific contact profile
app.get('/api/users/:username', requireAuth, (req: AuthedRequest, res) => {
  const username = String(req.params.username || '').trim().replace(/^@/, '').toLowerCase();
  const user = db.users[username];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  return res.json(publicUser(user));
});

// ---------- Group Chats ----------
app.post('/api/groups', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  if (limited(`grp:${me.username}`, 15, 3600_000)) {
    return res.status(429).json({ error: 'Слишком много групп за час' });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = String(body.name || '').trim().slice(0, 60);
  const description = String(body.description || '').trim().slice(0, 160);
  if (!name) return res.status(400).json({ error: 'Введите название группы' });

  let avatar = '';
  if (body.avatar !== undefined && body.avatar !== '') {
    const validated = validateAvatarDataUrl(body.avatar);
    if (validated === null) {
      return res.status(400).json({ error: 'Поддерживаются только PNG, JPEG или WebP до 250 КБ' });
    }
    avatar = validated;
  }

  const id = crypto.randomUUID();
  let avatarColor = pickAvatarColor(id);
  if (typeof body.avatarColor === 'string' && AVATAR_COLORS.includes(body.avatarColor.trim())) {
    avatarColor = body.avatarColor.trim();
  }

  const rawMembers = Array.isArray(body.members) ? body.members : [];
  const memberSet = new Set<string>([me.username]);
  for (const item of rawMembers) {
    const u = String(item || '').trim().toLowerCase();
    if (db.users[u]) memberSet.add(u);
  }

  const now = Date.now();
  const group: GroupRecord = {
    id,
    name,
    description,
    avatar,
    avatarColor,
    owner: me.username,
    members: [...memberSet].slice(0, 100),
    created: now,
  };
  db.groups[id] = group;

  const sysMsg: MessageRecord = {
    id: crypto.randomUUID(),
    type: 'system',
    chatKind: 'group',
    groupId: id,
    from: me.username,
    to: id,
    systemAction: 'created',
    ts: now,
  };
  db.messages.push(sysMsg);
  save();

  const pubGroup = publicGroup(group, true);
  const enrichedSys = enrichMessage(sysMsg);
  for (const member of group.members) {
    push(member, 'group:updated', { group: pubGroup, last: enrichedSys });
  }

  return res.json({ group: pubGroup, last: enrichedSys });
});

app.get('/api/groups/:id', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const group = db.groups[String(req.params.id || '')];
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });
  if (!group.members.includes(me.username)) {
    return res.status(403).json({ error: 'Нет доступа к этой группе' });
  }
  return res.json(publicGroup(group, true));
});

app.patch('/api/groups/:id', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const group = db.groups[String(req.params.id || '')];
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });
  if (!group.members.includes(me.username)) {
    return res.status(403).json({ error: 'Нет доступа к этой группе' });
  }
  if (group.owner !== me.username) {
    return res.status(403).json({ error: 'Редактировать группу может только создатель' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.name !== undefined) {
    const name = String(body.name).trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Название группы не может быть пустым' });
    group.name = name;
  }
  if (body.description !== undefined) {
    group.description = String(body.description).trim().slice(0, 160);
  }
  if (body.avatarColor !== undefined) {
    const color = String(body.avatarColor).trim();
    if (!AVATAR_COLORS.includes(color)) {
      return res.status(400).json({ error: 'Некорректный цвет группы' });
    }
    group.avatarColor = color;
  }
  if (body.avatar !== undefined) {
    const validated = validateAvatarDataUrl(body.avatar);
    if (validated === null) {
      return res.status(400).json({ error: 'Поддерживаются только PNG, JPEG или WebP до 250 КБ' });
    }
    group.avatar = validated;
  }

  const emittedMsgs: MessageRecord[] = [];
  let removedMember: string | null = null;

  if (typeof body.addMember === 'string') {
    const target = body.addMember.trim().replace(/^@/, '').toLowerCase();
    if (!db.users[target]) return res.status(404).json({ error: 'Пользователь не найден' });
    if (!group.members.includes(target)) {
      group.members.push(target);
      const sysMsg: MessageRecord = {
        id: crypto.randomUUID(),
        type: 'system',
        chatKind: 'group',
        groupId: group.id,
        from: me.username,
        to: group.id,
        systemAction: 'added',
        systemTarget: target,
        ts: Date.now(),
      };
      db.messages.push(sysMsg);
      emittedMsgs.push(sysMsg);
    }
  }

  if (typeof body.removeMember === 'string') {
    const target = body.removeMember.trim().replace(/^@/, '').toLowerCase();
    if (target === group.owner) {
      return res.status(400).json({ error: 'Создателя нельзя удалить из группы' });
    }
    if (group.members.includes(target)) {
      group.members = group.members.filter((m) => m !== target);
      removedMember = target;
      const sysMsg: MessageRecord = {
        id: crypto.randomUUID(),
        type: 'system',
        chatKind: 'group',
        groupId: group.id,
        from: me.username,
        to: group.id,
        systemAction: 'removed',
        systemTarget: target,
        ts: Date.now(),
      };
      db.messages.push(sysMsg);
      emittedMsgs.push(sysMsg);
    }
  }

  save();
  const pubGroup = publicGroup(group, true);

  for (const member of group.members) {
    push(member, 'group:updated', { group: pubGroup });
    for (const msg of emittedMsgs) {
      push(member, 'message', { message: enrichMessage(msg), group: pubGroup });
    }
  }
  if (removedMember) {
    push(removedMember, 'group:removed', { groupId: group.id });
  }

  return res.json(pubGroup);
});

app.post('/api/groups/:id/leave', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const group = db.groups[String(req.params.id || '')];
  if (!group) return res.status(404).json({ error: 'Группа не найдена' });
  if (!group.members.includes(me.username)) {
    return res.status(403).json({ error: 'Вы не состоите в этой группе' });
  }

  group.members = group.members.filter((m) => m !== me.username);
  if (group.members.length === 0) {
    delete db.groups[group.id];
    save();
    push(me.username, 'group:removed', { groupId: group.id });
    return res.json({ left: true, deleted: true });
  }

  if (group.owner === me.username) {
    group.owner = group.members[0];
  }

  const sysMsg: MessageRecord = {
    id: crypto.randomUUID(),
    type: 'system',
    chatKind: 'group',
    groupId: group.id,
    from: me.username,
    to: group.id,
    systemAction: 'left',
    ts: Date.now(),
  };
  db.messages.push(sysMsg);
  save();

  const pubGroup = publicGroup(group, true);
  push(me.username, 'group:removed', { groupId: group.id });
  for (const member of group.members) {
    push(member, 'group:updated', { group: pubGroup });
    push(member, 'message', { message: enrichMessage(sysMsg), group: pubGroup });
  }

  return res.json({ left: true });
});

// Unified chat list (DMs + Groups)
app.get('/api/chats', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const lastDmByPeer = new Map<string, MessageRecord>();
  const lastByGroup = new Map<string, MessageRecord>();

  for (const m of db.messages) {
    if (m.chatKind === 'group' && m.groupId) {
      const prev = lastByGroup.get(m.groupId);
      if (!prev || m.ts >= prev.ts) {
        lastByGroup.set(m.groupId, m);
      }
      continue;
    }

    if (m.from !== me.username && m.to !== me.username) continue;
    const other = m.from === me.username ? m.to : m.from;
    const prev = lastDmByPeer.get(other);
    if (!prev || m.ts >= prev.ts) {
      lastDmByPeer.set(other, m);
    }
  }

  const dmChats: ChatSummary[] = [...lastDmByPeer.entries()]
    .filter(([other]) => Boolean(db.users[other]))
    .map(([other, last]) => ({
      kind: 'dm',
      user: publicUser(db.users[other]),
      last,
    }));

  const groupChats: ChatSummary[] = Object.values(db.groups)
    .filter((g) => g.members.includes(me.username))
    .map((g) => {
      const last = lastByGroup.get(g.id);
      return {
        kind: 'group',
        group: publicGroup(g, false),
        last: last ? enrichMessage(last) : null,
      };
    });

  const combined = [...dmChats, ...groupChats].sort((a, b) => {
    const tsA = a.kind === 'dm' ? a.last.ts : (a.last?.ts ?? a.group.created);
    const tsB = b.kind === 'dm' ? b.last.ts : (b.last?.ts ?? b.group.created);
    return tsB - tsA;
  });

  return res.json(combined);
});

// Messages for DM (?with=) or Group (?group=)
app.get('/api/messages', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  const groupId = String(req.query.group || '').trim();

  if (groupId) {
    const group = db.groups[groupId];
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (!group.members.includes(me.username)) {
      return res.status(403).json({ error: 'Нет доступа к сообщениям группы' });
    }
    const msgs = db.messages
      .filter((m) => m.chatKind === 'group' && m.groupId === groupId)
      .slice(-300)
      .map(enrichMessage);
    return res.json(msgs);
  }

  const other = String(req.query.with || '').trim().toLowerCase();
  if (!db.users[other]) return res.status(404).json({ error: 'Пользователь не найден' });

  const msgs = db.messages
    .filter(
      (m) =>
        m.chatKind !== 'group' &&
        ((m.from === me.username && m.to === other) ||
          (m.from === other && m.to === me.username)),
    )
    .slice(-300);

  return res.json(msgs);
});

// Send text message (DM or Group)
app.post('/api/send', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  if (limited(`send:${me.username}`, 90, 60_000)) {
    return res.status(429).json({ error: 'Слишком быстро' });
  }
  const body = (req.body ?? {}) as Record<string, unknown>;
  const text = String(body.text || '').trim().slice(0, 4000);
  const groupId = String(body.groupId || '').trim();
  if (!text) return res.status(400).json({ error: 'Пустое сообщение' });

  if (groupId) {
    const group = db.groups[groupId];
    if (!group) return res.status(404).json({ error: 'Группа не найдена' });
    if (!group.members.includes(me.username)) {
      return res.status(403).json({ error: 'Вы не состоите в этой группе' });
    }
    const msg: MessageRecord = {
      id: crypto.randomUUID(),
      type: 'text',
      chatKind: 'group',
      groupId,
      from: me.username,
      to: groupId,
      text,
      ts: Date.now(),
    };
    db.messages.push(msg);
    save();

    const enriched = enrichMessage(msg);
    const pubGroup = publicGroup(group, false);
    for (const member of group.members) {
      push(member, 'message', { message: enriched, group: pubGroup });
    }
    return res.json(enriched);
  }

  const to = String(body.to || '').trim().toLowerCase();
  if (!db.users[to]) return res.status(404).json({ error: 'Пользователь не найден' });

  const msg: MessageRecord = {
    id: crypto.randomUUID(),
    type: 'text',
    chatKind: 'dm',
    from: me.username,
    to,
    text,
    ts: Date.now(),
  };
  db.messages.push(msg);
  save();

  push(to, 'message', { message: msg, user: publicUser(me) });
  push(me.username, 'message', { message: msg, user: publicUser(db.users[to]) });

  return res.json(msg);
});

// WebRTC call signaling + server-authoritative post-call chat bubbles
app.post('/api/signal', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  if (limited(`sig:${me.username}`, 600, 60_000)) {
    return res.status(429).json({ error: 'Слишком быстро' });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const to = String(body.to || '').trim().toLowerCase();
  const type = String(body.type || '') as SignalType;
  const callType: CallType = body.callType === 'video' ? 'video' : 'audio';
  const allowed: SignalType[] = [
    'offer',
    'answer',
    'ice',
    'hangup',
    'reject',
    'cancel',
    'busy',
    'missed',
  ];

  if (!db.users[to] || to === me.username || !allowed.includes(type)) {
    return res.status(400).json({ error: 'Неверный сигнал' });
  }

  const online = isOnline(to);

  if (type === 'offer') {
    const callId =
      typeof body.callId === 'string' && body.callId.trim()
        ? body.callId.trim()
        : crypto.randomUUID();

    if (!online) {
      recordCallMessage(me.username, to, callType, 'missed', 0, Date.now());
      return res.json({ delivered: false, callId, missedLogged: true });
    }

    if (isUserInCall(to)) {
      recordCallMessage(me.username, to, callType, 'busy', 0, Date.now());
      return res.json({ delivered: false, callId, busy: true });
    }

    activeCalls.set(callId, {
      id: callId,
      from: me.username,
      to,
      callType,
      startedAt: Date.now(),
      answeredAt: null,
    });

    push(to, 'signal', {
      from: publicUser(me),
      type: 'offer',
      callId,
      callType,
      data: body.data ?? null,
    });
    return res.json({ delivered: true, callId });
  }

  const callId = typeof body.callId === 'string' ? body.callId.trim() : '';

  if (type === 'answer') {
    const call = activeCalls.get(callId);
    if (call && call.to === me.username && call.answeredAt === null) {
      call.answeredAt = Date.now();
    }
    if (online) {
      push(to, 'signal', {
        from: publicUser(me),
        type: 'answer',
        callId,
        data: body.data ?? null,
      });
    }
    return res.json({ delivered: online, callId });
  }

  if (type === 'ice') {
    if (online) {
      push(to, 'signal', {
        from: publicUser(me),
        type: 'ice',
        callId,
        data: body.data ?? null,
      });
    }
    return res.json({ delivered: online, callId });
  }

  if (online) {
    push(to, 'signal', {
      from: publicUser(me),
      type,
      callId,
      data: body.data ?? null,
    });
  }
  const loggedMessage = callId ? finalizeCall(callId, type) : null;
  return res.json({ delivered: online, callId, callLogged: Boolean(loggedMessage) });
});

// SSE real-time stream (Bearer header auth)
app.get('/api/stream', requireAuth, (req: AuthedRequest, res) => {
  const me = req.me!;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 2000\n\n');

  if (!streams.has(me.username)) streams.set(me.username, new Set());
  streams.get(me.username)!.add(res);

  me.lastSeen = Date.now();
  save();
  broadcastPresence(me.username);

  const ping = setInterval(() => {
    res.write(': ping\n\n');
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    const set = streams.get(me.username);
    set?.delete(res);

    if (!set || set.size === 0) {
      streams.delete(me.username);
      me.lastSeen = Date.now();
      save();
      broadcastPresence(me.username);

      for (const [callId, call] of [...activeCalls.entries()]) {
        if (call.from === me.username || call.to === me.username) {
          const peer = call.from === me.username ? call.to : call.from;
          if (isOnline(peer)) {
            push(peer, 'signal', {
              from: publicUser(me),
              type: 'hangup',
              callId,
              data: null,
            });
          }
          finalizeCall(callId, 'hangup');
        }
      }
    }
  });
});

// ---------- Vite Dev Middleware / Production Static ----------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Эфир мессенджер запущен на http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
