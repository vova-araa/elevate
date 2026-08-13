import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, Clock, Loader2, SearchX } from "lucide-react";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDeletionStatus } from "@/lib/data-deletion.functions";

/**
 * Statuspagina waar Meta de gebruiker naartoe stuurt na een verwijderverzoek.
 * De bevestigingscode staat in de URL, maar kan ook handmatig worden ingevuld.
 */
export const Route = createFileRoute("/data-deletion-status")({
  ssr: false,
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Status verwijderverzoek — Elevate Design" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DeletionStatusPage,
});

function DeletionStatusPage() {
  const { code: codeFromUrl } = Route.useSearch();
  const [code, setCode] = useState(codeFromUrl ?? "");
  const [submitted, setSubmitted] = useState(codeFromUrl ?? "");
  const fetchStatus = useServerFn(getDeletionStatus);

  const { data, isFetching, error } = useQuery({
    queryKey: ["data-deletion-status", submitted],
    queryFn: () => fetchStatus({ data: { code: submitted } }),
    enabled: submitted.length > 0,
    meta: { silent: true },
    retry: false,
  });

  return (
    <LegalPage eyebrow="Juridisch" title="Status verwijderverzoek" updated="13 augustus 2026">
      <LegalSection title="Zoek je verzoek op">
        <p>
          Vul de bevestigingscode in die je hebt gekregen toen je Elevate Design uit je Facebook- of
          Instagram-instellingen verwijderde.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(code.trim());
          }}
        >
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Bevestigingscode"
            className="sm:max-w-xs"
            autoComplete="off"
          />
          <Button type="submit" disabled={!code.trim() || isFetching}>
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Status bekijken
          </Button>
        </form>
      </LegalSection>

      {submitted && !isFetching ? (
        <LegalSection title="Resultaat">
          {error || !data?.found ? (
            <p className="flex items-start gap-2 text-muted-foreground">
              <SearchX className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              We vinden geen verzoek met deze code. Controleer de code, of mail{" "}
              <a href="mailto:elevate.plannen@gmail.com" className="text-gold hover:underline">
                elevate.plannen@gmail.com
              </a>
              .
            </p>
          ) : data.status === "completed" ? (
            <div className="space-y-2">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <span>
                  <b>Afgerond.</b> We hebben de opgeslagen toegangssleutels en accountgegevens van
                  je Meta-koppeling verwijderd
                  {typeof data.removedConnections === "number" && data.removedConnections > 0
                    ? ` (${data.removedConnections} koppeling${data.removedConnections === 1 ? "" : "en"})`
                    : ""}
                  .
                </span>
              </p>
              {data.completedAt ? (
                <p className="text-xs text-muted-foreground">
                  Verwerkt op {new Date(data.completedAt).toLocaleString("nl-NL")}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              Je verzoek is ontvangen en wordt verwerkt. Dit duurt maximaal 30 dagen.
            </p>
          )}
        </LegalSection>
      ) : null}

      <LegalSection title="Wil je álles laten verwijderen?">
        <p>
          Deze pagina gaat alleen over de gegevens van je gekoppelde Meta-account. Wil je dat wij
          ook je account, content en bestanden verwijderen, kijk dan op{" "}
          <a href="/data-deletion" className="text-gold hover:underline">
            gegevens verwijderen
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
