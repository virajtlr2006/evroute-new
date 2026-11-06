import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { BOOKING_KINDS, renderText, useNotifications } from '@/lib/notifications';
import type { NotifKind } from '@/lib/types';

const tone = (k: NotifKind) => (k === 'booking_confirmed' ? 'success' : k === 'booking_declined' || k === 'booking_cancelled' || k === 'charger_alert' ? 'error' : 'info');

/**
 * Lives in the layout and watches for new notifications while the person is logged in.
 * New ones pop up as a toast (and as a desktop alert if they allowed it and the tab is in the background),
 * and booking changes refresh the bookings, slots and wait data straight away.
 */
export function NotificationListener() {
  const user = useAuth((s) => s.user);
  const push = useToast((s) => s.push);
  const qc = useQueryClient();
  const { data } = useNotifications();
  const seen = useRef<number | null>(null); // highest notification id already handled

  useEffect(() => { seen.current = null; }, [user?.id]);

  useEffect(() => {
    if (!data) return;
    const maxId = data.items.reduce((m, i) => Math.max(m, i.id), 0);
    if (seen.current === null) {
      // first load after logging in: one summary instead of a pile of old toasts
      seen.current = maxId;
      const n = data.items.filter((i) => !i.isRead && i.kind !== 'welcome').length;
      if (n > 0) push('info', `You have ${n} unread notification${n === 1 ? '' : 's'}.`, { href: '/notifications' });
      return;
    }
    const fresh = data.items.filter((i) => i.id > seen.current! && !i.isRead).sort((a, b) => a.id - b.id);
    seen.current = Math.max(seen.current, maxId);
    if (!fresh.length) return;

    if (fresh.length > 3) push('info', `${fresh.length} new notifications.`, { href: '/notifications', ms: 8000 });
    else fresh.forEach((n) => push(tone(n.kind), renderText(n.body), { title: n.title, href: n.link || '/notifications', ms: 8000 }));

    if (fresh.some((n) => BOOKING_KINDS.includes(n.kind))) {
      qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['slots'] }); qc.invalidateQueries({ queryKey: ['wait'] });
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
      fresh.slice(-3).forEach((n) => new Notification(n.title, { body: renderText(n.body) }));
    }
  }, [data, push, qc]);

  return null;
}
