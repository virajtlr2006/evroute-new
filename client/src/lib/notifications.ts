import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { NotificationList, NotifKind } from '@/lib/types';

/** The server writes times as [[ISO]]; show them in the reader's own time zone. */
export const renderText = (s: string) =>
  s.replace(/\[\[(\d{4}-[^\]]+)\]\]/g, (_m, iso: string) =>
    new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }));

export const KIND_META: Record<NotifKind, { label: string; dot: string; glyph: string }> = {
  welcome: { label: 'Welcome', dot: 'bg-road', glyph: '\u2605' },
  info: { label: 'Update', dot: 'bg-road', glyph: 'i' },
  booking_request: { label: 'Request', dot: 'bg-signal text-ink', glyph: '\u2709' },
  booking_confirmed: { label: 'Confirmed', dot: 'bg-ok', glyph: '\u2713' },
  booking_declined: { label: 'Declined', dot: 'bg-bad', glyph: '\u00d7' },
  booking_cancelled: { label: 'Cancelled', dot: 'bg-bad', glyph: '\u00d7' },
  booking_reminder: { label: 'Reminder', dot: 'bg-warn', glyph: '\u23f0' },
  charger_alert: { label: 'Alert', dot: 'bg-bad', glyph: '!' },
  review: { label: 'Review', dot: 'bg-road', glyph: '\u2605' },
};

export const BOOKING_KINDS: NotifKind[] = ['booking_request', 'booking_confirmed', 'booking_declined', 'booking_cancelled', 'booking_reminder'];

/** Notifications for the signed-in user, refreshed every 6 seconds. */
export function useNotifications(limit = 30) {
  const user = useAuth((s) => s.user);
  return useQuery({
    queryKey: ['notifications', user?.id, limit], enabled: !!user, refetchInterval: 6000,
    queryFn: () => api<NotificationList>(`/notifications?limit=${limit}`),
  });
}

export function useNotificationActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['notifications'] });
  // update every cached list at once so the badge and the lists change instantly
  const patch = (fn: (l: NotificationList) => NotificationList) =>
    qc.setQueriesData<NotificationList>({ queryKey: ['notifications'] }, (old) => (old ? fn(old) : old));
  const markRead = useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}/read`, { method: 'PATCH' }),
    onMutate: (id) => patch((l) => {
      const was = l.items.find((i) => i.id === id);
      return { items: l.items.map((i) => (i.id === id ? { ...i, isRead: true } : i)), unread: Math.max(0, l.unread - (was && !was.isRead ? 1 : 0)) };
    }),
    onSettled: refresh,
  });
  const markAll = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onMutate: () => patch((l) => ({ items: l.items.map((i) => ({ ...i, isRead: true })), unread: 0 })),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: number) => api(`/notifications/${id}`, { method: 'DELETE' }),
    onMutate: (id) => patch((l) => {
      const was = l.items.find((i) => i.id === id);
      return { items: l.items.filter((i) => i.id !== id), unread: Math.max(0, l.unread - (was && !was.isRead ? 1 : 0)) };
    }),
    onSettled: refresh,
  });
  const clear = useMutation({
    mutationFn: () => api('/notifications', { method: 'DELETE' }),
    onMutate: () => patch(() => ({ items: [], unread: 0 })),
    onSettled: refresh,
  });
  return { markRead, markAll, remove, clear };
}
