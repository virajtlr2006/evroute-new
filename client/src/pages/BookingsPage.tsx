import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import type { Booking } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallButton } from '@/components/CallButton';
import { useCancelBooking, useMyBookings } from '@/lib/bookings';
import { useToast } from '@/store/toast';

const badge: Record<string, string> = {
  requested: 'bg-warn/20 text-warn', confirmed: 'bg-ok/15 text-ok', declined: 'bg-black/5 text-ink/60 line-through', cancelled: 'bg-bad/15 text-bad',
};

export default function BookingsPage() {
  const user = useAuth((s) => s.user);
  const qc = useQueryClient();
  const { data } = useMyBookings();
  const push = useToast((s) => s.push);
  const cancel = useCancelBooking();
  const act = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => api(`/bookings/${id}`, { method: 'PATCH', body: { status } }),
    onSuccess: (_d, v) => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['slots'] }); push('success', v.status === 'confirmed' ? 'Booking confirmed.' : 'Booking declined.'); },
    onError: (e) => push('error', (e as Error).message),
  });
  if (!user) return <Card>Please <Link className="underline" to="/login">log in</Link> to see your bookings.</Card>;

  const row = (b: Booking, incoming: boolean) => (
    <Card key={b.id} className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="font-semibold"><Link className="underline" to={`/chargers/${b.chargerId}`}>{b.chargerName}</Link>, {b.city}</p>
        <p className="text-sm text-ink/70">{new Date(b.startTime).toLocaleString()} for {b.durationMin} min{incoming ? ` - requested by ${b.driverName}` : ''}</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge className={badge[b.status]}>{b.status}</Badge>
        {incoming && b.status === 'requested' && (<>
          <Button size="sm" onClick={() => act.mutate({ id: b.id, status: 'confirmed' })}>Confirm</Button>
          <Button size="sm" variant="outline" onClick={() => act.mutate({ id: b.id, status: 'declined' })}>Decline</Button>
        </>)}
        {!incoming && (b.status === 'requested' || b.status === 'confirmed') && <CallButton chargerId={b.chargerId} size="sm" label="Call" />}
        {(b.status === 'requested' || b.status === 'confirmed') && <Button size="sm" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: b.id, chargerId: b.chargerId })}>Cancel booking</Button>}
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Bookings</h1>
      <section className="space-y-2"><CardTitle>Requests for your chargers</CardTitle>
        {data?.incoming.map((b) => row(b, true))}{!data?.incoming.length && <p className="text-sm text-ink/70">None yet. Share a private charger from "Add a charger".</p>}</section>
      <section className="space-y-2"><CardTitle>Your bookings</CardTitle>
        {data?.made.map((b) => row(b, false))}{!data?.made.length && <p className="text-sm text-ink/70">You have not booked a private charger yet.</p>}</section>
    </div>
  );
}
