import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquarePlus,
  CalendarClock,
  PartyPopper,
  ImageOff,
  Send,
  X,
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Music2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import elevateLogoUrl from "@/assets/elevate-logo.png";
import {
  getApprovalQueueByToken,
  actOnPostByToken,
  type ApprovalQueuePost,
} from "@/lib/approval-links.functions";

export const Route = createFileRoute("/approve/$token")({
  ssr: false,
  // Publieke, klant-specifieke link — nooit indexeren.
  head: () => ({
    meta: [
      { title: "Goedkeuren — Elevate Design" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ApprovePage,
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

function ApprovePage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getQueue = useServerFn(getApprovalQueueByToken);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["approval-queue", token],
    queryFn: () => getQueue({ data: { token } }),
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
            {error instanceof Error ? error.message : "Deze goedkeurlink werkt niet (meer)."}
          </p>
          <p className="mt-4 text-xs text-muted-foreground/70">
            Vraag je contactpersoon om een nieuwe link.
          </p>
        </div>
      </Shell>
    );
  }

  const posts = data?.posts ?? [];

  return (
    <Shell>
      <div className="fade-in-up glass-strong rounded-2xl p-6 sm:p-8 text-center">
        <h1 className="font-display text-3xl text-gold">Goedkeuren voor {data?.clientName}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Bekijk de concepten hieronder en keur ze goed, of vraag een wijziging aan.
        </p>
      </div>

      {posts.length === 0 ? (
        <div className="glass-strong rounded-2xl p-10 text-center">
          <PartyPopper className="mx-auto mb-3 h-9 w-9 text-gold" />
          <p className="text-sm text-muted-foreground">
            Er staat op dit moment niets klaar om te keuren.
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              token={token}
              onChanged={() => qc.invalidateQueries({ queryKey: ["approval-queue", token] })}
            />
          ))}
        </div>
      )}
    </Shell>
  );
}

function PostCard({
  post,
  token,
  onChanged,
}: {
  post: ApprovalQueuePost;
  token: string;
  onChanged: () => void;
}) {
  const act = useServerFn(actOnPostByToken);
  const pm = PLATFORM_META[post.platform] ?? PLATFORM_META.instagram;
  const [requesting, setRequesting] = useState(false);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<"approve" | "change" | null>(null);
  const [done, setDone] = useState<"approved" | "change_requested" | null>(null);

  async function approve() {
    setBusy("approve");
    try {
      await act({ data: { token, postId: post.id, action: "approve" } });
      toast.success("Post goedgekeurd — hij wordt ingepland");
      setDone("approved");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Goedkeuren mislukt");
    } finally {
      setBusy(null);
    }
  }

  async function submitChange(e: React.FormEvent) {
    e.preventDefault();
    const text = comment.trim();
    if (!text) return;
    setBusy("change");
    try {
      await act({
        data: { token, postId: post.id, action: "request_change", comment: text },
      });
      toast.success("Wijzigingsverzoek verstuurd — het team gaat ermee aan de slag");
      setDone("change_requested");
      setRequesting(false);
      setComment("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Versturen mislukt");
    } finally {
      setBusy(null);
    }
  }

  if (done) {
    return (
      <div className="glass-strong rounded-2xl p-5 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-400" />
        <p className="text-sm">
          {done === "approved"
            ? "Goedgekeurd. Deze post wordt ingepland."
            : "Wijzigingsverzoek verstuurd. Het team gaat ermee aan de slag."}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-strong rounded-2xl p-4 sm:p-5">
      <div className="flex flex-col gap-4">
        {post.mediaUrl ? (
          post.mediaType?.startsWith("video") ? (
            <video
              src={post.mediaUrl}
              controls
              className="w-full aspect-square rounded-xl object-cover bg-black"
            />
          ) : (
            <img
              src={post.mediaUrl}
              alt=""
              className="w-full aspect-square rounded-xl object-cover"
            />
          )
        ) : (
          <div className="w-full aspect-[2/1] rounded-xl border border-gold/10 bg-surface/40 flex flex-col items-center justify-center gap-1.5 text-muted-foreground">
            <ImageOff className="h-6 w-6" />
            <span className="text-xs">Geen media</span>
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "text-[10px] rounded-full border px-2 py-1 inline-flex items-center gap-1",
                pm.tint,
              )}
            >
              <pm.Icon className="h-3 w-3" /> {pm.label}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {new Date(post.scheduledAt).toLocaleString("nl-NL", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>

          {post.caption ? (
            <p className="mt-2.5 text-sm whitespace-pre-wrap break-words">{post.caption}</p>
          ) : (
            <p className="mt-2.5 text-sm text-muted-foreground italic">Geen caption</p>
          )}
        </div>

        {requesting ? (
          <form onSubmit={submitChange} className="space-y-2">
            <textarea
              autoFocus
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Wat wil je aangepast hebben?"
              rows={3}
              className="w-full text-sm rounded-lg bg-input/60 border border-gold/20 px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40 resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={busy !== null || !comment.trim()}
                className="min-h-11 rounded-lg bg-gradient-gold px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {busy === "change" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Versturen
              </button>
              <button
                type="button"
                onClick={() => {
                  setRequesting(false);
                  setComment("");
                }}
                disabled={busy !== null}
                className="min-h-11 rounded-lg border border-gold/20 px-4 text-sm inline-flex items-center justify-center gap-1.5 hover:bg-accent/40 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Annuleer
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={approve}
              disabled={busy !== null}
              className="min-h-11 rounded-lg bg-gradient-gold px-4 text-sm font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
            >
              {busy === "approve" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Goedkeuren
            </button>
            <button
              onClick={() => setRequesting(true)}
              disabled={busy !== null}
              className="min-h-11 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 px-4 text-sm font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <MessageSquarePlus className="h-4 w-4" /> Wijziging vragen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
