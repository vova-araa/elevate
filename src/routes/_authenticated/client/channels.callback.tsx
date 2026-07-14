import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { completePostizConnect } from "@/lib/postiz-connect.functions";

const searchSchema = z.object({
  platform: z.enum(["instagram", "tiktok", "linkedin", "youtube", "facebook"]),
  code: z.string().min(1).max(200),
  clientId: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/client/channels/callback")({
  validateSearch: (s) => searchSchema.parse(s),
  component: CallbackPage,
});

function CallbackPage() {
  const { platform, code, clientId } = Route.useSearch();
  const complete = useServerFn(completePostizConnect);
  const navigate = useNavigate();
  const ran = useRef(false);
  const stateRef = useRef<"working" | "done" | "error">("working");
  const messageRef = useRef<string>("");

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    (async () => {
      try {
        const res = await complete({ data: { platform, code, clientId } });
        stateRef.current = "done";
        toast.success(`${platform[0].toUpperCase() + platform.slice(1)} succesvol gekoppeld!`);
        messageRef.current = `Verbonden als ${res.handle}`;
        setTimeout(() => navigate({ to: "/client/channels" }), 600);
      } catch (e: any) {
        stateRef.current = "error";
        messageRef.current = e?.message ?? "Koppeling mislukt";
        toast.error("Koppeling mislukt — probeer opnieuw");
      }
    })();
  }, [platform, code, clientId, complete, navigate]);

  return (
    <div className="grid place-items-center min-h-[60vh]">
      <div className="rounded-2xl border border-gold/15 bg-card p-8 max-w-sm w-full text-center space-y-3">
        {stateRef.current === "working" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-gold mx-auto" />
            <div className="font-medium">{platform} verbinden…</div>
            <p className="text-xs text-muted-foreground">Een moment, we ronden het af.</p>
          </>
        )}
        {stateRef.current === "done" && (
          <>
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
            <div className="font-medium">Gekoppeld!</div>
            <p className="text-xs text-muted-foreground">{messageRef.current}</p>
          </>
        )}
        {stateRef.current === "error" && (
          <>
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <div className="font-medium">Koppeling mislukt</div>
            <p className="text-xs text-muted-foreground">{messageRef.current}</p>
            <button
              onClick={() => navigate({ to: "/client/channels" })}
              className="mt-2 text-xs h-8 px-3 rounded-lg bg-gold/20 text-gold"
            >
              Terug naar kanalen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
