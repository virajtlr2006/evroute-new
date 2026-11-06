import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import type { Charger } from '@/lib/types';
import { STATUS_META } from './StatusBadge';

const letter = { fast_dc: 'F', slow_ac: 'S', swap: 'B' } as const;

function pin(c: Charger, selected: boolean, stopNo?: number) {
  const bg = STATUS_META[c.status].color;
  const text = stopNo ? String(stopNo) : letter[c.type];
  return L.divIcon({
    className: '',
    html: `<div class="pin ${selected ? 'sel' : ''}" style="background:${bg}">${text}</div>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [30, 30] });
  }, [points, map]);
  return null;
}

interface Props {
  chargers: Charger[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  line?: [number, number][];
  stopIds?: number[];
  className?: string;
}

export function ChargerMap({ chargers, selectedId, onSelect, line, stopIds, className }: Props) {
  return (
    <MapContainer center={[21.5, 72.9]} zoom={7} className={className ?? 'h-full min-h-[360px] w-full'} scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {line && line.length > 1 && (
        <>
          <Polyline positions={line} pathOptions={{ color: '#0b5d4b', weight: 5, opacity: 0.85 }} />
          <Fit points={line} />
        </>
      )}
      {chargers.map((c) => {
        const idx = stopIds?.indexOf(c.id) ?? -1;
        return (
          <Marker
            key={c.id}
            position={[c.lat, c.lng]}
            icon={pin(c, c.id === selectedId, idx >= 0 ? idx + 1 : undefined)}
            eventHandlers={{ click: () => onSelect?.(c.id) }}
            zIndexOffset={idx >= 0 ? 1000 : 0}
          >
            <Tooltip direction="top" offset={[0, -14]}>{c.name}</Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

const pickIcon = L.divIcon({ className: '', html: '<div class="pin" style="background:#0b5d4b">+</div>', iconSize: [28, 28], iconAnchor: [14, 14] });

function Clicker({ onChange }: { onChange: (p: [number, number]) => void }) {
  useMapEvents({ click: (e) => onChange([e.latlng.lat, e.latlng.lng]) });
  return null;
}

/** Moves the map to the selected point whenever it changes (e.g. after an address is typed). */
function FlyTo({ value }: { value: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.flyTo(value, Math.max(map.getZoom(), 16), { duration: 0.8 });
  }, [value, map]);
  return null;
}

export function LocationPicker({ value, onChange }: { value: [number, number] | null; onChange: (p: [number, number]) => void }) {
  return (
    <MapContainer center={value ?? [21.5, 72.9]} zoom={value ? 16 : 7} className="h-64 w-full lg:h-96" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Clicker onChange={onChange} />
      <FlyTo value={value} />
      {value && (
        <Marker position={value} icon={pickIcon} draggable
          eventHandlers={{ dragend: (e) => { const ll = (e.target as L.Marker).getLatLng(); onChange([ll.lat, ll.lng]); } }} />
      )}
    </MapContainer>
  );
}
