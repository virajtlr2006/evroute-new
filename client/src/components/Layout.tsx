import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/Toaster';
import { NotificationBell } from '@/components/NotificationBell';
import { NotificationListener } from '@/components/NotificationListener';
import { useToast } from '@/store/toast';
import { cn } from '@/lib/utils';

const links = [
  { to: '/', label: 'Chargers' },
  { to: '/trip', label: 'Trip planner' },
  { to: '/guide', label: 'Charging guide' },
  { to: '/cost', label: 'Cost' },
  { to: '/services', label: 'Roadside help' },
  { to: '/battery', label: 'Battery log' },
  { to: '/learn', label: 'Learn' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();

  return (
    <div className="flex min-h-full flex-col">
      <Toaster />
      {user && <NotificationListener />}

      <header className="bg-road text-white">
        {/* Row 1: logo on the left, account actions on the right */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="font-display text-2xl font-bold tracking-tight">
            EV<span className="text-signal">Route</span>
          </Link>

          <div className="flex items-center gap-1 text-sm sm:gap-2">
            <Button size="sm" variant="accent" className="whitespace-nowrap" onClick={() => nav('/add')}>
              Add a charger
            </Button>
            {user ? (
              <>
                <Link to="/bookings" className="rounded-md px-3 py-1.5 hover:bg-white/10">Bookings</Link>
                <NotificationBell />
                <span className="hidden whitespace-nowrap md:inline">{user.name}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/10"
                  onClick={() => {
                    logout();
                    qc.removeQueries({ queryKey: ['notifications'] });
                    qc.removeQueries({ queryKey: ['bookings'] });
                    nav('/');
                    useToast.getState().push('info', 'You have been logged out.');
                  }}
                >
                  Log out
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10"
                onClick={() => nav('/login')}
              >
                Log in
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: navigation links. They never wrap; on small screens this row scrolls sideways. */}
        <nav aria-label="Main" className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium hover:bg-white/10',
                    isActive && 'bg-white/15',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-line py-4 text-center text-xs text-ink/60">
        Map data &copy; OpenStreetMap contributors. Routing by OSRM demo server. Seeded chargers are demo data, not verified stations.
      </footer>
    </div>
  );
}