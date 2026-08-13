import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  ExternalLink,
  Facebook,
  Instagram,
  Music2,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { getPublishedFeed } from "@/lib/feed.functions";

type FeedPlatform = "instagram" | "facebook";

const META: Record<FeedPlatform, { label: string; Icon: LucideIcon; ratio: string }> = {
  instagram: { label: "Instagram", Icon: Instagram, ratio: "1 / 1" },
  facebook: { label: "Facebook", Icon: Facebook, ratio: "1.91 / 1" },
};

/**
 * De échte feed van het account dat nu actief is in de sidebar — zodat je op
 * het dashboard direct ziet hoe het profiel van die klant er nú uitziet.
 *
 * TikTok staat er bewust niet bij: het uitlezen van een TikTok-feed vereist de
 * video.list-scope, die we niet aanvragen.
 */
export function LiveFeedCard() {
  const activeClient = useClientStore((s) => s.activeClient);
  const clientId = activeClient?.id ?? null;
  const [platform, setPlatform] = useState<FeedPlatform>("instagram");
  const feedFn = useServerFn(getPublishedFeed);

  // Welke kanalen heeft deze klant daadwerkelijk gekoppeld?
  const { data: channels } = useQuery({
    queryKey: ["live-feed-channels", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("social_connections")
        .select("platform")
        .eq("client_id", clientId!)
        .eq("status", "active");
      return (data ?? []).map((c) => c.platform as string);
    },
  });

  const available = (["instagram", "facebook"] as FeedPlatform[]).filter((p) =>
    (channels ?? []).includes(p),
  );
  const active = available.includes(platform) ? platform : (available[0] ?? "instagram");

  const { data: posts, isLoading } = useQuery({
    queryKey: ["live-feed", clientId, active],
    enabled: !!clientId && available.length > 0,
    staleTime: 5 * 60_000,
    meta: { silent: true },
    queryFn: () => feedFn({ data: { clientId: clientId!, platform: active, limit: 9 } }),
  });

  if (!clientId) {
    return (
      <div className="rounded-2xl border border-gold/15 bg-card p-5">
        <h2 className="font-display text-xl">Live feed</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Kies links een klant om hun feed te zien.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gold/15 bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl">
          Live feed
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {activeClient?.name}
          </span>
        </h2>
        {available.length > 1 && (
          <div className="inline-flex rounded-full glass p-1 text-xs">
            {available.map((p) => {
              const Icon = META[p].Icon;
              return (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 transition sm:min-h-0 sm:py-1",
                    active === p ? "bg-gold/15 text-gold" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {META[p].label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {available.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gold/20 p-8 text-center">
          <Plug className="mx-auto h-5 w-5 text-amber-500" />
          <p className="mt-2 text-sm text-muted-foreground">
            Nog geen Instagram of Facebook gekoppeld voor {activeClient?.name}.
          </p>
          <Link
            to="/admin/channels"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gold/30 px-4 py-1.5 text-xs text-gold hover:bg-gold/5"
          >
            Kanaal koppelen <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-none" />
          ))}
        </div>
      ) : !posts || posts.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nog geen gepubliceerde posts op dit account.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
          {posts.map((p) => (
            <a
              key={p.id}
              href={p.permalink ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="group relative bg-surface-elevated/60"
              style={{ aspectRatio: META[active].ratio }}
              title={p.caption ?? "Openen op het platform"}
            >
              {p.mediaUrl ? (
                <img
                  src={p.mediaUrl}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="grid h-full w-full place-items-center text-muted-foreground/40">
                  <Instagram className="h-5 w-5" />
                </span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                <ExternalLink className="h-4 w-4 text-white" />
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
