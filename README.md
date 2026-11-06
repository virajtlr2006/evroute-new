# EVRoute

A website that solves the information and coordination problems of long EV journeys (cars and e-bikes/scooters).

## Features
- Charger discovery across networks, with filters (vehicle, speed, connector, status, price) and a map
- Live status via driver reports (working / busy / out of order); reports expire after 24 h
- Reviews and amenities (food, restroom, wifi, shelter)
- Trip planner using real range (speed, AC, load, temperature) and charger reliability
- EV vs petrol cost calculator
- Slot booking with no double booking: booked time slots are visible to everyone and update live; overlapping requests are rejected by the server
- Private chargers need owner approval (the slot is held meanwhile); public chargers confirm instantly
- Click a charger (map pin or list card) to open its own page: owner, status, Book now, reviews, map
- Busy chargers: shows how long the current session has left and asks "Do you want to wait?", then asks you to confirm before reserving the next free slot (queued fairly behind earlier bookings)
- Notifications: a bell with an unread count, a Notifications page, and live pop-ups (new ones appear within about 6 seconds, plus optional desktop alerts when the tab is in the background). Covers booking requests, confirmations, declines, cancellations (by driver or owner), a reminder 15 minutes before a slot, a charger you booked being reported out of order, new reviews on your charger, and a welcome message
- Instant on-screen confirmations for your own actions: login, sign-up, logout, session expired, booking, cancel, report, review, charger added, battery log
- Charging guide: video plus step-by-step instructions for CCS2, CHAdeMO, GB/T, Type 2, 15A socket and battery swap
- One-tap Cancel booking with instant confirmation; the slot is freed immediately
- Click-to-call: booked drivers get a Call button; the owner's phone number is never shown on any page
- Add a charger: type the address and the map jumps to it (drag the pin to fine-tune)
- Battery-swap stations for e-scooters
- Roadside help directory (EV mechanics, towing, service centres)
- Battery log with efficiency and fast-charge-share insights

## Tech stack
Frontend: Vite, React 18, TypeScript, Tailwind CSS v4, shadcn-style components, Zustand, TanStack Query, React Router, Leaflet (OpenStreetMap)
Backend: Node 20+, Fastify 5, TypeScript (tsx), SQLite (better-sqlite3), Zod, JWT auth, bcryptjs
External: OSRM demo server (routing) and Nominatim (place search). Both need internet.

## Run it
Requires Node.js 20 or newer.

    npm install
    npm run dev

Open http://localhost:5173 (API runs on http://localhost:4000).
Demo login: demo@evroute.test / demo1234

## Other commands
    npm run typecheck     # type-check server and client
    npm run build         # production build of the client
    npm run reset-db      # delete the database; it re-seeds on next start

## Notes
- Notifications are stored per user in the `notifications` table and polled every 6 seconds (no websockets needed). Times in them are stored as UTC and shown in each reader's own time zone. A server timer checks every 30 seconds for the 15-minute booking reminders.
- Guide videos are third-party YouTube walkthroughs embedded from youtube-nocookie.com (internet needed); they are not stored in this project. Swap any video by editing `videoId` in `client/src/lib/guides.ts`. The GB/T guide uses a general DC fast-charging video.
- Busy time: when someone reports a charger busy they can say how long is left. If they do not, the app assumes about 30 minutes from the report, and labels it as an estimate. A confirmed booking in progress also counts as busy.
- Call button: the number is stored server-side and only released (as a tel: dial link) to a user with an active booking on that charger. The browser hands it to the phone's dialer. For a fully masked call (neither side sees the other's number) connect a telephony provider such as Twilio or Exotel in `GET /api/chargers/:id/call`.
- Seeded chargers carry DEMO placeholder phone numbers (+91 00000 000NN). Owners enter real ones in Add a charger.
- Existing databases are migrated automatically (a `contact_phone` column is added on start); no reset needed.
- Seeded chargers and services are DEMO data, not verified stations. Replace via the Add a charger page or by importing real data (e.g. Open Charge Map) into the chargers table.
- Vehicle specs are approximate: edit server/src/vehicles.ts.
- Set JWT_SECRET (see server/.env.example) before deploying anywhere public.
- The OSRM demo server and Nominatim are for light demo use only; self-host or use a paid provider in production.
