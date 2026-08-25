import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Music2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import { getConnectContext, type ConnectPlatformStatus } from "@/lib/channel-invites.functions";

const searchSchema = z.object({});

export const Route = createFileRoute("/connect/$token")({
  ssr: false,
  validateSearch: searchSchema,
  // Publieke, klant-specifieke link — nooit indexeren.
  head: () => ({
    meta: [{ title: "Kanalen — Elevate Design" }, { name: "robots", content: "noindex, nofollow" }],
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
  const getContext = useServerFn(getConnectContext);

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

  return (
    <Shell>
      <div className="fade-in-up glass-strong rounded-2xl p-6 sm:p-8 text-center">
        <h1 className="font-display text-3xl text-gold">Social-accounts van {data?.clientName}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Kanalen koppelen doe je niet zelf via deze link — je Elevate-team sluit ze centraal aan.
          Hieronder zie je de actuele status.
        </p>
      </div>

      <div className="space-y-3 pb-8">
        {platforms.map((p) => (
          <PlatformCard key={p.platform} platform={p} />
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/70 pb-4">
        Deze link is persoonlijk en tijdelijk. Deel hem niet met anderen.
      </p>
    </Shell>
  );
}

function PlatformCard({ platform }: { platform: ConnectPlatformStatus }) {
  const pm = PLATFORM_META[platform.platform] ?? PLATFORM_META.instagram;

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
            <div className="text-xs text-amber-600 dark:text-amber-300">Aandacht nodig</div>
          ) : (
            <div className="text-xs text-muted-foreground">Nog niet gekoppeld</div>
          )}
        </div>
        {platform.connected && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300 bg-emerald-500/10 border border-emerald-400/30 rounded-full px-2 py-1">
            <CheckCircle2 className="h-3 w-3" /> Gekoppeld
          </span>
        )}
      </div>
    </div>
  );
}
