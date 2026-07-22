import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useClientStore } from "@/lib/stores/client-store";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Clock,
  Instagram,
  Music2,
  Linkedin,
  Youtube,
  Facebook,
  Filter,
  ListChecks,
  Send,
  Share2,
  Copy,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { createApprovalLink } from "@/lib/approval-links.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: ApprovalsPage,
});

const PLATFORM_ICONS: Record<string, LucideIcon> = {
  instagram: Instagram,
  tiktok: Music2,
  linkedin: Linkedin,
  youtube: Youtube,
  facebook: Facebook,
};
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F",
  tiktok: "#000000",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  facebook: "#1877F2",
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { activeClient } = useClientStore();
  const createLink = useServerFn(createApprovalLink);
  const [filterClient, setFilterClient] = useState<string>("all");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function shareApprovalLink() {
    if (!activeClient) return;
    setShareBusy(true);
    setShareCopied(false);
    try {
      const res = await createLink({
        data: { clientId: activeClient.id, origin: window.location.origin },
      });
      setShareUrl(res.url);
      setShareOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Link maken mislukt");
    } finally {
      setShareBusy(false);
    }
  }

  const { data: clients } = useQuery({
    queryKey: ["clients-min-appr"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color").order("name")).data ?? [],
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["approvals-posts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("scheduled_posts")
        .select("*")
        .eq("status", "draft")
        .order("scheduled_at", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = (posts ?? []).filter((p) =>
    filterClient === "all" ? true : p.client_id === filterClient,
  );

  const clientName = (id: string) => clients?.find((c) => c.id === id)?.name ?? "—";

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  }

  async function approve(postId: string, clientId: string) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "scheduled" })
      .eq("id", postId);
    if (error) return toast.error(error.message);
    await notifyTeam(
      clientId,
      "Post goedgekeurd",
      "Post staat klaar om te publiceren.",
      `/admin/planner?clientId=${clientId}`,
    );
    toast.success("Goedgekeurd");
    qc.invalidateQueries({ queryKey: ["approvals-posts"] });
  }

  async function reject(postId: string, clientId: string) {
    if (!confirm("Post afwijzen en verwijderen?")) return;
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", postId);
    if (error) return toast.error(error.message);
    await notifyTeam(
      clientId,
      "Post afgewezen",
      "Concept is verwijderd.",
      `/admin/planner?clientId=${clientId}`,
    );
    toast.success("Afgewezen");
    qc.invalidateQueries({ queryKey: ["approvals-posts"] });
  }

  async function submitFeedback(postId: string, clientId: string) {
    if (!feedbackText.trim()) return toast.error("Geef feedback mee");
    await notifyTeam(
      clientId,
      "Feedback op concept",
      feedbackText.trim(),
      `/admin/planner?clientId=${clientId}`,
    );
    toast.success("Feedback verzonden");
    setFeedbackFor(null);
    setFeedbackText("");
  }

  async function notifyTeam(clientId: string, title: string, body: string, link: string) {
    const { data: members } = await supabase
      .from("client_members")
      .select("user_id")
      .eq("client_id", clientId);
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const ids = new Set<string>();
    members?.forEach((m: Pick<Tables<"client_members">, "user_id">) => ids.add(m.user_id));
    admins?.forEach((a: Pick<Tables<"user_roles">, "user_id">) => ids.add(a.user_id));
    const rows = Array.from(ids)
      .filter((id) => id !== user?.id)
      .map((uid) => ({ user_id: uid, type: "approval", title, body, link }));
    if (rows.length) await supabase.from("notifications").insert(rows);
  }

  async function bulkApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const targets = (posts ?? []).filter((p) => selected.has(p.id));
    setBulkBusy(true);
    try {
      const { error } = await supabase
        .from("scheduled_posts")
        .update({ status: "scheduled" })
        .in("id", ids);
      if (error) return toast.error(error.message);
      const clientIds = new Set(targets.map((p) => p.client_id));
      await Promise.all(
        Array.from(clientIds).map((clientId) =>
          notifyTeam(
            clientId,
            "Posts goedgekeurd",
            `${targets.filter((p) => p.client_id === clientId).length} post(s) staan klaar om te publiceren.`,
            `/admin/planner?clientId=${clientId}`,
          ),
        ),
      );
      toast.success(`${ids.length} goedgekeurd`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["approvals-posts"] });
      qc.invalidateQueries({ queryKey: ["admin-sidebar-counts"] });
    } finally {
      setBulkBusy(false);
    }
  }

  async function bulkReject() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`${ids.length} post(s) afwijzen en verwijderen?`)) return;
    const targets = (posts ?? []).filter((p) => selected.has(p.id));
    setBulkBusy(true);
    try {
      const { error } = await supabase.from("scheduled_posts").delete().in("id", ids);
      if (error) return toast.error(error.message);
      const clientIds = new Set(targets.map((p) => p.client_id));
      await Promise.all(
        Array.from(clientIds).map((clientId) =>
          notifyTeam(
            clientId,
            "Posts afgewezen",
            `${targets.filter((p) => p.client_id === clientId).length} concept(en) zijn verwijderd.`,
            `/admin/planner?clientId=${clientId}`,
          ),
        ),
      );
      toast.success(`${ids.length} afgewezen`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["approvals-posts"] });
      qc.invalidateQueries({ queryKey: ["admin-sidebar-counts"] });
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">Module 5</div>
          <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1">Goedkeuringen</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Posts die wachten op goedkeuring. Bekijk, keur goed of geef feedback.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gold/70" />
          <select
            value={filterClient}
            onChange={(e) => setFilterClient(e.target.value)}
            className="rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
          >
            <option value="all">Alle klanten</option>
            {clients?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {activeClient && (
            <button
              onClick={shareApprovalLink}
              disabled={shareBusy}
              title={`Deel goedkeurlink voor ${activeClient.name}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-gold px-3 py-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {shareBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Share2 className="h-3.5 w-3.5" />
              )}
              Deel goedkeurlink
            </button>
          )}
          <Link
            to="/admin/tasks"
            className="hidden sm:inline-flex items-center gap-1 text-xs rounded-lg border border-gold/20 px-3 py-2 hover:bg-gold/10"
          >
            <ListChecks className="h-3.5 w-3.5" /> Naar taken
          </Link>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-gold/20 bg-background/95 backdrop-blur px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-gold">{selected.size} geselecteerd</span>
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <button
              onClick={toggleSelectAll}
              disabled={bulkBusy}
              className="min-h-11 inline-flex items-center justify-center rounded-lg border border-gold/20 px-3 py-2 text-xs hover:bg-accent/40 disabled:opacity-60"
            >
              {allFilteredSelected ? "Deselecteer alles" : "Selecteer alles"}
            </button>
            <button
              onClick={bulkApprove}
              disabled={bulkBusy}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 px-3 py-2 text-xs hover:bg-emerald-500/30 disabled:opacity-60"
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Goedkeuren ({selected.size})
            </button>
            <button
              onClick={bulkReject}
              disabled={bulkBusy}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-500/15 text-red-300 px-3 py-2 text-xs hover:bg-red-500/25 disabled:opacity-60"
            >
              {bulkBusy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="h-3.5 w-3.5" />
              )}
              Afwijzen ({selected.size})
            </button>
          </div>
        </div>
      )}

      {/* Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat icon={Clock} label="Wacht op goedkeuring" value={filtered.length} tint="text-gold" />
        <Stat
          icon={CheckCircle2}
          label="Vandaag in te plannen"
          value={
            filtered.filter(
              (p) => new Date(p.scheduled_at).toDateString() === new Date().toDateString(),
            ).length
          }
          tint="text-emerald-400"
        />
        <Stat
          icon={MessageSquare}
          label="Klanten met concepten"
          value={new Set(filtered.map((p) => p.client_id)).size}
        />
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      ) : filtered.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Niets in afwachting. Alles is goedgekeurd.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => {
            const Icon = PLATFORM_ICONS[p.platform];
            const mediaUrl = p.media_path
              ? supabase.storage.from("client-uploads").getPublicUrl(p.media_path).data.publicUrl
              : null;
            return (
              <div key={p.id} className="glass-strong rounded-xl overflow-hidden flex flex-col">
                {mediaUrl ? (
                  p.media_type?.startsWith("video") ? (
                    <video
                      src={mediaUrl}
                      controls
                      className="w-full aspect-square object-cover bg-black"
                    />
                  ) : (
                    <img src={mediaUrl} alt="" className="w-full aspect-square object-cover" />
                  )
                ) : (
                  <div className="w-full aspect-square bg-accent/20 flex items-center justify-center text-muted-foreground text-xs">
                    Geen media
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        aria-label="Selecteer concept"
                        className="h-4 w-4 shrink-0 rounded border-gold/40 accent-gold"
                      />
                      {Icon && (
                        <Icon
                          className="h-3.5 w-3.5"
                          style={{ color: PLATFORM_COLORS[p.platform] }}
                        />
                      )}
                      <span className="capitalize text-muted-foreground">{p.platform}</span>
                    </div>
                    <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5">
                      {clientName(p.client_id)}
                    </span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap line-clamp-4">
                    {p.caption || (
                      <span className="text-muted-foreground italic">Geen caption</span>
                    )}
                  </p>

                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Gepland:{" "}
                    {new Date(p.scheduled_at).toLocaleString("nl-NL", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>

                  {feedbackFor === p.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={feedbackText}
                        onChange={(e) => setFeedbackText(e.target.value)}
                        rows={3}
                        placeholder="Wat moet er anders?"
                        className="w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitFeedback(p.id, p.client_id)}
                          className="flex-1 rounded-lg bg-gold/20 text-gold px-3 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-gold/30"
                        >
                          <Send className="h-3.5 w-3.5" /> Verstuur
                        </button>
                        <button
                          onClick={() => {
                            setFeedbackFor(null);
                            setFeedbackText("");
                          }}
                          className="rounded-lg border border-gold/20 px-3 py-2 text-xs hover:bg-accent/40"
                        >
                          Annuleer
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => approve(p.id, p.client_id)}
                        className="rounded-lg bg-emerald-500/20 text-emerald-300 px-2 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-emerald-500/30"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Keur
                      </button>
                      <button
                        onClick={() => setFeedbackFor(p.id)}
                        className="rounded-lg bg-gold/15 text-gold px-2 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-gold/25"
                      >
                        <MessageSquare className="h-3.5 w-3.5" /> Feedback
                      </button>
                      <button
                        onClick={() => reject(p.id, p.client_id)}
                        className="rounded-lg bg-red-500/15 text-red-300 px-2 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-red-500/25"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Wijs af
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={shareOpen}
        onOpenChange={(open) => {
          setShareOpen(open);
          if (!open) setShareCopied(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display text-gold">Goedkeurlink</DialogTitle>
            <DialogDescription>Klant hoeft niet in te loggen · 14 dagen geldig</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate rounded-lg bg-background/60 border border-gold/20 px-3 py-2.5 text-sm">
              {shareUrl}
            </code>
            <button
              onClick={() => {
                if (!shareUrl) return;
                navigator.clipboard.writeText(shareUrl);
                setShareCopied(true);
                toast.success("Link gekopieerd");
              }}
              className="shrink-0 min-h-11 min-w-11 rounded-lg border border-gold/20 inline-flex items-center justify-center hover:bg-gold/10"
              title="Kopieer link"
            >
              {shareCopied ? (
                <Check className="h-4 w-4 text-emerald-400" />
              ) : (
                <Copy className="h-4 w-4 text-gold" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stuur deze link naar je klant (WhatsApp, e-mail, …). Ze kunnen er direct concepten mee
            goedkeuren of een wijziging aanvragen, zonder in te loggen.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tint?: string;
}) {
  return (
    <div className="glass-strong rounded-xl p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tint ?? "text-gold")} /> {label}
      </div>
      <div className={cn("mt-2 text-2xl font-display", tint ?? "text-foreground")}>{value}</div>
    </div>
  );
}
