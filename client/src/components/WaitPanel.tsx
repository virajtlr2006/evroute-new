import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { useMyBookings } from '@/lib/bookings';
import type { Charger } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Select, Label } from '@/components/ui/field';

interface WaitInfo {
  busy: boolean; estimated?: boolean; busyUntil?: string; minutesLeft?: number;
  startTime?: string; endTime?: string; waitMin?: number; othersAhead?: boolean; durationMin?: number;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} minute${m === 1 ? '' : 's'}`);

/** Shown only while the charger is in use. Asks "do you want to wait?", then asks the driver to confirm before reserving the next slot. */
export function WaitPanel({ charger }: { charger: Charger }) {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const mine = useMyBookings();
  const [duration, setDuration] = useState(60);
  const [step, setStep] = useState<'ask' | 'confirm'>('ask');
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 20000); return () => clearInterval(t); }, []);

  const { data: info } = useQuery({
    queryKey: ['wait', charger.id, duration],
    queryFn: () => api<WaitInfo>(`/chargers/${charger.id}/wait-info?durationMin=${duration}`),
    refetchInterval: 10000,
  });

  const wait = useMutation({
    mutationFn: () => api<{ startTime: string; status: string }>(`/chargers/${charger.id}/wait`, { body: { durationMin: duration, expectedStart: info!.startTime } }),
    onSuccess: (r) => {
      push('success', r.status === 'confirmed' ? `You're next. Your slot starts at ${clock(r.startTime)}.` : `Request sent for ${clock(r.startTime)}. The owner will confirm it.`);
      setStep('ask');
    },
    onError: (e) => { push('error', (e as Error).message); setStep('ask'); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['wait', charger.id] }); qc.invalidateQueries({ queryKey: ['slots', charger.id] }); qc.invalidateQueries({ queryKey: ['bookings'] });
    },
  });

  if (!info?.busy || !info.busyUntil || !info.startTime) return null;
  // minutes left, recomputed locally so the countdown stays fresh between server refreshes
  const left = Math.max(1, Math.ceil((new Date(info.busyUntil).getTime() - Date.now()) / 60000));
  const isOwn = !!user && charger.ownerId === user.id;
  const hasBooking = (mine.data?.made ?? []).some((b) => b.chargerId === charger.id && (b.status === 'requested' || b.status === 'confirmed'));
  const wantsLabel = charger.isPrivate && charger.ownerId ? 'Send request' : 'Yes, reserve my turn';

  return (
    <div className="space-y-3 rounded-xl border-2 border-signal bg-signal/15 p-4" role="region" aria-label="Charger is busy">
      <div>
        <p className="font-bold">This charger is in use right now</p>
        <p className="text-sm">
          The current charging should finish in about <span className="font-bold">{mins(left)}</span> (around {clock(info.busyUntil)}).
          {info.estimated && <span className="text-ink/70"> This is an estimate because no finish time was reported.</span>}
        </p>
      </div>

      {charger.type === 'swap' || isOwn ? null : !user ? (
        <p className="text-sm">Please <Link className="underline" to="/login">log in</Link> to wait for your turn.</p>
      ) : hasBooking ? (
        <p className="text-sm font-medium">You already have a booking here, so your turn is held. See it below.</p>
      ) : step === 'ask' ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Do you want to wait?</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setStep('confirm')}>Yes, I will wait</Button>
            <Link to="/" className="inline-flex h-10 items-center rounded-lg border border-line bg-white px-4 text-sm font-semibold hover:bg-paper">No, find another charger</Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3 rounded-lg bg-white p-3">
          <div><Label htmlFor={`wd${charger.id}`}>How long will you charge?</Label>
            <Select id={`wd${charger.id}`} value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {[30, 60, 120, 180, 240].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>)}
            </Select></div>
          <p className="text-sm">
            <span className="font-bold">Please confirm.</span> We will reserve this charger for you from{' '}
            <span className="font-bold">{clock(info.startTime)} to {clock(info.endTime!)}</span> (about {mins(info.waitMin!)} from now).
            {info.othersAhead && <span> Other drivers are booked ahead of you, so your turn is a little later than the finish time.</span>}
            {charger.isPrivate && charger.ownerId && <span> The owner still needs to approve it, and your slot is held meanwhile.</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={wait.isPending} onClick={() => wait.mutate()}>{wait.isPending ? 'Reserving...' : wantsLabel}</Button>
            <Button variant="outline" disabled={wait.isPending} onClick={() => setStep('ask')}>Go back</Button>
          </div>
        </div>
      )}
    </div>
  );
}
