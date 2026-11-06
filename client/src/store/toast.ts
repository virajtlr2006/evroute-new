import { create } from 'zustand';

export interface Toast { id: number; kind: 'success' | 'error' | 'info'; text: string; title?: string; href?: string }
interface ToastState {
  toasts: Toast[];
  push: (kind: Toast['kind'], text: string, opts?: { title?: string; href?: string; ms?: number }) => void;
  dismiss: (id: number) => void;
}

let next = 1;
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (kind, text, opts = {}) => {
    const id = next++;
    // keep at most 4 on screen so a burst of notifications cannot cover the page
    set({ toasts: [...get().toasts, { id, kind, text, title: opts.title, href: opts.href }].slice(-4) });
    setTimeout(() => get().dismiss(id), opts.ms ?? 5000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
