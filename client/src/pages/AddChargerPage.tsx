import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, geocodeAddress } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import { LocationPicker } from '@/components/ChargerMap';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input, Label, Select } from '@/components/ui/field';

const CONNECTORS = ['CCS2', 'CHAdeMO', 'Type2', 'GB/T', '15A socket', 'Battery swap'];
const AMENITIES = ['restroom', 'food', 'wifi', 'shelter'];

export default function AddChargerPage() {
  const user = useAuth((s) => s.user);
  const nav = useNavigate();
  const qc = useQueryClient();
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [f, setF] = useState({ name: '', network: 'Independent', city: '', address: '', type: 'slow_ac', vehicle: 'car', powerKw: 7.4, pricePerKwh: 10, isPrivate: false, contactPhone: '' });
  const [conn, setConn] = useState<string[]>(['Type2']);
  const [am, setAm] = useState<string[]>([]);
  const toggle = (arr: string[], v: string, set: (a: string[]) => void) => set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // Address -> map: when the person stops typing (or presses Enter), find the address and drop the pin there.
  const [locStatus, setLocStatus] = useState<{ kind: 'idle' | 'searching' | 'found' | 'missing' | 'error'; text?: string }>({ kind: 'idle' });
  const lookupId = useRef(0);
  const lastKey = useRef(''); // the address|city text we last looked up, to avoid repeat lookups
  const manual = useRef(false); // set when the person placed the pin by hand, so we do not move it again for the same text
  const locate = async (address: string, city: string) => {
    const id = ++lookupId.current;
    lastKey.current = `${address.trim()}|${city.trim()}`;
    setLocStatus({ kind: 'searching' });
    try {
      const hit = await geocodeAddress(address.trim(), city.trim());
      if (id !== lookupId.current) return; // a newer lookup superseded this one
      if (!hit) { setLocStatus({ kind: 'missing', text: 'Could not find that address. Add the city or click the map to place the pin yourself.' }); return; }
      manual.current = false;
      setPos([hit.lat, hit.lng]);
      if (!city.trim() && hit.city) { lastKey.current = `${address.trim()}|${hit.city}`; setF((cur) => (cur.city ? cur : { ...cur, city: hit.city })); }
      setLocStatus({ kind: 'found', text: hit.label });
    } catch (e) {
      if (id === lookupId.current) setLocStatus({ kind: 'error', text: (e as Error).message });
    }
  };
  useEffect(() => {
    if (f.address.trim().length < 4 || manual.current || lastKey.current === `${f.address.trim()}|${f.city.trim()}`) return;
    const t = setTimeout(() => locate(f.address, f.city), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.address, f.city]);
  const placeByHand = (p: [number, number]) => { manual.current = true; lookupId.current++; setPos(p); setLocStatus({ kind: 'idle' }); };

  const create = useMutation({
    mutationFn: () => api<{ id: number }>('/chargers', { body: { ...f, lat: pos![0], lng: pos![1], connectors: conn, amenities: am } }),
    onSuccess: (d) => { qc.invalidateQueries({ queryKey: ['chargers'] }); qc.invalidateQueries({ queryKey: ['notifications'] }); useToast.getState().push('success', 'Charger added. Thank you for helping other drivers.'); nav(`/chargers/${d.id}`); },
    onError: (e) => useToast.getState().push('error', (e as Error).message),
  });
  const submit = (e: FormEvent) => { e.preventDefault(); if (pos) create.mutate(); };

  if (!user) return <Card>Please <Link className="underline" to="/login">log in</Link> to add a charger.</Card>;

  return (
    <div className="space-y-4">
      <div><h1 className="text-3xl font-bold">Add a charger</h1>
        <p className="text-ink/70">Know a charger that is missing? Add it. Or share your home charger with travellers: tick "private" and approve each booking yourself.</p></div>
      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div><Label htmlFor="n">Name</Label><Input id="n" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="c">City</Label><Input id="c" required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
            <div><Label htmlFor="nw">Network</Label><Input id="nw" value={f.network} onChange={(e) => setF({ ...f, network: e.target.value })} /></div>
          </div>
          <div><Label htmlFor="a">Address or landmark</Label><Input id="a" value={f.address} placeholder="e.g. Station Road, Bardoli" autoComplete="street-address"
            onChange={(e) => { manual.current = false; setF({ ...f, address: e.target.value }); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); locate(f.address, f.city); } }} />
            <p className="mt-1 text-xs text-ink/60" aria-live="polite">
              {locStatus.kind === 'searching' && 'Locating on the map...'}
              {locStatus.kind === 'found' && <span className="text-ok">Location set on the map from this address. Drag the pin to fine-tune.</span>}
              {(locStatus.kind === 'missing' || locStatus.kind === 'error') && <span className="text-bad">{locStatus.text}</span>}
              {locStatus.kind === 'idle' && 'Type the address and the map will jump to it.'}
            </p></div>
          <div><Label htmlFor="ph">Contact phone (for bookings and enquiries)</Label>
            <Input id="ph" type="tel" inputMode="tel" required={f.isPrivate} placeholder="+91 98765 43210" value={f.contactPhone} onChange={(e) => setF({ ...f, contactPhone: e.target.value })} />
            <p className="mt-1 text-xs text-ink/60">Never shown on the site. Drivers with a booking get a Call button that connects them to this number.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="t">Charger type</Label>
              <Select id="t" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
                <option value="fast_dc">DC fast</option><option value="slow_ac">Slow AC</option><option value="swap">Battery swap</option></Select></div>
            <div><Label htmlFor="v">For</Label>
              <Select id="v" value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })}>
                <option value="car">Cars</option><option value="bike">Bikes / scooters</option><option value="both">Both</option></Select></div>
            <div><Label htmlFor="p">Power (kW)</Label><Input id="p" type="number" step="0.1" min={0} value={f.powerKw} onChange={(e) => setF({ ...f, powerKw: Number(e.target.value) })} /></div>
            <div><Label htmlFor="pr">Price (Rs/kWh)</Label><Input id="pr" type="number" min={0} value={f.pricePerKwh} onChange={(e) => setF({ ...f, pricePerKwh: Number(e.target.value) })} /></div>
          </div>
          <fieldset><legend className="mb-1 text-sm font-medium">Connectors</legend>
            <div className="flex flex-wrap gap-3 text-sm">{CONNECTORS.map((x) => <label key={x} className="flex items-center gap-1.5"><input type="checkbox" checked={conn.includes(x)} onChange={() => toggle(conn, x, setConn)} />{x}</label>)}</div></fieldset>
          <fieldset><legend className="mb-1 text-sm font-medium">Nearby amenities</legend>
            <div className="flex flex-wrap gap-3 text-sm">{AMENITIES.map((x) => <label key={x} className="flex items-center gap-1.5"><input type="checkbox" checked={am.includes(x)} onChange={() => toggle(am, x, setAm)} />{x}</label>)}</div></fieldset>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={f.isPrivate} onChange={(e) => setF({ ...f, isPrivate: e.target.checked })} />Private charger: travellers must request a booking</label>
        </Card>
        <Card className="space-y-3">
          <p className="text-sm font-medium">Location: type the address, click the map, or drag the pin {pos && <span className="font-normal text-ink/60">({pos[0].toFixed(4)}, {pos[1].toFixed(4)})</span>}</p>
          <div className="overflow-hidden rounded-xl border border-line"><LocationPicker value={pos} onChange={placeByHand} /></div>
          {create.error && <p className="text-sm text-bad">{(create.error as Error).message}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={!pos || !conn.length || create.isPending}>{pos ? 'Save charger' : 'Pick a location first'}</Button>
        </Card>
      </form>
    </div>
  );
}
