import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PLATFORMS, type Platform } from "@/components/planner/planner-shared";
import { bulkCreatePosts, getBestTimes } from "@/lib/bulk-planner.functions";
import {
  ClipboardPaste,
  Upload,
  Download,
  Loader2,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Wand2,
  ExternalLink,
} from "lucide-react";

const searchSchema = z.object({
  clientId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/admin/bulk")({
  validateSearch: searchSchema,
  component: BulkPlannerPage,
});

const VALID_PLATFORMS = new Set<string>(PLATFORMS.map((p) => p.id));

type RowStatus = "geldig" | "waarschuwing" | "fout";

interface ParsedRow {
  line: number;
  rawDate: string;
  rawTime: string;
  rawPlatform: string;
  caption: string;
  platforms: Platform[];
  status: RowStatus;
  messages: string[];
}

/** Kleine CSV-lijnparser met ondersteuning voor quotes en komma's binnen velden. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
    } else if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function isValidCalendarDate(raw: string): boolean {
  if (!DATE_RE.test(raw)) return false;
  const d = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  // Voorkom dat bv. 2026-02-30 stilletjes overloopt naar maart.
  return d.toISOString().slice(0, 10) === raw;
}

/**
 * Parseert geplakte of geüploade CSV-tekst naar rijen met validatiestatus.
 * Kolommen (header-regel, case-insensitive, flexibele volgorde): date, time
 * (optioneel), platform (komma/pipe-gescheiden), caption.
 */
function parseCsv(text: string): { rows: ParsedRow[]; globalError: string | null } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], globalError: "Geen inhoud gevonden" };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const dateIdx = header.indexOf("date");
  const timeIdx = header.indexOf("time");
  const platformIdx = header.indexOf("platform");
  const captionIdx = header.indexOf("caption");

  const missing = [
    dateIdx < 0 ? "date" : null,
    platformIdx < 0 ? "platform" : null,
    captionIdx < 0 ? "caption" : null,
  ].filter((v): v is string => !!v);
  if (missing.length > 0) {
    return {
      rows: [],
      globalError: `CSV mist verplichte kolom(men): ${missing.join(", ")}`,
    };
  }

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]);
    if (parts.every((p) => p === "")) continue;

    const rawDate = parts[dateIdx] ?? "";
    const rawTime = timeIdx >= 0 ? (parts[timeIdx] ?? "") : "";
    const rawPlatform = parts[platformIdx] ?? "";
    const caption = parts[captionIdx] ?? "";

    const messages: string[] = [];

    if (!rawDate) {
      messages.push("Datum ontbreekt");
    } else if (!isValidCalendarDate(rawDate)) {
      messages.push("Ongeldige datum (verwacht YYYY-MM-DD)");
    }

    if (rawTime && !TIME_RE.test(rawTime)) {
      messages.push("Ongeldige tijd (verwacht HH:mm)");
    }

    const tokens = rawPlatform
      .split(/[,|]/)
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const unknown = tokens.filter((t) => !VALID_PLATFORMS.has(t));
    const validPlatforms = tokens.filter((t): t is Platform => VALID_PLATFORMS.has(t));
    if (tokens.length === 0) {
      messages.push("Platform ontbreekt");
    } else if (unknown.length > 0) {
      messages.push(`Onbekend platform: ${unknown.join(", ")}`);
    }

    if (!caption.trim()) {
      messages.push("Caption is leeg");
    }

    const hasBlockingError = messages.length > 0;
    const warnings: string[] = [];
    if (!hasBlockingError && !rawTime) {
      warnings.push("Tijd ontbreekt — wordt automatisch aangevuld");
    }

    const status: RowStatus = hasBlockingError
      ? "fout"
      : warnings.length > 0
        ? "waarschuwing"
        : "geldig";

    rows.push({
      line: i + 1,
      rawDate,
      rawTime,
      rawPlatform,
      caption: caption.trim(),
      platforms: validPlatforms,
      status,
      messages: hasBlockingError ? messages : warnings,
    });
  }

  return { rows, globalError: null };
}

function downloadTemplate() {
  const csv = [
    "date,time,platform,caption",
    '2026-07-20,09:00,instagram,"Zomerse update over ons nieuwste product!"',
    '2026-07-21,,linkedin|facebook,"Deze week delen we inzichten over groei."',
    '2026-07-22,18:30,tiktok,"Snelle tip in 15 seconden"',
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bulk-planner-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const STATUS_BADGE: Record<RowStatus, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  geldig: {
    label: "Geldig",
    cls: "border-emerald-400/40 text-emerald-400 bg-emerald-500/10",
    Icon: CheckCircle2,
  },
  waarschuwing: {
    label: "Waarschuwing",
    cls: "border-amber-400/40 text-amber-400 bg-amber-500/10",
    Icon: AlertTriangle,
  },
  fout: {
    label: "Fout",
    cls: "border-red-400/40 text-red-400 bg-red-500/10",
    Icon: XCircle,
  },
};

function BulkPlannerPage() {
  const { clientId } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const bulkCreateFn = useServerFn(bulkCreatePosts);
  const bestTimesFn = useServerFn(getBestTimes);

  const [csvText, setCsvText] = useState("");
  const [fillBestTimes, setFillBestTimes] = useState(true);
  const [parsed, setParsed] = useState<{ rows: ParsedRow[]; globalError: string | null } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileBusy, setFileBusy] = useState(false);
  const [lastImportedClientId, setLastImportedClientId] = useState<string | null>(null);

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["bulk-planner-clients"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color").order("name")).data ?? [],
  });

  const selected = clients?.find((c) => c.id === clientId) ?? clients?.[0];
  const activeId = selected?.id;

  if (!clientId && activeId) {
    navigate({ to: "/admin/bulk", search: { clientId: activeId }, replace: true });
  }

  const importableRows = useMemo(
    () => (parsed?.rows ?? []).filter((r) => r.status !== "fout"),
    [parsed],
  );
  const validCount = importableRows.length;
  const errorCount = (parsed?.rows ?? []).filter((r) => r.status === "fout").length;

  const missingTimePlatforms = useMemo(() => {
    const set = new Set<Platform>();
    for (const row of importableRows) {
      if (!row.rawTime) row.platforms.forEach((p) => set.add(p));
    }
    return Array.from(set).sort();
  }, [importableRows]);

  const bestTimesQuery = useQuery({
    queryKey: ["bulk-planner-best-times", activeId, missingTimePlatforms],
    queryFn: async () =>
      bestTimesFn({
        data: { clientId: activeId ?? null, platforms: missingTimePlatforms },
      }),
    enabled: fillBestTimes && missingTimePlatforms.length > 0,
  });

  function runParse(text: string) {
    if (!text.trim()) {
      setParsed(null);
      return;
    }
    const result = parseCsv(text);
    setParsed(result);
    if (result.globalError) {
      toast.error(result.globalError);
    }
  }

  async function onFile(file: File) {
    setFileBusy(true);
    try {
      const reader = new FileReader();
      const text = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("Bestand lezen mislukt"));
        reader.readAsText(file);
      });
      setCsvText(text);
      runParse(text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setFileBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!activeId) throw new Error("Kies eerst een klant");
      const items: { scheduledAt: string; platform: Platform; caption: string }[] = [];
      for (const row of importableRows) {
        for (const platform of row.platforms) {
          const effectiveTime =
            row.rawTime || (fillBestTimes ? bestTimesQuery.data?.[platform] : undefined) || "09:00";
          const iso = new Date(`${row.rawDate}T${effectiveTime}:00`).toISOString();
          items.push({ scheduledAt: iso, platform, caption: row.caption });
        }
      }
      return bulkCreateFn({ data: { clientId: activeId, rows: items } });
    },
    onSuccess: (res) => {
      toast.success(`${res.inserted} post${res.inserted === 1 ? "" : "s"} ingepland`);
      setLastImportedClientId(activeId ?? null);
      setCsvText("");
      setParsed(null);
      qc.invalidateQueries({ queryKey: ["scheduled-posts"] });
    },
    onError: (e) => {
      toast.error(e instanceof Error ? e.message : String(e));
    },
  });

  const waitingOnBestTimes =
    fillBestTimes && missingTimePlatforms.length > 0 && bestTimesQuery.isLoading;

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-gradient-gold grid place-items-center text-primary-foreground">
          <CalendarClock className="h-5 w-5" />
        </div>
        <div>
          <h1 className="font-display text-2xl leading-tight">Bulk-planner</h1>
          <p className="text-xs text-muted-foreground">
            Plan in één keer veel posts in via CSV-import
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Klant</CardTitle>
          <CardDescription>Kies de klant waarvoor je posts gaat importeren.</CardDescription>
        </CardHeader>
        <CardContent>
          {clientsLoading ? (
            <Skeleton className="h-9 w-64" />
          ) : clients && clients.length > 0 ? (
            <Select
              value={activeId}
              onValueChange={(v) => navigate({ to: "/admin/bulk", search: { clientId: v } })}
            >
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Kies een klant" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">
              Geen klanten gevonden. Maak eerst een klant aan.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">CSV-import</CardTitle>
            <CardDescription>
              Kolommen: <code className="text-gold">date</code> (YYYY-MM-DD),{" "}
              <code className="text-gold">time</code> (HH:mm, optioneel),{" "}
              <code className="text-gold">platform</code> (één of meerdere, komma/pipe-gescheiden),{" "}
              <code className="text-gold">caption</code>.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
            <Download className="h-3.5 w-3.5" /> Voorbeeld-template
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs defaultValue="paste">
            <TabsList>
              <TabsTrigger value="paste" className="gap-1.5">
                <ClipboardPaste className="h-3.5 w-3.5" /> Plakken
              </TabsTrigger>
              <TabsTrigger value="file" className="gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Bestand uploaden
              </TabsTrigger>
            </TabsList>
            <TabsContent value="paste" className="mt-3 space-y-2">
              <Textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder='date,time,platform,caption&#10;2026-07-20,09:00,instagram,"Mijn caption"'
                rows={8}
                className="font-mono text-xs"
              />
              <Button size="sm" onClick={() => runParse(csvText)} disabled={!csvText.trim()}>
                Valideren
              </Button>
            </TabsContent>
            <TabsContent value="file" className="mt-3 space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={fileBusy}
              >
                {fileBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                Kies .csv-bestand
              </Button>
              {csvText && (
                <p className="text-xs text-muted-foreground">
                  Bestand geladen ({csvText.split(/\r?\n/).filter(Boolean).length} regels).
                </p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-2 rounded-lg border border-gold/10 bg-muted/30 px-3 py-2">
            <Switch
              id="fill-best-times"
              checked={fillBestTimes}
              onCheckedChange={setFillBestTimes}
            />
            <Label
              htmlFor="fill-best-times"
              className="text-xs cursor-pointer flex items-center gap-1.5"
            >
              <Wand2 className="h-3.5 w-3.5 text-gold" />
              Vul ontbrekende tijden met beste tijd (anders standaard 09:00)
            </Label>
          </div>
        </CardContent>
      </Card>

      {parsed && parsed.rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Validatie-preview</CardTitle>
              <CardDescription>
                <span className="text-emerald-400 font-medium">{validCount} geldig</span>
                {", "}
                <span className="text-red-400 font-medium">{errorCount} fout</span>
                {waitingOnBestTimes && " — beste tijden ophalen…"}
              </CardDescription>
            </div>
            <Button
              onClick={() => importMutation.mutate()}
              disabled={
                validCount === 0 || !activeId || importMutation.isPending || waitingOnBestTimes
              }
            >
              {importMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CalendarClock className="h-3.5 w-3.5" />
              )}
              Importeer {validCount > 0 ? `(${validCount})` : ""}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="max-h-[28rem] overflow-y-auto rounded-lg border border-gold/10">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Regel</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Tijd</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Caption</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Melding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.rows.map((row) => {
                    const meta = STATUS_BADGE[row.status];
                    return (
                      <TableRow key={row.line}>
                        <TableCell className="text-muted-foreground">{row.line}</TableCell>
                        <TableCell>{row.rawDate || "—"}</TableCell>
                        <TableCell>{row.rawTime || "—"}</TableCell>
                        <TableCell>
                          {row.platforms.length > 0
                            ? row.platforms.join(", ")
                            : row.rawPlatform || "—"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate" title={row.caption}>
                          {row.caption || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={meta.cls}>
                            <meta.Icon className="h-3 w-3 mr-1" />
                            {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.messages.join("; ") || "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {parsed?.globalError && (
        <Card>
          <CardContent className="p-4 text-sm text-red-400 flex items-center gap-2">
            <XCircle className="h-4 w-4" /> {parsed.globalError}
          </CardContent>
        </Card>
      )}

      {importMutation.isSuccess && lastImportedClientId && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              Import voltooid. Bekijk de nieuwe posts in de planner.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate({ to: "/admin/planner", search: { clientId: lastImportedClientId } })
              }
            >
              Bekijk in planner <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
