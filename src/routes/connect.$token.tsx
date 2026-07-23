import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Link2,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Music2,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import {
  getConnectContext,
  startConnectByToken,
  type ConnectPlatformStatus,
} from "@/lib/channel-invites.functions";

const searchSchema = z.object({
  connected: z.string().optional(),
  handle: z.string().optional(),
  error: z.string().optional(),
});

export const Route = createFileRoute("/connect/$token")({
  ssr: false,
  validateSearch: searchSchema,
  // Publieke, klant-specifieke link — nooit indexeren.
  head: () => ({
    meta: [
      { title: "Accounts koppelen — Elevate Design" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ConnectPage,
});

const PLATFORM_META: Record<string, { label: string; Icon: LucideIcon; tint: string }> = {
  instagram: {
    label: "Instagram",
    Icon: Instagram,
    tint: "text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/30",
  },
  tiktok: { label: "TikTok", Icon: Music2, tint: "text-sky-300 bg-sky-500/10 border-sky-400/30" },
  linkedin: {
    label: "LinkedIn",
    Icon: Linkedin,
    tint: "text-blue-300 bg-blue-500/10 border-blue-400/30",
  },
  youtube: {
    label: "YouTube",
    Icon: Youtube,
    tint: "text-red-300 bg-red-500/10 border-red-400/30",
  },
  facebook: {
    label: "Facebook",
    Icon: Facebook,
    tint: "text-indigo-300 bg-indigo-500/10 border-indigo-400/30",
  },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-luxe px-4 py-8 sm:py-10">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[45vh]"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="relative mx-auto w-full max-w-lg space-y-5">
        <div className="flex items-center justify-center gap-2.5 pt-2">
          <div className="grid h-10 w-10 place-items-center rounded-full border border-gold/20 bg-background/60 shadow-sm">
            <img
              src={elevateLogoUrl}
              alt="Elevate Design"
              width={22}
              height={22}
              className="h-[22px] w-[22px] object-contain"
            />
          </div>
          <span className="font-display text-lg text-gold">Elevate Design</span>
        </div>
        {children}
      </div>
    </main>
  );
}

function ConnectPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getContext = useServerFn(getConnectContext);
  const { connected, handle, error } = Route.useSearch();

  const {
    data,
    isLoading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: ["connect-context", token],
    queryFn: () => getContext({ data: { token } }),
    retry: false,
  });

  // Toon eenmalig een melding voor de OAuth-callback-redirect, wis daarna de querystring.
  useEffect(() => {
    if (!connected && !error) return;
    if (error) toast.error(error);
    else if (connected) toast.success(`${handle ?? "Account"} gekoppeld via ${connected}`);
    qc.invalidateQueries({ queryKey: ["connect-context", token] });
    navigate({ to: "/connect/$token", params: { token }, search: {}, replace: true });
  }, [connected, handle, error, navigate, qc, token]);

  if (isLoading) {
    return (
      <Shell>
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gold" />
        </div>
      </Shell>
    );
  }

  if (isError) {
    return (
      <Shell>
        <div className="glass-strong fade-in-up rounded-2xl p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-9 w-9 text-destructive" />
          <h1 className="font-display text-2xl">Link ongeldig</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {queryError instanceof Error
              ? queryError.message
              : "Deze koppel-link werkt niet (meer)."}
          </p>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Vraag je contactpersoon bij Elevate om een nieuwe link.
          </p>
        </div>
      </Shell>
    );
  }

  const platforms = data?.platforms ?? [];
  const anyConnected = platforms.some((p) => p.connected);

  return (
    <Shell>
      <div className="fade-in-up glass-strong rounded-2xl p-6 sm:p-8 text-center">
        <h1 className="font-display text-3xl text-gold">
          Koppel de social-accounts van {data?.clientName}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Kies hieronder een platform en log in met het account van je bedrijf. Klaar in een paar
          klikken — je hoeft nergens voor in te loggen op dit portaal.
        </p>
        {anyConnected && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-300">
            <PartyPopper className="h-3.5 w-3.5" /> Sommige accounts staan al gekoppeld.
          </p>
        )}
      </div>

      <div className="space-y-3 pb-8">
        {platforms.map((p) => (
          <PlatformCard key={p.platform} platform={p} token={token} />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/70 pb-4">
        Deze link is persoonlijk en tijdelijk. Deel hem niet met anderen.
      </p>
    </Shell>
  );
}

function PlatformCard({ platform, token }: { platform: ConnectPlatformStatus; token: string }) {
  const start = useServerFn(startConnectByToken);
  const pm = PLATFORM_META[platform.platform] ?? PLATFORM_META.instagram;
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    try {
      const res = await start({
        data: { token, platform: platform.platform, origin: window.location.origin },
      });
      window.location.href = res.redirectUrl;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Koppelen mislukt");
      setBusy(false);
    }
  }

  return (
    <div className="glass-strong rounded-2xl p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div
          className={cn("h-11 w-11 shrink-0 rounded-xl border grid place-items-center", pm.tint)}
        >
          <pm.Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{pm.label}</div>
          {platform.connected ? (
            <div className="text-xs text-muted-foreground truncate">
              {platform.handle ?? "Gekoppeld"}
              {typeof platform.followerCount === "number" && (
                <> · {platform.followerCount.toLocaleString("nl-NL")} volgers</>
              )}
            </div>
          ) : platform.status === "expired" ? (
            <div className="text-xs text-amber-600 dark:text-amber-300">
              Koppeling verlopen — koppel opnieuw
            </div>
          ) : platform.available ? (
            <div className="text-xs text-muted-foreground">Nog niet gekoppeld</div>
          ) : (
            <div className="text-xs text-muted-foreground">Nog niet beschikbaar</div>
          )}
        </div>
        {platform.connected ? (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-1">
            <CheckCircle2 className="h-3 w-3" /> Gekoppeld
          </span>
        ) : platform.available ? (
          <button
            onClick={connect}
            disabled={busy}
            className="shrink-0 min-h-11 rounded-lg bg-gradient-gold px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Koppelen
          </button>
        ) : (
          <span className="shrink-0 text-[10px] text-muted-foreground/70">binnenkort</span>
        )}
      </div>
    </div>
  );
}
