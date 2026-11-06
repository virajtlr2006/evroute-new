import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Charger } from '@/lib/types';
import { ChargerMap } from '@/components/ChargerMap';
import { StatusBadge, TYPE_LABEL } from '@/components/StatusBadge';
import { Card } from '@/components/ui/card';
import { Input, Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';


export default function ChargersPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['chargers'], queryFn: () => api<Charger[]>('/chargers') });
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [f, setF] = useState({ q: '', vehicle: '', type: params.get('type') ?? '', connector: params.get('connector') ?? '', status: '', sort: 'city' });
  const openCharger = (id: number) => nav(`/chargers/${id}`);

  const connectors = useMemo(() => [...new Set(data.flatMap((c) => c.connectors))].sort(), [data]);
  const list = useMemo(() => {
    const q = f.q.toLowerCase();
    const out = data.filter((c) =>
      (!q || c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q)) &&
      (!f.vehicle || c.vehicle === f.vehicle || c.vehicle === 'both') &&
      (!f.type || c.type === f.type) && (!f.connector || c.connectors.includes(f.connector)) && (!f.status || c.status === f.status));
    if (f.sort === 'price') out.sort((a, b) => a.pricePerKwh - b.pricePerKwh);
    if (f.sort === 'power') out.sort((a, b) => b.powerKw - a.powerKw);
    return out;
  }, [data, f]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Find a charger that works</h1>
        <p className="text-ink/70">Every network in one place, with the latest driver reports. Free to browse; log in to report status.</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Input placeholder="Search name or city" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search" />
        <Select value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} aria-label="Vehicle">
          <option value="">Car or bike</option><option value="car">Car</option><option value="bike">Bike / scooter</option>
        </Select>
        <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} aria-label="Charger type">
          <option value="">Any speed</option><option value="fast_dc">DC fast</option><option value="slow_ac">Slow AC</option><option value="swap">Battery swap</option>
        </Select>
        <Select value={f.connector} onChange={(e) => setF({ ...f, connector: e.target.value })} aria-label="Connector">
          <option value="">Any connector</option>{connectors.map((c) => <option key={c}>{c}</option>)}
        </Select>
        <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Status">
          <option value="">Any status</option><option value="available">Working</option><option value="busy">Busy</option><option value="broken">Out of order</option>
        </Select>
        <Select value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} aria-label="Sort">
          <option value="city">Sort: city</option><option value="price">Sort: cheapest</option><option value="power">Sort: fastest</option>
        </Select>
      </div>
      {error && <p className="text-bad">{(error as Error).message}. Is the API running on port 4000?</p>}
      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="order-2 max-h-[640px] space-y-2 overflow-y-auto lg:order-1">
          {isLoading && <p>Loading chargers...</p>}
          {!isLoading && !list.length && <p className="text-ink/70">No chargers match these filters. Clear a filter or add the missing charger.</p>}
          {list.map((c) => (
            <Link key={c.id} to={`/chargers/${c.id}`} className="block" aria-label={`Open ${c.name}`}>
            <Card className="cursor-pointer p-3 hover:border-road">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{c.name}</p>
                  <p className="text-sm text-ink/70">{c.city} - {c.network}</p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                <Badge>{TYPE_LABEL[c.type]}{c.powerKw ? ` ${c.powerKw} kW` : ''}</Badge>
                <Badge>Rs {c.pricePerKwh}{c.type === 'swap' ? '/swap-kWh' : '/kWh'}</Badge>
                {c.isPrivate && <Badge className="bg-signal/30">Private - bookable</Badge>}
                {c.connectors.map((x) => <Badge key={x}>{x}</Badge>)}
              </div>
            </Card>
            </Link>
          ))}
        </div>
        <div className="order-1 space-y-3 lg:order-2">
          <div className="h-[460px] overflow-hidden rounded-xl border border-line">
            <ChargerMap chargers={list} onSelect={openCharger} />
          </div>
          <p className="text-xs text-ink/60">Click a pin or a card to open that charger's page. Pin letter: F = DC fast, S = slow AC, B = battery swap. Colour = latest report (green working, amber busy, red out of order, grey no recent report).</p>
        </div>
      </div>
    </div>
  );
}
