import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { confirmDialog } from "@/components/ui/confirm";
import { useMemo, useState, useRef, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSignedUrl } from "@/lib/use-signed-url";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth-context";
import { generateCaption } from "@/lib/planner.functions";
import { publishScheduledPost } from "@/lib/publish.functions";
import { getPublishedFeed, type PublishedFeedItem } from "@/lib/feed.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { z } from "zod";
import { CAPTION_LIMITS, DAY_LABELS_LONG } from "@/lib/social-constants";
import { dutchHolidays } from "@/lib/holidays";
import { EmojiPickerButton } from "@/components/emoji-picker-button";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Upload,
  Sparkles,
  Trash2,
  Loader2,
  Calendar as CalIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  Image as ImageIcon,
  Video as VideoIcon,
  CalendarDays,
  LayoutGrid,
  ListChecks,
  Eye,
  Layers,
  Repeat,
  StickyNote,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  PLATFORMS,
  VISIBLE_PLATFORMS,
  STATUS_META,
  GOLD_FALLBACK,
  toKey,
  sameDay,
  type Platform,
  type PostStatus,
} from "@/components/planner/planner-shared";
import { PostChip } from "@/components/planner/post-chip";
import { WeekView } from "@/components/planner/week-view";
import { ClientLegend } from "@/components/planner/client-legend";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";

const searchSchema = z.object({
  clientId: z.string().uuid().optional(),
  view: z.enum(["month", "week", "day", "agenda"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const Route = createFileRoute("/_authenticated/admin/planner")({
  validateSearch: searchSchema,
  component: PlannerPage,
});

// Platform-, status- en datumhelpers zijn gedeeld met de planner-componenten
// in src/components/planner/ (PLATFORMS, STATUS_META, toKey, sameDay).

type ScheduledPost = Tables<"scheduled_posts">;
type FeedPost = Pick<
  ScheduledPost,
  | "id"
  | "platform"
  | "caption"
  | "media_path"
  | "media_type"
  | "scheduled_at"
  | "status"
  | "published_at"
>;

/** Vorm van de `recurring_rule` JSON-kolom op scheduled_posts. */
interface RecurringRule {
  freq: "daily" | "weekly" | "monthly";
  count: number;
}

function PlannerPage() {
  const { clientId, view: viewParam, date: dateParam } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const view = viewParam ?? "month";

  const initialDate = useMemo(() => {
    if (dateParam) {
      const [y, m, d] = dateParam.split("-").map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  }, [dateParam]);

  const { data: clients } = useQuery({
    queryKey: ["planner-clients"],
    // Klantenlijst wijzigt zelden — langer cachen scheelt herhaalde queries.
    staleTime: 10 * 60_000,
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color,industry").order("name")).data ??
      [],
  });

  const selected = clients?.find((c) => c.id === clientId) ?? clients?.[0];
  const activeId = selected?.id;

  if (!clientId && activeId) {
    navigate({ to: "/admin/planner", search: { clientId: activeId, view }, replace: true });
  }

  const [cursor, setCursor] = useState<Date>(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  useEffect(() => {
    if (dateParam) {
      setCursor(initialDate);
      setSelectedDate(initialDate);
    }
  }, [dateParam, initialDate]);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [composeDate, setComposeDate] = useState<Date | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [feedPlatform, setFeedPlatform] = useState<Platform | "all">("all");
  const [feedOpen, setFeedOpen] = useState(true);
  // Hoe ver vooruit tonen we de geplande posts in de feed-preview?
  const [feedDays, setFeedDays] = useState<number>(7);

  const { data: feedPosts } = useQuery({
    queryKey: ["feed-preview", activeId, feedPlatform, feedDays],
    enabled: !!activeId,
    queryFn: async () => {
      // Alles tot en met de gekozen horizon: al gepubliceerd + wat er de
      // komende dagen op de planning staat.
      const until = new Date();
      until.setDate(until.getDate() + feedDays);
      until.setHours(23, 59, 59, 999);
      let q = supabase
        .from("scheduled_posts")
        .select("id,platform,caption,media_path,media_type,scheduled_at,status,published_at")
        .eq("client_id", activeId!)
        .is("deleted_at", null)
        .eq("is_queued", false)
        .lte("scheduled_at", until.toISOString());
      if (feedPlatform !== "all") q = q.eq("platform", feedPlatform);
      return (await q.order("scheduled_at", { ascending: false }).limit(36)).data ?? [];
    },
  });

  // De échte gepubliceerde feed van het gekoppelde account (Instagram/Facebook).
  const publishedFeedFn = useServerFn(getPublishedFeed);
  const { data: livePosts } = useQuery({
    queryKey: ["published-feed", activeId, feedPlatform],
    enabled: !!activeId && (feedPlatform === "instagram" || feedPlatform === "facebook"),
    staleTime: 5 * 60_000,
    meta: { silent: true },
    queryFn: () =>
      publishedFeedFn({
        data: {
          clientId: activeId!,
          platform: feedPlatform as "instagram" | "facebook",
          limit: 24,
        },
      }),
  });

  const range = useMemo(() => {
    const start = new Date(cursor);
    const end = new Date(cursor);
    if (view === "month") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === "week") {
      const offset = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - offset);
      start.setHours(0, 0, 0, 0);
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (view === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 3, 0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }, [cursor, view]);

  const { data: posts } = useQuery({
    queryKey: [
      "scheduled-posts",
      activeId,
      range.start.toISOString(),
      range.end.toISOString(),
      feedPlatform,
    ],
    enabled: !!activeId,
    queryFn: async () => {
      let q = supabase
        .from("scheduled_posts")
        .select("*")
        .eq("client_id", activeId!)
        .is("deleted_at", null)
        .eq("is_queued", false)
        .gte("scheduled_at", range.start.toISOString())
        .lte("scheduled_at", range.end.toISOString());
      if (feedPlatform !== "all") q = q.eq("platform", feedPlatform);
      return (await q.order("scheduled_at")).data ?? [];
    },
  });

  const byDay = useMemo(() => {
    const m: Record<string, ScheduledPost[]> = {};
    (posts ?? []).forEach((p) => {
      const k = toKey(new Date(p.scheduled_at));
      (m[k] ||= []).push(p);
    });
    return m;
  }, [posts]);

  function shiftCursor(dir: -1 | 1) {
    const n = new Date(cursor);
    if (view === "month") n.setMonth(n.getMonth() + dir);
    else if (view === "week") n.setDate(n.getDate() + 7 * dir);
    else if (view === "day") n.setDate(n.getDate() + dir);
    else n.setMonth(n.getMonth() + dir);
    setCursor(n);
  }

  async function reschedule(id: string, newDate: Date, keepTime = true) {
    const orig = (posts ?? []).find((p) => p.id === id);
    if (!orig) return;
    if (orig.status === "published")
      return toast.error("Gepubliceerde posts kunnen niet verplaatst worden");
    const o = new Date(orig.scheduled_at);
    const next = new Date(newDate);
    if (keepTime) next.setHours(o.getHours(), o.getMinutes(), 0, 0);
    if (next.toISOString() === orig.scheduled_at) return;
    // Optimistische update — meteen verplaatsen in de UI, terugdraaien bij fout
    const key = [
      "scheduled-posts",
      activeId,
      range.start.toISOString(),
      range.end.toISOString(),
      feedPlatform,
    ];
    const prev = qc.getQueryData<ScheduledPost[]>(key);
    qc.setQueryData(key, (old: ScheduledPost[] | undefined) =>
      (old ?? []).map((p) => (p.id === id ? { ...p, scheduled_at: next.toISOString() } : p)),
    );
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ scheduled_at: next.toISOString() })
      .eq("id", id);
    if (error) {
      qc.setQueryData(key, prev);
      return toast.error(error.message);
    }
    toast.success("Verplaatst");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }

  async function approve(id: string) {
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ status: "scheduled" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Goedgekeurd & ingepland");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }
  const publishPost = useServerFn(publishScheduledPost);
  async function markPublished(id: string) {
    const post = (posts ?? []).find((p) => p.id === id);
    const meta = post ? PLATFORMS.find((x) => x.id === post.platform) : undefined;
    const t = toast.loading(`Publiceren naar ${meta?.label ?? "platform"}...`);
    try {
      await publishPost({ data: { postId: id } });
      toast.success(`Gepubliceerd op ${meta?.label ?? "platform"}`, { id: t });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publiceren mislukt", { id: t });
    }
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
  }
  async function removePost(id: string) {
    if (!(await confirmDialog("Naar prullenbak verplaatsen? (30 dagen herstelbaar)"))) return false;
    const { error } = await supabase
      .from("scheduled_posts")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success("Naar prullenbak");
    qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    return true;
  }

  function openCompose(date?: Date, id?: string) {
    setEditId(id ?? null);
    setComposeDate(date ?? selectedDate);
    setComposeOpen(true);
  }

  if (!clients) return <PlannerSkeleton />;

  if (clients.length === 0) {
    return (
      <div className="max-w-2xl">
        <EmptyState
          icon={<CalendarDays className="h-5 w-5" />}
          title="Nog geen klanten"
          description="Maak eerst een klant aan; daarna kun je content plannen op de kalender."
          action={
            <Link
              to="/admin/clients/new"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm font-medium"
            >
              <Plus className="h-4 w-4" /> Nieuwe klant
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Planner</p>
          <h1 className="font-display text-4xl sm:text-5xl mt-2">Content kalender</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl">
            Plan posts per platform, sleep om te herplannen, en gebruik AI voor captions en
            hashtags.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={activeId ?? ""}
            onChange={(e) =>
              navigate({ to: "/admin/planner", search: { clientId: e.target.value, view } })
            }
            className="rounded-full bg-input/60 hairline px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => openCompose(new Date())}
            className="rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm font-medium inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" /> Nieuwe post
          </button>
        </div>
      </div>

      {/* View toggle + nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full glass p-1 text-xs">
          {(["month", "week", "day", "agenda"] as const).map((v) => {
            const Icon =
              v === "month"
                ? CalendarDays
                : v === "week"
                  ? LayoutGrid
                  : v === "day"
                    ? CalIcon
                    : ListChecks;
            const labels = { month: "Maand", week: "Week", day: "Dag", agenda: "Agenda" };
            return (
              <button
                key={v}
                onClick={() =>
                  navigate({ to: "/admin/planner", search: { clientId: activeId, view: v } })
                }
                className={cn(
                  "rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 transition",
                  view === v
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {labels[v]}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftCursor(-1)}
            className="rounded-full glass p-2 hover:bg-gold/10"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="font-display text-xl min-w-48 text-center capitalize">
            {periodLabel(cursor, view)}
          </div>
          <button
            onClick={() => shiftCursor(1)}
            className="rounded-full glass p-2 hover:bg-gold/10"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setCursor(new Date());
              setSelectedDate(new Date());
            }}
            className="rounded-full glass px-3 py-1.5 text-sm hover:bg-gold/10"
          >
            Vandaag
          </button>
        </div>
      </div>

      {/* Legenda: klanten met brand_color, klikbaar om te filteren */}
      <ClientLegend
        clients={clients}
        activeId={activeId}
        onSelect={(id: string) =>
          navigate({ to: "/admin/planner", search: { clientId: id, view } })
        }
      />

      {/* Feed preview per account */}
      <FeedPreviewPanel
        clientName={selected?.name ?? ""}
        platform={feedPlatform}
        setPlatform={setFeedPlatform}
        posts={feedPosts ?? []}
        livePosts={livePosts ?? []}
        days={feedDays}
        setDays={setFeedDays}
        open={feedOpen}
        setOpen={setFeedOpen}
        onOpenPost={(id: string) => openCompose(undefined, id)}
      />

      {/* Main view */}
      {view === "month" && (
        <MonthView
          cursor={cursor}
          byDay={byDay}
          selected={selectedDate}
          brandColor={selected?.brand_color}
          onSelectDay={(d: Date) => {
            setSelectedDate(d);
          }}
          onDoubleClickDay={(d: Date) => openCompose(d)}
          onDropPost={(d: Date, id: string) => reschedule(id, d)}
          dragId={dragId}
          setDragId={setDragId}
          onOpenPost={(id: string) => openCompose(undefined, id)}
        />
      )}
      {view === "week" && (
        <WeekView
          cursor={cursor}
          byDay={byDay}
          brandColor={selected?.brand_color}
          onClickDay={(d: Date) => openCompose(d)}
          onDropPost={(d: Date, id: string) => reschedule(id, d)}
          dragId={dragId}
          setDragId={setDragId}
          onOpenPost={(id: string) => openCompose(undefined, id)}
        />
      )}
      {view === "day" && (
        <DayView
          date={cursor}
          posts={byDay[toKey(cursor)] ?? []}
          brandColor={selected?.brand_color}
          onAdd={() => openCompose(cursor)}
          onOpenPost={(id: string) => openCompose(undefined, id)}
          onApprove={approve}
          onPublish={markPublished}
          onDelete={removePost}
        />
      )}
      {view === "agenda" && (
        <AgendaView
          posts={posts ?? []}
          brandColor={selected?.brand_color}
          onOpenPost={(id: string) => openCompose(undefined, id)}
          onApprove={approve}
          onPublish={markPublished}
          onDelete={removePost}
        />
      )}

      {composeOpen && activeId && (
        <ComposeModal
          clientId={activeId}
          clientName={selected?.name ?? ""}
          industry={selected?.industry ?? ""}
          defaultDate={composeDate ?? selectedDate}
          editId={editId}
          existing={editId ? ((posts ?? []).find((p) => p.id === editId) ?? null) : null}
          userId={user?.id}
          onClose={() => {
            setComposeOpen(false);
            setEditId(null);
          }}
          onSaved={() => {
            setComposeOpen(false);
            setEditId(null);
            qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
          }}
          onDelete={
            editId
              ? async () => {
                  if (await removePost(editId)) {
                    setComposeOpen(false);
                    setEditId(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function periodLabel(d: Date, view: string) {
  if (view === "month" || view === "agenda")
    return d.toLocaleDateString("nl-NL", { month: "long", year: "numeric" });
  if (view === "day")
    return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  const start = new Date(d);
  start.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getDate()} ${start.toLocaleDateString("nl-NL", { month: "short" })} – ${end.getDate()} ${end.toLocaleDateString("nl-NL", { month: "short" })}`;
}

/* ------------------------------ LOAD SKELETON ------------------------------ */
function PlannerSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-10 w-72 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-40 rounded-full" />
          <Skeleton className="h-10 w-32 rounded-full" />
        </div>
      </div>
      {/* Toggle + nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Skeleton className="h-9 w-64 rounded-full" />
        <Skeleton className="h-9 w-56 rounded-full" />
      </div>
      {/* Kalender */}
      <Skeleton className="h-[520px] w-full rounded-2xl" />
    </div>
  );
}

/* ------------------------------ MONTH VIEW ------------------------------ */
function MonthView({
  cursor,
  byDay,
  selected,
  brandColor,
  onSelectDay,
  onDoubleClickDay,
  onDropPost,
  dragId,
  setDragId,
  onOpenPost,
}: {
  cursor: Date;
  byDay: Record<string, ScheduledPost[]>;
  selected: Date;
  brandColor?: string | null;
  onSelectDay: (d: Date) => void;
  onDoubleClickDay: (d: Date) => void;
  onDropPost: (d: Date, id: string) => void;
  dragId: string | null;
  setDragId: (id: string | null) => void;
  onOpenPost: (id: string) => void;
}) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const offset = (start.getDay() + 6) % 7;
  const days: Date[] = [];
  for (let i = 0; i < offset; i++)
    days.push(new Date(start.getFullYear(), start.getMonth(), -offset + i + 1));
  for (let d = 1; d <= end.getDate(); d++)
    days.push(new Date(start.getFullYear(), start.getMonth(), d));
  // Vul het raster aan met de eerste dagen van de volgende maand — opeenvolgend
  // (bug-fix: telde eerder verkeerd op vanaf de laatste dag en sloeg 1–4 aug over).
  let trailing = 1;
  while (days.length % 7) {
    days.push(new Date(end.getFullYear(), end.getMonth(), end.getDate() + trailing));
    trailing++;
  }
  const today = new Date();

  // Feestdagen: jaar ervoor/erna meenemen, zodat leading/trailing dagen die in
  // een ander jaar vallen (grid rond de jaarwisseling) ook een label krijgen.
  const cursorYear = cursor.getFullYear();
  const holidayMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const y of [cursorYear - 1, cursorYear, cursorYear + 1]) {
      for (const h of dutchHolidays(y)) map.set(h.date, h.name);
    }
    return map;
  }, [cursorYear]);

  return (
    <div className="glass-strong rounded-2xl p-4">
      {/* Op smalle schermen horizontaal scrollen i.p.v. samengeperste cellen. */}
      <div className="overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-[0.18em] text-gold/70 pb-2">
            {["ma", "di", "wo", "do", "vr", "za", "zo"].map((d) => (
              <div key={d} className="text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              const k = toKey(d);
              const items = byDay[k] || [];
              const inMonth = d.getMonth() === cursor.getMonth();
              const isToday = sameDay(d, today);
              const isSelected = sameDay(d, selected);
              const holidayName = holidayMap.get(k);
              return (
                <div
                  key={i}
                  onClick={() => onSelectDay(d)}
                  onDoubleClick={() => onDoubleClickDay(d)}
                  onDragOver={(e) => {
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragId) {
                      onDropPost(d, dragId);
                      setDragId(null);
                    }
                  }}
                  className={cn(
                    "min-h-28 text-left rounded-lg p-2 transition border cursor-pointer",
                    inMonth ? "bg-surface/50" : "bg-surface/20 opacity-50",
                    isSelected
                      ? "border-gold ring-1 ring-gold/40"
                      : "border-transparent hover:border-gold/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "text-xs flex items-center justify-center h-6 w-6 rounded-full",
                        isToday
                          ? "bg-gold text-primary-foreground font-semibold"
                          : "text-muted-foreground",
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {holidayName && (
                      <span
                        className="mx-1 flex-1 truncate text-center text-[9px] text-muted-foreground/60"
                        title={holidayName}
                      >
                        {holidayName}
                      </span>
                    )}
                    {items.length > 0 && (
                      <span className="text-[10px] text-gold/80">{items.length}</span>
                    )}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {items.slice(0, 3).map((p) => (
                      <PostChip
                        key={p.id}
                        post={p}
                        brandColor={brandColor}
                        onDragStart={() => setDragId(p.id)}
                        onDragEnd={() => setDragId(null)}
                        onOpen={() => onOpenPost(p.id)}
                      />
                    ))}
                    {items.length > 3 && (
                      <div className="text-[10px] text-muted-foreground pl-1">
                        +{items.length - 3} meer
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ WEEK VIEW ------------------------------ */
// De week-weergave (7 kolommen, posts per dag gestapeld, drag & drop)
// staat in src/components/planner/week-view.tsx.

/* ------------------------------ DAY VIEW ------------------------------ */
function DayView({
  date,
  posts,
  brandColor,
  onAdd,
  onOpenPost,
  onApprove,
  onPublish,
  onDelete,
}: {
  date: Date;
  posts: ScheduledPost[];
  brandColor?: string | null;
  onAdd: () => void;
  onOpenPost: (id: string) => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const sorted = [...posts].sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at));
  return (
    <div className="glass-strong rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-display text-2xl capitalize">
          {date.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
        </div>
        <button
          onClick={onAdd}
          className="rounded-full bg-gradient-gold text-primary-foreground px-3 py-1.5 text-sm inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" /> Post toevoegen
        </button>
      </div>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<CalIcon className="h-5 w-5" />}
          title="Geen posts vandaag"
          description="Er staat niets gepland voor deze dag. Voeg een post toe om te beginnen."
        />
      ) : (
        <div className="space-y-3">
          {sorted.map((p) => (
            <PostRow
              key={p.id}
              post={p}
              brandColor={brandColor}
              onOpen={onOpenPost}
              onApprove={onApprove}
              onPublish={onPublish}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ AGENDA VIEW ------------------------------ */
function AgendaView({
  posts,
  brandColor,
  onOpenPost,
  onApprove,
  onPublish,
  onDelete,
}: {
  posts: ScheduledPost[];
  brandColor?: string | null;
  onOpenPost: (id: string) => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, ScheduledPost[]>();
    [...posts]
      .sort((a, b) => +new Date(a.scheduled_at) - +new Date(b.scheduled_at))
      .forEach((p) => {
        const k = toKey(new Date(p.scheduled_at));
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push(p);
      });
    return Array.from(m.entries());
  }, [posts]);

  if (grouped.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="h-5 w-5" />}
        title="Niets in deze periode"
        description="Er staan geen geplande posts in dit tijdvak. Kies een andere periode of plan een nieuwe post."
      />
    );
  }
  return (
    <div className="space-y-6">
      {grouped.map(([k, items]) => {
        const d = new Date(k);
        return (
          <div key={k}>
            <div className="text-xs uppercase tracking-[0.22em] text-gold/70 mb-2 capitalize">
              {d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" })}
            </div>
            <div className="space-y-3">
              {items.map((p) => (
                <PostRow
                  key={p.id}
                  post={p}
                  brandColor={brandColor}
                  onOpen={onOpenPost}
                  onApprove={onApprove}
                  onPublish={onPublish}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostRow({
  post,
  brandColor,
  onOpen,
  onApprove,
  onPublish,
  onDelete,
}: {
  post: ScheduledPost;
  brandColor?: string | null;
  onOpen: (id: string) => void;
  onApprove: (id: string) => void;
  onPublish: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const meta = PLATFORMS.find((x) => x.id === post.platform)!;
  const sm = STATUS_META[post.status as PostStatus];
  const mediaUrl = useSignedUrl(post.media_path);
  return (
    <div
      className="glass rounded-xl p-4 flex flex-col sm:flex-row gap-4 sm:items-start"
      style={{ borderLeft: `3px solid ${brandColor || GOLD_FALLBACK}` }}
    >
      <div className="shrink-0">
        {mediaUrl ? (
          post.media_type?.startsWith("video") ? (
            <video src={mediaUrl} className="h-20 w-20 rounded-lg object-cover" />
          ) : (
            <img src={mediaUrl} alt="" className="h-20 w-20 rounded-lg object-cover" />
          )
        ) : (
          <div
            className={cn(
              "h-20 w-20 rounded-lg bg-gradient-to-br grid place-items-center",
              meta.color,
            )}
          >
            <meta.Icon className="h-7 w-7 text-white" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs inline-flex items-center gap-1 text-foreground/80">
            <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
          </span>
          <span
            className={cn(
              "text-[10px] rounded-full px-2 py-0.5 inline-flex items-center gap-1 border",
              sm.cls,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", sm.dot)} /> {sm.label}
          </span>
          <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />{" "}
            {new Date(post.scheduled_at).toLocaleString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
              day: "numeric",
              month: "short",
            })}
          </span>
        </div>
        <p className="text-sm mt-2 line-clamp-2 whitespace-pre-wrap">
          {post.caption || <span className="text-muted-foreground italic">Geen caption</span>}
        </p>
        {post.error_message && (
          <div className="mt-1 text-[11px] text-red-300 inline-flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {post.error_message}
          </div>
        )}
      </div>
      <div className="flex flex-row flex-wrap sm:flex-col gap-1.5 shrink-0">
        <button
          onClick={() => onOpen(post.id)}
          className="text-[11px] rounded-full border border-border/40 min-h-11 px-3 hover:bg-accent/30 inline-flex items-center gap-1"
        >
          <Eye className="h-3 w-3" /> Bekijk
        </button>
        {post.status === "draft" && (
          <button
            onClick={() => onApprove(post.id)}
            className="text-[11px] rounded-full border border-sky-400/40 text-sky-300 hover:bg-sky-500/10 min-h-11 px-3 inline-flex items-center gap-1"
          >
            <CheckCircle2 className="h-3 w-3" /> Keur goed
          </button>
        )}
        {(post.status === "scheduled" || post.status === "draft") && (
          <button
            onClick={() => onPublish(post.id)}
            className="text-[11px] rounded-full border border-emerald-400/40 text-emerald-300 hover:bg-emerald-500/10 min-h-11 px-3 inline-flex items-center gap-1"
          >
            <Send className="h-3 w-3" /> Markeer gepubliceerd
          </button>
        )}
        <button
          onClick={() => onDelete(post.id)}
          className="text-[11px] rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 min-h-11 px-3 inline-flex items-center gap-1"
        >
          <Trash2 className="h-3 w-3" /> Verwijder
        </button>
      </div>
    </div>
  );
}

/* ------------------------------ COMPOSE MODAL ------------------------------ */
function ComposeModal({
  clientId,
  clientName,
  industry,
  defaultDate,
  editId,
  existing,
  userId,
  onClose,
  onSaved,
  onDelete,
}: {
  clientId: string;
  clientName: string;
  industry: string;
  defaultDate: Date;
  editId: string | null;
  existing: ScheduledPost | null;
  userId?: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const [platforms, setPlatforms] = useState<Platform[]>(
    existing ? [existing.platform as Platform] : ["instagram"],
  );
  const [caption, setCaption] = useState<string>(existing?.caption ?? "");
  const [notes, setNotes] = useState<string>(existing?.notes ?? "");
  const [mediaPath, setMediaPath] = useState<string | null>(existing?.media_path ?? null);
  const [mediaType, setMediaType] = useState<string | null>(existing?.media_type ?? null);
  const [scheduledAt, setScheduledAt] = useState<string>(() => {
    const d = existing ? new Date(existing.scheduled_at) : new Date(defaultDate);
    if (!existing && d.getHours() === 0) d.setHours(10, 0, 0, 0);
    d.setSeconds(0, 0);
    const tz = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tz * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [tone, setTone] = useState<string>("");
  const [brief, setBrief] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const existingRecurringRule = existing?.recurring_rule as RecurringRule | null | undefined;
  const [recurring, setRecurring] = useState<"none" | "daily" | "weekly" | "monthly">(
    existingRecurringRule?.freq ?? "none",
  );
  const [recurringCount, setRecurringCount] = useState<number>(existingRecurringRule?.count ?? 4);
  const [showNotes, setShowNotes] = useState<boolean>(!!existing?.notes);
  const captionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captionFn = useServerFn(generateCaption);

  const primary = platforms[0] ?? "instagram";
  const limit = CAPTION_LIMITS[primary];
  const overSoft = limit && caption.length > limit.soft;
  const overHard = limit && caption.length > limit.hard;

  const mediaUrl = useSignedUrl(mediaPath);

  // Welke kanalen zijn daadwerkelijk gekoppeld voor deze klant? Alleen daar
  // kun je naartoe plannen; de rest tonen we uitgeschakeld met uitleg.
  const { data: connectedPlatforms } = useQuery({
    queryKey: ["composer-connected-platforms", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("social_connections")
        .select("platform")
        .eq("client_id", clientId)
        .eq("status", "active");
      return (data ?? []).map((c) => c.platform as Platform);
    },
  });
  const isConnected = (p: Platform) => (connectedPlatforms ?? []).includes(p);

  // Nieuwe post: als de standaardkeuze (Instagram) niet gekoppeld is, val terug
  // op het eerste kanaal dat wél gekoppeld is — anders staat er een platform
  // voorgeselecteerd waar je niet naartoe kunt publiceren.
  useEffect(() => {
    if (editId || !connectedPlatforms?.length) return;
    setPlatforms((prev) =>
      prev.some((p) => connectedPlatforms.includes(p)) ? prev : [connectedPlatforms[0]],
    );
  }, [connectedPlatforms, editId]);

  // Best-time suggestions for the primary platform
  const { data: bestTimes } = useQuery({
    queryKey: ["best-times", primary],
    queryFn: async () => {
      const { data } = await supabase
        .from("best_time_benchmarks")
        .select("day_of_week,time_of_day,score,rationale")
        .eq("platform", primary)
        .order("score", { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  function togglePlatform(p: Platform) {
    if (editId) return;
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  function insertAtCursor(text: string) {
    const el = captionRef.current;
    if (!el) {
      setCaption((c) => c + text);
      return;
    }
    const start = el.selectionStart ?? caption.length;
    const end = el.selectionEnd ?? caption.length;
    const next = caption.slice(0, start) + text + caption.slice(end);
    setCaption(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + text.length;
    });
  }

  function applyBestTime(dayOfWeek: number, timeOfDay: string) {
    const base = new Date(scheduledAt);
    const cur = base.getDay();
    const diff = (dayOfWeek - cur + 7) % 7;
    const target = new Date(base);
    target.setDate(target.getDate() + (diff === 0 ? 7 : diff));
    const [h, m] = timeOfDay.split(":").map(Number);
    target.setHours(h, m, 0, 0);
    const tz = target.getTimezoneOffset();
    setScheduledAt(new Date(target.getTime() - tz * 60000).toISOString().slice(0, 16));
    toast.success("Beste tijd toegepast");
  }

  async function onPickFile(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "bin";
      // Binnen de klantmap houden: alle storage-policies isoleren op het
      // eerste pad-segment (client-id).
      const path = `${clientId}/planner/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (error) throw error;
      setMediaPath(path);
      setMediaType(file.type);
      toast.success("Media geüpload");
    } catch (e) {
      toast.error("Upload mislukt: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    if (!brief.trim()) return toast.error("Geef een korte briefing");
    setAiLoading(true);
    try {
      const res = await captionFn({
        data: {
          brief,
          platform: primary,
          tone,
          brand: `${clientName}${industry ? " — " + industry : ""}`,
        },
      });
      const text = (res.caption ?? "").trim();
      const tags = (res.hashtags ?? []).join(" ");
      setCaption(text + (tags ? `\n\n${tags}` : ""));
      toast.success("Caption gegenereerd");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setAiLoading(false);
    }
  }

  function expandRecurring(base: Date): Date[] {
    if (recurring === "none") return [base];
    const dates: Date[] = [];
    const n = Math.max(1, Math.min(52, recurringCount));
    for (let i = 0; i < n; i++) {
      const d = new Date(base);
      if (recurring === "daily") d.setDate(d.getDate() + i);
      else if (recurring === "weekly") d.setDate(d.getDate() + i * 7);
      else if (recurring === "monthly") d.setMonth(d.getMonth() + i);
      dates.push(d);
    }
    return dates;
  }

  async function save(asStatus: PostStatus, queueIt = false) {
    if (platforms.length === 0) return toast.error("Kies minimaal 1 platform");
    if (!queueIt && !scheduledAt) return toast.error("Kies een datum en tijd");
    if (overHard) return toast.error(`Caption te lang voor ${limit.label} (max ${limit.hard})`);
    setSaving(true);
    try {
      const recurringRule =
        recurring !== "none" && !editId ? { freq: recurring, count: recurringCount } : null;

      if (editId) {
        const { error } = await supabase
          .from("scheduled_posts")
          .update({
            caption: caption || null,
            notes: notes || null,
            media_path: mediaPath,
            media_type: mediaType,
            scheduled_at: new Date(scheduledAt).toISOString(),
            status: asStatus,
          })
          .eq("id", editId);
        if (error) throw error;
      } else if (queueIt) {
        // Add to queue — queue dispatcher assigns real time later
        const placeholder = new Date(scheduledAt || Date.now()).toISOString();
        const rows: TablesInsert<"scheduled_posts">[] = platforms.map((p) => ({
          client_id: clientId,
          platform: p,
          caption: caption || null,
          notes: notes || null,
          media_path: mediaPath,
          media_type: mediaType,
          scheduled_at: placeholder,
          status: "draft" as PostStatus,
          is_queued: true,
          created_by: userId ?? null,
        }));
        const { error } = await supabase.from("scheduled_posts").insert(rows);
        if (error) throw error;
      } else {
        const base = new Date(scheduledAt);
        const dates = expandRecurring(base);
        // For each platform × each date
        const rows: (TablesInsert<"scheduled_posts"> & {
          _isParent: boolean;
          _idx: number;
          _platform: Platform;
        })[] = [];
        for (const p of platforms) {
          const parentId: string | null = null;
          for (let i = 0; i < dates.length; i++) {
            rows.push({
              client_id: clientId,
              platform: p,
              caption: caption || null,
              notes: notes || null,
              media_path: mediaPath,
              media_type: mediaType,
              scheduled_at: dates[i].toISOString(),
              status: asStatus,
              recurring_rule: i === 0 ? recurringRule : null,
              _isParent: i === 0 && recurringRule ? true : false,
              _idx: i,
              _platform: p,
              created_by: userId ?? null,
            });
          }
          void parentId;
        }
        // Insert all without parent_recurring_id linkage (simple model)
        const insertRows = rows.map(({ _isParent, _idx, _platform, ...r }) => r);
        const { error } = await supabase.from("scheduled_posts").insert(insertRows);
        if (error) throw error;
      }
      const msg = queueIt
        ? `Toegevoegd aan wachtrij`
        : editId
          ? "Opgeslagen"
          : recurring !== "none"
            ? `${recurringCount}× ${platforms.length} post${platforms.length > 1 ? "s" : ""} aangemaakt`
            : `${platforms.length} post${platforms.length > 1 ? "s" : ""} aangemaakt`;
      toast.success(msg);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] overflow-y-auto glass-strong rounded-2xl border border-gold/20 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.22em] text-gold/80 inline-flex items-center gap-2">
              {editId ? "Post bewerken" : "Nieuwe post"}
              {existing &&
                (() => {
                  const sm = STATUS_META[existing.status as PostStatus];
                  return (
                    <span
                      className={cn(
                        "text-[10px] normal-case tracking-normal rounded-full px-2 py-0.5 inline-flex items-center gap-1 border",
                        sm.cls,
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", sm.dot)} /> {sm.label}
                    </span>
                  );
                })()}
            </div>
            <h2 className="font-display text-3xl mt-1">{clientName}</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-accent/40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          {/* Form */}
          <div className="space-y-4">
            {/* Platforms */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Platforms {editId && "(niet wijzigbaar)"}
              </div>
              <div className="flex flex-wrap gap-2">
                {VISIBLE_PLATFORMS.map((p) => {
                  const active = platforms.includes(p.id);
                  // Nog niet gekoppeld → niet aanklikbaar (je kunt er niet
                  // naartoe publiceren). Bij bewerken blijft alles vast.
                  const connected = isConnected(p.id);
                  const disabled = !!editId || !connected;
                  return (
                    <button
                      key={p.id}
                      onClick={() => togglePlatform(p.id)}
                      disabled={disabled}
                      title={
                        connected
                          ? undefined
                          : `${p.label} is nog niet gekoppeld voor deze klant — koppel het eerst via Kanalen`
                      }
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-sm inline-flex items-center gap-1.5 transition",
                        active
                          ? "bg-gold/15 text-gold border-gold/40"
                          : "border-border/40 text-muted-foreground hover:text-foreground",
                        disabled && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <p.Icon className="h-3.5 w-3.5" /> {p.label}
                      {!connected && <span className="text-[10px]">· niet gekoppeld</span>}
                    </button>
                  );
                })}
              </div>
              {connectedPlatforms && connectedPlatforms.length === 0 && (
                <p className="mt-2 text-xs text-amber-500">
                  Nog geen kanalen gekoppeld voor deze klant. Koppel ze eerst via Kanalen.
                </p>
              )}
            </div>

            {/* Media */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Media
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                }}
              />
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="rounded-full glass px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-gold/10"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {mediaPath ? "Vervang" : "Upload foto / video"}
                </button>
                {mediaPath && (
                  <button
                    onClick={() => {
                      setMediaPath(null);
                      setMediaType(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" /> Verwijder
                  </button>
                )}
                {mediaType && (
                  <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                    {mediaType.startsWith("video") ? (
                      <VideoIcon className="h-3 w-3" />
                    ) : (
                      <ImageIcon className="h-3 w-3" />
                    )}
                    {mediaType}
                  </span>
                )}
              </div>
            </div>

            {/* Schedule + best-time */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Datum & tijd
              </div>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
              />
              {bestTimes && bestTimes.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wider text-gold/70 inline-flex items-center gap-1">
                    <Zap className="h-3 w-3" /> Beste tijd
                  </span>
                  {bestTimes.map((bt, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applyBestTime(bt.day_of_week, bt.time_of_day)}
                      title={bt.rationale ?? ""}
                      className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[11px] hover:bg-gold/15"
                    >
                      {DAY_LABELS_LONG[bt.day_of_week]?.slice(0, 3)}{" "}
                      {String(bt.time_of_day).slice(0, 5)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Recurring */}
            {!editId && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 inline-flex items-center gap-1">
                  <Repeat className="h-3 w-3" /> Herhaling
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(
                    [
                      { v: "none", label: "Niet" },
                      { v: "daily", label: "Dagelijks" },
                      { v: "weekly", label: "Wekelijks" },
                      { v: "monthly", label: "Maandelijks" },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.v}
                      type="button"
                      onClick={() => setRecurring(r.v)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs transition",
                        recurring === r.v
                          ? "bg-gold/15 text-gold border-gold/40"
                          : "border-border/40 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                  {recurring !== "none" && (
                    <label className="text-xs text-muted-foreground inline-flex items-center gap-2">
                      Aantal:
                      <input
                        type="number"
                        min={1}
                        max={52}
                        value={recurringCount}
                        onChange={(e) => setRecurringCount(Number(e.target.value) || 1)}
                        className="w-16 rounded-lg bg-input/60 hairline px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-gold/40"
                      />
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Caption + AI + emoji */}
            <div>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Caption
                </div>
                <div className="flex items-center gap-2">
                  <EmojiPickerButton onSelect={insertAtCursor} />
                  <span
                    className={cn(
                      "text-[10px]",
                      overHard
                        ? "text-red-400 font-semibold"
                        : overSoft
                          ? "text-amber-400"
                          : "text-muted-foreground",
                    )}
                  >
                    {caption.length} / {limit?.hard ?? "—"}{" "}
                    {overSoft && !overHard && `(boven ${limit.label} preview ${limit.soft})`}
                    {overHard && ` (te lang voor ${limit.label})`}
                  </span>
                </div>
              </div>
              <textarea
                ref={captionRef}
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={8}
                placeholder="Schrijf je caption…"
                className={cn(
                  "w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40 resize-y",
                  overHard && "ring-2 ring-red-500/40",
                )}
              />

              <div className="mt-3 rounded-xl border border-gold/20 bg-gold/5 p-3 space-y-2">
                <div className="text-xs text-gold inline-flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> AI caption & hashtags
                </div>
                <input
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="Korte briefing — waar gaat de post over?"
                  className="w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
                />
                <div className="flex gap-2">
                  <input
                    value={tone}
                    onChange={(e) => setTone(e.target.value)}
                    placeholder="Tone (optioneel) — bijv. speels, professioneel"
                    className="flex-1 rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40"
                  />
                  <button
                    onClick={generate}
                    disabled={aiLoading}
                    className="rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}{" "}
                    Genereer
                  </button>
                </div>
              </div>
            </div>

            {/* Notes (internal) */}
            <div>
              <button
                type="button"
                onClick={() => setShowNotes((v) => !v)}
                className="text-xs uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
              >
                <StickyNote className="h-3 w-3" /> Interne notities {notes && `(${notes.length})`}
              </button>
              {showNotes && (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notities voor het team — niet zichtbaar in de post"
                  className="mt-2 w-full rounded-lg bg-input/60 hairline px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-gold/40 resize-y"
                />
              )}
            </div>
          </div>

          {/* Live preview */}
          <div className="space-y-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Live preview
            </div>
            <div className="space-y-4">
              {(platforms.length ? platforms : ["instagram" as Platform]).map((id) => {
                const meta = PLATFORMS.find((x) => x.id === id)!;
                return (
                  <div key={id} className="glass rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <meta.Icon className="h-3.5 w-3.5" /> {meta.label}
                      <span className="text-[10px] text-muted-foreground ml-auto">
                        {meta.ratio}
                      </span>
                    </div>
                    <div
                      className="rounded-lg overflow-hidden bg-surface/40 border border-border/30"
                      style={{ aspectRatio: meta.ratio }}
                    >
                      {mediaUrl ? (
                        mediaType?.startsWith("video") ? (
                          <video src={mediaUrl} controls className="h-full w-full object-cover" />
                        ) : (
                          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                        )
                      ) : (
                        <div
                          className={cn(
                            "h-full w-full bg-gradient-to-br grid place-items-center",
                            meta.color,
                          )}
                        >
                          <meta.Icon className="h-10 w-10 text-white/80" />
                        </div>
                      )}
                    </div>
                    {caption && (
                      <p className="text-xs mt-2 whitespace-pre-wrap line-clamp-6">{caption}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-border/30">
          {editId && onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="mr-auto rounded-full border border-destructive/40 text-destructive hover:bg-destructive/10 px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              <Trash2 className="h-4 w-4" /> Verwijder
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-full glass px-4 py-2 text-sm hover:bg-accent/30"
          >
            Annuleren
          </button>
          {!editId && (
            <button
              onClick={() => save("draft", true)}
              disabled={saving || overHard}
              className="rounded-full border border-violet-400/40 text-violet-300 hover:bg-violet-500/10 px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}{" "}
              Voeg toe aan queue
            </button>
          )}
          <button
            onClick={() => save("draft")}
            disabled={saving || overHard}
            className="rounded-full border border-amber-400/40 text-amber-300 hover:bg-amber-500/10 px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}{" "}
            Opslaan als concept
          </button>
          <button
            onClick={() => save("scheduled")}
            disabled={saving || overHard}
            className="rounded-full bg-gradient-gold text-primary-foreground px-4 py-2 text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}{" "}
            Goedkeuren & inplannen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ FEED PREVIEW ------------------------------ */
function FeedPreviewPanel({
  clientName,
  platform,
  setPlatform,
  posts,
  livePosts,
  days,
  setDays,
  open,
  setOpen,
  onOpenPost,
}: {
  clientName: string;
  platform: Platform | "all";
  setPlatform: (p: Platform | "all") => void;
  posts: FeedPost[];
  livePosts: PublishedFeedItem[];
  days: number;
  setDays: (d: number) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  onOpenPost: (id: string) => void;
}) {
  const isAll = platform === "all";
  const meta = isAll ? null : PLATFORMS.find((p) => p.id === platform)!;
  const label = isAll ? "Alle kanalen" : meta!.label;
  const ratio = isAll
    ? "1 / 1"
    : platform === "instagram"
      ? "1 / 1"
      : platform === "tiktok"
        ? "9 / 16"
        : platform === "youtube"
          ? "16 / 9"
          : "1.91 / 1";
  const cols =
    isAll || platform === "instagram" || platform === "tiktok"
      ? "grid-cols-3"
      : "grid-cols-2 md:grid-cols-3";
  const options: Array<{ id: Platform | "all"; label: string; Icon: LucideIcon }> = [
    { id: "all", label: "Alle", Icon: Layers },
    ...VISIBLE_PLATFORMS.map((p) => ({ id: p.id, label: p.label, Icon: p.Icon })),
  ];

  // De echte feed is er alleen per kanaal (Instagram/Facebook). Hebben we die,
  // dan tonen we onze eigen 'published'-rijen niet nog eens — die staan al in
  // de live feed. Zo krijg je één doorlopend beeld: bovenaan wat er de komende
  // dagen bij komt, daaronder wat er nu al op het profiel staat.
  const hasLive = livePosts.length > 0;
  const planned = hasLive ? posts.filter((p) => p.status !== "published") : posts;
  const tiles = [
    ...planned.map((p) => ({
      kind: "planned" as const,
      at: new Date(p.scheduled_at).getTime(),
      post: p,
    })),
    ...livePosts.map((l) => ({
      kind: "live" as const,
      at: new Date(l.publishedAt).getTime(),
      item: l,
    })),
  ].sort((a, b) => b.at - a.at);

  return (
    <div className="glass-strong rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {(() => {
            const Icon = isAll ? Layers : meta!.Icon;
            return <Icon className="h-4 w-4 text-gold" />;
          })()}
          <div className="text-sm">
            <span className="font-display text-base">Filter</span>
            <span className="text-muted-foreground">
              {" "}
              · {clientName} · {label}
            </span>
          </div>
        </div>
        {/* Wrapt op smalle schermen: kanaalkeuze + horizon + toggle passen
            samen niet op één telefoonregel. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-full glass p-1 text-[11px]">
            {options.map((pl) => (
              <button
                key={pl.id}
                type="button"
                onClick={() => setPlatform(pl.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 inline-flex items-center gap-1 transition cursor-pointer",
                  platform === pl.id
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <pl.Icon className="h-3 w-3" /> {pl.label}
              </button>
            ))}
          </div>
          {/* Hoe ver vooruit kijken we? Zo zie je hoe de feed er straks uitziet. */}
          <div className="inline-flex rounded-full glass p-1 text-[11px]">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                title={`Toon de planning tot ${d} dagen vooruit`}
                className={cn(
                  "rounded-full px-2.5 py-1 transition cursor-pointer",
                  days === d
                    ? "bg-gold/15 text-gold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={() => setOpen(!open)}
            className="rounded-full glass px-3 py-1 text-xs hover:bg-gold/10"
          >
            {open ? "Verberg preview" : "Toon preview"}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Filtert de hele planner en toont hoe de feed er over {days} dagen uitziet
        {hasLive ? " — inclusief de posts die nu al live op het profiel staan." : "."}
      </p>

      {open &&
        (tiles.length === 0 ? (
          <EmptyState
            icon={<ImageIcon className="h-5 w-5" />}
            title={`Nog geen posts voor ${label}`}
            description="Plan een post in om de feed-preview van dit kanaal te zien."
            className="py-8"
          />
        ) : (
          <>
            <div className={cn("grid gap-1 rounded-xl overflow-hidden hairline", cols)}>
              {tiles.map((t) =>
                t.kind === "planned" ? (
                  <FeedTile
                    key={`p-${t.post.id}`}
                    post={t.post}
                    ratio={ratio}
                    onOpen={() => onOpenPost(t.post.id)}
                  />
                ) : (
                  <LiveFeedTile key={`l-${t.item.id}`} item={t.item} ratio={ratio} />
                ),
              )}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Nieuwste links · Goudgekaderd = ingepland · Groen vinkje = gepubliceerd · Amber =
              wacht op goedkeuring
              {hasLive && " · Tegels zonder rand staan al live op het profiel"}
            </p>
          </>
        ))}
    </div>
  );
}

/** Tegel voor een post die al écht op het profiel staat (via de platform-API). */
function LiveFeedTile({ item, ratio }: { item: PublishedFeedItem; ratio: string }) {
  const inner = (
    <>
      {item.mediaUrl ? (
        <img src={item.mediaUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="h-full w-full grid place-items-center bg-gradient-to-br from-gold/20 to-gold/5">
          <ImageIcon className="h-6 w-6 text-gold/60" />
        </div>
      )}
      {item.isVideo && (
        <div className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
          <VideoIcon className="h-3 w-3 text-white" />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1">
        <div className="text-[9px] text-white/80">
          {new Date(item.publishedAt).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "short",
          })}
        </div>
      </div>
    </>
  );

  const cls = "relative bg-surface-elevated/60 overflow-hidden group block";
  return item.permalink ? (
    <a
      href={item.permalink}
      target="_blank"
      rel="noreferrer"
      className={cls}
      style={{ aspectRatio: ratio }}
      title="Openen op het platform"
    >
      {inner}
    </a>
  ) : (
    <div className={cls} style={{ aspectRatio: ratio }}>
      {inner}
    </div>
  );
}

function FeedTile({ post, ratio, onOpen }: { post: FeedPost; ratio: string; onOpen: () => void }) {
  const mediaUrl = useSignedUrl(post.media_path);
  const sm = STATUS_META[post.status as PostStatus];
  const isVideo = post.media_type?.startsWith("video");
  const ringCls =
    post.status === "published"
      ? "ring-emerald-400/60"
      : post.status === "scheduled" || post.status === "publishing"
        ? "ring-gold/70"
        : post.status === "failed"
          ? "ring-red-400/60"
          : "ring-amber-400/50";

  return (
    <button
      onClick={onOpen}
      className={cn(
        "relative bg-surface-elevated/60 ring-2 ring-inset overflow-hidden group",
        ringCls,
      )}
      style={{ aspectRatio: ratio }}
    >
      {mediaUrl ? (
        isVideo ? (
          <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
        ) : (
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="h-full w-full grid place-items-center bg-gradient-to-br from-gold/20 to-gold/5">
          <ImageIcon className="h-6 w-6 text-gold/60" />
        </div>
      )}
      {isVideo && (
        <div className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
          <VideoIcon className="h-3 w-3 text-white" />
        </div>
      )}
      {post.status === "published" ? (
        <div className="absolute top-1 right-1 rounded-full bg-black/70 p-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        </div>
      ) : (
        <div className="absolute top-1 left-1 inline-flex items-center gap-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] text-white">
          <Clock className="h-2.5 w-2.5" />
          {new Date(post.scheduled_at).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "short",
          })}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition">
        <p className="text-[10px] text-white line-clamp-2">{post.caption || "Geen caption"}</p>
      </div>
    </button>
  );
}
