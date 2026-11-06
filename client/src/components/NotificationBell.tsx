import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { KIND_META, renderText, useNotificationActions, useNotifications } from '@/lib/notifications';
import { timeAgo, cn } from '@/lib/utils';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  const loc = useLocation();
  const { data } = useNotifications();
  const { markRead, markAll } = useNotificationActions();
  const unread = data?.unread ?? 0;

  useEffect(() => { setOpen(false); }, [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="relative" ref={box}>
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="true" aria-expanded={open}
        aria-label={`Notifications, ${unread} unread`} className="relative grid h-9 w-9 cursor-pointer place-items-center rounded-md hover:bg-white/10">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-bad px-1 text-[11px] font-bold leading-[18px] text-white">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[1500] mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-white text-ink shadow-xl" role="dialog" aria-label="Notifications">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <p className="font-bold">Notifications</p>
            <button className="cursor-pointer text-xs font-semibold underline disabled:no-underline disabled:opacity-40" disabled={!unread} onClick={() => markAll.mutate()}>Mark all read</button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {data?.items.slice(0, 8).map((n) => (
              <li key={n.id}>
                <button onClick={() => { if (!n.isRead) markRead.mutate(n.id); setOpen(false); nav(n.link || '/notifications'); }}
                  className={cn('flex w-full cursor-pointer items-start gap-3 border-b border-line px-3 py-2.5 text-left hover:bg-paper', !n.isRead && 'bg-road/5')}>
                  <span aria-hidden className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white', KIND_META[n.kind].dot)}>{KIND_META[n.kind].glyph}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block text-sm', !n.isRead ? 'font-bold' : 'font-semibold')}>{n.title}</span>
                    <span className="block text-xs text-ink/70">{renderText(n.body)}</span>
                    <span className="block text-[11px] text-ink/50">{timeAgo(n.createdAt)}</span>
                  </span>
                  {!n.isRead && <span aria-label="Unread" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-road" />}
                </button>
              </li>
            ))}
            {!data?.items.length && <li className="px-3 py-8 text-center text-sm text-ink/60">You are all caught up.</li>}
          </ul>
          <Link to="/notifications" className="block px-3 py-2 text-center text-sm font-semibold underline">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
