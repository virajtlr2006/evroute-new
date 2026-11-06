import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { KIND_META, renderText, useNotificationActions, useNotifications } from '@/lib/notifications';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn, timeAgo } from '@/lib/utils';

export default function NotificationsPage() {
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const push = useToast((s) => s.push);
  const { data, isLoading } = useNotifications(100);
  const { markRead, markAll, remove, clear } = useNotificationActions();
  const [tab, setTab] = useState<'all' | 'unread'>('all');
  const [perm, setPerm] = useState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);

  if (!user) return <Card>Please <Link className="underline" to="/login">log in</Link> to see your notifications.</Card>;
  const items = (data?.items ?? []).filter((n) => tab === 'all' || !n.isRead);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-ink/70">Booking requests, confirmations, reminders and alerts about your chargers. New ones also pop up while you browse.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!data?.unread || markAll.isPending} onClick={() => markAll.mutate()}>Mark all read</Button>
          <Button variant="outline" disabled={!data?.items.length || clear.isPending} onClick={() => { clear.mutate(); push('info', 'All notifications cleared.'); }}>Clear all</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-2">
          {(['all', 'unread'] as const).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={cn('cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold', tab === t ? 'border-road bg-road text-white' : 'border-line bg-white hover:bg-paper')}>
              {t === 'all' ? 'All' : `Unread${data?.unread ? ` (${data.unread})` : ''}`}
            </button>
          ))}
        </div>
        {perm === 'default' && (
          <Button size="sm" variant="accent" onClick={async () => {
            const r = await Notification.requestPermission(); setPerm(r);
            push(r === 'granted' ? 'success' : 'info', r === 'granted' ? 'Desktop alerts are on. You will get them when this tab is in the background.' : 'Desktop alerts stay off.');
          }}>Turn on desktop alerts</Button>
        )}
        {perm === 'granted' && <p className="text-xs text-ink/60">Desktop alerts are on for this browser.</p>}
        {perm === 'denied' && <p className="text-xs text-ink/60">Desktop alerts are blocked in your browser settings.</p>}
      </div>

      <ul className="space-y-2">
        {isLoading && <li>Loading...</li>}
        {items.map((n) => (
          <li key={n.id}>
            <Card className={cn('flex items-start gap-3 p-3', !n.isRead && 'border-road/40 bg-road/5')}>
              <span aria-hidden className={cn('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white', KIND_META[n.kind].dot)}>{KIND_META[n.kind].glyph}</span>
              <div className="min-w-0 flex-1">
                <p className={cn(!n.isRead ? 'font-bold' : 'font-semibold')}>{n.title} {!n.isRead && <span className="ml-1 inline-block h-2 w-2 rounded-full bg-road align-middle" aria-label="Unread" />}</p>
                <p className="text-sm text-ink/80">{renderText(n.body)}</p>
                <p className="mt-0.5 text-xs text-ink/50">{KIND_META[n.kind].label} - {timeAgo(n.createdAt)}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row">
                {n.link && <Button size="sm" onClick={() => { if (!n.isRead) markRead.mutate(n.id); nav(n.link); }}>Open</Button>}
                {!n.isRead && <Button size="sm" variant="outline" onClick={() => markRead.mutate(n.id)}>Mark read</Button>}
                <Button size="sm" variant="ghost" aria-label="Delete notification" onClick={() => remove.mutate(n.id)}>Delete</Button>
              </div>
            </Card>
          </li>
        ))}
        {!isLoading && !items.length && <li className="rounded-xl border border-dashed border-line p-8 text-center text-ink/60">{tab === 'unread' ? 'No unread notifications.' : 'No notifications yet. Booking updates will show up here.'}</li>}
      </ul>
    </div>
  );
}
