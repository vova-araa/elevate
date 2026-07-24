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
  RefreshCw,
  X,
  Plug,
  AlertTriangle,
  Share2,
  Copy,
  Check,
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
  getSocialSetupStatus,
} from "@/lib/channels.functions";
import { createChannelInvite } from "@/lib/channel-invites.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/** Klik-voor-klik instructies per platform voor de eenmalige app-registratie. */
const SETUP_GUIDE: Record<string, { portal: string; portalLabel: string; steps: string[] }> = {
  instagram: {
    portal: "https://developers.facebook.com/apps/",
    portalLabel: "developers.facebook.com",
    steps: [
      "Maak (eenmalig) een app aan van het type 'Business'.",
      "Voeg het product 'Facebook Login for Business' toe.",
      "Plak de redirect-URI hieronder bij 'Valid OAuth Redirect URIs'.",
      "Kopieer App-ID en App-secret naar de omgeving als META_APP_ID en META_APP_SECRET.",
      "Zorg dat het Instagram-account een Business-account is, gekoppeld aan een Facebook-pagina.",
    ],
  },
  facebook: {
    portal: "https://developers.facebook.com/apps/",
    portalLabel: "developers.facebook.com",
    steps: [
      "Zelfde Meta-app als Instagram — één keer instellen is genoeg.",
      "Kopieer App-ID en App-secret naar META_APP_ID en META_APP_SECRET.",
    ],
  },
  tiktok: {
    portal: "https://developers.tiktok.com/",
    portalLabel: "developers.tiktok.com",
    steps: [
      "Maak een app aan en vraag de 'Content Posting API' aan.",
      "Plak de redirect-URI hieronder bij 'Redirect URI'.",
      "Kopieer Client key en Client secret naar TIKTOK_CLIENT_KEY en TIKTOK_CLIENT_SECRET.",
    ],
  },
  linkedin: {
    portal: "https://www.linkedin.com/developers/apps",
    portalLabel: "linkedin.com/developers",
    steps: [
      "Maak een app aan (koppel je bedrijfspagina).",
      "Vraag de producten 'Sign In with LinkedIn' en 'Share on LinkedIn' aan.",
      "Plak de redirect-URI hieronder bij 'Authorized redirect URLs'.",
      "Kopieer Client ID en Client Secret naar LINKEDIN_CLIENT_ID en LINKEDIN_CLIENT_SECRET.",
    ],
  },
  youtube: {
    portal: "https://console.cloud.google.com/apis/credentials",
    portalLabel: "console.cloud.google.com",
    steps: [
      "Maak een project + OAuth Client ID (type 'Webapplicatie').",
      "Zet de YouTube Data API v3 aan.",
      "Plak de redirect-URI hieronder bij 'Geautoriseerde omleidings-URI's'.",
      "Kopieer Client-ID en Client-secret naar GOOGLE_CLIENT_ID en GOOGLE_CLIENT_SECRET.",
    ],
  },
};

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
  const createInvite = useServerFn(createChannelInvite);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  async function shareChannelInvite() {
    if (!clientId) return;
    setInviteBusy(true);
    setInviteCopied(false);
    try {
      const res = await createInvite({
        data: { clientId, origin: window.location.origin },
      });
      setInviteUrl(res.url);
      setInviteOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link maken mislukt");
    } finally {
      setInviteBusy(false);
    }
  }

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
      const res = await connect({
        data: { clientId, platform, returnTo: "admin", origin: window.location.origin },
      });
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

  const setupFn = useServerFn(getSocialSetupStatus);
  const { data: setup } = useQuery({
    queryKey: ["social-setup-status"],
    queryFn: () => setupFn(),
    staleTime: 60_000,
  });
  const redirectUri =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/oauth/callback` : "";
  const copyRedirect = async () => {
    await navigator.clipboard.writeText(redirectUri);
    toast.success("Redirect-URI gekopieerd");
  };

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
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl inline-flex items-center gap-2">
            <Plug className="h-6 w-6 text-gold" /> Kanalen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Social-accounts van <b className="text-foreground">{activeClient?.name}</b>. Publiceren
            loopt via deze koppelingen.
          </p>
        </div>
        <button
          onClick={shareChannelInvite}
          disabled={inviteBusy}
          title={`Deel koppel-link voor ${activeClient?.name}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
        >
          {inviteBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Share2 className="h-3.5 w-3.5" />
          )}
          Deel koppel-link
        </button>
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
          const warn = tokenExpiryWarning(ch?.token_expires_at);
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

              {warn && !expired && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  {warn.message}
                </div>
              )}

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
                ) : setup && !setup.platforms[id]?.configured ? (
                  <details className="w-full text-xs">
                    <summary className="cursor-pointer inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-amber-400/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium">
                      Eenmalig instellen (±10 min)
                    </summary>
                    <ol className="mt-3 space-y-1.5 list-decimal pl-4 text-muted-foreground">
                      <li>
                        Ga naar{" "}
                        <a
                          href={SETUP_GUIDE[id].portal}
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-gold"
                        >
                          {SETUP_GUIDE[id].portalLabel}
                        </a>
                        .
                      </li>
                      {SETUP_GUIDE[id].steps.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                      <li>
                        Herstart/redeploy de app — deze kaart wordt dan vanzelf een Koppelen-knop.
                      </li>
                    </ol>
                    <button
                      onClick={copyRedirect}
                      className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-gold/20 hover:bg-gold/10 font-medium"
                    >
                      <Link2 className="h-3.5 w-3.5" /> Kopieer redirect-URI
                    </button>
                    <div className="mt-1.5 break-all font-mono text-[10.5px] text-muted-foreground">
                      {redirectUri}
                    </div>
                    <div className="mt-1.5 text-[10.5px] text-muted-foreground">
                      Nog in te stellen: {setup.platforms[id]?.missing.join(", ")}
                    </div>
                  </details>
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

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) setInviteCopied(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Koppel-link</DialogTitle>
            <DialogDescription>
              Eigenaar hoeft niet in te loggen · 30 dagen geldig
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-background/60 border border-gold/20 px-3 py-2.5 text-sm">
              {inviteUrl}
            </code>
            <button
              onClick={() => {
                if (!inviteUrl) return;
                navigator.clipboard.writeText(inviteUrl);
                setInviteCopied(true);
                toast.success("Link gekopieerd");
              }}
              className="shrink-0 min-h-11 min-w-11 rounded-lg border border-gold/20 inline-flex items-center justify-center hover:bg-gold/10"
              title="Kopieer link"
            >
              {inviteCopied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-gold" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stuur dit naar de eigenaar. Die koppelt zijn accounts zonder in te loggen. 30 dagen
            geldig.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
