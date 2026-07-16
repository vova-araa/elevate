import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
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
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import {
  listClientChannels,
  startSocialConnect,
  disconnectChannel,
  refreshChannel,
} from "@/lib/channels.functions";

const searchSchema = z.object({
  connected: z.string().optional(),
  handle: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/channels")({
  validateSearch: searchSchema,
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

function AdminChannels() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { activeClient } = useClientStore();
  const clientId = activeClient?.id;
  const { connected, handle, error } = Route.useSearch();

  const list = useServerFn(listClientChannels);
  const connect = useServerFn(startSocialConnect);
  const disc = useServerFn(disconnectChannel);
  const refresh = useServerFn(refreshChannel);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-channels", clientId],
    enabled: !!clientId,
    queryFn: () => list({ data: { clientId: clientId! } }),
  });

  // Toon eenmalig een toast voor de OAuth-callback-redirect, wis daarna de querystring.
  useEffect(() => {
    if (!connected && !error) return;
    if (error) toast.error(error);
    else if (connected) toast.success(`${handle ?? "Account"} gekoppeld via ${connected}`);
    navigate({ to: "/admin/channels", search: {}, replace: true });
  }, [connected, handle, error, navigate]);

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

  const connectMut = useMutation({
    mutationFn: async (platform: Platform) => {
      if (!clientId) throw new Error("Selecteer eerst een klant in de sidebar");
      const res = await connect({ data: { clientId, platform, returnTo: "admin" } });
      return res;
    },
    onSuccess: (res) => {
      window.location.href = res.redirectUrl;
    },
    onError: (e: Error) => toast.error(e.message ?? "Verbinden mislukt"),
  });

  const refreshMut = useMutation({
    mutationFn: async (platform: Platform) => {
      if (!clientId) throw new Error("Geen klant geselecteerd");
      return refresh({ data: { clientId, platform } });
    },
    onSuccess: (res) => {
      if (res.connected) toast.success(`Vernieuwd${res.handle ? ` als ${res.handle}` : ""}`);
      else toast.info(res.reason ?? "Nog geen wijzigingen gevonden");
      refetch();
    },
    onError: (e: Error) => toast.error(e.message ?? "Vernieuwen mislukt"),
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
      <header>
        <h1 className="font-display text-2xl inline-flex items-center gap-2">
          <Plug className="h-6 w-6 text-gold" /> Kanalen
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Social-accounts van <b className="text-foreground">{activeClient?.name}</b>. Publiceren
          loopt via deze koppelingen.
        </p>
      </header>

      {isLoading && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gold" /> Laden…
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PLATFORMS.map(({ id, label, Icon, tint }) => {
          const ch = channelsByPlatform.get(id);
          const connectedActive = !!ch && ch.status === "active";
          const expired = !!ch && ch.status === "expired";
          return (
            <div
              key={id}
              className={cn(
                "relative rounded-2xl border border-gold/15 bg-card p-4 overflow-hidden bg-gradient-to-br",
                tint,
              )}
            >
              {connectedActive && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3" /> Gekoppeld
                </span>
              )}
              {expired && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-full px-2 py-0.5">
                  <AlertTriangle className="h-3 w-3" /> Verlopen — koppel opnieuw
                </span>
              )}
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-background/40 grid place-items-center">
                  <Icon className="h-5 w-5" />
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

              <div className="mt-4 flex items-center gap-2">
                {connectedActive ? (
                  <>
                    <button
                      onClick={() => refreshMut.mutate(id)}
                      disabled={refreshMut.isPending}
                      className="text-xs h-8 px-3 rounded-lg border border-gold/20 hover:bg-gold/10 inline-flex items-center gap-1.5"
                    >
                      {refreshMut.isPending ? (
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
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Koppelen stuurt je naar het platform om te autoriseren; daarna kom je automatisch hier
        terug.
      </p>
    </div>
  );
}
