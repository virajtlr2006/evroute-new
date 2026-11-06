import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { fmtSlot, useCancelBooking, useMyBookings, useSlots } from '@/lib/bookings';
import type { Charger } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Select } from '@/components/ui/field';
import { CallButton } from '@/components/CallButton';
import { cn } from '@/lib/utils';

const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export function BookingPanel({ charger }: { charger: Charger }) {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  const slots = useSlots(charger.id);
  const mine = useMyBookings();
  const cancel = useCancelBooking();
  const [form, setForm] = useState({ startTime: '', durationMin: 60 });

  const myActive = (mine.data?.made ?? []).filter((b) => b.chargerId === charger.id && (b.status === 'requested' || b.status === 'confirmed'));

  // Live overlap check against the slots other people (and you) already hold.
  const clash = useMemo(() => {
    if (!form.startTime) return null;
    const s = new Date(form.startTime).getTime();
    if (Number.isNaN(s)) return null;
    const e = s + form.durationMin * 60000;
    return (slots.data ?? []).find((x) => s < new Date(x.endTime).getTime() && e > new Date(x.startTime).getTime()) ?? null;
  }, [form, slots.data]);
  const inPast = !!form.startTime && new Date(form.startTime).getTime() < Date.now() - 60000;

  const book = useMutation({
    mutationFn: () => api<{ id: number; status: string }>(`/chargers/${charger.id}/bookings`, {
      body: { startTime: new Date(form.startTime).toISOString(), durationMin: Number(form.durationMin) } }),
    onSuccess: (r) => {
      push('success', r.status === 'confirmed' ? 'Booking confirmed.' : 'Request sent. The owner will confirm it.');
      setForm({ startTime: '', durationMin: 60 });
    },
    onError: (e) => push('error', (e as Error).message),
    onSettled: () => { qc.invalidateQueries({ queryKey: ['slots', charger.id] }); qc.invalidateQueries({ queryKey: ['bookings'] }); },
  });

  if (charger.type === 'swap') return <p className="text-sm text-ink/70">Battery-swap stations are walk-in only and cannot be booked.</p>;
  const isOwn = !!user && charger.ownerId === user.id;

  return (
    <div className="space-y-4">
      <section aria-label="Booked time slots">
        <h4 className="mb-1 text-sm font-bold">Booked slots <span className="font-normal text-ink/60">(updates live)</span></h4>
        {slots.data?.length ? (
          <ul className="space-y-1">
            {slots.data.map((x) => (
              <li key={x.id} className={cn('flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm', x.mine ? 'bg-road/10' : 'bg-bad/10')}>
                <span>{fmtSlot(x.startTime, x.endTime)}</span>
                <Badge className={x.status === 'requested' ? 'bg-warn/20 text-warn' : 'bg-bad/15 text-bad'}>
                  {x.mine ? 'Your booking' : x.status === 'requested' ? 'Pending' : 'Booked'}
                </Badge>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-ok">No upcoming bookings. Every time is free.</p>}
      </section>

      {user && myActive.length > 0 && (
        <section aria-label="Your bookings here" className="space-y-2">
          <h4 className="text-sm font-bold">Your booking{myActive.length > 1 ? 's' : ''} here</h4>
          {myActive.map((b) => (
            <div key={b.id} className="space-y-2 rounded-lg border border-line p-3">
              <p className="text-sm">
                {new Date(b.startTime).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} for {b.durationMin} min{' '}
                <Badge className={b.status === 'confirmed' ? 'bg-ok/15 text-ok' : 'bg-warn/20 text-warn'}>{b.status === 'confirmed' ? 'Confirmed' : 'Waiting for owner'}</Badge>
              </p>
              <div className="flex flex-wrap gap-2">
                {charger.hasContact && <CallButton chargerId={charger.id} />}
                <Button size="md" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: b.id, chargerId: charger.id })}>Cancel booking</Button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!user ? (
        <p className="text-sm">Please <Link className="underline" to="/login">log in</Link> to book a slot.</p>
      ) : isOwn ? (
        <p className="text-sm text-ink/70">This is your charger. Manage requests under <Link className="underline" to="/bookings">Bookings</Link>.</p>
      ) : (
        <section aria-label="Book a slot" className="space-y-2">
          <h4 className="text-sm font-bold">Pick a free time</h4>
          <div><Label htmlFor={`st${charger.id}`}>Start time</Label>
            <Input id={`st${charger.id}`} type="datetime-local" min={localInput(new Date())} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></div>
          <div><Label htmlFor={`du${charger.id}`}>Duration</Label>
            <Select id={`du${charger.id}`} value={form.durationMin} onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}>
              {[30, 60, 120, 180, 240, 480].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>)}
            </Select></div>
          {clash && <p className="text-sm font-medium text-bad">Not available: this overlaps a booking ({fmtSlot(clash.startTime, clash.endTime)}). Choose another time.</p>}
          {inPast && <p className="text-sm font-medium text-bad">Choose a time in the future.</p>}
          <Button className="w-full" disabled={!form.startTime || !!clash || inPast || book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? 'Booking...' : charger.isPrivate && charger.ownerId ? 'Request booking' : 'Book now'}
          </Button>
          {charger.isPrivate && charger.ownerId && <p className="text-xs text-ink/60">The owner confirms each request on private chargers. The slot is held for you meanwhile.</p>}
          {!charger.hasContact && <p className="text-xs text-ink/60">This charger has no contact number listed, so there is no call button.</p>}
        </section>
      )}
    </div>
  );
}
