import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { MessagesThread } from "@/components/messages-thread";
import { MessageSquare, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/client/messages")({
  component: ClientMessages,
});

function ClientMessages() {
  const { user } = useAuth();

  const { data: membership, isLoading } = useQuery({
    queryKey: ["my-client", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_members")
        .select("client_id, clients(name)")
        .eq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-gold" />
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="glass rounded-2xl p-10 text-center">
        <MessageSquare className="h-8 w-8 text-gold mx-auto mb-3" />
        <h2 className="font-display text-2xl">Geen actieve klantkoppeling</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Zodra je gekoppeld bent aan een bedrijf verschijnen hier berichten van je Elevate-team.
        </p>
      </div>
    );
  }

  const clientId = (membership as any).client_id as string;
  const clientName = (membership as any).clients?.name as string | undefined;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="text-xs uppercase tracking-[0.22em] text-gold/80">Berichten</p>
        <h1 className="font-display text-4xl">{clientName ?? "Gesprek"}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Directe lijn met je Elevate-team. Reageer op deliverables, vragen of strategie.
        </p>
      </div>
      <MessagesThread clientId={clientId} asRole="client" />
    </div>
  );
}
