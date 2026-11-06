import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { startCall } from '@/lib/bookings';
import { useToast } from '@/store/toast';

/** Direct call button. The contact number is intentionally never shown. */
export function CallButton({ chargerId, label = 'Call owner', size = 'md', variant = 'accent' }: {
  chargerId: number; label?: string; size?: 'sm' | 'md' | 'lg'; variant?: 'default' | 'accent' | 'outline';
}) {
  const [busy, setBusy] = useState(false);
  const push = useToast((s) => s.push);
  return (
    <Button size={size} variant={variant} disabled={busy} onClick={async () => {
      setBusy(true);
      try { await startCall(chargerId); } catch (e) { push('error', (e as Error).message); } finally { setBusy(false); }
    }}>
      <span aria-hidden>&#9742;</span> {busy ? 'Connecting...' : label}
    </Button>
  );
}
