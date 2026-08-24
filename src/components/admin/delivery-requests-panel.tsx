import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/empty-state";
import {
  createDeliveryRequest,
  deleteDeliveryRequest,
  setDeliveryRequestStatus,
  type DeliveryKind,
} from "@/lib/deliverables.functions";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

/**
 * Aanleververzoeken beheren vanuit de klantpagina. Wat je hier aanmaakt komt bij
 * de klant in het portaal op de aanleverlijst te staan, met voortgang die
 * meeloopt zodra hij bestanden uploadt.
 */

const KINDS: { value: DeliveryKind; label: string }[] = [
  { value: "media", label: "Beeld & video" },
  { value: "info", label: "Informatie" },
  { value: "access", label: "Toegang" },
  { value: "approval", label: "Akkoord" },
];

/** Standaardverzoeken die bij bijna elke nieuwe klant terugkomen. */
const PRESETS: { title: string; kind: DeliveryKind; quantity: number; description: string }[] = [
  {
    title: "Beeldmateriaal van deze maand",
    kind: "media",
    quantity: 10,
    description: "Foto's of video's van producten, werk of het team — liefst staand (9:16).",
  },
  {
    title: "Logo en huisstijl",
    kind: "media",
    quantity: 1,
    description: "Logo in hoge resolutie (PNG met transparante achtergrond) plus je kleurcodes.",
  },
  {
    title: "Aanbod en aanbiedingen komende maand",
    kind: "info",
    quantity: 1,
    description: "Wat wil je uitlichten? Acties, nieuwe producten, evenementen of nieuws.",
  },
];

export function DeliveryRequestsPanel({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const create = useServerFn(createDeliveryRequest);
  const setStatus = useServerFn(setDeliveryRequestStatus);
  const remove = useServerFn(deleteDeliveryRequest);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<DeliveryKind>("media");
  const [quantity, setQuantity] = useState(1);
  const [dueDate, setDueDate] = useState("");

  const { data: requests } = useQuery({
    queryKey: ["delivery-requests", clientId],
    queryFn: async () =>
      (
        await supabase
          .from("delivery_requests")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["delivery-requests", clientId] });
    qc.invalidateQueries({ queryKey: ["delivery-overview", clientId] });
  };

  const addMut = useMutation({
    mutationFn: (vars: {
      title: string;
      description?: string;
      kind: DeliveryKind;
      quantityNeeded: number;
      dueDate?: string;
    }) => create({ data: { clientId, ...vars } }),
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setQuantity(1);
      setDueDate("");
      invalidate();
      toast.success("Verzoek toegevoegd — de klant ziet het direct in het portaal");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const statusMut = useMutation({
    mutationFn: (vars: { id: string; status: "open" | "done" }) => setStatus({ data: vars }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-gold/10 bg-card p-5">
        <h3 className="font-display text-xl">Nieuw aanleververzoek</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Wat heb je van deze klant nodig? Het verschijnt meteen op zijn aanleverlijst.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.title}
              type="button"
              onClick={() => {
                setTitle(p.title);
                setDescription(p.description);
                setKind(p.kind);
                setQuantity(p.quantity);
              }}
              className="rounded-full border border-gold/30 px-3 h-8 text-xs text-gold hover:bg-gold/10"
            >
              {p.title}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titel, bv. 5 foto's van de nieuwe collectie"
            className="sm:col-span-2 min-h-11 rounded-lg bg-input/60 hairline px-4 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Toelichting (optioneel) — hoe concreter, hoe beter wat je terugkrijgt"
            className="sm:col-span-2 min-h-[80px] rounded-lg bg-input/60 hairline px-4 py-3 text-sm"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as DeliveryKind)}
            className="min-h-11 rounded-lg bg-input/60 hairline px-4 text-sm"
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <DatePicker
            value={dueDate}
            onChange={setDueDate}
            className="min-h-11 rounded-lg bg-input/60 hairline px-4 text-sm"
          />
          {kind === "media" && (
            <label className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Aantal bestanden</span>
              <input
                type="number"
                min={1}
                max={100}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(100, Number(e.target.value))))}
                className="w-20 min-h-11 rounded-lg bg-input/60 hairline px-3 text-sm tabular-nums lining-nums"
              />
            </label>
          )}
        </div>

        <button
          type="button"
          disabled={title.trim().length < 2 || addMut.isPending}
          onClick={() =>
            addMut.mutate({
              title: title.trim(),
              description: description.trim() || undefined,
              kind,
              quantityNeeded: kind === "media" ? quantity : 1,
              dueDate: dueDate || undefined,
            })
          }
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gold px-4 h-10 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" /> Toevoegen
        </button>
      </div>

      {(requests?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Clock className="h-5 w-5" />}
          title="Nog geen verzoeken"
          description="Zodra je iets aanvraagt ziet de klant het in zijn portaal, met deadline en voortgang."
        />
      ) : (
        <ul className="space-y-2">
          {requests?.map((r) => {
            const done = r.status === "done";
            return (
              <li
                key={r.id}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3.5",
                  done ? "border-border/60 bg-muted/20" : "border-gold/10 bg-card",
                )}
              >
                <button
                  type="button"
                  onClick={() => statusMut.mutate({ id: r.id, status: done ? "open" : "done" })}
                  className="mt-0.5 shrink-0 text-gold"
                  aria-label={done ? "Heropenen" : "Afronden"}
                >
                  <CheckCircle2 className={cn("h-5 w-5", !done && "opacity-30")} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("text-sm font-medium", done && "line-through opacity-60")}>
                      {r.title}
                    </span>
                    <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {KINDS.find((k) => k.value === r.kind)?.label ?? r.kind}
                    </span>
                    {r.due_date && (
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(`${r.due_date}T12:00:00`), "d MMM yyyy", { locale: nl })}
                      </span>
                    )}
                  </div>
                  {r.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{r.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => delMut.mutate(r.id)}
                  className="shrink-0 text-muted-foreground hover:text-red-400"
                  aria-label="Verwijderen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
