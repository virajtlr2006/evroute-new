import { useNavigate } from 'react-router-dom';
import { useToast } from '@/store/toast';
import { cn } from '@/lib/utils';

const tone = { success: 'bg-ok text-white', error: 'bg-bad text-white', info: 'bg-ink text-white' } as const;
const icon = { success: '\u2713', error: '!', info: 'i' } as const;

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const nav = useNavigate();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[2000] flex flex-col items-center gap-2 px-4 sm:items-end" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={cn('pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg px-4 py-2.5 text-sm shadow-lg', tone[t.kind])}>
          <span aria-hidden className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/25 text-xs font-bold">{icon[t.kind]}</span>
          <button className={cn('flex-1 text-left', t.href ? 'cursor-pointer' : 'cursor-default')} onClick={() => { if (t.href) { nav(t.href); dismiss(t.id); } }}>
            {t.title && <span className="block font-bold">{t.title}</span>}
            <span className={t.title ? 'font-normal' : 'font-semibold'}>{t.text}</span>
            {t.href && <span className="mt-0.5 block text-xs underline">View</span>}
          </button>
          <button className="cursor-pointer text-lg leading-none text-white/80 hover:text-white" onClick={() => dismiss(t.id)} aria-label="Dismiss">&times;</button>
        </div>
      ))}
    </div>
  );
}
