import { useSearchParams, Link } from 'react-router-dom';
import { GUIDES, BEFORE_YOU_GO } from '@/lib/guides';
import { Card, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function GuidePage() {
  const [params, setParams] = useSearchParams();
  const g = GUIDES.find((x) => x.key === params.get('type')) ?? GUIDES[0];
  const query = new URLSearchParams();
  if (g.chargerFilter.type) query.set('type', g.chargerFilter.type);
  if (g.chargerFilter.connector) query.set('connector', g.chargerFilter.connector);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">How to charge: step-by-step guides</h1>
        <p className="text-ink/70">Pick the charger type you will use. Each guide has a video and the steps in order.</p>
      </div>

      <div role="tablist" aria-label="Charger types" className="flex flex-wrap gap-2">
        {GUIDES.map((x) => (
          <button key={x.key} role="tab" aria-selected={x.key === g.key} onClick={() => setParams({ type: x.key })}
            className={cn('cursor-pointer rounded-full border px-4 py-1.5 text-sm font-semibold',
              x.key === g.key ? 'border-road bg-road text-white' : 'border-line bg-white hover:bg-paper')}>
            {x.short}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <h2 className="text-2xl font-bold">{g.name}</h2>
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-paper p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Used for</dt><dd>{g.usedFor}</dd></div>
              <div className="rounded-lg bg-paper p-3"><dt className="text-xs font-semibold uppercase tracking-wide text-ink/60">Speed</dt><dd>{g.speed}</dd></div>
            </dl>
            <div className="aspect-video overflow-hidden rounded-xl border border-line bg-black">
              <iframe key={g.videoId} className="h-full w-full" loading="lazy"
                src={`https://www.youtube-nocookie.com/embed/${g.videoId}`} title={g.videoTitle}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <p className="text-sm">
              <span className="font-semibold">{g.videoTitle}.</span>{' '}
              <a className="underline" href={`https://www.youtube.com/watch?v=${g.videoId}`} target="_blank" rel="noreferrer">Watch on YouTube</a> if the video does not play here.
            </p>
            {g.videoNote && <p className="text-xs text-ink/60">{g.videoNote}</p>}
          </Card>

          <Card>
            <CardTitle>Before you go</CardTitle>
            <ol className="mt-2 space-y-2 text-sm">
              {BEFORE_YOU_GO.map((s, i) => (
                <li key={s.title} className="flex gap-3"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-signal text-xs font-bold">{i + 1}</span>
                  <span><span className="font-semibold">{s.title}.</span> {s.detail}</span></li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardTitle>Step by step: {g.short}</CardTitle>
            <ol className="mt-3 space-y-3">
              {g.steps.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-road text-sm font-bold text-white">{i + 1}</span>
                  <div><p className="font-semibold">{s.title}</p><p className="text-sm text-ink/80">{s.detail}</p></div>
                </li>
              ))}
            </ol>
          </Card>
          <Card className="bg-signal/15">
            <CardTitle>Tips and safety</CardTitle>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{g.tips.map((t) => <li key={t}>{t}</li>)}</ul>
          </Card>
          <Link to={`/?${query.toString()}`} className="inline-flex h-10 items-center rounded-lg bg-road px-4 text-sm font-semibold text-white hover:bg-road-dark">
            Find {g.short} chargers
          </Link>
        </div>
      </div>
    </div>
  );
}
