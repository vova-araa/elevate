import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { listClientChannels } from "@/lib/channels.functions";
import { supabase } from "@/integrations/supabase/client";
import { useActiveClient } from "@/hooks/use-active-client";
import { PLATFORMS as PLATFORM_CONFIG, type Platform } from "@/config/platforms";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/client/channels")({
  component: ChannelsPage,
});

// tint = alleen de kaart-gradient (from-…/to-…). De platformkleur zit
// uitsluitend op de icoon-box (iconTint); labels erven text-foreground,
// zodat ze in light mode leesbaar blijven.
// Welke platforms er zijn en of ze aangeboden worden komt uit
// src/config/platforms.ts (A02) — hier alleen de kaartkleuren.
const CARD_TINT: Record<Platform, { tint: string; iconTint: string }> = {
  instagram: {
    tint: "from-fuchsia-500/15 to-rose-500/10",
    iconTint: "text-fuchsia-500 dark:text-rose-300",
  },
  tiktok: { tint: "from-cyan-500/15 to-pink-500/10", iconTint: "text-cyan-600 dark:text-cyan-300" },
  linkedin: { tint: "from-sky-500/15 to-blue-500/10", iconTint: "text-sky-600 dark:text-sky-300" },
  youtube: { tint: "from-red-500/15 to-orange-500/10", iconTint: "text-red-500 dark:text-red-300" },
  facebook: {
    tint: "from-indigo-500/15 to-blue-500/10",
    iconTint: "text-indigo-500 dark:text-indigo-300",
  },
};

const PLATFORMS = PLATFORM_CONFIG.map((p) => ({ ...p, ...CARD_TINT[p.id] }));
const VISIBLE_PLATFORMS = PLATFORMS.filter((p) => p.enabled);

function ChannelsPage() {
  const qc = useQueryClient();
  const { clientId, previewing } = useActiveClient();
  const list = useServerFn(listClientChannels);

  const { data, isLoading } = useQuery({
    queryKey: ["client-channels", clientId],
    // In admin-preview expliciet de bekeken klant meegeven; de server
    // controleert die toegang alsnog via user_has_client_access.
    queryFn: () => list({ data: previewing ? { clientId } : {} }),
  });

  // Realtime: refetch wanneer er iets verandert in social_connections van deze klant
  useEffect(() => {
    if (!data?.clientId) return;
    const ch = supabase
      .channel(`channels-${data.clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_connections",
          filter: `client_id=eq.${data.clientId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["client-channels"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [data?.clientId, qc]);

  const channelsByPlatform = new Map((data?.channels ?? []).map((c) => [c.platform, c]));

  return (
    <div className="space-y-5 max-w-5xl">
      <header className="aurora">
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Koppelingen</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Kanalen</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Overzicht van je gekoppelde social-accounts. Je Elevate-team koppelt en beheert deze voor
          je.
        </p>
      </header>

      {isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VISIBLE_PLATFORMS.map(({ id }) => (
            <Skeleton key={id} className="h-[132px] w-full rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {VISIBLE_PLATFORMS.map(({ id, label, Icon, tint, iconTint }) => {
            const ch = channelsByPlatform.get(id);
            const connectedActive = !!ch && ch.status === "active";
            const expired = !!ch && ch.status === "expired";
            return (
              <div
                key={id}
                className={cn(
                  "card-lift relative card-surface-lg bg-card p-4 overflow-hidden",
                  "bg-gradient-to-br",
                  tint,
                )}
              >
                {connectedActive && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                    <CheckCircle2 className="h-3 w-3" /> Gekoppeld
                  </span>
                )}
                {expired && (
                  <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                    <AlertTriangle className="h-3 w-3" /> Aandacht nodig
                  </span>
                )}
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-background/40 grid place-items-center">
                    <Icon className={cn("h-5 w-5", iconTint)} />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium">{label}</div>
                    {ch ? (
                      <div className="text-xs text-muted-foreground truncate">
                        {ch.account_username ?? "—"}
                        {typeof ch.follower_count === "number" && (
                          <> · {ch.follower_count.toLocaleString("nl-NL")} volgers</>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">Niet gekoppeld</div>
                    )}
                  </div>
                </div>

                {/* Geruststelling in plaats van stilte: de klant hoeft niets te
                    doen zolang de koppeling zichzelf vernieuwt. */}
                {connectedActive && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    Blijft actief — je hoeft hier niets voor te doen
                  </div>
                )}

                {expired && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Neem contact op met je Elevate-team om opnieuw te koppelen.
                  </div>
                )}

                {!ch && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Nog niet gekoppeld — vraag je Elevate-team om dit kanaal aan te sluiten.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 shrink-0 translate-y-0.5" />
        Kanalen koppelen doe je niet zelf meer op dit scherm — je Elevate-team beheert dit centraal.
      </p>
    </div>
  );
}
