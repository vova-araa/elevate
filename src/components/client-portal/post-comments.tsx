import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MessageSquare, Send, Loader2 } from "lucide-react";

/**
 * Commentaar-thread onder een geplande post (approval-flow klantportaal).
 * Toont bestaande post_comments (oplopend op created_at) en laat de
 * ingelogde gebruiker altijd nieuw commentaar toevoegen.
 */
export function PostComments({
  postId,
  clientId,
  autoFocus = false,
}: {
  postId: string;
  clientId: string;
  autoFocus?: boolean;
}) {
  const qc = useQueryClient();
  const { user, role } = useAuth();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: comments, isLoading } = useQuery({
    queryKey: ["post-comments", postId],
    queryFn: async () =>
      (
        await supabase
          .from("post_comments")
          .select("*")
          .eq("post_id", postId)
          .order("created_at", { ascending: true })
      ).data ?? [],
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || !user) return;
    setBusy(true);
    const { error } = await supabase.from("post_comments").insert({
      post_id: postId,
      client_id: clientId,
      author_id: user.id,
      author_role: role === "admin" ? "team" : "client",
      body: text,
    });
    setBusy(false);
    if (error) return toast.error("Commentaar plaatsen mislukt: " + error.message);
    setBody("");
    toast.success("Commentaar geplaatst");
    qc.invalidateQueries({ queryKey: ["post-comments", postId] });
  }

  return (
    <div className="mt-3 rounded-xl border border-gold/10 bg-surface/40 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5 text-gold" />
        Opmerkingen
        {comments && comments.length > 0 && (
          <span className="rounded-full bg-gold/15 text-gold px-1.5 py-0.5 text-[10px] font-medium">
            {comments.length}
          </span>
        )}
      </div>

      <div className="mt-2 space-y-2">
        {isLoading && (
          <div className="flex justify-center py-3">
            <Loader2 className="h-4 w-4 animate-spin text-gold" />
          </div>
        )}
        {!isLoading && (comments?.length ?? 0) === 0 && (
          <p className="text-xs text-muted-foreground py-1">
            Nog geen opmerkingen bij deze post.
          </p>
        )}
        {comments?.map((c) => {
          const isClient = c.author_role === "client";
          return (
            <div key={c.id} className="rounded-lg bg-surface/60 border border-border/30 p-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    "text-[10px] rounded-full border px-2 py-0.5 uppercase tracking-wider",
                    isClient
                      ? "text-gold bg-gold/10 border-gold/30"
                      : "text-sky-300 bg-sky-500/10 border-sky-400/30",
                  )}
                >
                  {isClient ? "Klant" : "Team"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(c.created_at).toLocaleString("nl-NL", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p className="mt-1.5 text-sm whitespace-pre-wrap break-words">{c.body}</p>
            </div>
          );
        })}
      </div>

      <form onSubmit={submit} className="mt-3 flex flex-col sm:flex-row gap-2">
        <textarea
          autoFocus={autoFocus}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Schrijf een opmerking…"
          rows={2}
          className="flex-1 text-sm rounded-lg bg-input/60 hairline px-3 py-2 outline-none focus:ring-2 focus:ring-gold/40 resize-none min-h-11"
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="min-h-11 rounded-lg bg-gradient-gold px-4 py-2 text-xs font-medium text-primary-foreground disabled:opacity-50 inline-flex items-center justify-center gap-1.5 shrink-0"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Plaatsen
        </button>
      </form>
    </div>
  );
}
