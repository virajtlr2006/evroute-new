import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import type { ChargerDetail, Status } from '@/lib/types';
import { StatusBadge, TYPE_LABEL } from '@/components/StatusBadge';
import { ChargerMap } from '@/components/ChargerMap';
import { BookingPanel } from '@/components/BookingPanel';
import { WaitPanel } from '@/components/WaitPanel';
import { GUIDE_KEY_BY_CONNECTOR } from '@/lib/guides';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Label, Select, Textarea } from '@/components/ui/field';
import { timeAgo } from '@/lib/utils';

export default function ChargerDetailPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const { data: c, isLoading, error } = useQuery({ queryKey: ['charger', id], queryFn: () => api<ChargerDetail>(`/chargers/${id}`) });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['charger', id] }); qc.invalidateQueries({ queryKey: ['chargers'] }); qc.invalidateQueries({ queryKey: ['wait'] }); };

  const [note, setNote] = useState('');
  const [finishIn, setFinishIn] = useState(0);
  const report = useMutation({ mutationFn: (status: Status) => api(`/chargers/${id}/reports`, { body: { status, note, ...(status === 'busy' && finishIn ? { finishInMin: finishIn } : {}) } }), onSuccess: () => { setNote(''); refresh(); useToast.getState().push('success', 'Thanks. Your status report is live for other drivers.'); }, onError: (e) => useToast.getState().push('error', (e as Error).message) });

  const [rv, setRv] = useState({ rating: 5, comment: '' });
  const review = useMutation({ mutationFn: () => api(`/chargers/${id}/reviews`, { body: rv }), onSuccess: () => { setRv({ rating: 5, comment: '' }); refresh(); useToast.getState().push('success', 'Review posted. Thank you.'); }, onError: (e) => useToast.getState().push('error', (e as Error).message) });

  if (isLoading) return <p>Loading...</p>;
  if (error || !c) return <p className="text-bad">{(error as Error)?.message ?? 'Not found'}</p>;
  const loginHint = <p className="text-sm">Please <Link className="underline" to="/login">log in</Link> to do this.</p>;

  return (
    <div className="space-y-3">
    <Link to="/" className="inline-block text-sm font-semibold underline">&larr; All chargers</Link>
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-2xl font-bold">{c.name}</h1>
              <p className="text-ink/70">{c.address}{c.address ? ', ' : ''}{c.city} - {c.network}</p>
            </div>
            <div className="text-right">
              <StatusBadge status={c.status} />
              <p className="mt-1 text-xs text-ink/60">Updated {timeAgo(c.statusUpdatedAt)}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Badge>{TYPE_LABEL[c.type]}{c.powerKw ? ` ${c.powerKw} kW` : ''}</Badge>
            <Badge>Rs {c.pricePerKwh}/kWh</Badge>
            <Badge>For {c.vehicle === 'both' ? 'cars and bikes' : c.vehicle === 'car' ? 'cars' : 'bikes'}</Badge>
            {c.connectors.map((x) => <Badge key={x}>{x}</Badge>)}
            {c.amenities.map((x) => <Badge key={x} className="bg-road/10 text-road">{x}</Badge>)}
          </div>
          {c.type !== 'swap' && (
            <a href="#book" className="mt-4 inline-flex h-12 items-center rounded-lg bg-road px-6 font-semibold text-white hover:bg-road-dark">Book now</a>
          )}
        </Card>

        <Card>
          <CardTitle>Is it working right now?</CardTitle>
          <p className="mb-3 text-sm text-ink/70">Your report helps the next driver. Reports older than 24 hours are shown as "no recent report".</p>
          {user ? (
            <div className="space-y-2">
              <Input placeholder="Optional note, e.g. 2 cars waiting" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
              <div className="max-w-xs"><Label htmlFor="fin">If busy, current charging finishes in</Label>
                <Select id="fin" value={finishIn} onChange={(e) => setFinishIn(Number(e.target.value))}>
                  <option value={0}>Not sure</option>
                  {[5, 10, 15, 20, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m >= 60 ? `${m / 60} h` : `${m} min`}</option>)}
                </Select></div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => report.mutate('available')} disabled={report.isPending}>Working</Button>
                <Button variant="accent" onClick={() => report.mutate('busy')} disabled={report.isPending}>Busy</Button>
                <Button variant="danger" onClick={() => report.mutate('broken')} disabled={report.isPending}>Out of order</Button>
              </div>
              {report.error && <p className="text-sm text-bad">{(report.error as Error).message}</p>}
            </div>
          ) : loginHint}
          <ul className="mt-4 space-y-1 text-sm">
            {c.reports.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2">
                <StatusBadge status={r.status} /> <span>{r.userName}, {timeAgo(r.createdAt)}</span>{r.note && <span className="text-ink/70">- {r.note}</span>}
              </li>
            ))}
            {!c.reports.length && <li className="text-ink/70">No reports yet. Be the first.</li>}
          </ul>
        </Card>

        <Card>
          <CardTitle>Reviews {c.avgRating ? `(${c.avgRating}/5 from ${c.reviewCount})` : ''}</CardTitle>
          {user ? (
            <div className="mb-4 grid gap-2 sm:grid-cols-[120px_1fr_auto]">
              <Select value={rv.rating} onChange={(e) => setRv({ ...rv, rating: Number(e.target.value) })} aria-label="Rating">
                {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} stars</option>)}
              </Select>
              <Input placeholder="Speed, cleanliness, food nearby..." value={rv.comment} onChange={(e) => setRv({ ...rv, comment: e.target.value })} maxLength={400} />
              <Button onClick={() => review.mutate()} disabled={review.isPending}>Post review</Button>
            </div>
          ) : <div className="mb-3">{loginHint}</div>}
          <ul className="space-y-2">
            {c.reviews.map((r) => (
              <li key={r.id} className="rounded-lg bg-paper p-3 text-sm">
                <p className="font-semibold">{r.rating}/5 <span className="font-normal text-ink/70">by {r.userName}, {timeAgo(r.createdAt)}</span></p>
                {r.comment && <p>{r.comment}</p>}
              </li>
            ))}
            {!c.reviews.length && <li className="text-sm text-ink/70">No reviews yet.</li>}
          </ul>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="h-64 overflow-hidden rounded-xl border border-line"><ChargerMap chargers={[c]} selectedId={c.id} className="h-full w-full" /></div>
        <Card>
          <CardTitle>Charger owner</CardTitle>
          <p className="font-semibold">{c.ownerName ?? c.network}</p>
          <p className="text-sm text-ink/70">{c.isPrivate ? 'Private host. The owner approves each booking request.' : c.ownerName ? `Listed by a community member - ${c.network} network.` : `Operator: ${c.network}`}</p>
        </Card>
        <Card id="book" className="scroll-mt-4 space-y-4">
          <CardTitle>Book a slot</CardTitle>
          <WaitPanel charger={c} />
          <BookingPanel charger={c} />
        </Card>
        <Card>
          <CardTitle>How to charge here</CardTitle>
          <p className="mb-2 text-sm text-ink/70">Video and step-by-step guide for this charger.</p>
          <div className="flex flex-wrap gap-2">
            {[...new Set(c.connectors.map((x) => GUIDE_KEY_BY_CONNECTOR[x]).filter(Boolean))].map((k) => {
              const label = c.connectors.find((x) => GUIDE_KEY_BY_CONNECTOR[x] === k)!;
              return <Link key={k} to={`/guide?type=${k}`} className="inline-flex h-9 items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold hover:bg-paper">{label} guide</Link>;
            })}
          </div>
        </Card>
      </div>
    </div>
    </div>
  );
}
