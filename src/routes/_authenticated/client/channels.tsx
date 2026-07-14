import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  listClientChannels,
  initPostizConnect,
  disconnectPostizChannel,
  syncPostizConnection,
} from "@/lib/postiz-connect.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/client/channels")({
  component: ChannelsPage,
});

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

const PLATFORMS: { id: Platform; label: string; Icon: LucideIcon; tint: string }[] = [
  {
    id: "instagram",
    label: "Instagram",
    Icon: Instagram,
    tint: "from-fuchsia-500/15 to-rose-500/10 text-rose-300",
  },
  {
    id: "tiktok",
    label: "TikTok",
    Icon: Music2,
    tint: "from-cyan-500/15 to-pink-500/10 text-cyan-300",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    Icon: Linkedin,
    tint: "from-sky-500/15 to-blue-500/10 text-sky-300",
  },
  {
    id: "youtube",
    label: "YouTube",
    Icon: Youtube,
    tint: "from-red-500/15 to-orange-500/10 text-red-300",
  },
  {
    id: "facebook",
    label: "Facebook",
    Icon: Facebook,
    tint: "from-indigo-500/15 to-blue-500/10 text-indigo-300",
  },
];

function ChannelsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const list = useServerFn(listClientChannels);
  const init = useServerFn(initPostizConnect);
  const disc = useServerFn(disconnectPostizChannel);
  const sync = useServerFn(syncPostizConnection);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-channels"],
    queryFn: () => list({ data: {} }),
  });

  // Realtime: refetch wanneer er iets verandert in social_connections of clients
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "clients", filter: `id=eq.${data.clientId}` },
        () => qc.invalidateQueries({ queryKey: ["client-channels"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [data?.clientId, qc]);

  const [confirm, setConfirm] = useState<Platform | null>(null);

  const syncAfterConnect = async (platform: Platform, notify = false) => {
    const result = await sync({ data: { platform } });
    await refetch();
    if (notify)
      toast[result?.connected ? "success" : "info"](
        result?.connected
          ? "Account gekoppeld"
          : (result?.reason ?? "Nog geen nieuwe koppeling gevonden"),
      );
  };

  const connectMut = useMutation({
    mutationFn: async (platform: Platform) => {
      const res = await init({ data: { platform } });
      if (res?.external) {
        const opened = window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
        if (!opened)
          throw new Error(
            "De browser blokkeerde het Postiz-tabblad. Sta pop-ups toe en probeer opnieuw.",
          );
      }
      return { ...res, platform };
    },
    onSuccess: (res) => {
      setConfirm(null);
      if (res?.external) {
        toast.info(
          "Rond de autorisatie af in het nieuwe tabblad. De status wordt automatisch ververst.",
        );
        [4000, 12000, 30000].forEach((ms) =>
          window.setTimeout(() => syncAfterConnect(res.platform), ms),
        );
      } else {
        navigate({ to: res.redirectUrl });
      }
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
        <h1 className="font-display text-2xl">Kanalen</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Koppel je social-accounts. Dit duurt ongeveer 30 seconden per platform.
        </p>
      </header>

      {data && !data.clientId && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 text-amber-200 p-4 text-sm">
          Geen client gekoppeld aan jouw account. Vraag een admin om je toe te voegen.
        </div>
      )}

      {data?.clientId && !data.provisioned && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 text-amber-200 p-4 text-sm">
          Account wordt voorbereid, probeer over een minuut opnieuw.
        </div>
      )}

      {isLoading && <div className="text-sm text-muted-foreground">Laden…</div>}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLATFORMS.map(({ id, label, Icon, tint }) => {
          const ch = channelsByPlatform.get(id);
          const connected = !!ch && ch.status === "active";
          return (
            <div
              key={id}
              className={cn(
                "relative rounded-2xl border border-gold/15 bg-card p-4 overflow-hidden",
                "bg-gradient-to-br",
                tint,
              )}
            >
              {connected && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3" /> Gekoppeld
                </span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-background/40 grid place-items-center">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium">{label}</div>
                  {connected ? (
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

              <div className="mt-4 flex items-center gap-2">
                {connected ? (
                  <button
                    onClick={() => {
                      if (window.confirm("Weet je het zeker? Posts vanuit dit kanaal stoppen.")) {
                        disconnectMut.mutate(id);
                      }
                    }}
                    disabled={disconnectMut.isPending}
                    className="text-xs h-8 px-3 rounded-lg border border-border bg-background/30 hover:bg-background/50 text-muted-foreground inline-flex items-center gap-1.5"
                  >
                    {disconnectMut.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Ontkoppelen"
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => data?.provisioned && setConfirm(id)}
                    disabled={!data?.provisioned || connectMut.isPending}
                    className="text-xs h-8 px-3 rounded-lg bg-gold/20 text-gold font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Link2 className="h-3.5 w-3.5" /> Koppelen
                  </button>
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
