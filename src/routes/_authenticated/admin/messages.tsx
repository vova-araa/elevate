import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessagesThread } from "@/components/messages-thread";
import { z } from "zod";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

const searchSchema = z.object({ clientId: z.string().uuid().optional() });

export const Route = createFileRoute("/_authenticated/admin/messages")({
  validateSearch: searchSchema,
  component: AdminMessages,
});

function AdminMessages() {
  const { clientId } = Route.useSearch();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const { data: clients } = useQuery({
    queryKey: ["clients-msg"],
    queryFn: async () =>
      (await supabase.from("clients").select("id,name,brand_color,logo_url").order("name")).data ??
      [],
  });

  const { data: lastMessages } = useQuery({
    queryKey: ["last-messages"],
    queryFn: async () => {
      const { data } = await supabase
        .from("messages")
        .select("client_id, body, created_at, sender_role")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  type LastMessage = Pick<Tables<"messages">, "client_id" | "body" | "created_at" | "sender_role">;
  const lastByClient = new Map<string, LastMessage>();
  lastMessages?.forEach((m) => {
    if (!lastByClient.has(m.client_id)) lastByClient.set(m.client_id, m);
  });

  const filtered = (clients ?? []).filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  // Sort: those with messages first, by recency
  filtered.sort((a, b) => {
    const ta = lastByClient.get(a.id)?.created_at ?? "";
    const tb = lastByClient.get(b.id)?.created_at ?? "";
    return tb.localeCompare(ta);
  });

  const selected = clients?.find((c) => c.id === clientId) ?? filtered[0];
  const activeId = selected?.id;

  if (!clients) return <Loader2 className="h-6 w-6 animate-spin text-gold" />;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.25em] text-gold/70">Module 6</div>
        <h1 className="font-display text-3xl sm:text-4xl text-gold mt-1">Berichten</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Alle klant-conversaties in één overzicht. Reageer, deel deliverables en feedback.
        </p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 min-h-[600px]">
        {/* Sidebar */}
        <div className="glass-strong rounded-xl p-3 flex flex-col">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Zoek klant..."
              className="w-full rounded-lg border border-gold/15 bg-background/60 pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
            {filtered.map((c) => {
              const last = lastByClient.get(c.id);
              const isActive = c.id === activeId;
              return (
                <button
                  key={c.id}
                  onClick={() => navigate({ to: "/admin/messages", search: { clientId: c.id } })}
                  className={cn(
                    "w-full flex items-start gap-3 rounded-lg p-3 text-left transition",
                    isActive ? "bg-gold/15 text-foreground" : "hover:bg-accent/30",
                  )}
                >
                  {c.logo_url ? (
                    <img
                      src={c.logo_url}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="h-9 w-9 rounded-full shrink-0"
                      style={{ background: c.brand_color || "#D4B97A" }}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {last
                        ? (last.sender_role === "admin" ? "Jij: " : "") + (last.body ?? "")
                        : "Geen berichten"}
                    </div>
                  </div>
                  {last && (
                    <div className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(last.created_at).toLocaleDateString("nl-NL", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  )}
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                Geen klanten gevonden
              </p>
            )}
          </div>
        </div>

        {/* Thread */}
        <div className="glass-strong rounded-xl p-4 flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-gold/10">
                {selected.logo_url ? (
                  <img
                    src={selected.logo_url}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="h-10 w-10 rounded-full"
                    style={{ background: selected.brand_color || "#D4B97A" }}
                  />
                )}
                <div>
                  <div className="font-display text-lg">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">Klant-conversatie</div>
                </div>
              </div>
              <MessagesThread clientId={selected.id} asRole="admin" />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-muted-foreground">
              <MessageSquare className="h-10 w-10 mb-3 text-gold/60" />
              <p className="text-sm">Kies een klant om de conversatie te openen.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
