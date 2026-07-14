import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Plus, Trash2, Compass, Calendar, Upload, ListChecks, MessageSquare,
  Briefcase, FileText, Lightbulb, Sparkles, Star, Pin, ExternalLink, Globe, Download, Activity, Pencil,
  Instagram, Music2, Linkedin, Youtube, Facebook, Link2, CheckCircle2, X, ArrowRight, Circle,
} from "lucide-react";
import { exportReportPdf, exportAllReportsPdf } from "@/lib/report-pdf";
import { MessagesThread } from "@/components/messages-thread";
import { ClientTimeline } from "@/components/client-timeline";
import { InstagramScheduler } from "@/components/instagram-scheduler";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/clients/$id")({
  component: ClientDetail,
});

type TabKey =
  | "overview" | "messages" | "meetings" | "reports" | "strategy"
  | "content" | "roadmap" | "calendar" | "uploads" | "tasks" | "socials";

type TabItem = { k: TabKey; label: string; icon: any };
const TAB_GROUPS: { group: string; items: TabItem[] }[] = [
  {
    group: "Algemeen",
    items: [
      { k: "overview", label: "Overzicht", icon: Sparkles },
      { k: "meetings", label: "Call inplannen", icon: Calendar },
    ],
  },
  {
    group: "Communicatie",
    items: [
      { k: "messages", label: "Berichten", icon: MessageSquare },
      { k: "calendar", label: "Kalender", icon: Calendar },
      { k: "socials", label: "Socials", icon: Link2 },
    ],
  },
  {
    group: "Sales",
    items: [
      { k: "reports", label: "Rapportages", icon: FileText },
    ],
  },
  {
    group: "Strategie & Content",
    items: [
      { k: "strategy", label: "Strategie", icon: Lightbulb },
      { k: "content", label: "Content", icon: Sparkles },
      { k: "roadmap", label: "Stappenplan", icon: Compass },
    ],
  },
  {
    group: "Werk",
    items: [
      { k: "tasks", label: "Taken", icon: ListChecks },
      { k: "uploads", label: "Uploads", icon: Upload },
    ],
  },
];
const ALL_TABS: TabItem[] = TAB_GROUPS.flatMap((g) => g.items);


function ClientDetail() {
  const { id } = useParams({ from: "/_authenticated/admin/clients/$id" });
  const [tab, setTab] = useState<TabKey>("overview");
  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*").eq("id", id).single()).data,
  });

  if (!client) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        {client.logo_url ? (
          <img src={client.logo_url} alt={client.name}
            className="h-16 w-16 rounded-full object-cover border border-gold/20" />
        ) : (
          <div className="h-16 w-16 rounded-full flex items-center justify-center font-display text-3xl text-primary-foreground"
            style={{ background: client.brand_color || "var(--gradient-gold)" }}>
            {client.name?.[0]?.toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">{client.industry || "Klant"}</p>
          <h1 className="font-display text-4xl truncate">{client.name}</h1>
        </div>
        {client.website && (
          <a href={client.website} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full hairline px-4 py-2 text-sm text-gold hover:bg-gold/10">
            <Globe className="h-4 w-4" /> Website <ExternalLink className="h-3 w-3" />
          </a>
        )}
        <Link to="/admin/clients/intake" search={{ clientId: id }}
          className="inline-flex items-center gap-2 rounded-full hairline px-4 py-2 text-sm text-gold hover:bg-gold/10">
          <Sparkles className="h-4 w-4" /> Intake
        </Link>
        <Link to="/admin/clients/$id/edit" params={{ id }}
          className="inline-flex items-center gap-2 rounded-full hairline px-4 py-2 text-sm text-gold hover:bg-gold/10">
          <Pencil className="h-4 w-4" /> Bewerken
        </Link>
      </div>

      <div className="flex gap-1 border-b border-gold/15 overflow-x-auto scrollbar-thin">
        {ALL_TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={cn(
              "shrink-0 inline-flex items-center gap-2 px-4 py-2.5 text-sm transition",
              tab === t.k ? "text-gold border-b-2 border-gold" : "text-muted-foreground hover:text-foreground",
            )}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <Overview client={client} />}
      {tab === "messages" && <MessagesThread clientId={id} clientName={client.name} asRole="admin" />}
      {tab === "meetings" && <MeetingsPanel clientId={id} />}
      {tab === "reports" && <ReportsPanel clientId={id} clientName={client.name} />}
      {tab === "strategy" && <StrategyPanel clientId={id} />}
      {tab === "content" && <ContentPanel clientId={id} />}
      {tab === "roadmap" && <RoadmapAdmin clientId={id} />}
      {tab === "calendar" && <CalendarAdmin clientId={id} />}
      {tab === "uploads" && <UploadsView clientId={id} />}
      {tab === "tasks" && <TasksView clientId={id} admin />}
      {tab === "socials" && <SocialsPanel client={client} />}
    </div>
  );
}

/* ───── Overview met KPI's ───── */

function Overview({ client }: { client: any }) {
  const { data: stats } = useQuery({
    queryKey: ["client-stats", client.id],
    queryFn: async () => {
      const [m, d, r, t, u, c, e, s] = await Promise.all([
        supabase.from("meetings").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("deals").select("value_cents,stage").eq("client_id", client.id),
        supabase.from("reports").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("tasks").select("status").eq("client_id", client.id),
        supabase.from("uploads").select("id", { count: "exact", head: true }).eq("client_id", client.id),
        supabase.from("content_items").select("status").eq("client_id", client.id),
        supabase.from("evaluations").select("score").eq("client_id", client.id),
        supabase.from("strategy_notes").select("id", { count: "exact", head: true }).eq("client_id", client.id),
      ]);
      const openTasks = (t.data ?? []).filter((x: any) => x.status !== "done").length;
      const wonDeals = (d.data ?? []).filter((x: any) => x.stage === "won");
      const pipeline = (d.data ?? []).filter((x: any) => !["won", "lost"].includes(x.stage));
      const wonValue = wonDeals.reduce((acc: number, x: any) => acc + (x.value_cents ?? 0), 0) / 100;
      const pipeValue = pipeline.reduce((acc: number, x: any) => acc + (x.value_cents ?? 0), 0) / 100;
      const lastScore = (e.data ?? []).slice(-1)[0]?.score ?? null;
      const liveContent = (c.data ?? []).filter((x: any) => x.status === "scheduled" || x.status === "published").length;
      return {
        meetings: m.count ?? 0, reports: r.count ?? 0, uploads: u.count ?? 0,
        strategy: s.count ?? 0, openTasks, wonValue, pipeValue, lastScore, liveContent,
      };
    },
  });

  const cards = [
    { label: "Gesprekken", value: stats?.meetings ?? "—" },
    { label: "Open taken", value: stats?.openTasks ?? "—" },
    { label: "Pipeline", value: stats ? `€ ${stats.pipeValue.toLocaleString("nl-NL")}` : "—" },
    { label: "Gewonnen", value: stats ? `€ ${stats.wonValue.toLocaleString("nl-NL")}` : "—" },
    { label: "Rapportages", value: stats?.reports ?? "—" },
    { label: "Content live", value: stats?.liveContent ?? "—" },
    { label: "Uploads", value: stats?.uploads ?? "—" },
    { label: "Laatste score", value: stats?.lastScore ?? "—" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold/70">{c.label}</div>
            <div className="font-display text-3xl mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-2xl">Over het merk</h3>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{client.description || "Nog geen omschrijving."}</p>
        </div>
        <div className="glass rounded-2xl p-6">
          <h3 className="font-display text-2xl">Interne notities</h3>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{client.notes || "—"}</p>
        </div>
      </div>
    </div>
  );
}

/* ───── Helpers ───── */

const inp = "rounded-lg bg-input/60 hairline px-3 py-2 text-sm w-full";
const btnGold = "rounded-lg bg-gradient-gold px-4 py-2 text-sm font-medium text-primary-foreground";

function SectionForm({ children, onSubmit, title }: { children: React.ReactNode; onSubmit: () => void; title: string }) {
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="glass-strong rounded-2xl p-5 space-y-3"
    >
      <div className="text-xs uppercase tracking-[0.2em] text-gold/80">{title}</div>
      {children}
    </form>
  );
}

/* ───── Meetings ───── */

function MeetingsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["meetings", clientId],
    queryFn: async () => (await supabase.from("meetings").select("*").eq("client_id", clientId).order("scheduled_at", { ascending: false })).data ?? [],
  });
  const empty = { title: "", meeting_type: "strategy" as const, scheduled_at: "", duration_min: 60, location: "", attendees: "", summary: "", action_items: "" };
  const [f, setF] = useState(empty);

  async function add() {
    if (!f.title || !f.scheduled_at) return toast.error("Titel en datum vereist");
    const { error } = await supabase.from("meetings").insert({ client_id: clientId, ...f });
    if (error) return toast.error(error.message);
    setF(empty); qc.invalidateQueries({ queryKey: ["meetings", clientId] });
    toast.success("Gesprek toegevoegd");
  }
  async function del(id: string) {
    await supabase.from("meetings").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["meetings", clientId] });
  }

  return (
    <div className="space-y-5">
      <SectionForm title="Nieuw gesprek" onSubmit={add}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className={inp} placeholder="Titel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className={inp} value={f.meeting_type} onChange={(e) => setF({ ...f, meeting_type: e.target.value as any })}>
            <option value="intake">Intake</option><option value="strategy">Strategie</option><option value="review">Review</option>
            <option value="presentation">Presentatie</option><option value="call">Call</option><option value="other">Anders</option>
          </select>
          <input type="datetime-local" className={inp} value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
          <input type="number" className={inp} placeholder="Duur (min)" value={f.duration_min} onChange={(e) => setF({ ...f, duration_min: Number(e.target.value) })} />
          <input className={inp} placeholder="Locatie / link" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} />
          <input className={inp} placeholder="Aanwezigen" value={f.attendees} onChange={(e) => setF({ ...f, attendees: e.target.value })} />
        </div>
        <textarea className={inp + " min-h-20"} placeholder="Samenvatting" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        <textarea className={inp + " min-h-16"} placeholder="Actiepunten" value={f.action_items} onChange={(e) => setF({ ...f, action_items: e.target.value })} />
        <button className={btnGold}>Opslaan</button>
      </SectionForm>
      <div className="space-y-3">
        {data?.map((m: any) => (
          <div key={m.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-display text-xl">{m.title}</div>
                <div className="text-xs text-gold/80 uppercase tracking-wider mt-1">
                  {m.meeting_type} · {new Date(m.scheduled_at).toLocaleString("nl-NL")} · {m.duration_min} min
                </div>
                {m.location && <div className="text-xs text-muted-foreground mt-1">📍 {m.location}</div>}
                {m.attendees && <div className="text-xs text-muted-foreground mt-1">👥 {m.attendees}</div>}
              </div>
              <button onClick={() => del(m.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </div>
            {m.summary && <p className="mt-3 text-sm whitespace-pre-wrap">{m.summary}</p>}
            {m.action_items && (
              <div className="mt-3 rounded-lg bg-gold/10 p-3">
                <div className="text-[10px] uppercase tracking-wider text-gold mb-1">Actiepunten</div>
                <p className="text-sm whitespace-pre-wrap">{m.action_items}</p>
              </div>
            )}
          </div>
        ))}
        {!data?.length && <Empty text="Nog geen gesprekken vastgelegd." />}
      </div>
    </div>
  );
}

/* ───── Deals ───── */

const DEAL_STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const STAGE_LABELS: Record<string, string> = { lead: "Lead", qualified: "Gekwalificeerd", proposal: "Voorstel", negotiation: "Onderhandeling", won: "Gewonnen", lost: "Verloren" };

function DealsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["deals", clientId],
    queryFn: async () => (await supabase.from("deals").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const empty = { title: "", stage: "lead" as const, value_cents: 0, probability: 50, expected_close_date: "", description: "" };
  const [f, setF] = useState(empty);

  async function add() {
    if (!f.title) return;
    await supabase.from("deals").insert({ client_id: clientId, ...f, expected_close_date: f.expected_close_date || null });
    setF(empty); qc.invalidateQueries({ queryKey: ["deals", clientId] });
  }
  async function setStage(id: string, stage: typeof DEAL_STAGES[number]) {
    await supabase.from("deals").update({ stage, closed_at: ["won", "lost"].includes(stage) ? new Date().toISOString() : null }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["deals", clientId] });
  }
  async function del(id: string) {
    await supabase.from("deals").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["deals", clientId] });
  }

  const totalPipe = (data ?? []).filter((d: any) => !["won", "lost"].includes(d.stage)).reduce((a: number, d: any) => a + (d.value_cents ?? 0), 0) / 100;
  const totalWon = (data ?? []).filter((d: any) => d.stage === "won").reduce((a: number, d: any) => a + (d.value_cents ?? 0), 0) / 100;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold/70">Pipeline waarde</div>
          <div className="font-display text-3xl mt-1">€ {totalPipe.toLocaleString("nl-NL")}</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-gold/70">Gewonnen</div>
          <div className="font-display text-3xl mt-1">€ {totalWon.toLocaleString("nl-NL")}</div>
        </div>
      </div>
      <SectionForm title="Nieuwe deal" onSubmit={add}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className={inp} placeholder="Titel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className={inp} value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as any })}>
            {DEAL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
          <input type="number" className={inp} placeholder="Waarde (€)" value={f.value_cents / 100 || ""} onChange={(e) => setF({ ...f, value_cents: Math.round(Number(e.target.value) * 100) })} />
          <input type="number" min={0} max={100} className={inp} placeholder="Kans (%)" value={f.probability} onChange={(e) => setF({ ...f, probability: Number(e.target.value) })} />
          <input type="date" className={inp} value={f.expected_close_date} onChange={(e) => setF({ ...f, expected_close_date: e.target.value })} />
        </div>
        <textarea className={inp + " min-h-16"} placeholder="Omschrijving" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <button className={btnGold}>Deal toevoegen</button>
      </SectionForm>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {DEAL_STAGES.map((stage) => (
          <div key={stage} className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gold mb-2">{STAGE_LABELS[stage]}</div>
            <div className="space-y-2">
              {data?.filter((d: any) => d.stage === stage).map((d: any) => (
                <div key={d.id} className="rounded-lg bg-surface-elevated/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{d.title}</div>
                      <div className="text-xs text-gold mt-0.5">€ {((d.value_cents ?? 0) / 100).toLocaleString("nl-NL")} · {d.probability}%</div>
                      {d.expected_close_date && <div className="text-[10px] text-muted-foreground mt-0.5">Sluit {new Date(d.expected_close_date).toLocaleDateString("nl-NL")}</div>}
                    </div>
                    <button onClick={() => del(d.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <select value={d.stage} onChange={(e) => setStage(d.id, e.target.value as any)} className="mt-2 w-full text-[10px] rounded bg-gold/10 px-2 py-1 text-gold">
                    {DEAL_STAGES.map((s) => <option key={s} value={s}>→ {STAGE_LABELS[s]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Reports ───── */

function ReportsPanel({ clientId, clientName }: { clientId: string; clientName: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["reports", clientId],
    queryFn: async () => (await supabase.from("reports").select("*").eq("client_id", clientId).order("period_end", { ascending: false, nullsFirst: false })).data ?? [],
  });
  const empty = { title: "", report_type: "monthly" as const, period_start: "", period_end: "", summary: "", highlights: "" };
  const [f, setF] = useState(empty);
  async function add() {
    if (!f.title) return;
    await supabase.from("reports").insert({
      client_id: clientId, ...f,
      period_start: f.period_start || null, period_end: f.period_end || null,
    });
    setF(empty); qc.invalidateQueries({ queryKey: ["reports", clientId] });
  }
  async function del(id: string) { await supabase.from("reports").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["reports", clientId] }); }
  function exportOne(r: any) {
    exportReportPdf(clientName, r);
    toast.success("PDF gedownload");
  }
  function exportAll() {
    if (!data?.length) return;
    exportAllReportsPdf(clientName, data as any);
    toast.success("PDF met alle rapportages gedownload");
  }
  return (
    <div className="space-y-5">
      <SectionForm title="Nieuwe rapportage" onSubmit={add}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className={inp} placeholder="Titel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className={inp} value={f.report_type} onChange={(e) => setF({ ...f, report_type: e.target.value as any })}>
            <option value="monthly">Maandelijks</option><option value="campaign">Campagne</option>
            <option value="analytics">Analytics</option><option value="audit">Audit</option><option value="other">Anders</option>
          </select>
          <input type="date" className={inp} value={f.period_start} onChange={(e) => setF({ ...f, period_start: e.target.value })} />
          <input type="date" className={inp} value={f.period_end} onChange={(e) => setF({ ...f, period_end: e.target.value })} />
        </div>
        <textarea className={inp + " min-h-20"} placeholder="Samenvatting" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
        <textarea className={inp + " min-h-16"} placeholder="Highlights" value={f.highlights} onChange={(e) => setF({ ...f, highlights: e.target.value })} />
        <button className={btnGold}>Opslaan</button>
      </SectionForm>
      {!!data?.length && (
        <div className="flex justify-end">
          <button onClick={exportAll} className="inline-flex items-center gap-2 rounded-full hairline px-4 py-2 text-sm text-gold hover:bg-gold/10">
            <Download className="h-4 w-4" /> Exporteer alle als PDF
          </button>
        </div>
      )}
      <div className="space-y-3">
        {data?.map((r: any) => (
          <div key={r.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-gold/80">{r.report_type}</div>
                <div className="font-display text-xl">{r.title}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {r.period_start ? new Date(r.period_start).toLocaleDateString("nl-NL") : "—"}
                  {" → "}
                  {r.period_end ? new Date(r.period_end).toLocaleDateString("nl-NL") : "—"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => exportOne(r)} title="Exporteer als PDF"
                  className="inline-flex items-center gap-1.5 rounded-full hairline px-3 py-1.5 text-xs text-gold hover:bg-gold/10">
                  <Download className="h-3.5 w-3.5" /> PDF
                </button>
                <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            {r.summary && <p className="mt-3 text-sm whitespace-pre-wrap">{r.summary}</p>}
            {r.highlights && <div className="mt-3 rounded-lg bg-gold/10 p-3 text-sm whitespace-pre-wrap">{r.highlights}</div>}
          </div>
        ))}
        {!data?.length && <Empty text="Nog geen rapportages." />}
      </div>
    </div>
  );
}

/* ───── Strategy ───── */

function StrategyPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["strategy", clientId],
    queryFn: async () => (await supabase.from("strategy_notes").select("*").eq("client_id", clientId).order("pinned", { ascending: false }).order("updated_at", { ascending: false })).data ?? [],
  });
  const empty = { title: "", category: "positioning", body: "", pinned: false };
  const [f, setF] = useState(empty);
  async function add() {
    if (!f.title) return;
    await supabase.from("strategy_notes").insert({ client_id: clientId, ...f });
    setF(empty); qc.invalidateQueries({ queryKey: ["strategy", clientId] });
  }
  async function togglePin(id: string, pinned: boolean) {
    await supabase.from("strategy_notes").update({ pinned: !pinned }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["strategy", clientId] });
  }
  async function del(id: string) { await supabase.from("strategy_notes").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["strategy", clientId] }); }
  return (
    <div className="space-y-5">
      <SectionForm title="Nieuwe strategie-notitie" onSubmit={add}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className={inp} placeholder="Titel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className={inp} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="positioning">Positionering</option><option value="audience">Doelgroep</option>
            <option value="brand">Brand</option><option value="campaign">Campagne</option>
            <option value="competitor">Concurrent</option><option value="general">Algemeen</option>
          </select>
        </div>
        <textarea className={inp + " min-h-24"} placeholder="Notitie" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={f.pinned} onChange={(e) => setF({ ...f, pinned: e.target.checked })} /> Vastpinnen
        </label>
        <button className={btnGold}>Opslaan</button>
      </SectionForm>
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((n: any) => (
          <div key={n.id} className={cn("glass rounded-2xl p-5", n.pinned && "gold-ring")}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-gold">{n.category}</div>
                <div className="font-display text-lg">{n.title}</div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => togglePin(n.id, n.pinned)} className={cn("p-1.5 rounded hover:bg-gold/10", n.pinned ? "text-gold" : "text-muted-foreground")}><Pin className="h-3.5 w-3.5" /></button>
                <button onClick={() => del(n.id)} className="p-1.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{n.body}</p>
          </div>
        ))}
        {!data?.length && <Empty text="Nog geen strategie-notities." />}
      </div>
    </div>
  );
}

/* ───── Content ───── */

const CONTENT_STATUS = ["idea", "draft", "approved", "scheduled", "published", "archived"] as const;
const STATUS_LABELS: Record<string, string> = { idea: "Idee", draft: "Concept", approved: "Goedgekeurd", scheduled: "Gepland", published: "Gepubliceerd", archived: "Archief" };

function ContentPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["content", clientId],
    queryFn: async () => (await supabase.from("content_items").select("*").eq("client_id", clientId).order("scheduled_at", { ascending: false, nullsFirst: false })).data ?? [],
  });
  const empty = { title: "", channel: "instagram" as const, status: "idea" as const, scheduled_at: "", concept: "", copy: "", hashtags: "" };
  const [f, setF] = useState(empty);
  async function add() {
    if (!f.title) return;
    await supabase.from("content_items").insert({ client_id: clientId, ...f, scheduled_at: f.scheduled_at || null });
    setF(empty); qc.invalidateQueries({ queryKey: ["content", clientId] });
  }
  async function setStatus(id: string, status: typeof CONTENT_STATUS[number]) {
    await supabase.from("content_items").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["content", clientId] });
  }
  async function del(id: string) { await supabase.from("content_items").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["content", clientId] }); }
  return (
    <div className="space-y-5">
      <SectionForm title="Nieuwe content" onSubmit={add}>
        <div className="grid gap-2 md:grid-cols-2">
          <input className={inp} placeholder="Titel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <select className={inp} value={f.channel} onChange={(e) => setF({ ...f, channel: e.target.value as any })}>
            <option value="instagram">Instagram</option><option value="tiktok">TikTok</option><option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option><option value="youtube">YouTube</option><option value="website">Website</option>
            <option value="email">E-mail</option><option value="print">Print</option><option value="other">Anders</option>
          </select>
          <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as any })}>
            {CONTENT_STATUS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <input type="datetime-local" className={inp} value={f.scheduled_at} onChange={(e) => setF({ ...f, scheduled_at: e.target.value })} />
        </div>
        <textarea className={inp + " min-h-16"} placeholder="Concept / brief" value={f.concept} onChange={(e) => setF({ ...f, concept: e.target.value })} />
        <textarea className={inp + " min-h-16"} placeholder="Copy / tekst" value={f.copy} onChange={(e) => setF({ ...f, copy: e.target.value })} />
        <input className={inp} placeholder="Hashtags" value={f.hashtags} onChange={(e) => setF({ ...f, hashtags: e.target.value })} />
        <button className={btnGold}>Toevoegen</button>
      </SectionForm>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {CONTENT_STATUS.map((s) => (
          <div key={s} className="glass rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-gold mb-2">{STATUS_LABELS[s]}</div>
            <div className="space-y-2">
              {data?.filter((c: any) => c.status === s).map((c: any) => (
                <div key={c.id} className="rounded-lg bg-surface-elevated/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-wider text-gold/80">{c.channel}</div>
                      <div className="text-sm font-medium">{c.title}</div>
                      {c.scheduled_at && <div className="text-[10px] text-muted-foreground">{new Date(c.scheduled_at).toLocaleString("nl-NL")}</div>}
                    </div>
                    <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  {c.concept && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.concept}</p>}
                  <select value={c.status} onChange={(e) => setStatus(c.id, e.target.value as any)} className="mt-2 w-full text-[10px] rounded bg-gold/10 px-2 py-1 text-gold">
                    {CONTENT_STATUS.map((x) => <option key={x} value={x}>→ {STATUS_LABELS[x]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Evaluation ───── */

function EvaluationPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["evaluations", clientId],
    queryFn: async () => (await supabase.from("evaluations").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const empty = { title: "", period_label: "", score: 8, strengths: "", improvements: "", next_steps: "", body: "" };
  const [f, setF] = useState(empty);
  async function add() {
    if (!f.title) return;
    await supabase.from("evaluations").insert({ client_id: clientId, ...f });
    setF(empty); qc.invalidateQueries({ queryKey: ["evaluations", clientId] });
  }
  async function del(id: string) { await supabase.from("evaluations").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["evaluations", clientId] }); }

  return (
    <div className="space-y-5">
      <SectionForm title="Nieuwe evaluatie" onSubmit={add}>
        <div className="grid gap-2 md:grid-cols-3">
          <input className={inp + " md:col-span-2"} placeholder="Titel" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
          <input className={inp} placeholder="Periode (bv Q1 2026)" value={f.period_label} onChange={(e) => setF({ ...f, period_label: e.target.value })} />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs uppercase tracking-wider text-gold/80">Score</label>
          <input type="range" min={1} max={10} value={f.score} onChange={(e) => setF({ ...f, score: Number(e.target.value) })} className="flex-1" />
          <span className="font-display text-2xl text-gold w-10 text-right">{f.score}</span>
        </div>
        <textarea className={inp + " min-h-16"} placeholder="Sterke punten" value={f.strengths} onChange={(e) => setF({ ...f, strengths: e.target.value })} />
        <textarea className={inp + " min-h-16"} placeholder="Verbeterpunten" value={f.improvements} onChange={(e) => setF({ ...f, improvements: e.target.value })} />
        <textarea className={inp + " min-h-16"} placeholder="Volgende stappen" value={f.next_steps} onChange={(e) => setF({ ...f, next_steps: e.target.value })} />
        <button className={btnGold}>Evaluatie opslaan</button>
      </SectionForm>
      <div className="space-y-3">
        {data?.map((e: any) => (
          <div key={e.id} className="glass rounded-2xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-gold/80">{e.period_label || "Evaluatie"}</div>
                <div className="font-display text-xl">{e.title}</div>
              </div>
              <div className="flex items-center gap-2">
                {e.score != null && <div className="font-display text-3xl text-gold">{e.score}<span className="text-sm text-muted-foreground">/10</span></div>}
                <button onClick={() => del(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3 mt-4">
              {e.strengths && <Block label="Sterk" body={e.strengths} tone="good" />}
              {e.improvements && <Block label="Verbeteren" body={e.improvements} tone="warn" />}
              {e.next_steps && <Block label="Volgende stappen" body={e.next_steps} tone="info" />}
            </div>
          </div>
        ))}
        {!data?.length && <Empty text="Nog geen evaluaties." />}
      </div>
    </div>
  );
}

function Block({ label, body, tone }: { label: string; body: string; tone: "good" | "warn" | "info" }) {
  const toneCls = tone === "good" ? "bg-gold/10 text-gold" : tone === "warn" ? "bg-destructive/10 text-destructive" : "bg-accent/30 text-foreground";
  return (
    <div className="rounded-lg bg-surface-elevated/60 p-3">
      <div className={cn("text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-block", toneCls)}>{label}</div>
      <p className="mt-2 text-sm whitespace-pre-wrap">{body}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">{text}</div>;
}

/* ───── Bestaande panels (roadmap / calendar / uploads / tasks) ───── */

const STEP_STATUS_OPTIONS = [
  { value: "pending", label: "In afwachting" },
  { value: "in_progress", label: "Bezig" },
  { value: "completed", label: "Voltooid" },
] as const;

const ROADMAP_STATUS_OPTIONS = [
  { value: "draft", label: "Concept" },
  { value: "active", label: "Actief" },
  { value: "completed", label: "Voltooid" },
  { value: "archived", label: "Gearchiveerd" },
] as const;

const DELIVERABLE_OPTIONS = [
  { value: "image", label: "Afbeelding" },
  { value: "video", label: "Video" },
  { value: "copy", label: "Tekst" },
  { value: "document", label: "Document" },
  { value: "other", label: "Overig" },
];

const STATUS_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  pending: { label: "In afwachting", icon: Circle, color: "text-muted-foreground", bg: "bg-surface-elevated/60", border: "border-muted-foreground/20" },
  in_progress: { label: "Bezig", icon: ArrowRight, color: "text-gold", bg: "bg-gold/10", border: "border-gold/30" },
  completed: { label: "Voltooid", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
};

function RoadmapAdmin({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: roadmaps } = useQuery({
    queryKey: ["roadmaps", clientId],
    queryFn: async () => (await supabase.from("roadmaps").select("*, roadmap_steps(*)").eq("client_id", clientId).order("created_at")).data ?? [],
  });
  const [newRoadmap, setNewRoadmap] = useState("");
  const [newDesc, setNewDesc] = useState("");

  async function addRoadmap() {
    if (!newRoadmap.trim()) return;
    await supabase.from("roadmaps").insert({ client_id: clientId, title: newRoadmap, description: newDesc || null, status: "active" });
    setNewRoadmap(""); setNewDesc("");
    qc.invalidateQueries({ queryKey: ["roadmaps", clientId] });
    toast.success("Stappenplan aangemaakt");
  }

  async function addStep(roadmap_id: string, title: string, due_date: string | null, description: string | null, deliverable_type: string | null) {
    if (!title.trim()) return;
    const order = (roadmaps?.find((r: any) => r.id === roadmap_id)?.roadmap_steps?.length ?? 0);
    await supabase.from("roadmap_steps").insert({
      roadmap_id, title, due_date, description: description || null,
      deliverable_type: deliverable_type as any, status: "pending", step_order: order,
    });
    qc.invalidateQueries({ queryKey: ["roadmaps", clientId] });
    toast.success("Stap toegevoegd");
  }

  async function updateStepStatus(id: string, status: string) {
    await supabase.from("roadmap_steps").update({ status: status as any }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["roadmaps", clientId] });
  }

  async function updateRoadmapStatus(id: string, status: string) {
    await supabase.from("roadmaps").update({ status: status as any }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["roadmaps", clientId] });
    toast.success("Status gewijzigd");
  }

  async function delStep(id: string) {
    await supabase.from("roadmap_steps").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["roadmaps", clientId] });
  }

  async function delRoadmap(id: string) {
    await supabase.from("roadmaps").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["roadmaps", clientId] });
    toast.success("Stappenplan verwijderd");
  }

  return (
    <div className="space-y-8">
      {/* Nieuw stappenplan */}
      <div className="glass rounded-2xl p-5 space-y-3">
        <div className="text-xs uppercase tracking-[0.2em] text-gold/80">Nieuw stappenplan</div>
        <div className="grid gap-2 md:grid-cols-2">
          <input value={newRoadmap} onChange={(e) => setNewRoadmap(e.target.value)} placeholder="Titel stappenplan" className={inp} />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Omschrijving (optioneel)" className={inp} />
        </div>
        <button onClick={addRoadmap} className={btnGold}><Plus className="h-4 w-4 inline mr-1" /> Aanmaken</button>
      </div>

      {roadmaps?.map((r: any) => {
        const steps = [...(r.roadmap_steps ?? [])].sort((a: any, b: any) => a.step_order - b.step_order);
        const completed = steps.filter((s: any) => s.status === "completed").length;
        const total = steps.length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const rmStatus = ROADMAP_STATUS_OPTIONS.find((o) => o.value === r.status);

        return (
          <div key={r.id} className="glass-strong rounded-2xl p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl">{r.title}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={r.status}
                  onChange={(e) => updateRoadmapStatus(r.id, e.target.value)}
                  className="text-xs rounded-lg bg-input/60 hairline px-2 py-1"
                >
                  {ROADMAP_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button onClick={() => delRoadmap(r.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            {/* Progress */}
            <div className="mt-4 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-surface-elevated/60 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-gold transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="text-xs text-muted-foreground shrink-0">{completed}/{total} · {pct}%</div>
            </div>

            {/* Steps */}
            <div className="mt-6 space-y-3">
              {steps.map((s: any) => (
                <RoadmapStepRow
                  key={s.id}
                  step={s}
                  onStatusChange={(status) => updateStepStatus(s.id, status)}
                  onDelete={() => delStep(s.id)}
                />
              ))}
              <AddStepForm onAdd={(t, d, desc, dt) => addStep(r.id, t, d, desc, dt)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoadmapStepRow({ step, onStatusChange, onDelete }: {
  step: any;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: step.title, description: step.description || "", due_date: step.due_date || "", deliverable_type: step.deliverable_type || "other" });
  const qc = useQueryClient();

  const meta = STATUS_META[step.status || "pending"] ?? STATUS_META.pending;
  const Icon = meta.icon;

  async function save() {
    await supabase.from("roadmap_steps").update({
      title: draft.title,
      description: draft.description || null,
      due_date: draft.due_date || null,
      deliverable_type: draft.deliverable_type as any,
    }).eq("id", step.id);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["roadmaps"] });
  }

  if (editing) {
    return (
      <div className="rounded-xl hairline p-4 space-y-2 bg-surface-elevated/40">
        <div className="grid gap-2 md:grid-cols-2">
          <input className={inp} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Titel" />
          <input type="date" className={inp} value={draft.due_date} onChange={(e) => setDraft({ ...draft, due_date: e.target.value })} />
        </div>
        <textarea className={inp + " min-h-16"} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Beschrijving" />
        <select className={inp} value={draft.deliverable_type} onChange={(e) => setDraft({ ...draft, deliverable_type: e.target.value })}>
          {DELIVERABLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={save} className={btnGold + " text-xs"}>Opslaan</button>
          <button onClick={() => { setEditing(false); setDraft({ title: step.title, description: step.description || "", due_date: step.due_date || "", deliverable_type: step.deliverable_type || "other" }); }} className="rounded-lg hairline px-3 py-2 text-xs text-muted-foreground">Annuleren</button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3 transition", meta.border, meta.bg)}>
      <div className={cn("shrink-0 grid h-8 w-8 place-items-center rounded-full", meta.color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{step.title}</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          {step.deliverable_type && (
            <span>{DELIVERABLE_OPTIONS.find((o) => o.value === step.deliverable_type)?.label || step.deliverable_type}</span>
          )}
          {step.due_date && (
            <span>{new Date(step.due_date).toLocaleDateString("nl-NL")}</span>
          )}
          {step.description && <span className="line-clamp-1">{step.description}</span>}
        </div>
      </div>
      <select
        value={step.status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="text-xs rounded-lg bg-input/60 hairline px-2 py-1 shrink-0"
      >
        {STEP_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button onClick={() => setEditing(true)} className="shrink-0 text-muted-foreground hover:text-gold p-1"><Pencil className="h-3.5 w-3.5" /></button>
      <button onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-destructive p-1"><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function AddStepForm({ onAdd }: { onAdd: (t: string, d: string | null, desc: string | null, deliverable: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [t, setT] = useState("");
  const [d, setD] = useState("");
  const [desc, setDesc] = useState("");
  const [dt, setDt] = useState("other");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full rounded-xl hairline border-dashed py-3 text-xs text-muted-foreground hover:text-foreground hover:border-gold/40 transition">
        <Plus className="h-3.5 w-3.5 inline mr-1" /> Stap toevoegen
      </button>
    );
  }

  return (
    <div className="rounded-xl hairline p-4 space-y-2 bg-surface-elevated/30">
      <div className="grid gap-2 md:grid-cols-2">
        <input value={t} onChange={(e) => setT(e.target.value)} placeholder="Titel stap" className={inp} />
        <input type="date" value={d} onChange={(e) => setD(e.target.value)} className={inp} />
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Beschrijving (optioneel)" className={inp + " min-h-14"} />
      <div className="flex gap-2">
        <select value={dt} onChange={(e) => setDt(e.target.value)} className={inp + " w-auto text-xs"}>
          {DELIVERABLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => { onAdd(t, d || null, desc || null, dt); setT(""); setD(""); setDesc(""); setDt("other"); setOpen(false); }} className={btnGold + " text-xs"}><Plus className="h-3.5 w-3.5 inline mr-1" /> Toevoegen</button>
        <button onClick={() => setOpen(false)} className="rounded-lg hairline px-3 py-2 text-xs text-muted-foreground">Annuleren</button>
      </div>
    </div>
  );
}

function CalendarAdmin({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["cal", clientId],
    queryFn: async () => (await supabase.from("calendar_items").select("*").eq("client_id", clientId).order("date")).data ?? [],
  });
  const [f, setF] = useState<{ date: string; title: string; deliverable_type: "image" | "video" | "copy" | "document" | "other" }>({ date: "", title: "", deliverable_type: "image" });
  async function add() {
    if (!f.date || !f.title) return;
    await supabase.from("calendar_items").insert({ client_id: clientId, ...f });
    setF({ date: "", title: "", deliverable_type: "image" }); qc.invalidateQueries({ queryKey: ["cal", clientId] });
  }
  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-5 grid gap-2 md:grid-cols-4">
        <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={inp} />
        <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Titel" className={inp + " md:col-span-2"} />
        <select value={f.deliverable_type} onChange={(e) => setF({ ...f, deliverable_type: e.target.value as typeof f.deliverable_type })} className={inp}>
          <option value="image">Afbeelding</option><option value="video">Video</option><option value="copy">Tekst</option><option value="document">Document</option><option value="other">Anders</option>
        </select>
        <button onClick={add} className={btnGold + " md:col-span-4"}>Toevoegen</button>
      </div>
      <div className="space-y-2">
        {data?.map((c: any) => (
          <div key={c.id} className="glass rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{c.title}</div>
              <div className="text-xs text-muted-foreground">{new Date(c.date).toLocaleDateString("nl-NL")} · {c.deliverable_type} · {c.status}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UploadsView({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const { data } = useQuery({
    queryKey: ["uploads", clientId],
    queryFn: async () => (await supabase.from("uploads").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    const { data: u } = await supabase.auth.getUser();
    let ok = 0;
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${clientId}/${Date.now()}-${safeName}`;
      const { error: upErr } = await supabase.storage.from("client-uploads").upload(path, file, { cacheControl: "3600", upsert: false });
      if (upErr) { toast.error(`${file.name}: ${upErr.message}`); setProgress((p) => p && { ...p, done: p.done + 1 }); continue; }
      const { error: insErr } = await supabase.from("uploads").insert({
        client_id: clientId, file_path: path, file_name: file.name, file_type: file.type, file_size: file.size, uploader_id: u.user?.id ?? null,
      });
      if (insErr) toast.error(`DB: ${insErr.message}`);
      else ok++;
      setProgress((p) => p && { ...p, done: p.done + 1 });
    }
    if (ok > 0) toast.success(`${ok} bestand${ok === 1 ? "" : "en"} geüpload`);
    setBusy(false);
    setProgress(null);
    e.target.value = "";
    qc.invalidateQueries({ queryKey: ["uploads", clientId] });
  }
  return (
    <div className="space-y-4">
      <label className={`glass-strong block rounded-2xl border-2 border-dashed border-gold/30 p-10 text-center ${busy ? "opacity-60 pointer-events-none" : "cursor-pointer hover:border-gold/60"}`}>
        <Plus className="h-6 w-6 mx-auto text-gold" />
        <div className="mt-2 text-sm">
          {busy
            ? `Bezig met uploaden… ${progress ? `${progress.done}/${progress.total}` : ""}`
            : "Klik om beeld of video toe te voegen"}
        </div>
        <input type="file" multiple accept="image/*,video/*" onChange={handleFile} className="hidden" disabled={busy} />
      </label>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {data?.map((u: any) => <UploadTile key={u.id} u={u} />)}
        {data?.length === 0 && <p className="col-span-full text-sm text-muted-foreground">Nog niets geüpload.</p>}
      </div>
    </div>
  );
}

function UploadTile({ u }: { u: any }) {
  const { data } = supabase.storage.from("client-uploads").getPublicUrl(u.file_path);
  const url = data.publicUrl;
  const isVideo = u.file_type?.startsWith("video/");
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block aspect-square overflow-hidden rounded-xl glass relative bg-surface-elevated/40">
      {isVideo
        ? <video src={url} className="h-full w-full object-cover" />
        : <img src={url} alt={u.file_name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3">
        <div className="text-xs text-white/90 truncate">{u.file_name}</div>
      </div>
    </a>
  );
}

function TasksView({ clientId, admin = false }: { clientId: string; admin?: boolean }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["tasks", clientId],
    queryFn: async () => (await supabase.from("tasks").select("*").eq("client_id", clientId).order("created_at", { ascending: false })).data ?? [],
  });
  const [t, setT] = useState<{ title: string; priority: "low" | "medium" | "high" | "urgent" }>({ title: "", priority: "medium" });
  async function add() {
    if (!t.title) return;
    await supabase.from("tasks").insert({ client_id: clientId, ...t });
    setT({ title: "", priority: "medium" }); qc.invalidateQueries({ queryKey: ["tasks", clientId] });
  }
  async function setStatus(id: string, status: "todo" | "in_progress" | "done") {
    await supabase.from("tasks").update({ status }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["tasks", clientId] });
  }
  const cols: { k: "todo" | "in_progress" | "done"; label: string }[] = [
    { k: "todo", label: "Te doen" }, { k: "in_progress", label: "Bezig" }, { k: "done", label: "Klaar" },
  ];
  return (
    <div className="space-y-4">
      {admin && (
        <div className="glass rounded-2xl p-4 flex gap-2">
          <input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="Nieuwe taak" className={inp} />
          <select value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value as typeof t.priority })} className={inp + " w-auto"}>
            <option value="low">Laag</option><option value="medium">Medium</option><option value="high">Hoog</option><option value="urgent">Urgent</option>
          </select>
          <button onClick={add} className={btnGold}>Toevoegen</button>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.k} className="glass rounded-2xl p-4">
            <h3 className="font-display text-lg mb-3">{c.label}</h3>
            <div className="space-y-2">
              {data?.filter((x: any) => x.status === c.k).map((x: any) => (
                <div key={x.id} className="rounded-lg bg-surface-elevated/60 p-3">
                  <div className="text-sm font-medium">{x.title}</div>
                  <div className="text-xs text-muted-foreground">{x.priority}</div>
                  <div className="flex gap-1 mt-2">
                    {cols.filter((cc) => cc.k !== c.k).map((cc) => (
                      <button key={cc.k} onClick={() => setStatus(x.id, cc.k)} className="text-[10px] rounded px-2 py-0.5 bg-gold/15 text-gold hover:bg-gold/25">→ {cc.label}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───── Socials Panel ───── */
const SOCIAL_NETWORKS = [
  { k: "instagram_url", label: "Instagram", Icon: Instagram, ph: "https://instagram.com/jouwmerk", color: "from-pink-500 to-orange-400" },
  { k: "tiktok_url", label: "TikTok", Icon: Music2, ph: "https://tiktok.com/@jouwmerk", color: "from-slate-700 to-slate-900" },
  { k: "linkedin_url", label: "LinkedIn", Icon: Linkedin, ph: "https://linkedin.com/company/jouwmerk", color: "from-sky-600 to-sky-800" },
  { k: "youtube_url", label: "YouTube", Icon: Youtube, ph: "https://youtube.com/@jouwmerk", color: "from-red-500 to-red-700" },
  { k: "facebook_url", label: "Facebook", Icon: Facebook, ph: "https://facebook.com/jouwmerk", color: "from-blue-600 to-blue-800" },
] as const;

function SocialsPanel({ client }: { client: any }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const connectedCount = SOCIAL_NETWORKS.filter((s) => client?.[s.k]).length;

  async function save(field: string, value: string | null) {
    setBusy(true);
    const { error } = await supabase.from("clients").update({ [field]: value } as any).eq("id", client.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(value ? "Social gekoppeld" : "Social losgekoppeld");
    qc.invalidateQueries({ queryKey: ["client", client.id] });
    setEditing(null);
    setDraft("");
  }

  return (
    <div className="space-y-5">
      <div className="glass rounded-2xl p-5 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gold/15 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-gold" />
        </div>
        <div className="flex-1">
          <div className="font-display text-xl">Socials</div>
          <div className="text-sm text-muted-foreground">
            {connectedCount} van {SOCIAL_NETWORKS.length} kanalen gekoppeld
          </div>
      </div>

      <InstagramScheduler clientId={client.id} igUrl={client?.instagram_url ?? null} />

      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {SOCIAL_NETWORKS.map(({ k, label, Icon, ph, color }) => {
          const url = client?.[k] as string | null;
          const isEditing = editing === k;
          return (
            <div key={k} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br flex items-center justify-center text-white shrink-0", color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{label}</div>
                  {url ? (
                    <a href={url} target="_blank" rel="noreferrer"
                      className="text-xs text-gold hover:underline truncate block">{url}</a>
                  ) : (
                    <div className="text-xs text-muted-foreground">Nog niet gekoppeld</div>
                  )}
                </div>
                {url && !isEditing && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder={ph}
                    className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy || !draft.trim()}
                      onClick={() => save(k, draft.trim())}
                      className="flex-1 rounded-lg bg-gradient-gold py-2 text-xs font-medium text-primary-foreground"
                    >
                      Opslaan
                    </button>
                    <button
                      onClick={() => { setEditing(null); setDraft(""); }}
                      className="rounded-lg hairline px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setEditing(k); setDraft(url ?? ""); }}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-gold py-2 text-xs font-medium text-primary-foreground"
                  >
                    <Link2 className="h-3.5 w-3.5" /> {url ? "Bewerken" : "Verbind"}
                  </button>
                  {url && (
                    <button
                      disabled={busy}
                      onClick={() => save(k, null)}
                      className="rounded-lg hairline border-destructive/40 px-3 py-2 text-xs text-destructive hover:bg-destructive/10"
                      title="Loskoppelen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
