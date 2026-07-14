import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, MessageSquare, Loader2, Clock, Instagram,
  Music2, Linkedin, Youtube, Facebook, Filter, ListChecks, Send,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/approvals")({
  component: ApprovalsPage,
});

const PLATFORM_ICONS: Record<string, any> = {
  instagram: Instagram, tiktok: Music2, linkedin: Linkedin, youtube: Youtube, facebook: Facebook,
};
const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E4405F", tiktok: "#000000", linkedin: "#0A66C2", youtube: "#FF0000", facebook: "#1877F2",
};

function ApprovalsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [filterClient, setFilterClient] = useState<string>("all");
  const [feedbackFor, setFeedbackFor] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-min-appr"],
    queryFn: async () => (await supabase.from("clients").select("id,name,brand_color").order("name")).data ?? [],
  });

  const { data: posts, isLoading } = useQuery({
    queryKey: ["approvals-posts"],
    queryFn: async () => {
      const { data } = await supabase.from("scheduled_posts")
        .select("*").eq("status", "draft").order("scheduled_at", { ascending: true });
      return data ?? [];
    },
  });

  const filtered = (posts ?? []).filter((p) =>
    filterClient === "all" ? true : p.client_id === filterClient
  );

  const clientName = (id: string) => clients?.find((c) => c.id === id)?.name ?? "—";

  async function approve(postId: string, clientId: string) {
    const { error } = await supabase.from("scheduled_posts")
      .update({ status: "scheduled" }).eq("id", postId);
    if (error) return toast.error(error.message);
    await notifyTeam(clientId, "Post goedgekeurd", "Post staat klaar om te publiceren.", `/admin/planner?clientId=${clientId}`);
    toast.success("Goedgekeurd");
    qc.invalidateQueries({ queryKey: ["approvals-posts"] });
  }

  async function reject(postId: string, clientId: string) {
    if (!confirm("Post afwijzen en verwijderen?")) return;
    const { error } = await supabase.from("scheduled_posts").delete().eq("id", postId);
    if (error) return toast.error(error.message);
    await notifyTeam(clientId, "Post afgewezen", "Concept is verwijderd.", `/admin/planner?clientId=${clientId}`);
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
    setFeedbackFor(null); setFeedbackText("");
  }

  async function notifyTeam(clientId: string, title: string, body: string, link: string) {
    const { data: members } = await supabase.from("client_members").select("user_id").eq("client_id", clientId);
    const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const ids = new Set<string>();
    members?.forEach((m: any) => ids.add(m.user_id));
    admins?.forEach((a: any) => ids.add(a.user_id));
    const rows = Array.from(ids)
      .filter((id) => id !== user?.id)
      .map((uid) => ({ user_id: uid, type: "approval", title, body, link }));
    if (rows.length) await supabase.from("notifications").insert(rows);
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
          <select value={filterClient} onChange={(e) => setFilterClient(e.target.value)}
            className="rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm">
            <option value="all">Alle klanten</option>
            {clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Link to="/admin/tasks" className="hidden sm:inline-flex items-center gap-1 text-xs rounded-lg border border-gold/20 px-3 py-2 hover:bg-gold/10">
            <ListChecks className="h-3.5 w-3.5" /> Naar taken
          </Link>
        </div>
      </div>

      {/* Counter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat icon={Clock} label="Wacht op goedkeuring" value={filtered.length} tint="text-gold" />
        <Stat icon={CheckCircle2} label="Vandaag in te plannen"
          value={filtered.filter((p) => new Date(p.scheduled_at).toDateString() === new Date().toDateString()).length}
          tint="text-emerald-400" />
        <Stat icon={MessageSquare} label="Klanten met concepten"
          value={new Set(filtered.map((p) => p.client_id)).size} />
      </div>

      {isLoading ? (
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      ) : filtered.length === 0 ? (
        <div className="glass-strong rounded-xl p-12 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Niets in afwachting. Alles goedgekeurd 🎉</p>
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
                    <video src={mediaUrl} controls className="w-full aspect-square object-cover bg-black" />
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
                      {Icon && <Icon className="h-3.5 w-3.5" style={{ color: PLATFORM_COLORS[p.platform] }} />}
                      <span className="capitalize text-muted-foreground">{p.platform}</span>
                    </div>
                    <span className="rounded-full bg-gold/15 text-gold px-2 py-0.5">{clientName(p.client_id)}</span>
                  </div>

                  <p className="text-sm whitespace-pre-wrap line-clamp-4">{p.caption || <span className="text-muted-foreground italic">Geen caption</span>}</p>

                  <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Gepland: {new Date(p.scheduled_at).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" })}
                  </div>

                  {feedbackFor === p.id ? (
                    <div className="space-y-2">
                      <textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)}
                        rows={3} placeholder="Wat moet er anders?"
                        className="w-full rounded-lg border border-gold/20 bg-background/60 px-3 py-2 text-sm" />
                      <div className="flex gap-2">
                        <button onClick={() => submitFeedback(p.id, p.client_id)}
                          className="flex-1 rounded-lg bg-gold/20 text-gold px-3 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-gold/30">
                          <Send className="h-3.5 w-3.5" /> Verstuur
                        </button>
                        <button onClick={() => { setFeedbackFor(null); setFeedbackText(""); }}
                          className="rounded-lg border border-gold/20 px-3 py-2 text-xs hover:bg-accent/40">Annuleer</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-auto grid grid-cols-3 gap-1.5">
                      <button onClick={() => approve(p.id, p.client_id)}
                        className="rounded-lg bg-emerald-500/20 text-emerald-300 px-2 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Keur
                      </button>
                      <button onClick={() => setFeedbackFor(p.id)}
                        className="rounded-lg bg-gold/15 text-gold px-2 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-gold/25">
                        <MessageSquare className="h-3.5 w-3.5" /> Feedback
                      </button>
                      <button onClick={() => reject(p.id, p.client_id)}
                        className="rounded-lg bg-red-500/15 text-red-300 px-2 py-2 text-xs inline-flex items-center justify-center gap-1 hover:bg-red-500/25">
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
    </div>
  );
}

function Stat({ icon: Icon, label, value, tint }: any) {
  return (
    <div className="glass-strong rounded-xl p-4">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className={cn("h-3.5 w-3.5", tint ?? "text-gold")} /> {label}
      </div>
      <div className={cn("mt-2 text-2xl font-display", tint ?? "text-foreground")}>{value}</div>
    </div>
  );
}
