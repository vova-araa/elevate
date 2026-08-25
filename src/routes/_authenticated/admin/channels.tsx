import { createFileRoute } from "@tanstack/react-router";
import { confirmDialog } from "@/components/ui/confirm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Loader2,
  Link2,
  RefreshCw,
  X,
  Plug,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClientStore } from "@/lib/stores/client-store";
import { PLATFORMS as PLATFORM_CONFIG, type Platform } from "@/config/platforms";
import {
  listClientChannels,
  disconnectChannel,
  refreshChannel,
  selectFacebookPage,
} from "@/lib/channels.functions";
import {
  listPostizChannels,
  assignPostizIntegration,
  type PostizChannelOption,
} from "@/lib/postiz.functions";

export const Route = createFileRoute("/_authenticated/admin/channels")({
  component: AdminChannels,
});

/**
 * Waarschuwing wanneer er écht een mens aan te pas moet komen — alleen nog
 * relevant voor de legacy directe koppelingen die er nog liggen; Postiz
 * ververst tokens zelf, dus koppelingen met meta.provider==='postiz' hebben
 * geen reconnectBefore.
 */
function tokenExpiryWarning(
  reconnectBefore: string | null | undefined,
): { expired: boolean; message: string } | null {
  if (!reconnectBefore) return null;
  const expires = new Date(reconnectBefore);
  if (Number.isNaN(expires.getTime())) return null;
  const days = Math.floor((expires.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { expired: true, message: "Koppeling verlopen — opnieuw koppelen" };
  if (days <= 14) return { expired: false, message: `Koppeling verloopt over ${days} dagen` };
  return null;
}

// Kaartkleur is presentatie voor dit scherm; welke platforms er zijn en of ze
// aangeboden worden komt uit src/config/platforms.ts (A02).
const CARD_TINT: Record<Platform, string> = {
  instagram: "from-pink-500/10 to-orange-500/5",
  tiktok: "from-fuchsia-500/10 to-cyan-500/5",
  linkedin: "from-sky-600/10 to-sky-400/5",
  youtube: "from-red-500/10 to-orange-500/5",
  facebook: "from-indigo-500/10 to-blue-500/5",
};

const PLATFORMS = PLATFORM_CONFIG.map((p) => ({ ...p, tint: CARD_TINT[p.id] }));
const VISIBLE_PLATFORMS = PLATFORMS.filter((p) => p.enabled);

// Postiz kent meerdere varianten per platform (bv. een los "zakelijk" account) —
// die matchen we allemaal terug op onze eigen vijf platform-ids.
const POSTIZ_IDENTIFIER_PLATFORM: Record<string, Platform> = {
  instagram: "instagram",
  "instagram-standalone": "instagram",
  facebook: "facebook",
  tiktok: "tiktok",
  "tiktok-business": "tiktok",
  linkedin: "linkedin",
  "linkedin-page": "linkedin",
  youtube: "youtube",
};

function AdminChannels() {
  const qc = useQueryClient();
  const { activeClient } = useClientStore();
  const clientId = activeClient?.id;

  const list = useServerFn(listClientChannels);
  const disc = useServerFn(disconnectChannel);
  const refresh = useServerFn(refreshChannel);
  const selectPage = useServerFn(selectFacebookPage);
  const listPostiz = useServerFn(listPostizChannels);
  const assignPostiz = useServerFn(assignPostizIntegration);

  const [pickerOpen, setPickerOpen] = useState<Platform | null>(null);
  const [pickerValue, setPickerValue] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-channels", clientId],
    enabled: !!clientId,
    queryFn: () => list({ data: { clientId: clientId! } }),
  });

  const {
    data: postiz,
    isLoading: postizLoading,
    refetch: refetchPostiz,
  } = useQuery({
    queryKey: ["postiz-channels"],
    queryFn: () => listPostiz(),
    staleTime: 30_000,
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
        () => {
          qc.invalidateQueries({ queryKey: ["admin-channels", clientId] });
          qc.invalidateQueries({ queryKey: ["postiz-channels"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [clientId, qc]);

  const selectPageMut = useMutation({
    mutationFn: async (vars: { platform: "facebook" | "instagram"; pageId: string }) => {
      if (!clientId) throw new Error("Geen klant geselecteerd");
      return selectPage({ data: { clientId, ...vars } });
    },
    onSuccess: (res) => {
      toast.success(`Overgeschakeld naar ${res.pageName}`);
      refetch();
    },
    onError: (e: Error) => toast.error(e.message ?? "Wisselen mislukt"),
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
      qc.invalidateQueries({ queryKey: ["postiz-channels"] });
    },
    onError: (e: Error) => toast.error(e.message ?? "Ontkoppelen mislukt"),
  });

  const assignMut = useMutation({
    mutationFn: (vars: { platform: Platform; channel: PostizChannelOption }) => {
      if (!clientId) throw new Error("Geen klant geselecteerd");
      return assignPostiz({
        data: {
          clientId,
          platform: vars.platform,
          integrationId: vars.channel.id,
          integrationName: vars.channel.profile || vars.channel.name,
          integrationIdentifier: vars.channel.identifier,
        },
      });
    },
    onSuccess: () => {
      toast.success("Gekoppeld via Postiz");
      setPickerOpen(null);
      setPickerValue("");
      refetch();
      refetchPostiz();
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

  if (!postizLoading && postiz && !postiz.configured) {
    return (
      <div className="space-y-5 max-w-5xl">
        <header>
          <h1 className="font-display text-2xl inline-flex items-center gap-2">
            <Plug className="h-6 w-6 text-gold" /> Kanalen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Koppelen loopt via Postiz — daar is nog geen verbinding mee.
          </p>
        </header>
        <div className="rounded-xl border border-dashed border-amber-400/40 bg-amber-500/5 p-6 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">POSTIZ_API_KEY ontbreekt</p>
          <p className="mt-1.5">
            Kopieer de API-key uit Postiz (Instellingen) en zet 'm als{" "}
            <code className="rounded bg-background/60 px-1.5 py-0.5 text-xs">POSTIZ_API_KEY</code>{" "}
            in de omgeving. Herstart/redeploy daarna — deze pagina werkt dan vanzelf.
          </p>
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
          Social-accounts van <b className="text-foreground">{activeClient?.name}</b>, gekoppeld via
          Postiz. Publiceren loopt via deze koppelingen.
        </p>
      </header>

      {(isLoading || postizLoading) && (
        <div className="text-sm text-muted-foreground inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gold" /> Laden…
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {VISIBLE_PLATFORMS.map(({ id, label, Icon, tint }) => {
          const ch = channelsByPlatform.get(id);
          const connectedActive = !!ch && ch.status === "active";
          const expired = !!ch && ch.status === "expired";
          const postizBacked = connectedActive && ch?.metaProvider === "postiz";
          const warn = tokenExpiryWarning(ch?.reconnectBefore);

          const unassignedForPlatform = (postiz?.channels ?? []).filter(
            (c) => !c.assignedClientId && POSTIZ_IDENTIFIER_PLATFORM[c.identifier] === id,
          );

          return (
            <div
              key={id}
              className={cn(
                "relative card-surface-lg bg-card p-4 overflow-hidden bg-gradient-to-br",
                tint,
              )}
            >
              {connectedActive && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-0.5">
                  <CheckCircle2 className="h-3 w-3" /> {postizBacked ? "Via Postiz" : "Gekoppeld"}
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

              {warn && !expired && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {warn.message}
                </div>
              )}

              {connectedActive && !warn && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-300" />
                  {postizBacked
                    ? "Blijft actief — Postiz ververst de koppeling zelf"
                    : ch?.neverExpires
                      ? "Blijft actief — dit token verloopt niet"
                      : "Blijft actief — vernieuwt zichzelf automatisch"}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2">
                {connectedActive ? (
                  <>
                    {/* Postiz ververst tokens zelf — alleen tonen voor de
                        overgebleven legacy directe koppelingen. */}
                    {!postizBacked && (
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
                    )}
                    <button
                      onClick={async () => {
                        const msg = postizBacked
                          ? `Weet je het zeker? De toewijzing aan ${activeClient?.name} wordt losgelaten (het kanaal blijft in Postiz staan).`
                          : `Weet je het zeker? Publiceren naar ${label} stopt voor ${activeClient?.name}.`;
                        if (await confirmDialog(msg)) {
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

                    {/* Meerdere Facebook-pagina's op het account (legacy directe
                        koppeling)? Dan hier wisselen zonder opnieuw te koppelen. */}
                    {!postizBacked &&
                      (id === "facebook" || id === "instagram") &&
                      (ch?.pages?.length ?? 0) > 1 && (
                        <select
                          value={ch?.currentPageId ?? ""}
                          disabled={selectPageMut.isPending}
                          onChange={(e) => {
                            if (e.target.value && e.target.value !== ch?.currentPageId) {
                              selectPageMut.mutate({ platform: id, pageId: e.target.value });
                            }
                          }}
                          className="h-8 max-w-full rounded-lg border border-gold/20 bg-input/60 px-2 text-xs"
                          aria-label="Gekoppelde pagina wisselen"
                        >
                          {ch?.pages
                            ?.filter((pg) => id === "facebook" || pg.hasInstagram)
                            .map((pg) => (
                              <option key={pg.id} value={pg.id}>
                                {pg.name}
                              </option>
                            ))}
                        </select>
                      )}
                  </>
                ) : pickerOpen === id ? (
                  <div className="w-full space-y-2">
                    {unassignedForPlatform.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">
                        Geen ongekoppelde {label}-kanalen gevonden in Postiz. Koppel het account
                        eerst in Postiz zelf, kom dan terug en klik op Ververs.
                      </p>
                    ) : (
                      <select
                        value={pickerValue}
                        onChange={(e) => setPickerValue(e.target.value)}
                        className="input h-9 text-xs"
                      >
                        <option value="">Kies een Postiz-kanaal…</option>
                        {unassignedForPlatform.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.profile || c.name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="flex items-center gap-2">
                      {unassignedForPlatform.length > 0 && (
                        <button
                          onClick={() => {
                            const channel = unassignedForPlatform.find((c) => c.id === pickerValue);
                            if (channel) assignMut.mutate({ platform: id, channel });
                          }}
                          disabled={!pickerValue || assignMut.isPending}
                          className="text-xs h-8 px-3 rounded-lg bg-gradient-gold text-primary-foreground font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {assignMut.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          Toewijzen
                        </button>
                      )}
                      <button
                        onClick={() => refetchPostiz()}
                        className="text-xs h-8 px-3 rounded-lg border border-border text-muted-foreground inline-flex items-center gap-1.5"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Ververs
                      </button>
                      <button
                        onClick={() => {
                          setPickerOpen(null);
                          setPickerValue("");
                        }}
                        className="text-xs h-8 px-3 rounded-lg border border-border text-muted-foreground inline-flex items-center gap-1.5"
                      >
                        <X className="h-3.5 w-3.5" /> Annuleren
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setPickerOpen(id)}
                    className="text-xs h-8 px-3 rounded-lg bg-gradient-gold text-primary-foreground font-medium inline-flex items-center gap-1.5 hover:brightness-105"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Koppel via Postiz
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Nieuw kanaal nog niet in de lijst? Koppel het eerst in Postiz zelf (Postiz heeft geen
        koppel-terugkeer-URL naar Elevate), kom dan terug en klik op Ververs bij het platform.
      </p>
    </div>
  );
}
