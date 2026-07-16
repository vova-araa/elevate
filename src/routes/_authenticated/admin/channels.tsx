import { createFileRoute, Link } from "@tanstack/react-router";
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
  RefreshCw,
  X,
  Plug,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import {
  listClientChannels,
  initPostizConnect,
  disconnectPostizChannel,
  syncPostizConnection,
  claimPostizIntegration,
} from "@/lib/postiz-connect.functions";

export const Route = createFileRoute("/_authenticated/admin/channels")({
  component: AdminChannels,
});

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

const PLATFORMS: { id: Platform; label: string; Icon: LucideIcon; tint: string }[] = [
  {
    id: "instagram",
    label: "Instagram",
    Icon: Instagram,
    tint: "from-pink-500/10 to-orange-500/5",
  },
  { id: "tiktok", label: "TikTok", Icon: Music2, tint: "from-fuchsia-500/10 to-cyan-500/5" },
  { id: "linkedin", label: "LinkedIn", Icon: Linkedin, tint: "from-sky-600/10 to-sky-400/5" },
  { id: "youtube", label: "YouTube", Icon: Youtube, tint: "from-red-500/10 to-orange-500/5" },
  { id: "facebook", label: "Facebook", Icon: Facebook, tint: "from-indigo-500/10 to-blue-500/5" },
];

interface Claimable {
  id: string;
  name: string;
  picture: string | null;
}

function AdminChannels() {
  const qc = useQueryClient();
  const { activeClient } = useClientStore();
  const clientId = activeClient?.id;

  const list = useServerFn(listClientChannels);
  const init = useServerFn(initPostizConnect);
  const disc = useServerFn(disconnectPostizChannel);
  const sync = useServerFn(syncPostizConnection);
  const claim = useServerFn(claimPostizIntegration);

  // Handmatig kiezen wanneer meerdere Postiz-accounts beschikbaar zijn
  const [claimFor, setClaimFor] = useState<{ platform: Platform; options: Claimable[] } | null>(
    null,
  );

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-channels", clientId],
    enabled: !!clientId,
    queryFn: () => list({ data: { clientId: clientId! } }),
  });

  // Realtime: ververs bij wijzigingen in social_connections van deze klant
  useEffect(() => {
    if (!clientId) return;
    const ch = supabase
      .channel(`admin-channels-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "social_connections",
          filter: `client_id=eq.${clientId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["admin-channels", clientId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clientId, qc]);

  const syncAfterConnect = async (platform: Platform, notifyUser = false) => {
    if (!clientId) return;
    const result = await sync({ data: { clientId, platform } });
    await refetch();
    if (notifyUser) {
      if (result?.connected) toast.success("Account gekoppeld");
      else if (result && "claimable" in result && (result.claimable?.length ?? 0) > 1) {
        setClaimFor({ platform, options: (result.claimable ?? []) as Claimable[] });
      } else toast.info(result?.reason ?? "Nog geen nieuwe koppeling gevonden");
    }
  };

  const connectMut = useMutation({
    mutationFn: async (platform: Platform) => {
      if (!clientId) throw new Error("Selecteer eerst een klant in de sidebar");
      const res = await init({ data: { clientId, platform } });
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
      toast.info("Rond de autorisatie af in het nieuwe tabblad. De status ververst automatisch.");
      [4000, 12000, 30000].forEach((ms) =>
        window.setTimeout(() => syncAfterConnect(res.platform), ms),
      );
    },
    onError: (e: Error) => toast.error(e.message ?? "Verbinden mislukt"),
  });

  const syncMut = useMutation({
    mutationFn: (platform: Platform) => syncAfterConnect(platform, true),
    onError: (e: Error) => toast.error(e.message ?? "Synchroniseren mislukt"),
  });

  const disconnectMut = useMutation({
    mutationFn: (platform: Platform) => {
      if (!clientId) throw new Error("Geen klant geselecteerd");
      return disc({ data: { clientId, platform } });
    },
    onSuccess: () => {
      toast.success("Ontkoppeld");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message ?? "Ontkoppelen mislukt"),
  });

  const claimMut = useMutation({
    mutationFn: (args: { platform: Platform; integrationId: string }) => {
      if (!clientId) throw new Error("Geen klant geselecteerd");
      return claim({
        data: { clientId, platform: args.platform, integrationId: args.integrationId },
      });
    },
    onSuccess: (res) => {
      toast.success(`Gekoppeld als ${res.handle}`);
      setClaimFor(null);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message ?? "Koppelen mislukt"),
  });

  const channelsByPlatform = new Map((data?.channels ?? []).map((c) => [c.platform, c]));

  if (!clientId) {
    return (
      <div className="space-y-5 max-w-5xl">
        <header>
          <h1 className="font-display text-2xl inline-flex items-center gap-2">
            <Plug className="h-6 w-6 text-gold" /> Kanalen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Beheer per klant welke social-accounts gekoppeld zijn.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-gold/30 bg-gold/5 p-10 text-center text-sm text-muted-foreground">
          Selecteer eerst een klant in de sidebar om kanalen te koppelen.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl inline-flex items-center gap-2">
            <Plug className="h-6 w-6 text-gold" /> Kanalen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Social-accounts van <b className="text-foreground">{activeClient?.name}</b>. Publiceren
            loopt via deze koppelingen.
          </p>
        </div>
        <Link
          to="/admin/postiz"
          className="text-xs h-8 px-3 rounded-lg border border-gold/20 hover:bg-gold/10 inline-flex items-center gap-1.5"
        >
          Postiz-overzicht
        </Link>
      </header>

      {data && !data.provisioned && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">
          Deze klant is nog niet volledig geprovisioned in Postiz — koppelen kan zodra dat klaar is.
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gold" /> Laden…
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLATFORMS.map(({ id, label, Icon, tint }) => {
          const ch = channelsByPlatform.get(id);
          const connected = !!ch && ch.status === "active";
          return (
            <div
              key={id}
              className={cn(
                "relative rounded-2xl border border-gold/15 bg-card p-4 overflow-hidden bg-gradient-to-br",
                tint,
              )}
            >
              {connected && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
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
                  <>
                    <button
                      onClick={() => syncMut.mutate(id)}
                      disabled={syncMut.isPending}
                      className="text-xs h-8 px-3 rounded-lg border border-gold/20 hover:bg-gold/10 inline-flex items-center gap-1.5"
                    >
                      {syncMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Vernieuw
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `Weet je het zeker? Publiceren naar ${label} stopt voor ${activeClient?.name}.`,
                          )
                        ) {
                          disconnectMut.mutate(id);
                        }
                      }}
                      disabled={disconnectMut.isPending}
                      className="text-xs h-8 px-3 rounded-lg border border-border bg-background/30 hover:bg-background/50 text-muted-foreground inline-flex items-center gap-1.5"
                    >
                      {disconnectMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                      Ontkoppel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => connectMut.mutate(id)}
                      disabled={connectMut.isPending}
                      className="text-xs h-8 px-3 rounded-lg bg-gradient-gold text-primary-foreground font-medium inline-flex items-center gap-1.5 hover:brightness-105"
                    >
                      {connectMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Link2 className="h-3.5 w-3.5" />
                      )}
                      Koppelen
                    </button>
                    <button
                      onClick={() => syncMut.mutate(id)}
                      disabled={syncMut.isPending}
                      className="text-xs h-8 px-3 rounded-lg border border-gold/20 hover:bg-gold/10 inline-flex items-center gap-1.5"
                      title="Zoek een bestaand Postiz-account voor dit platform"
                    >
                      {syncMut.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      Zoek bestaand
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Handmatige keuze bij meerdere beschikbare Postiz-accounts */}
      {claimFor && (
        <div className="rounded-xl border border-gold/20 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium">
              Meerdere Postiz-accounts gevonden voor{" "}
              {PLATFORMS.find((p) => p.id === claimFor.platform)?.label} — welke hoort bij{" "}
              {activeClient?.name}?
            </div>
            <button
              onClick={() => setClaimFor(null)}
              className="rounded-md p-1.5 hover:bg-accent/40"
              aria-label="Sluiten"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {claimFor.options.map((o) => (
              <button
                key={o.id}
                onClick={() =>
                  claimMut.mutate({ platform: claimFor.platform, integrationId: o.id })
                }
                disabled={claimMut.isPending}
                className="inline-flex items-center gap-2 rounded-lg border border-gold/20 bg-background/40 hover:bg-gold/10 px-3 h-9 text-sm"
              >
                {o.picture ? (
                  <img src={o.picture} alt="" className="h-5 w-5 rounded-full object-cover" />
                ) : (
                  <span className="h-5 w-5 rounded-full bg-gold/20" />
                )}
                {o.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Koppelen opent Postiz in een nieuw tabblad; na autorisatie wordt het account automatisch aan
        deze klant gekoppeld. Gebruik “Zoek bestaand” als het account al in Postiz staat.
      </p>
    </div>
  );
}
