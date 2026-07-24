import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { nl } from "date-fns/locale";
import {
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Music2,
  CheckCircle2,
  Loader2,
  Link2,
  X,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listClientChannels,
  startSocialConnect,
  disconnectChannel,
  getSocialSetupStatus,
} from "@/lib/channels.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  connected: z.string().optional(),
  handle: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/client/channels")({
  validateSearch: searchSchema,
  component: ChannelsPage,
});

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

/**
 * Waarschuwing als een token (bijna) verlopen is. Alleen tonen wanneer er een
 * token_expires_at bekend is die binnen 14 dagen valt of al verstreken is;
 * platforms zonder verlooptijd leveren null op en tonen dus niets.
 */
function tokenExpiryWarning(
  tokenExpiresAt: string | null | undefined,
): { expired: boolean; message: string } | null {
  if (!tokenExpiresAt) return null;
  const expires = new Date(tokenExpiresAt);
  if (Number.isNaN(expires.getTime())) return null;
  const days = differenceInCalendarDays(expires, new Date());
  if (days < 0) return { expired: true, message: "Koppeling verlopen — opnieuw koppelen" };
  if (days <= 14) {
    const rel = formatDistanceToNow(expires, { locale: nl, addSuffix: true });
    return { expired: false, message: `Koppeling verloopt ${rel} — opnieuw koppelen` };
  }
  return null;
}

// tint = alleen de kaart-gradient (from-…/to-…). De platformkleur zit
// uitsluitend op de icoon-box (iconTint); labels erven text-foreground,
// zodat ze in light mode leesbaar blijven (zie ook connect.$token.tsx).
const PLATFORMS: {
  id: Platform;
  label: string;
  Icon: LucideIcon;
  tint: string;
  iconTint: string;
}[] = [
  {
    id: "instagram",
    label: "Instagram",
    Icon: Instagram,
    tint: "from-fuchsia-500/15 to-rose-500/10",
    iconTint: "text-fuchsia-500 dark:text-rose-300",
  },
  {
    id: "tiktok",
    label: "TikTok",
    Icon: Music2,
    tint: "from-cyan-500/15 to-pink-500/10",
    iconTint: "text-cyan-600 dark:text-cyan-300",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    Icon: Linkedin,
    tint: "from-sky-500/15 to-blue-500/10",
    iconTint: "text-sky-600 dark:text-sky-300",
  },
  {
    id: "youtube",
    label: "YouTube",
    Icon: Youtube,
    tint: "from-red-500/15 to-orange-500/10",
    iconTint: "text-red-500 dark:text-red-300",
  },
  {
    id: "facebook",
    label: "Facebook",
    Icon: Facebook,
    tint: "from-indigo-500/15 to-blue-500/10",
    iconTint: "text-indigo-500 dark:text-indigo-300",
  },
];

function ChannelsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { connected, handle, error } = Route.useSearch();
  const list = useServerFn(listClientChannels);
  const connect = useServerFn(startSocialConnect);
  const disc = useServerFn(disconnectChannel);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-channels"],
    queryFn: () => list({ data: {} }),
  });

  // Setup-status: welke platforms zijn in de omgeving geconfigureerd. Zo tonen
  // we niet-beschikbare platforms als "Nog niet beschikbaar" i.p.v. een
  // Koppelen-knop die op een env-fout uitloopt.
  const setupFn = useServerFn(getSocialSetupStatus);
  const { data: setup } = useQuery({
    queryKey: ["social-setup-status"],
    queryFn: () => setupFn(),
    staleTime: 60_000,
  });

  // Toon eenmalig een toast voor de OAuth-callback-redirect, wis daarna de querystring.
  useEffect(() => {
    if (!connected && !error) return;
    if (error) toast.error(error);
    else if (connected) toast.success(`${handle ?? "Account"} gekoppeld via ${connected}`);
    navigate({ to: "/client/channels", search: {}, replace: true });
  }, [connected, handle, error, navigate]);

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

  const [confirm, setConfirm] = useState<Platform | null>(null);

  const connectMut = useMutation({
    mutationFn: async (platform: Platform) => {
      const res = await connect({
        data: { platform, returnTo: "client", origin: window.location.origin },
      });
      return res;
    },
    onSuccess: (res) => {
      window.location.href = res.redirectUrl;
    },
    onError: (e: Error) => toast.error(e.message ?? "Verbinden mislukt"),
  });

  const disconnectMut = useMutation({
    mutationFn: (platform: Platform) => disc({ data: { platform } }),
    onSuccess: () => {
      toast.success("Ontkoppeld");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message ?? "Mislukt"),
  });

  const channelsByPlatform = new Map((data?.channels ?? []).map((c) => [c.platform, c]));

  return (
    <div className="space-y-5 max-w-5xl">
      <header>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Koppelingen</p>
        <h1 className="font-display text-4xl sm:text-5xl mt-2">Kanalen</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Koppel je social-accounts. Dit duurt ongeveer 30 seconden per platform.
        </p>
      </header>

      {data && !data.clientId && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 text-amber-200 p-4 text-sm">
          Geen client gekoppeld aan jouw account. Vraag een admin om je toe te voegen.
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Laden…</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLATFORMS.map(({ id, label, Icon, tint, iconTint }) => {
          const ch = channelsByPlatform.get(id);
          const connectedActive = !!ch && ch.status === "active";
          const expired = !!ch && ch.status === "expired";
          const warn = tokenExpiryWarning(ch?.token_expires_at);
          // Alleen tonen als "Koppelen" wanneer het platform in de omgeving is
          // ingesteld. Zonder setup-status (nog aan het laden) niet blokkeren.
          const available = !setup || !!setup.platforms[id]?.configured;
          return (
            <div
              key={id}
              className={cn(
                "relative rounded-2xl border border-gold/15 bg-card p-4 overflow-hidden",
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
                  <AlertTriangle className="h-3 w-3" /> Verlopen — koppel opnieuw
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

              {warn && !expired && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {warn.message}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                {connectedActive ? (
                  <button
                    onClick={() => {
                      if (window.confirm("Weet je het zeker? Posts vanuit dit kanaal stoppen.")) {
                        disconnectMut.mutate(id);
                      }
                    }}
                    disabled={disconnectMut.isPending}
                    className="text-xs min-h-11 px-3 rounded-lg border border-border bg-background/30 hover:bg-background/50 text-muted-foreground inline-flex items-center gap-1.5"
                  >
                    {disconnectMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Ontkoppelen"
                    )}
                  </button>
                ) : available ? (
                  <button
                    onClick={() => setConfirm(id)}
                    disabled={connectMut.isPending}
                    className="text-xs min-h-11 px-3 rounded-lg bg-gold/20 text-gold font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Koppelen
                  </button>
                ) : (
                  <span className="text-xs min-h-11 px-3 rounded-lg border border-border/60 bg-background/20 text-muted-foreground inline-flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" /> Nog niet beschikbaar
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm sheet/modal */}
      {confirm &&
        (() => {
          const meta = PLATFORMS.find((p) => p.id === confirm)!;
          const Icon = meta.Icon;
          return (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setConfirm(null)}
            >
              <div
                className="w-full sm:max-w-md bg-card border border-gold/20 rounded-t-3xl sm:rounded-2xl p-6 space-y-4 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl bg-gold/15 grid place-items-center text-gold">
                    <Icon className="h-6 w-6" />
                  </div>
                  <button
                    onClick={() => setConfirm(null)}
                    className="h-8 w-8 rounded-full grid place-items-center text-muted-foreground hover:bg-accent/30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <div className="font-display text-xl">{meta.label} koppelen</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Je wordt doorgestuurd naar {meta.label} om toegang te geven. Dit duurt maar 30
                    seconden.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setConfirm(null)}
                    className="flex-1 h-10 rounded-xl border border-border text-sm"
                  >
                    Annuleren
                  </button>
                  <button
                    onClick={() => connectMut.mutate(confirm)}
                    disabled={connectMut.isPending}
                    className="flex-1 h-10 rounded-xl bg-gold text-primary-foreground text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {connectMut.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Verbinding voorbereiden…
                      </>
                    ) : (
                      "Koppelen"
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
