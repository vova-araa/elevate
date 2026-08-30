import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { lookupDeletionStatus, type DeletionStatus } from "@/lib/data-deletion.server";
import { allowRequest, requestIp } from "@/lib/rate-limit.server";

/**
 * Publieke statusopvraging: Meta verwijst de gebruiker naar deze pagina met een
 * bevestigingscode. Bewust zonder inlog — de code is het enige geheim, en er
 * komt geen persoonsgegeven uit (alleen status + aantal verwijderde koppelingen).
 */
export const getDeletionStatus = createServerFn({ method: "POST" })
  .validator((d) =>
    z.object({ code: z.string().regex(/^[a-f0-9]{8,64}$/, "Ongeldige code") }).parse(d),
  )
  .handler(async ({ data }): Promise<DeletionStatus> => {
    if (!allowRequest(`del-status:${requestIp()}`, 20, 60_000)) {
      throw new Error("Te veel aanvragen — probeer het over een minuut opnieuw");
    }
    return lookupDeletionStatus(data.code);
  });
