import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = useAuth.getState().token;
  const res = await fetch(`/api${path}`, {
    method: opts.method ?? (opts.body ? 'POST' : 'GET'),
    // Only declare JSON when there is a body: the server rejects an empty body labelled as JSON (e.g. on DELETE).
    headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) {
      useAuth.getState().logout();
      useToast.getState().push('info', 'Your session has expired. Please log in again.');
    }
    throw new Error(data.error ?? res.statusText);
  }
  return data as T;
}

export async function geocode(q: string): Promise<{ lat: number; lng: number; label: string }> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Could not find "${q}". Try adding the state, e.g. "Surat, Gujarat".`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name as string };
}

export interface Found { lat: number; lng: number; label: string; city: string }

async function nominatim(q: string): Promise<Found | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=1&countrycodes=in&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Address search is unavailable right now.');
  const data = await res.json();
  if (!data.length) return null;
  const a = data[0].address ?? {};
  return {
    lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name as string,
    city: a.city ?? a.town ?? a.village ?? a.suburb ?? a.county ?? '',
  };
}

/** Find a typed address on the map. Tries the full text first, then progressively broader queries. */
export async function geocodeAddress(address: string, city: string): Promise<Found | null> {
  const attempts = [[address, city].filter(Boolean).join(', '), address, city].filter((q, i, a) => q && a.indexOf(q) === i);
  for (const q of attempts) {
    const hit = await nominatim(q);
    if (hit) return hit;
  }
  return null;
}
