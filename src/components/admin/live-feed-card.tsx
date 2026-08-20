import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ExternalLink,
  Facebook,
  CalendarClock,
  ImageOff,
  Instagram,
  Linkedin,
  Music2,
  Play,
  Plug,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/error-state";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { getPublishedFeed, type FeedPlatform } from "@/lib/feed.functions";

/**
 * De feed van de klant die nu actief is, zoals hij er op het platform uitziet.
 *
 * Klik je op een ander kanaal, dan wisselt het profielkopje én het raster mee:
 * elk platform heeft zijn eigen vorm (Instagram vierkant, TikTok staand,
 * Facebook liggend), en dat is precies waar je naar kijkt als je beoordeelt of
 * een profiel klopt.
 *
 * Instagram en Facebook halen we rechtstreeks bij het platform op. Voor TikTok,
 * LinkedIn en YouTube vragen we de scopes voor terugleesbare feeds niet aan;
 * daar tonen we wat wij voor deze klant hebben gepubliceerd.
 */

interface PlatformStyle {
  label: string;
  Icon: LucideIcon;
  /** Verhouding van een tegel. */
  ratio: string;
  /** Kolommen in het raster. */
  cols: string;
  /** Merkkleur voor het actieve tabblad en de gloed achter het profiel. */
  tint: string;
  glow: string;
}

const STYLES: Record<FeedPlatform, PlatformStyle> = {
  instagram: {
    label: "Instagram",
    Icon: Instagram,
    ratio: "1 / 1",
    cols: "grid-cols-3",
    tint: "text-fuchsia-500 dark:text-rose-300",
    glow: "from-fuchsia-500/12 via-orange-300/8",
  },
  facebook: {
    label: "Facebook",
    Icon: Facebook,
    ratio: "1.91 / 1",
    cols: "grid-cols-2",
    tint: "text-indigo-500 dark:text-indigo-300",
    glow: "from-indigo-500/12 via-sky-300/8",
  },
  tiktok: {
    label: "TikTok",
    Icon: Music2,
    ratio: "9 / 16",
    cols: "grid-cols-3",
    tint: "text-cyan-600 dark:text-cyan-300",
    glow: "from-cyan-400/14 via-rose-300/8",
  },
  linkedin: {
    label: "LinkedIn",
    Icon: Linkedin,
    ratio: "1.91 / 1",
    cols: "grid-cols-2",
    tint: "text-sky-600 dark:text-sky-300",
    glow: "from-sky-500/12 via-blue-300/8",
  },
  youtube: {
    label: "YouTube",
    Icon: Youtube,
    ratio: "16 / 9",
    cols: "grid-cols-2",
    tint: "text-red-500 dark:text-red-300",
    glow: "from-red-500/12 via-orange-300/8",
  },
};

const ORDER: FeedPlatform[] = ["instagram", "tiktok", "facebook", "linkedin", "youtube"];

function compactNumber(n: number): string {
  return n >= 10_000 ? `${(n / 1000).toFixed(n >= 100_000 ? 0 : 1)}K` : n.toLocaleString("nl-NL");
}

export function LiveFeedCard() {
  const activeClient = useClientStore((s) => s.activeClient);
  const clientId = activeClient?.id ?? null;
  const [platform, setPlatform] = useState<FeedPlatform>("instagram");
  const feedFn = useServerFn(getPublishedFeed);

  // Gekoppelde kanalen, inclusief handle en volgers voor het profielkopje.
  const { data: channels } = useQuery({
    queryKey: ["live-feed-channels", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("social_connections")
        .select("platform, account_username, follower_count")
        .eq("client_id", clientId!)
        .eq("status", "active");
      return data ?? [];
    },
  });

  const available = ORDER.filter((p) => (channels ?? []).some((c) => c.platform === p));
  const active = available.includes(platform) ? platform : (available[0] ?? "instagram");
  const style = STYLES[active];
  const connection = (channels ?? []).find((c) => c.platform === active);

  const {
    data: feed,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["live-feed", clientId, active],
    enabled: !!clientId && available.length > 0,
    staleTime: 5 * 60_000,
    meta: { silent: true },
    queryFn: () => feedFn({ data: { clientId: clientId!, platform: active, limit: 12 } }),
  });

  if (!clientId) {
    return (
      <div className="rounded-2xl border border-gold/15 bg-card p-5">
        <h2 className="font-display text-xl">Feed</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Kies links een klant om hun feed te zien.
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-gold/15 bg-card">
      {/* Gloed in de kleur van het gekozen platform — het kanaal wisselt zo ook
          visueel, niet alleen in de inhoud. */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent transition-[background] duration-500",
          style.glow,
        )}
      />

      <div className="relative p-5">
        {/* Profielkopje */}
        <div className="flex items-center gap-4">
          <Avatar
            name={activeClient?.name ?? "?"}
            logoUrl={activeClient?.logo_url ?? null}
            color={activeClient?.color ?? null}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <style.Icon className={cn("h-4 w-4 shrink-0", style.tint)} />
              <p className="truncate font-display text-xl">
                {connection?.account_username ?? activeClient?.name}
              </p>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              {typeof connection?.follower_count === "number" && (
                <span>
                  <b className="text-foreground tabular-nums">
                    {compactNumber(connection.follower_count)}
                  </b>{" "}
                  volgers
                </span>
              )}
              <span>
                <b className="text-foreground tabular-nums">{feed?.publishedCount ?? 0}</b>{" "}
                gepubliceerd
              </span>
              {!!feed?.plannedCount && (
                <span className="text-gold">
                  <b className="tabular-nums">{feed.plannedCount}</b> gepland
                </span>
              )}
              {feed?.source === "eigen" && (
                <span className="text-muted-foreground/70" title={feed.note ?? undefined}>
                  via Elevate gepubliceerd
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Kanaalwissel */}
        {available.length > 1 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {available.map((p) => {
              const s = STYLES[p];
              const on = active === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition",
                    on
                      ? "border-gold/40 bg-gold/10 text-foreground"
                      : "border-border/60 text-muted-foreground hover:border-gold/25 hover:text-foreground",
                  )}
                  aria-pressed={on}
                >
                  <s.Icon className={cn("h-3.5 w-3.5", on ? s.tint : "")} />
                  {s.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Raster */}
        <div className="mt-4">
          {available.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/20 p-8 text-center">
              <Plug className="mx-auto h-5 w-5 text-amber-500" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nog geen kanaal gekoppeld voor {activeClient?.name}.
              </p>
              <Link
                to="/admin/channels"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs text-gold hover:bg-gold/5"
              >
                Kanaal koppelen <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : isLoading ? (
            <div className={cn("grid gap-1", style.cols)}>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton
                  key={i}
                  className="w-full rounded-none"
                  style={{ aspectRatio: style.ratio }}
                />
              ))}
            </div>
          ) : error ? (
            // Eerder toonde dit "nog niets gepubliceerd" bij een mislukte
            // aanroep — dat leest als een lege feed terwijl er iets stuk is.
            <ErrorState
              title="Feed kon niet laden"
              description="De verbinding met het platform gaf geen antwoord."
              onRetry={() => void refetch()}
              className="py-6"
            />
          ) : !feed || feed.items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gold/20 p-8 text-center">
              <ImageOff className="mx-auto h-5 w-5 text-muted-foreground/60" />
              <p className="mt-2 text-sm text-muted-foreground">
                Nog niets gepubliceerd of ingepland op {style.label}.
              </p>
              <Link
                to="/admin/compose"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs text-gold hover:bg-gold/5"
              >
                Eerste post maken <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className={cn("grid gap-1 overflow-hidden rounded-xl", style.cols)}>
              {feed.items.map((p) => (
                <Tile key={p.id} post={p} shape={style} />
              ))}
            </div>
          )}

          {feed?.note && (
            <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">{feed.note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  name,
  logoUrl,
  color,
}: {
  name: string;
  logoUrl: string | null;
  color: string | null;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={name}
        className="h-14 w-14 shrink-0 rounded-full border border-gold/25 object-cover"
      />
    );
  }
  return (
    <div
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-gold/25 font-display text-2xl text-primary-foreground"
      style={{ background: color || "var(--gradient-gold)" }}
    >
      {name[0]?.toUpperCase()}
    </div>
  );
}

/** Datum kort, zoals je hem in een planning wilt lezen. */
function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function Tile({
  post,
  shape,
}: {
  post: {
    id: string;
    caption: string | null;
    mediaUrl: string | null;
    permalink: string | null;
    isVideo: boolean;
    publishedAt: string;
    kind: "gepubliceerd" | "gepland";
  };
  shape: PlatformStyle;
}) {
  const planned = post.kind === "gepland";
  const Wrapper = post.permalink ? "a" : "div";
  return (
    <Wrapper
      {...(post.permalink ? { href: post.permalink, target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "group relative block overflow-hidden bg-surface-elevated/60",
        planned && "ring-1 ring-inset ring-gold/45",
      )}
      style={{ aspectRatio: shape.ratio }}
      title={post.caption ?? undefined}
    >
      {post.mediaUrl ? (
        <img
          src={post.mediaUrl}
          alt=""
          loading="lazy"
          className={cn(
            "h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]",
            // Ingetogener dan het echte werk, maar bij hover zie je hem vol —
            // anders kun je niet beoordelen of het beeld in het raster past.
            planned &&
              "opacity-80 saturate-[0.85] group-hover:opacity-100 group-hover:saturate-100",
          )}
        />
      ) : (
        <span className="grid h-full w-full place-items-center text-muted-foreground/40">
          <shape.Icon className="h-5 w-5" />
        </span>
      )}

      {planned && (
        <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
          <CalendarClock className="h-2.5 w-2.5" />
          {shortDate(post.publishedAt)}
        </span>
      )}

      {post.isVideo && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm">
          <Play className="h-3 w-3 translate-x-px fill-current" />
        </span>
      )}

      {/* Bijschrift verschijnt bij hover — anders leidt tekst af van het beeld,
          en juist het beeld beoordeel je hier. */}
      <span className="pointer-events-none absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/80 via-black/20 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
        {post.caption && (
          <span className="line-clamp-3 text-[11px] leading-snug text-white/90">
            {post.caption}
          </span>
        )}
        {post.permalink && (
          <span className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-white/70">
            Openen <ExternalLink className="h-2.5 w-2.5" />
          </span>
        )}
      </span>
    </Wrapper>
  );
}
