import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import { z, ZodError } from 'zod';
import { db } from './db';
import { seedIfEmpty } from './seed';
import { vehicles } from './vehicles';
import { fetchRoute, planTrip, type ChargerRow } from './trip';
import { notify, userName, when } from './notify';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: number };
    user: { id: number };
  }
}

seedIfEmpty();

const app = Fastify({ logger: { level: 'warn' } });
await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? 'dev-secret-change-me' });

app.setErrorHandler((err: any, _req, reply) => {
  if (err instanceof ZodError) {
    return reply.code(400).send({ error: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
  }
  const code = err.statusCode ?? 500;
  if (code >= 500) app.log.error(err);
  reply.code(code).send({ error: code >= 500 ? err.message || 'Server error' : err.message });
});

const auth = async (req: any, reply: any) => {
  try { await req.jwtVerify(); } catch { reply.code(401).send({ error: 'Please log in first.' }); }
};

// ---------- helpers ----------
const STALE_HOURS = 24;
function effectiveStatus(r: any) {
  if (!r.status_updated_at) return 'unknown';
  const ageH = (Date.now() - new Date(r.status_updated_at.replace(' ', 'T') + 'Z').getTime()) / 3.6e6;
  return ageH > STALE_HOURS ? 'unknown' : r.status;
}
const mapCharger = (r: any) => ({
  id: r.id, name: r.name, network: r.network, lat: r.lat, lng: r.lng, address: r.address, city: r.city,
  connectors: JSON.parse(r.connectors), powerKw: r.power_kw, type: r.type, vehicle: r.vehicle,
  pricePerKwh: r.price_per_kwh, amenities: JSON.parse(r.amenities), status: effectiveStatus(r),
  statusUpdatedAt: r.status_updated_at, isPrivate: !!r.is_private, ownerId: r.owner_id, ownerName: r.owner_name ?? null, hasContact: !!r.contact_phone,
  avgRating: r.avg_rating == null ? null : Math.round(r.avg_rating * 10) / 10, reviewCount: r.review_count ?? 0,
});
const CHARGER_SELECT = `SELECT c.*,
  (SELECT AVG(rating) FROM reviews WHERE charger_id = c.id) AS avg_rating,
  (SELECT COUNT(*) FROM reviews WHERE charger_id = c.id) AS review_count,
  (SELECT name FROM users WHERE id = c.owner_id) AS owner_name
  FROM chargers c`;
const idParam = (v: unknown) => z.coerce.number().int().positive().parse(v);

// ---------- health & vehicles ----------
app.get('/api/health', async () => ({ ok: true }));
app.get('/api/vehicles', async () => vehicles);

// ---------- auth ----------
const registerSchema = z.object({ name: z.string().min(2).max(60), email: z.string().email(), password: z.string().min(6).max(100) });
app.post('/api/auth/register', async (req, reply) => {
  const b = registerSchema.parse(req.body);
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(b.email.toLowerCase());
  if (exists) return reply.code(409).send({ error: 'That email is already registered.' });
  const r = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?,?,?)')
    .run(b.name, b.email.toLowerCase(), bcrypt.hashSync(b.password, 10));
  const id = Number(r.lastInsertRowid);
  notify(id, 'welcome', 'Welcome to EVRoute', 'Find a working charger, book a slot, or plan a trip. You will get a notification here when a booking is confirmed, requested or about to start.', '/');
  return { token: app.jwt.sign({ id }, { expiresIn: '14d' }), user: { id, name: b.name, email: b.email.toLowerCase() } };
});
app.post('/api/auth/login', async (req, reply) => {
  const b = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);
  const u: any = db.prepare('SELECT * FROM users WHERE email = ?').get(b.email.toLowerCase());
  if (!u || !bcrypt.compareSync(b.password, u.password_hash)) return reply.code(401).send({ error: 'Wrong email or password.' });
  return { token: app.jwt.sign({ id: u.id }, { expiresIn: '14d' }), user: { id: u.id, name: u.name, email: u.email } };
});
app.get('/api/auth/me', { preHandler: auth }, async (req) => {
  const u: any = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.user.id);
  return u;
});

// ---------- chargers ----------
app.get('/api/chargers', async () => (db.prepare(CHARGER_SELECT + ' ORDER BY c.city, c.name').all() as any[]).map(mapCharger));

app.get('/api/chargers/:id', async (req, reply) => {
  const id = idParam((req.params as any).id);
  const row = db.prepare(CHARGER_SELECT + ' WHERE c.id = ?').get(id);
  if (!row) return reply.code(404).send({ error: 'Charger not found.' });
  const reports = db.prepare(`SELECT r.id, r.status, r.note, r.created_at AS createdAt, u.name AS userName
    FROM reports r JOIN users u ON u.id = r.user_id WHERE r.charger_id = ? ORDER BY r.id DESC LIMIT 10`).all(id);
  const reviews = db.prepare(`SELECT r.id, r.rating, r.comment, r.created_at AS createdAt, u.name AS userName
    FROM reviews r JOIN users u ON u.id = r.user_id WHERE r.charger_id = ? ORDER BY r.id DESC LIMIT 20`).all(id);
  return { ...mapCharger(row), reports, reviews };
});

const chargerSchema = z.object({
  name: z.string().min(2).max(80), network: z.string().max(40).default('Independent'),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  address: z.string().max(160).default(''), city: z.string().min(1).max(60),
  connectors: z.array(z.string()).min(1), powerKw: z.number().min(0).max(400),
  type: z.enum(['fast_dc', 'slow_ac', 'swap']), vehicle: z.enum(['car', 'bike', 'both']),
  pricePerKwh: z.number().min(0).max(200), amenities: z.array(z.string()).default([]), isPrivate: z.boolean().default(false),
  contactPhone: z.string().trim().regex(/^\+?[0-9][0-9 ()-]{6,18}$/, 'Enter a valid contact phone number').optional().or(z.literal('')).default(''),
});
app.post('/api/chargers', { preHandler: auth }, async (req) => {
  const b = chargerSchema.parse(req.body);
  const r = db.prepare(`INSERT INTO chargers
    (name, network, lat, lng, address, city, connectors, power_kw, type, vehicle, price_per_kwh, amenities, is_private, owner_id, contact_phone)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    b.name, b.isPrivate ? 'Private' : b.network, b.lat, b.lng, b.address, b.city, JSON.stringify(b.connectors),
    b.powerKw, b.type, b.vehicle, b.pricePerKwh, JSON.stringify(b.amenities), b.isPrivate ? 1 : 0, req.user.id, b.contactPhone);
  const newId = Number(r.lastInsertRowid);
  notify(req.user.id, 'info', 'Charger added', `${b.name} is now listed.${b.isPrivate ? ' You will be notified when someone requests a booking.' : ''}`, `/chargers/${newId}`, true);
  return { id: newId };
});

app.post('/api/chargers/:id/reports', { preHandler: auth }, async (req, reply) => {
  const id = idParam((req.params as any).id);
  const b = z.object({ status: z.enum(['available', 'busy', 'broken']), note: z.string().max(200).default(''),
    finishInMin: z.number().int().min(1).max(600).optional() }).parse(req.body);
  const ch: any = db.prepare('SELECT id, name, owner_id FROM chargers WHERE id = ?').get(id);
  if (!ch) return reply.code(404).send({ error: 'Charger not found.' });
  db.prepare('INSERT INTO reports (charger_id, user_id, status, note) VALUES (?,?,?,?)').run(id, req.user.id, b.status, b.note);
  // For a busy charger the reporter can say how long the current session has left; that powers the "wait for my turn" feature.
  const busyUntil = b.status === 'busy' && b.finishInMin ? new Date(Date.now() + b.finishInMin * 60000).toISOString() : null;
  db.prepare("UPDATE chargers SET status = ?, status_updated_at = datetime('now'), busy_until = ? WHERE id = ?").run(b.status, busyUntil, id);
  if (b.status === 'broken') {
    // the owner, and anyone holding an upcoming booking here, should hear about it before they drive over
    const who = userName(req.user.id);
    if (ch.owner_id && ch.owner_id !== req.user.id) notify(ch.owner_id, 'charger_alert', 'Your charger was reported out of order', `${who} reported ${ch.name} as out of order${b.note ? `: ${b.note}` : '.'}`, `/chargers/${id}`);
    const holders = db.prepare("SELECT DISTINCT user_id FROM bookings WHERE charger_id = ? AND status IN ('requested','confirmed') AND start_time > ? AND user_id != ?")
      .all(id, new Date().toISOString(), req.user.id) as { user_id: number }[];
    for (const h of holders) if (h.user_id !== ch.owner_id) notify(h.user_id, 'charger_alert', 'Heads up: a charger you booked is out of order', `${ch.name} was just reported out of order. Check the page before you travel, or call the owner.`, `/chargers/${id}`);
  }
  return { ok: true };
});

app.post('/api/chargers/:id/reviews', { preHandler: auth }, async (req, reply) => {
  const id = idParam((req.params as any).id);
  const b = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(400).default('') }).parse(req.body);
  const ch: any = db.prepare('SELECT id, name, owner_id FROM chargers WHERE id = ?').get(id);
  if (!ch) return reply.code(404).send({ error: 'Charger not found.' });
  db.prepare('INSERT INTO reviews (charger_id, user_id, rating, comment) VALUES (?,?,?,?)').run(id, req.user.id, b.rating, b.comment);
  if (ch.owner_id && ch.owner_id !== req.user.id) notify(ch.owner_id, 'review', 'New review on your charger', `${userName(req.user.id)} rated ${ch.name} ${b.rating}/5${b.comment ? `: "${b.comment.slice(0, 80)}"` : '.'}`, `/chargers/${id}`);
  return { ok: true };
});

// ---------- bookings ----------
// Slots that block a time window: pending requests AND confirmed bookings, so two people can never hold the same slot.
const ACTIVE = "('requested','confirmed')";

function findClash(chargerId: number, startMs: number, endMs: number, ignoreBookingId = 0) {
  const rows = db.prepare(`SELECT id, start_time, duration_min FROM bookings
    WHERE charger_id = ? AND status IN ${ACTIVE} AND id != ?`).all(chargerId, ignoreBookingId) as any[];
  return rows.find((x) => {
    const s = new Date(x.start_time).getTime();
    return startMs < s + x.duration_min * 60000 && endMs > s;
  });
}

/** Tell the driver and the owner about a new booking or request. The driver's own entry is pre-read: they already saw it on screen. */
function announceBooking(c: any, driverId: number, startIso: string, durationMin: number, status: string) {
  const link = '/bookings';
  const slot = `${c.name}, ${when(startIso)} for ${durationMin} min`;
  if (status === 'confirmed') notify(driverId, 'booking_confirmed', 'Booking confirmed', `${slot}.`, link, true);
  else notify(driverId, 'booking_request', 'Booking request sent', `${slot}. Waiting for the owner to approve.`, link, true);
  if (c.owner_id && c.owner_id !== driverId) {
    const who = userName(driverId);
    if (status === 'requested') notify(c.owner_id, 'booking_request', 'New booking request', `${who} wants ${slot}. Open Bookings to confirm or decline.`, link);
    else notify(c.owner_id, 'booking_confirmed', 'New booking on your charger', `${who} booked ${slot}.`, link);
  }
}

/** When does the charger's current session end? null = not in use right now. */
function sessionEnd(c: any): { until: number; estimated: boolean } | null {
  const now = Date.now();
  let until = 0, estimated = false;
  if (effectiveStatus(c) === 'busy') {
    const reportedAt = new Date(String(c.status_updated_at).replace(' ', 'T') + 'Z').getTime();
    if (c.busy_until && new Date(c.busy_until).getTime() > now) until = new Date(c.busy_until).getTime();
    else if (c.busy_until) { until = now + 5 * 60000; estimated = true; }          // said it would be done by now; allow a few minutes
    else { until = Math.max(reportedAt + 30 * 60000, now + 5 * 60000); estimated = true; } // nobody said how long: assume ~30 min
  }
  // a confirmed booking that is running right now also occupies the charger
  const running = (db.prepare("SELECT start_time, duration_min FROM bookings WHERE charger_id = ? AND status = 'confirmed'").all(c.id) as any[])
    .map((x) => ({ s: new Date(x.start_time).getTime(), e: new Date(x.start_time).getTime() + x.duration_min * 60000 }))
    .filter((x) => x.s <= now && x.e > now);
  for (const r of running) if (r.e > until) { until = r.e; estimated = false; }
  return until > now ? { until, estimated } : null;
}

/** First start time at or after `from` where a slot of `durationMin` does not overlap any active booking. */
function nextFreeStart(chargerId: number, from: number, durationMin: number) {
  let start = Math.ceil(from / 60000) * 60000;
  for (let i = 0; i < 100; i++) {
    const clash = findClash(chargerId, start, start + durationMin * 60000);
    if (!clash) return start;
    start = new Date(clash.start_time).getTime() + clash.duration_min * 60000;
  }
  return start;
}

const needsApproval = (c: any) => !!(c.is_private && c.owner_id);
function checkBookable(c: any, userId: number): string | null {
  if (c.type === 'swap') return 'Battery-swap stations cannot be booked.';
  if (c.owner_id === userId) return 'You cannot book your own charger.';
  return null;
}

// Public: is the charger in use, when will it be free, and when would YOUR turn start if you wait?
app.get('/api/chargers/:id/wait-info', async (req, reply) => {
  const id = idParam((req.params as any).id);
  const { durationMin } = z.object({ durationMin: z.coerce.number().int().min(15).max(720).default(60) }).parse(req.query);
  const c: any = db.prepare('SELECT * FROM chargers WHERE id = ?').get(id);
  if (!c) return reply.code(404).send({ error: 'Charger not found.' });
  const end = sessionEnd(c);
  if (!end) return { busy: false };
  const start = nextFreeStart(id, end.until, durationMin);
  return {
    busy: true, estimated: end.estimated,
    busyUntil: new Date(end.until).toISOString(),
    minutesLeft: Math.max(1, Math.ceil((end.until - Date.now()) / 60000)),
    startTime: new Date(start).toISOString(),
    endTime: new Date(start + durationMin * 60000).toISOString(),
    waitMin: Math.max(1, Math.ceil((start - Date.now()) / 60000)),
    othersAhead: start > Math.ceil(end.until / 60000) * 60000, // true if other people's bookings push your turn later
    durationMin,
  };
});

// The driver agreed to wait: reserve the first free slot after the current session. expectedStart is what they confirmed;
// if the situation changed since (someone else queued, session extended) we refuse and let them confirm the new time.
app.post('/api/chargers/:id/wait', { preHandler: auth }, async (req, reply) => {
  const id = idParam((req.params as any).id);
  const b = z.object({ durationMin: z.number().int().min(15).max(720), expectedStart: z.string() }).parse(req.body);
  const c: any = db.prepare('SELECT * FROM chargers WHERE id = ?').get(id);
  if (!c) return reply.code(404).send({ error: 'Charger not found.' });
  const bad = checkBookable(c, req.user.id);
  if (bad) return reply.code(400).send({ error: bad });
  const result = db.transaction(() => {
    const end = sessionEnd(c);
    const start = nextFreeStart(id, end ? end.until : Date.now(), b.durationMin);
    if (Math.abs(start - new Date(b.expectedStart).getTime()) > 60000) return { changed: new Date(start).toISOString() };
    const status = needsApproval(c) ? 'requested' : 'confirmed';
    const r = db.prepare('INSERT INTO bookings (charger_id, user_id, start_time, duration_min, status) VALUES (?,?,?,?,?)')
      .run(id, req.user.id, new Date(start).toISOString(), b.durationMin, status);
    return { id: Number(r.lastInsertRowid), status, startTime: new Date(start).toISOString() };
  })();
  if (!('changed' in result)) announceBooking(c, req.user.id, result.startTime, b.durationMin, result.status);
  if ('changed' in result) return reply.code(409).send({ error: 'The wait time just changed. Please check the new time and confirm again.', startTime: result.changed });
  return { ok: true, ...result };
});

// Public: which upcoming slots are taken. No personal details are exposed.
app.get('/api/chargers/:id/slots', async (req, reply) => {
  const id = idParam((req.params as any).id);
  if (!db.prepare('SELECT id FROM chargers WHERE id = ?').get(id)) return reply.code(404).send({ error: 'Charger not found.' });
  let me = 0;
  try { await req.jwtVerify(); me = req.user.id; } catch { /* anonymous is fine */ }
  const rows = db.prepare(`SELECT id, user_id, start_time, duration_min, status FROM bookings
    WHERE charger_id = ? AND status IN ${ACTIVE} ORDER BY start_time ASC`).all(id) as any[];
  const now = Date.now();
  return rows
    .map((r) => ({ id: r.id, startTime: r.start_time, endTime: new Date(new Date(r.start_time).getTime() + r.duration_min * 60000).toISOString(),
      durationMin: r.duration_min, status: r.status as string, mine: r.user_id === me }))
    .filter((r) => new Date(r.endTime).getTime() > now);
});

app.post('/api/chargers/:id/bookings', { preHandler: auth }, async (req, reply) => {
  const id = idParam((req.params as any).id);
  const b = z.object({ startTime: z.string().min(10), durationMin: z.number().int().min(15).max(720) }).parse(req.body);
  const c: any = db.prepare('SELECT * FROM chargers WHERE id = ?').get(id);
  if (!c) return reply.code(404).send({ error: 'Charger not found.' });
  const bad = checkBookable(c, req.user.id);
  if (bad) return reply.code(400).send({ error: bad });
  const start = new Date(b.startTime).getTime();
  if (Number.isNaN(start) || start < Date.now() - 60000) return reply.code(400).send({ error: 'Choose a start time in the future.' });
  const end = start + b.durationMin * 60000;
  const inUse = sessionEnd(c);
  if (inUse && start < inUse.until) {
    const mins = Math.max(1, Math.ceil((inUse.until - Date.now()) / 60000));
    return reply.code(409).send({ error: `This charger is in use for about ${mins} more minute${mins === 1 ? '' : 's'}. Use "Wait for my turn" or pick a later start time.` });
  }
  // Private chargers with an owner need the owner's approval; all others are confirmed instantly.
  const status = needsApproval(c) ? 'requested' : 'confirmed';
  // better-sqlite3 is synchronous and this runs in one transaction, so check + insert cannot interleave with another request.
  const result = db.transaction(() => {
    const clash = findClash(id, start, end);
    if (clash) return { clash };
    const r = db.prepare('INSERT INTO bookings (charger_id, user_id, start_time, duration_min, status) VALUES (?,?,?,?,?)')
      .run(id, req.user.id, new Date(start).toISOString(), b.durationMin, status);
    return { id: Number(r.lastInsertRowid) };
  })();
  if ('clash' in result) {
    const s = new Date(result.clash!.start_time).getTime();
    return reply.code(409).send({ error: 'That time is already booked. Please pick a free slot (see the booked slots list).',
      clash: { startTime: new Date(s).toISOString(), endTime: new Date(s + result.clash!.duration_min * 60000).toISOString() } });
  }
  announceBooking(c, req.user.id, new Date(start).toISOString(), b.durationMin, status);
  return { ok: true, id: result.id, status };
});

app.get('/api/bookings/mine', { preHandler: auth }, async (req) => {
  const base = `SELECT b.id, b.start_time AS startTime, b.duration_min AS durationMin, b.status, c.id AS chargerId, c.name AS chargerName, c.city, u.name AS driverName
    FROM bookings b JOIN chargers c ON c.id = b.charger_id JOIN users u ON u.id = b.user_id`;
  const made = db.prepare(base + ' WHERE b.user_id = ? ORDER BY b.start_time DESC').all(req.user.id);
  const incoming = db.prepare(base + ' WHERE c.owner_id = ? ORDER BY b.start_time DESC').all(req.user.id);
  return { made, incoming };
});

app.patch('/api/bookings/:id', { preHandler: auth }, async (req, reply) => {
  const id = idParam((req.params as any).id);
  const { status } = z.object({ status: z.enum(['confirmed', 'declined', 'cancelled']) }).parse(req.body);
  const b: any = db.prepare('SELECT b.*, c.owner_id, c.name AS charger_name FROM bookings b JOIN chargers c ON c.id = b.charger_id WHERE b.id = ?').get(id);
  if (!b) return reply.code(404).send({ error: 'Booking not found.' });
  const isOwner = b.owner_id === req.user.id, isDriver = b.user_id === req.user.id;
  if (status === 'cancelled' ? !(isDriver || isOwner) : !isOwner) return reply.code(403).send({ error: 'You cannot do that on this booking.' });
  if (b.status === 'cancelled' || b.status === 'declined') return reply.code(400).send({ error: `This booking is already ${b.status}.` });
  if (status === 'confirmed' && b.status === 'confirmed') return { ok: true, status };
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run(status, id);
  const slot = `${b.charger_name}, ${when(new Date(b.start_time).toISOString())}`;
  if (status === 'confirmed') notify(b.user_id, 'booking_confirmed', 'Booking confirmed', `${userName(req.user.id)} confirmed your slot at ${slot}. You can now use the Call button if you need to reach the owner.`, '/bookings');
  else if (status === 'declined') notify(b.user_id, 'booking_declined', 'Booking request declined', `The owner could not accept your slot at ${slot}. Pick another time or charger.`, `/chargers/${b.charger_id}`);
  else if (isDriver) notify(b.owner_id, 'booking_cancelled', 'Booking cancelled', `${userName(req.user.id)} cancelled their slot at ${slot}. The time is free again.`, '/bookings');
  else notify(b.user_id, 'booking_cancelled', 'Booking cancelled by the owner', `Your slot at ${slot} was cancelled by the owner. Please pick another time or charger.`, `/chargers/${b.charger_id}`);
  return { ok: true, status };
});

// Click-to-call. The phone number is never part of any page; it is only released to the browser's dialer when the
// caller has an active booking on this charger (or owns it).
app.get('/api/chargers/:id/call', { preHandler: auth }, async (req, reply) => {
  const id = idParam((req.params as any).id);
  const c: any = db.prepare('SELECT owner_id, contact_phone FROM chargers WHERE id = ?').get(id);
  if (!c) return reply.code(404).send({ error: 'Charger not found.' });
  const hasBooking = db.prepare(`SELECT 1 FROM bookings WHERE charger_id = ? AND user_id = ? AND status IN ${ACTIVE} LIMIT 1`).get(id, req.user.id);
  if (!hasBooking && c.owner_id !== req.user.id) return reply.code(403).send({ error: 'Book this charger to unlock the call button.' });
  if (!c.contact_phone) return reply.code(404).send({ error: 'The owner has not added a contact number.' });
  reply.header('Cache-Control', 'no-store');
  return { dial: 'tel:' + String(c.contact_phone).replace(/[^\d+]/g, '') };
});

// ---------- notifications ----------
const mapNotif = (r: any) => ({ id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, isRead: !!r.is_read, createdAt: r.created_at });

app.get('/api/notifications', { preHandler: auth }, async (req) => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(100).default(30) }).parse(req.query);
  const items = (db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?').all(req.user.id, limit) as any[]).map(mapNotif);
  const unread = (db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id) as { n: number }).n;
  return { items, unread };
});
app.post('/api/notifications/read-all', { preHandler: auth }, async (req) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  return { ok: true };
});
app.patch('/api/notifications/:id/read', { preHandler: auth }, async (req) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(idParam((req.params as any).id), req.user.id);
  return { ok: true };
});
app.delete('/api/notifications/:id', { preHandler: auth }, async (req) => {
  db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(idParam((req.params as any).id), req.user.id);
  return { ok: true };
});
app.delete('/api/notifications', { preHandler: auth }, async (req) => {
  db.prepare('DELETE FROM notifications WHERE user_id = ?').run(req.user.id);
  return { ok: true };
});

// Reminder: confirmed bookings that start within 15 minutes get one "starting soon" notification.
function runReminders() {
  const now = Date.now();
  const rows = db.prepare(`SELECT b.id, b.user_id, b.start_time, c.id AS charger_id, c.name FROM bookings b JOIN chargers c ON c.id = b.charger_id
    WHERE b.status = 'confirmed' AND b.reminded = 0 AND b.start_time <= ? AND b.start_time > ?`)
    .all(new Date(now + 15 * 60000).toISOString(), new Date(now - 5 * 60000).toISOString()) as any[];
  for (const r of rows) {
    notify(r.user_id, 'booking_reminder', 'Your charging slot starts soon', `${r.name} at ${when(new Date(r.start_time).toISOString())}. Open the page for the Call button.`, `/chargers/${r.charger_id}`);
    db.prepare('UPDATE bookings SET reminded = 1 WHERE id = ?').run(r.id);
  }
}
setInterval(() => { try { runReminders(); } catch (e) { app.log.error(e); } }, 30000).unref();
runReminders();

// ---------- roadside / services ----------
app.get('/api/services', async (req) => {
  const q = z.object({ kind: z.string().optional(), city: z.string().optional() }).parse(req.query);
  const rows = db.prepare('SELECT * FROM services ORDER BY city, name').all() as any[];
  return rows
    .filter((r) => (!q.kind || r.kind === q.kind) && (!q.city || r.city.toLowerCase().includes(q.city.toLowerCase())))
    .map((r) => ({ id: r.id, name: r.name, kind: r.kind, city: r.city, phone: r.phone, evCertified: !!r.ev_certified, notes: r.notes }));
});

// ---------- battery logs ----------
const logSchema = z.object({
  logDate: z.string().min(8), odometerKm: z.number().min(0), kwhAdded: z.number().min(0).max(300),
  socStart: z.number().min(0).max(100), socEnd: z.number().min(0).max(100),
  chargeKind: z.enum(['home_ac', 'public_ac', 'dc_fast', 'swap']), cost: z.number().min(0).default(0),
});
app.get('/api/battery-logs', { preHandler: auth }, async (req) =>
  db.prepare(`SELECT id, log_date AS logDate, odometer_km AS odometerKm, kwh_added AS kwhAdded, soc_start AS socStart,
    soc_end AS socEnd, charge_kind AS chargeKind, cost FROM battery_logs WHERE user_id = ? ORDER BY odometer_km ASC`).all(req.user.id));
app.post('/api/battery-logs', { preHandler: auth }, async (req) => {
  const b = logSchema.parse(req.body);
  db.prepare('INSERT INTO battery_logs (user_id, log_date, odometer_km, kwh_added, soc_start, soc_end, charge_kind, cost) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.id, b.logDate, b.odometerKm, b.kwhAdded, b.socStart, b.socEnd, b.chargeKind, b.cost);
  return { ok: true };
});
app.delete('/api/battery-logs/:id', { preHandler: auth }, async (req) => {
  db.prepare('DELETE FROM battery_logs WHERE id = ? AND user_id = ?').run(idParam((req.params as any).id), req.user.id);
  return { ok: true };
});

// ---------- trip planner ----------
const tripSchema = z.object({
  from: z.object({ lat: z.number(), lng: z.number() }), to: z.object({ lat: z.number(), lng: z.number() }),
  vehicleId: z.string(), startSocPct: z.number().min(5).max(100), reserveSocPct: z.number().min(0).max(40),
  speedKmh: z.number().min(30).max(140), acOn: z.boolean(), loadKg: z.number().min(0).max(600), tempC: z.number().min(-10).max(50),
});
app.post('/api/trip/plan', async (req, reply) => {
  const b = tripSchema.parse(req.body);
  const vehicle = vehicles.find((v) => v.id === b.vehicleId);
  if (!vehicle) return reply.code(400).send({ error: 'Unknown vehicle.' });
  let route;
  try { route = await fetchRoute(b.from, b.to); } catch (e: any) {
    return reply.code(502).send({ error: `Could not get a route: ${e.message ?? 'routing service unavailable'}. Check your internet connection.` });
  }
  const chargers = (db.prepare('SELECT * FROM chargers WHERE is_private = 0').all() as any[]).map((r): ChargerRow => ({
    id: r.id, name: r.name, network: r.network, lat: r.lat, lng: r.lng, city: r.city, powerKw: r.power_kw,
    type: r.type, vehicle: r.vehicle, status: effectiveStatus(r) as ChargerRow['status'], pricePerKwh: r.price_per_kwh,
  }));
  return planTrip(route, chargers, {
    from: b.from, to: b.to, vehicle, startSoc: b.startSocPct / 100, reserveSoc: b.reserveSocPct / 100,
    speedKmh: b.speedKmh, acOn: b.acOn, loadKg: b.loadKg, tempC: b.tempC,
  });
});

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });
console.log(`EVRoute API running on http://localhost:${port}`);
