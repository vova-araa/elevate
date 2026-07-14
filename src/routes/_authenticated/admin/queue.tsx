import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { DAY_LABELS, DAY_LABELS_LONG } from "@/lib/social-constants";
import { Loader2, Plus, X, Layers, Upload, Download, Sparkles, Clock, Calendar } from "lucide-react";

const searchSchema = z.object({ clientId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/admin/queue")({
  validateSearch: searchSchema,
  component: QueuePage,
});

type Platform = "instagram" | "tiktok" | "linkedin" | "youtube" | "facebook";
const PLATFORMS: Platform[] = ["instagram", "tiktok", "linkedin", "youtube", "facebook"];

function QueuePage() {
  const { clientId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: clients } = useQuery({
    queryKey: ["queue-clients"],
    queryFn: async () => (await supabase.from("clients").select("id,name").order("name")).data ?? [],
  });
  const selected = clients?.find((c) => c.id === clientId) ?? clients?.[0];
  const activeId = selected?.id;

  if (!clientId && activeId) {
    navigate({ to: "/admin/queue", search: { clientId: activeId }, replace: true });
  }

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;
  if (clients.length === 0) {
    return <div className="glass-strong rounded-2xl p-10 text-center text-muted-foreground">Maak eerst een klant aan.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Slim plannen</p>
          <h1 className="font-display text-5xl mt-2">Queue & bulk</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Stel vaste tijdslots in, voeg posts toe aan de wachtrij, of upload meerdere posts in één keer via CSV.
          </p>
        </div>
        <select value={activeId ?? ""} onChange={(e) => navigate({ to: "/admin/queue", search: { clientId: e.target.value } })}
          className="rounded-full bg-input/60 hairline px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {activeId && (
        <div className="grid lg:grid-cols-2 gap-6">
          <SlotsManager clientId={activeId} />
          <QueuedDrafts clientId={activeId} qc={qc} />
        </div>
      )}

      {activeId && <BulkUpload clientId={activeId} userId={user?.id} qc={qc} />}
    </div>
  );
}

function SlotsManager({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [day, setDay] = useState(1);
  const [time, setTime] = useState("10:00");
  const [platform, setPlatform] = useState<Platform>("instagram");

  const { data: slots } = useQuery({
    queryKey: ["queue-slots", clientId],
    queryFn: async () => (await supabase.from("queue_slots").select("*").eq("client_id", clientId).order("day_of_week").order("time_of_day")).data ?? [],
  });

  async function addSlot() {
    const { error } = await supabase.from("queue_slots").insert({ client_id: clientId, day_of_week: day, time_of_day: time + ":00", platform } as any);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["queue-slots", clientId] });
    toast.success("Slot toegevoegd");
  }
  async function removeSlot(id: string) {
    const { error } = await supabase.from("queue_slots").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["queue-slots", clientId] });
  }

  const byDay = new Array(7).fill(0).map((_, i) => (slots ?? []).filter((s: any) => s.day_of_week === i));

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-gold" />
        <h2 className="font-display text-xl">Vaste tijdslots</h2>
      </div>
      <p className="text-xs text-muted-foreground">Posts in de wachtrij worden automatisch over deze slots verdeeld.</p>

      <div className="flex flex-wrap items-end gap-2">
        <select value={day} onChange={(e) => setDay(+e.target.value)} className="rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm">
          {DAY_LABELS_LONG.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm" />
        <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)} className="rounded-lg bg-input/60 hairline px-2 py-1.5 text-sm">
          {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <button onClick={addSlot} className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-sm inline-flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Slot
        </button>
      </div>

      <div className="space-y-2">
        {byDay.map((day, i) => (
          <div key={i} className="border-t border-border/30 pt-2">
            <div className="text-xs text-gold/80 uppercase tracking-wider">{DAY_LABELS_LONG[i]}</div>
            {day.length === 0 ? (
              <div className="text-xs text-muted-foreground italic">Geen slots</div>
            ) : (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {day.map((s: any) => (
                  <span key={s.id} className="text-xs rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 inline-flex items-center gap-1.5">
                    {s.time_of_day.slice(0, 5)} · {s.platform}
                    <button onClick={() => removeSlot(s.id)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QueuedDrafts({ clientId, qc }: { clientId: string; qc: any }) {
  const { data: queued } = useQuery({
    queryKey: ["queue-drafts", clientId],
    queryFn: async () => (await supabase.from("scheduled_posts")
      .select("*").eq("client_id", clientId).eq("is_queued", true).is("deleted_at", null)
      .order("created_at")).data ?? [],
  });
  const { data: slots } = useQuery({
    queryKey: ["queue-slots", clientId],
    queryFn: async () => (await supabase.from("queue_slots").select("*").eq("client_id", clientId).order("day_of_week").order("time_of_day")).data ?? [],
  });

  async function distribute() {
    if (!slots || slots.length === 0) return toast.error("Voeg eerst tijdslots toe");
    if (!queued || queued.length === 0) return toast.error("Geen posts in de wachtrij");

    // Get existing scheduled (non-queued) posts to avoid conflicts
    const { data: existing } = await supabase.from("scheduled_posts").select("scheduled_at")
      .eq("client_id", clientId).is("deleted_at", null).gte("scheduled_at", new Date().toISOString());
    const taken = new Set((existing ?? []).map((p: any) => new Date(p.scheduled_at).toISOString()));

    // Find next free slot for each queued post matching platform
    const updates: { id: string; scheduled_at: string }[] = [];
    const now = new Date();
    for (const post of queued) {
      const matchSlots = slots.filter((s: any) => s.platform === post.platform);
      if (matchSlots.length === 0) continue;
      let cursor = new Date(now);
      let found: Date | null = null;
      for (let d = 0; d < 60 && !found; d++) {
        for (const s of matchSlots) {
          if ((cursor.getDay() === s.day_of_week)) {
            const [h, m] = s.time_of_day.split(":");
            const slot = new Date(cursor);
            slot.setHours(+h, +m, 0, 0);
            if (slot > now && !taken.has(slot.toISOString())) { found = slot; break; }
          }
        }
        if (!found) { cursor.setDate(cursor.getDate() + 1); cursor.setHours(0,0,0,0); }
      }
      if (found) {
        updates.push({ id: post.id, scheduled_at: found.toISOString() });
        taken.add(found.toISOString());
      }
    }

    for (const u of updates) {
      await supabase.from("scheduled_posts").update({ scheduled_at: u.scheduled_at, is_queued: false }).eq("id", u.id);
    }
    toast.success(`${updates.length} posts ingepland`);
    qc.invalidateQueries({ queryKey: ["queue-drafts", clientId] });
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }

  async function removeFromQueue(id: string) {
    await supabase.from("scheduled_posts").update({ is_queued: false }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["queue-drafts", clientId] });
  }

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-gold" />
          <h2 className="font-display text-xl">Wachtrij</h2>
        </div>
        <button onClick={distribute} disabled={!queued?.length}
          className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
          <Sparkles className="h-3 w-3" /> Verdeel over slots
        </button>
      </div>
      <p className="text-xs text-muted-foreground">{queued?.length ?? 0} posts wachten. Klik "Verdeel" om ze automatisch in te plannen.</p>
      <div className="space-y-2 max-h-96 overflow-y-auto scrollbar-thin">
        {queued?.map((p: any) => (
          <div key={p.id} className="glass rounded-lg p-3 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gold">{p.platform}</div>
              <p className="text-sm line-clamp-2 mt-0.5">{p.caption || <em className="text-muted-foreground">Geen caption</em>}</p>
            </div>
            <button onClick={() => removeFromQueue(p.id)} className="text-xs text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {queued?.length === 0 && <div className="text-sm text-muted-foreground italic text-center py-4">Wachtrij is leeg</div>}
      </div>
    </div>
  );
}

function BulkUpload({ clientId, userId, qc }: { clientId: string; userId?: string; qc: any }) {
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"queue" | "schedule">("queue");
  const fileRef = useRef<HTMLInputElement>(null);

  function downloadTemplate() {
    const csv = "platform,caption,scheduled_at\ninstagram,\"Hello world!\",2026-06-10T10:00\ntiktok,\"Quick tip 👋\",\nlinkedin,\"Insightful post\",2026-06-12T08:30\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "bulk-posts-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines[0].split(",").map((h) => h.trim());
      const pIdx = header.indexOf("platform");
      const cIdx = header.indexOf("caption");
      const sIdx = header.indexOf("scheduled_at");
      if (pIdx < 0 || cIdx < 0) throw new Error("CSV moet kolommen 'platform' en 'caption' bevatten");

      const rows: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = parseCsvLine(lines[i]);
        if (parts.length === 0) continue;
        const platform = parts[pIdx]?.trim();
        const caption = parts[cIdx]?.trim() || null;
        const sched = sIdx >= 0 ? parts[sIdx]?.trim() : "";
        if (!platform) continue;
        rows.push({
          client_id: clientId,
          platform,
          caption,
          scheduled_at: sched ? new Date(sched).toISOString() : new Date(Date.now() + 86400000).toISOString(),
          status: "draft",
          is_queued: mode === "queue" || !sched,
          created_by: userId ?? null,
        });
      }
      if (rows.length === 0) throw new Error("Geen rijen gevonden");
      const { error } = await supabase.from("scheduled_posts").insert(rows as any);
      if (error) throw error;
      toast.success(`${rows.length} posts geïmporteerd`);
      qc.invalidateQueries({ queryKey: ["queue-drafts", clientId] });
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="glass-strong rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-gold" />
        <h2 className="font-display text-xl">Bulk upload via CSV</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Upload tientallen posts in één keer. Kolommen: <code className="text-gold">platform</code>, <code className="text-gold">caption</code>, <code className="text-gold">scheduled_at</code> (optioneel).
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full glass p-1 text-xs">
          <button onClick={() => setMode("queue")} className={`rounded-full px-3 py-1 ${mode === "queue" ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}>
            Naar wachtrij
          </button>
          <button onClick={() => setMode("schedule")} className={`rounded-full px-3 py-1 ${mode === "schedule" ? "bg-gold/15 text-gold" : "text-muted-foreground"}`}>
            Direct inplannen
          </button>
        </div>
        <button onClick={downloadTemplate} className="rounded-full glass px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:bg-gold/10">
          <Download className="h-3 w-3" /> Template
        </button>
        <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-xs inline-flex items-center gap-1.5">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          Kies CSV bestand
        </button>
      </div>
    </div>
  );
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
    else if (c === '"') inQ = !inQ;
    else if (c === "," && !inQ) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
