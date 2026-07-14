import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Instagram,
  Linkedin,
  Youtube,
  Facebook,
  Music2,
  ShieldCheck,
  MessageSquarePlus,
  CalendarClock,
  Loader2,
  Inbox,
  X,
} from "lucide-react";
import { PostComments } from "./post-comments";

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";

const PLATFORM_META: Record<Platform, { label: string; Icon: any; tint: string }> = {
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

/**
 * "Ter goedkeuring": alle concept-posts (status = draft) van de klant.
 * De klant kan goedkeuren (status -> scheduled) of een wijziging vragen
 * via een commentaar in post_comments (post blijft draft).
 */
export function ApprovalQueue({ clientId }: { clientId: string }) {
  const qc = useQueryClient();

  const { data: drafts, isLoading } = useQuery({
    queryKey: ["client-approval-drafts", clientId],
    queryFn: async () =>
      (
        await supabase
          .from("scheduled_posts")
          .select("*")
          .eq("client_id", clientId)
          .eq("status", "draft")
          .is("deleted_at", null)
          .order("scheduled_at", { ascending: true })
      ).data ?? [],
  });

  async function approve(id: string) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "scheduled" })
      .eq("id", id);
    if (error) return toast.error("Goedkeuren mislukt: " + error.message);
    toast.success("Post goedgekeurd — hij wordt ingepland");
    qc.invalidateQueries({ queryKey: ["client-approval-drafts", clientId] });
    qc.invalidateQueries({ queryKey: ["client-draft-count", clientId] });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if ((drafts?.length ?? 0) === 0) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <Inbox className="h-8 w-8 text-gold mx-auto mb-3" />
        <h2 className="font-display text-2xl">Niets te beoordelen</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Er staan momenteel geen concept-posts voor je klaar. Zodra je team iets voorbereidt,
          verschijnt het hier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {drafts!.map((post) => (
        <DraftCard
          key={post.id}
          post={post}
          clientId={clientId}
          onApprove={() => approve(post.id)}
        />
      ))}
    </div>
  );
}

function DraftCard({
  post,
  clientId,
  onApprove,
}: {
  post: any;
  clientId: string;
  onApprove: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const pm = PLATFORM_META[(post.platform as Platform) ?? "instagram"] ?? PLATFORM_META.instagram;
  const [requesting, setRequesting] = useState(false);
  const [changeText, setChangeText] = useState("");
  const [busy, setBusy] = useState<"approve" | "change" | null>(null);
  const [showComments, setShowComments] = useState(false);

  async function submitChangeRequest(e: React.FormEvent) {
    e.preventDefault();
    const text = changeText.trim();
    if (!text || !user) return;
    setBusy("change");
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      client_id: clientId,
      author_id: user.id,
      author_role: "client",
      body: text,
    });
    setBusy(null);
    if (error) return toast.error("Versturen mislukt: " + error.message);
    setChangeText("");
    setRequesting(false);
    setShowComments(true);
    toast.success("Wijzigingsverzoek verstuurd — je team gaat ermee aan de slag");
    qc.invalidateQueries({ queryKey: ["post-comments", post.id] });
  }

  return (
    <div className="rounded-xl border border-gold/10 bg-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row gap-4">
        {post.media_path && <MediaPreview path={post.media_path} mediaType={post.media_type} />}

        <div className="flex-1 min-w-0">
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
              {new Date(post.scheduled_at).toLocaleString("nl-NL", {
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

          <div className="mt-4 flex flex-col sm:flex-row flex-wrap gap-2">
            <button
              onClick={async () => {
                setBusy("approve");
                await onApprove();
                setBusy(null);
              }}
              disabled={busy !== null}
              className="min-h-11 rounded-lg bg-gradient-gold px-4 text-xs font-medium text-primary-foreground inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {busy === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5" />
              )}
              Goedkeuren
            </button>
            <button
              onClick={() => setRequesting((v) => !v)}
              disabled={busy !== null}
              className="min-h-11 rounded-lg border border-gold/30 text-gold hover:bg-gold/10 px-4 text-xs font-medium inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {requesting ? (
                <X className="h-3.5 w-3.5" />
              ) : (
                <MessageSquarePlus className="h-3.5 w-3.5" />
              )}
              {requesting ? "Annuleer" : "Wijziging vragen"}
            </button>
            <button
              onClick={() => setShowComments((v) => !v)}
              className="min-h-11 rounded-lg border border-border/40 text-muted-foreground hover:text-foreground px-4 text-xs inline-flex items-center justify-center gap-1.5"
            >
              {showComments ? "Verberg opmerkingen" : "Toon opmerkingen"}
            </button>
          </div>

          {requesting && (
            <form
              onSubmit={submitChangeRequest}
              className="mt-3 rounded-xl border border-gold/30 bg-surface/60 p-3 space-y-2"
            >
              <div className="text-[11px] uppercase tracking-wider text-gold/80">
                Wat wil je aangepast hebben?
              </div>
              <textarea
                autoFocus
                value={changeText}
                onChange={(e) => setChangeText(e.target.value)}
                placeholder="Bijv. andere openingszin, ander beeld, hashtags aanpassen…"
                rows={3}
                className="w-full text-sm rounded-lg bg-input/60 hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40 resize-none"
              />
              <button
                type="submit"
                disabled={busy !== null || !changeText.trim()}
                className="min-h-11 w-full sm:w-auto rounded-lg bg-gradient-gold px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {busy === "change" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Verstuur wijzigingsverzoek
              </button>
              <p className="text-[11px] text-muted-foreground">
                De post blijft in concept staan tot je team de wijziging heeft verwerkt.
              </p>
            </form>
          )}

          {showComments && <PostComments postId={post.id} clientId={clientId} />}
        </div>
      </div>
    </div>
  );
}

function MediaPreview({ path, mediaType }: { path: string; mediaType: string | null }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    supabase.storage
      .from("social-media")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl || "");
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  const isVideo = mediaType?.startsWith("video") || /\.(mp4|mov|webm)$/i.test(path);

  return (
    <div className="w-full sm:w-40 shrink-0">
      <div className="aspect-square overflow-hidden rounded-xl border border-gold/10 bg-surface/40">
        {url ? (
          isVideo ? (
            <video src={url} controls className="h-full w-full object-cover" />
          ) : (
            <img src={url} alt="Voorbeeld van de post" className="h-full w-full object-cover" />
          )
        ) : (
          <div className="h-full w-full grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
          </div>
        )}
      </div>
    </div>
  );
}
