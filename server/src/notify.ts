import { db } from './db';

export type NotifKind =
  | 'welcome' | 'info'
  | 'booking_request' | 'booking_confirmed' | 'booking_declined' | 'booking_cancelled' | 'booking_reminder'
  | 'charger_alert' | 'review';

/**
 * Store a notification for a user.
 * `read = true` records the event in the history without raising an alert: used when the person caused the event
 * themselves, because they already saw an instant confirmation on screen.
 */
export function notify(userId: number | null | undefined, kind: NotifKind, title: string, body = '', link = '', read = false) {
  if (!userId) return;
  db.prepare('INSERT INTO notifications (user_id, kind, title, body, link, is_read) VALUES (?,?,?,?,?,?)')
    .run(userId, kind, title, body, link, read ? 1 : 0);
}

/**
 * Times inside notification text are written as [[ISO-timestamp]] and turned into the reader's local time by the browser,
 * so a driver in India and a server in another time zone both see the right clock time.
 */
export const when = (iso: string) => `[[${iso}]]`;

export const userName = (id: number): string => (db.prepare('SELECT name FROM users WHERE id = ?').get(id) as { name: string } | undefined)?.name ?? 'Someone';
