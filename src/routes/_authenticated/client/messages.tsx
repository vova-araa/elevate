import { createFileRoute } from "@tanstack/react-router";
import { useActiveClient } from "@/hooks/use-active-client";
import { MessagesThread } from "@/components/messages-thread";

export const Route = createFileRoute("/_authenticated/client/messages")({
  component: ClientMessages,
});

function ClientMessages() {
  const { clientId, clientName } = useActiveClient();

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
