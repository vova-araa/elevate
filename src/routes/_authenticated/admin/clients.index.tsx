import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus,
  Search,
  Briefcase,
  MessageSquare,
  ListChecks,
  Star,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal,
  X,
  Sparkles,
} from "lucide-react";

type SortKey = "name" | "pipeline" | "openTasks" | "meetings" | "lastEval";
type SortDir = "asc" | "desc";

export const Route = createFileRoute("/_authenticated/admin/clients/")({
  component: ClientsList,
});

function ClientsList() {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [minPipeline, setMinPipeline] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("*").order("created_at", { ascending: false })).data ??
      [],
  });

  const { data: stats } = useQuery({
    queryKey: ["clients-stats"],
    queryFn: async () => {
      const [meetings, tasks, deals, evaluations] = await Promise.all([
        supabase.from("meetings").select("client_id"),
        supabase.from("tasks").select("client_id,status"),
        supabase.from("deals").select("client_id,stage,value_cents"),
        supabase.from("evaluations").select("client_id,score,created_at"),
      ]);
      const byClient: Record<
        string,
        {
          meetings: number;
          openTasks: number;
          pipeline: number;
          lastEval: number | null;
          lastEvalDate: string | null;
        }
      > = {};

      (meetings.data ?? []).forEach((m: any) => {
        byClient[m.client_id] = byClient[m.client_id] || {
          meetings: 0,
          openTasks: 0,
          pipeline: 0,
          lastEval: null,
          lastEvalDate: null,
        };
        byClient[m.client_id].meetings++;
      });

      (tasks.data ?? []).forEach((t: any) => {
        byClient[t.client_id] = byClient[t.client_id] || {
          meetings: 0,
          openTasks: 0,
          pipeline: 0,
          lastEval: null,
          lastEvalDate: null,
        };
        if (t.status !== "done") byClient[t.client_id].openTasks++;
      });

      (deals.data ?? []).forEach((d: any) => {
        byClient[d.client_id] = byClient[d.client_id] || {
          meetings: 0,
          openTasks: 0,
          pipeline: 0,
          lastEval: null,
          lastEvalDate: null,
        };
        if (!["won", "lost"].includes(d.stage))
          byClient[d.client_id].pipeline += (d.value_cents ?? 0) / 100;
      });

      (evaluations.data ?? []).forEach((e: any) => {
        byClient[e.client_id] = byClient[e.client_id] || {
          meetings: 0,
          openTasks: 0,
          pipeline: 0,
          lastEval: null,
          lastEvalDate: null,
        };
        const dt = e.created_at as string;
        if (!byClient[e.client_id].lastEvalDate || dt > byClient[e.client_id].lastEvalDate!) {
          byClient[e.client_id].lastEvalDate = dt;
          byClient[e.client_id].lastEval = e.score ?? null;
        }
      });

      return byClient;
    },
  });

  const industries = useMemo(() => {
    const set = new Set<string>();
    (clients ?? []).forEach((c: any) => {
      if (c.industry) set.add(c.industry);
    });
    return Array.from(set).sort();
  }, [clients]);

  const filteredSorted = useMemo(() => {
    let list = clients ?? [];

    // Tekstzoek
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter(
        (c: any) =>
          c.name?.toLowerCase().includes(s) ||
          c.industry?.toLowerCase().includes(s) ||
          c.description?.toLowerCase().includes(s),
      );
    }

    // Branchefilter
    if (industryFilter) {
      list = list.filter((c: any) => c.industry === industryFilter);
    }

    // Minimale pipeline filter
    if (minPipeline) {
      const min = parseFloat(minPipeline);
      if (!isNaN(min)) {
        list = list.filter((c: any) => (stats?.[c.id]?.pipeline ?? 0) >= min);
      }
    }

    // Sortering
    list = [...list].sort((a: any, b: any) => {
      const sa = stats?.[a.id];
      const sb = stats?.[b.id];
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "");
          break;
        case "pipeline":
          cmp = (sa?.pipeline ?? 0) - (sb?.pipeline ?? 0);
          break;
        case "openTasks":
          cmp = (sa?.openTasks ?? 0) - (sb?.openTasks ?? 0);
          break;
        case "meetings":
          cmp = (sa?.meetings ?? 0) - (sb?.meetings ?? 0);
          break;
        case "lastEval":
          cmp = (sa?.lastEval ?? 0) - (sb?.lastEval ?? 0);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [clients, q, industryFilter, minPipeline, stats, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
    }
  }

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="h-3 w-3 text-muted-foreground" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-gold" />
    ) : (
      <ArrowDown className="h-3 w-3 text-gold" />
    );
  };

  const activeFilters = (q.trim() ? 1 : 0) + (industryFilter ? 1 : 0) + (minPipeline ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Klanten</p>
          <h1 className="font-display text-5xl mt-2">Klanten</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients?.length ?? 0} bedrijven · klik op een kaart voor het volledige dossier
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/clients/intake"
            className="inline-flex items-center gap-2 rounded-full border border-gold/30 px-5 py-2.5 text-sm font-medium text-gold hover:bg-gold/10 transition"
          >
            <Sparkles className="h-4 w-4" /> Intake vragenlijst
          </Link>
          <Link
            to="/admin/clients/new"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-gold px-5 py-2.5 text-sm font-medium text-primary-foreground glow-gold"
          >
            <Plus className="h-4 w-4" /> Nieuwe klant
          </Link>
        </div>
      </div>

      {/* Zoek- en filterbalk */}
      <div className="glass rounded-2xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoek op naam, branche of omschrijving..."
              className="w-full rounded-full bg-input/60 hairline pl-9 pr-9 py-2.5 text-sm"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-gold/20 px-4 py-2.5 text-sm hover:bg-gold/10 transition"
          >
            <SlidersHorizontal className="h-4 w-4 text-gold" />
            Filters
            {activeFilters > 0 && (
              <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gold px-1.5 text-[10px] font-semibold text-primary-foreground">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {/* Sorteerchips */}
        <div className="flex flex-wrap gap-2">
          <SortChip
            label="Naam"
            sortKey="name"
            current={sortKey}
            toggle={toggleSort}
            icon={<SortIcon k="name" />}
          />
          <SortChip
            label="Pipeline"
            sortKey="pipeline"
            current={sortKey}
            toggle={toggleSort}
            icon={<SortIcon k="pipeline" />}
          />
          <SortChip
            label="Open taken"
            sortKey="openTasks"
            current={sortKey}
            toggle={toggleSort}
            icon={<SortIcon k="openTasks" />}
          />
          <SortChip
            label="Gesprekken"
            sortKey="meetings"
            current={sortKey}
            toggle={toggleSort}
            icon={<SortIcon k="meetings" />}
          />
          <SortChip
            label="Laatste evaluatie"
            sortKey="lastEval"
            current={sortKey}
            toggle={toggleSort}
            icon={<SortIcon k="lastEval" />}
          />
        </div>

        {/* Uitgeklapte filters */}
        {showFilters && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2 border-t border-gold/10">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Branche
              </label>
              <select
                value={industryFilter}
                onChange={(e) => setIndustryFilter(e.target.value)}
                className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
              >
                <option value="">Alle branches</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1.5 block">
                Min. pipeline (€)
              </label>
              <input
                type="number"
                value={minPipeline}
                onChange={(e) => setMinPipeline(e.target.value)}
                placeholder="bijv. 5000"
                className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm"
              />
            </div>
            {activeFilters > 0 && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setQ("");
                    setIndustryFilter("");
                    setMinPipeline("");
                    setSortKey("name");
                    setSortDir("asc");
                  }}
                  className="text-sm text-muted-foreground hover:text-destructive transition"
                >
                  Reset alle filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resultaten */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredSorted.length} resultaat{filteredSorted.length !== 1 ? "en" : ""}
          {q ? ` voor "${q}"` : ""}
          {industryFilter ? ` · ${industryFilter}` : ""}
          {minPipeline ? ` · vanaf €${minPipeline}` : ""}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredSorted.map((c: any) => {
          const s = stats?.[c.id] ?? {
            meetings: 0,
            openTasks: 0,
            pipeline: 0,
            lastEval: null,
            lastEvalDate: null,
          };
          return (
            <Link
              key={c.id}
              to="/admin/clients/$id"
              params={{ id: c.id }}
              className="glass rounded-2xl p-5 transition hover:gold-ring group"
            >
              <div className="flex items-center gap-3">
                {c.logo_url ? (
                  <img
                    src={c.logo_url}
                    alt={c.name}
                    className="h-14 w-14 rounded-full object-cover shrink-0 border border-gold/20"
                  />
                ) : (
                  <div
                    className="h-14 w-14 rounded-full flex items-center justify-center font-display text-2xl text-primary-foreground shrink-0"
                    style={{ background: c.brand_color || "var(--gradient-gold)" }}
                  >
                    {c.name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-display text-xl truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.industry || "—"}</div>
                </div>
              </div>
              {c.description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-2">{c.description}</p>
              )}
              <div className="mt-4 grid grid-cols-4 gap-2 pt-4 border-t border-gold/10">
                <Stat icon={MessageSquare} label="gesprek" value={s.meetings} />
                <Stat icon={ListChecks} label="open" value={s.openTasks} />
                <Stat
                  icon={Briefcase}
                  label="pipe"
                  value={s.pipeline ? `€${Math.round(s.pipeline / 1000)}k` : 0}
                />
                <Stat
                  icon={Star}
                  label="eval"
                  value={s.lastEval ?? "—"}
                  highlight={s.lastEval !== null}
                />
              </div>
            </Link>
          );
        })}
        {filteredSorted.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Search className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeFilters > 0
                ? "Geen klanten gevonden met deze filters."
                : "Nog geen klanten. Voeg er één toe."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function SortChip({
  label,
  sortKey,
  current,
  toggle,
  icon,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  toggle: (k: SortKey) => void;
  icon: React.ReactNode;
}) {
  const active = current === sortKey;
  return (
    <button
      onClick={() => toggle(sortKey)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-gold/15 text-gold border border-gold/30"
          : "border border-gold/10 text-muted-foreground hover:border-gold/30 hover:text-foreground"
      }`}
    >
      {label} {icon}
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: any;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <Icon className={`h-3.5 w-3.5 mx-auto ${highlight ? "text-gold" : "text-gold/70"}`} />
      <div className={`font-display text-lg mt-1 leading-none ${highlight ? "text-gold" : ""}`}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">
        {label}
      </div>
    </div>
  );
}
