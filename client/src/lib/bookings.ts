import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useToast } from '@/store/toast';
import type { Booking, Slot } from '@/lib/types';

type MyBookings = { made: Booking[]; incoming: Booking[] };

/** Booked slots for one charger, public, refreshed every 5 s so every user sees new bookings and cancellations. */
export function useSlots(chargerId: number) {
  const token = useAuth((s) => s.token);
  return useQuery({
    queryKey: ['slots', chargerId, !!token],
    queryFn: () => api<Slot[]>(`/chargers/${chargerId}/slots`),
    refetchInterval: 5000,
  });
}

/** The signed-in user's own bookings and requests for their chargers. */
export function useMyBookings() {
  const user = useAuth((s) => s.user);
  return useQuery({
    queryKey: ['bookings'], enabled: !!user, refetchInterval: 8000,
    queryFn: () => api<MyBookings>('/bookings/mine'),
  });
}

/** Cancel with instant feedback: the UI flips to "cancelled" and the slot frees up immediately; rolled back if the server refuses. */
export function useCancelBooking() {
  const qc = useQueryClient();
  const push = useToast((s) => s.push);
  return useMutation({
    mutationFn: ({ id }: { id: number; chargerId: number }) => api(`/bookings/${id}`, { method: 'PATCH', body: { status: 'cancelled' } }),
    onMutate: async ({ id, chargerId }) => {
      await qc.cancelQueries({ queryKey: ['bookings'] });
      await qc.cancelQueries({ queryKey: ['slots', chargerId] });
      const prevBookings = qc.getQueryData<MyBookings>(['bookings']);
      const prevSlots = qc.getQueriesData<Slot[]>({ queryKey: ['slots', chargerId] });
      const mark = (b: Booking) => (b.id === id ? { ...b, status: 'cancelled' } : b);
      if (prevBookings) qc.setQueryData<MyBookings>(['bookings'], { made: prevBookings.made.map(mark), incoming: prevBookings.incoming.map(mark) });
      qc.setQueriesData<Slot[]>({ queryKey: ['slots', chargerId] }, (old) => old?.filter((x) => x.id !== id));
      push('success', 'Booking cancelled.');
      return { prevBookings, prevSlots };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prevBookings) qc.setQueryData(['bookings'], ctx.prevBookings);
      ctx?.prevSlots.forEach(([key, data]) => qc.setQueryData(key, data));
      push('error', `Could not cancel: ${(e as Error).message}`);
    },
    onSettled: (_d, _e, v) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      qc.invalidateQueries({ queryKey: ['slots', v.chargerId] });
    },
  });
}

/** Ask the server for a one-time dial link and hand it to the phone/dialer. The number is never rendered on the page. */
export async function startCall(chargerId: number) {
  const { dial } = await api<{ dial: string }>(`/chargers/${chargerId}/call`);
  window.location.href = dial;
}

export const fmtSlot = (startIso: string, endIso: string) => {
  const s = new Date(startIso), e = new Date(endIso);
  const day = s.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
  const t = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${t(s)} - ${t(e)}`;
};
