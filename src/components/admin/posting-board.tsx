import { Link } from "@tanstack/react-router";
import { format, isToday, isTomorrow } from "date-fns";
import { nl } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Facebook,
  FileText,
  Image as ImageIcon,
  Instagram,
  Music2,
  Plug,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { useSignedUrls } from "@/lib/use-signed-url";
import type { PostingOverview, UpcomingPost } from "@/lib/posting-overview.functions";

const PLATFORM_ICON: Record<string, LucideIcon> = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music2,
};

/** Groepeer de komende posts per dag, zodat je per dag ziet wat er live gaat. */
function groupByDay(
  posts: UpcomingPost[],
): Array<{ key: string; label: string; items: UpcomingPost[] }> {
  const map = new Map<string, UpcomingPost[]>();
  for (const p of posts) {
    const d = new Date(p.scheduledAt);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const d = new Date(items[0].scheduledAt);
    const label = isToday(d)
      ? "Vandaag"
      : isTomorrow(d)
        ? "Morgen"
        : format(d, "EEEE d MMMM", { locale: nl });
    return { key, label: label.charAt(0).toUpperCase() + label.slice(1), items };
  });
}

export function PostingBoard({
  data,
  loading,
  error,
  onRetry,
  days,
  setDays,
}: {
  data: PostingOverview | undefined;
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  days: number;
  setDays: (d: number) => void;
}) {
  // Alle previews van de komende posts in één gebundelde aanroep.
  const urls = useSignedUrls((data?.upcoming ?? []).map((p) => p.mediaPath));

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  // Zonder data is er niets te tonen — maar dan een foutstaat met een knop, niet
  // een skeleton die eeuwig blijft pulseren.
  if (error || !data) {
    return (
      <ErrorState
        title="Postbord kon niet laden"
        description="De planning van de komende dagen is niet opgehaald."
        onRetry={onRetry}
      />
    );
  }

  const groups = groupByDay(data.upcoming);

  return (
    <div className="space-y-6">
      {/* Kerncijfers, gericht op posten */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={CalendarClock}
          value={data.totals.upcoming}
          label={`Gepland (${days} dagen)`}
          to="/admin/planner"
          tone="bg-gold/12 text-gold"
        />
        <Stat
          icon={FileText}
          value={data.totals.waiting}
          label="Wacht op akkoord"
          to="/admin/approvals"
          tone="bg-amber-500/12 text-amber-500"
        />
        <Stat
          icon={CheckCircle2}
          value={data.totals.publishedThisWeek}
          label="Live deze week"
          to="/admin/reach"
          tone="bg-emerald-500/12 text-emerald-500"
        />
        <Stat
          icon={AlertTriangle}
          value={data.totals.failed + data.totals.expiredChannels}
          label="Vraagt aandacht"
          to="/admin/channels"
          tone={
            data.totals.failed + data.totals.expiredChannels > 0
              ? "bg-red-500/12 text-red-400"
              : "bg-muted/40 text-muted-foreground"
          }
        />
      </div>

      {/* Klanten zonder planning — het belangrijkste signaal voor een bureau */}
      {data.gaps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-500/5 p-3 text-sm">
          <Sparkles className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-amber-600 dark:text-amber-300">
            Niets gepland de komende {days} dagen voor:{" "}
            <strong>{data.gaps.slice(0, 4).join(", ")}</strong>
            {data.gaps.length > 4 && ` +${data.gaps.length - 4}`}
          </span>
          <Link
            to="/admin/planner"
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/40 px-3 py-1 text-xs text-amber-600 hover:bg-amber-500/10 dark:text-amber-300"
          >
            Inplannen <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* Wat gaat er live — per dag */}
        <div className="rounded-2xl border border-gold/15 bg-card p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 font-display text-xl">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gold/12 text-gold">
                <CalendarClock className="h-4 w-4" />
              </span>
              Wat gaat er live
            </h2>
            <div className="inline-flex rounded-full glass p-1 text-xs">
              {[3, 7, 14].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  aria-pressed={days === d}
                  // Ruim tikdoel op mobiel (min. 44px), compacter op desktop.
                  className={cn(
                    "min-h-11 rounded-full px-4 transition sm:min-h-0 sm:px-2.5 sm:py-1",
                    days === d
                      ? "bg-gold/15 text-gold"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Niets gepland in de komende {days} dagen.
              </p>
              <Link
                to="/admin/planner"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs text-gold hover:bg-gold/5"
              >
                Post inplannen <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((g) => (
                <div key={g.key}>
                  <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {g.label} · {g.items.length}
                  </div>
                  <div className="space-y-1.5">
                    {g.items.map((p) => (
                      <UpcomingRow key={p.id} post={p} url={urls.get(p.mediaPath ?? "") ?? ""} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Per klant: staat de motor aan? */}
        <div className="rounded-2xl border border-gold/15 bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl">Per klant</h2>
            <Link
              to="/admin/clients"
              className="inline-flex items-center gap-1 text-xs text-gold hover:underline"
            >
              Beheren <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.clients.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nog geen klanten.</p>
          ) : (
            <ul className="space-y-1">
              {data.clients.map((c) => (
                <li key={c.clientId}>
                  <Link
                    to="/admin/planner"
                    search={{ clientId: c.clientId }}
                    className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-accent/40"
                  >
                    {c.logoUrl ? (
                      <img
                        src={c.logoUrl}
                        alt=""
                        loading="lazy"
                        className="h-8 w-8 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <span
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[11px] font-semibold text-white"
                        style={{ background: c.brandColor || "var(--gold)" }}
                      >
                        {c.clientName.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.clientName}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {c.channels.length === 0 ? (
                          <span className="inline-flex items-center gap-1 text-amber-500">
                            <Plug className="h-3 w-3" /> geen kanaal gekoppeld
                          </span>
                        ) : c.upcoming === 0 ? (
                          <span className="text-amber-500">niets gepland</span>
                        ) : (
                          <>
                            {c.upcoming} gepland
                            {c.daysUntilNext === 0
                              ? " · vandaag"
                              : c.daysUntilNext != null && ` · over ${c.daysUntilNext}d`}
                          </>
                        )}
                        {c.waiting > 0 && ` · ${c.waiting} wacht op akkoord`}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {c.channels.map((ch) => {
                        const Icon = PLATFORM_ICON[ch];
                        return Icon ? (
                          <Icon key={ch} className="h-3.5 w-3.5 text-muted-foreground/60" />
                        ) : null;
                      })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function UpcomingRow({ post, url }: { post: UpcomingPost; url: string }) {
  const Icon = PLATFORM_ICON[post.platform] ?? Instagram;
  const isVideo = post.mediaType?.startsWith("video");
  return (
    <Link
      to="/admin/planner"
      search={{ clientId: post.clientId }}
      className="flex items-center gap-3 rounded-lg border border-transparent p-2 transition hover:border-gold/20 hover:bg-accent/30"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-elevated/60">
        {url ? (
          isVideo ? (
            <video src={url} className="h-full w-full object-cover" muted playsInline />
          ) : (
            <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )
        ) : (
          <ImageIcon className="h-4 w-4 text-muted-foreground/50" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs">
          <span className="font-medium tabular-nums text-gold">
            {format(new Date(post.scheduledAt), "HH:mm")}
          </span>
          <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium">{post.clientName ?? "Onbekende klant"}</span>
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {post.caption || <span className="italic">geen caption</span>}
        </span>
      </span>
    </Link>
  );
}

function Stat({
  icon: Icon,
  value,
  label,
  to,
  tone,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  to: string;
  tone: string;
}) {
  return (
    <Link to={to} className="card-lift group rounded-xl border border-gold/15 bg-card p-4">
      <span className={cn("grid h-9 w-9 place-items-center rounded-lg", tone)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="mt-3 font-display text-3xl leading-none tabular-nums">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
    </Link>
  );
}
