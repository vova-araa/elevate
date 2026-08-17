import { createFileRoute } from "@tanstack/react-router";
import { handleMetaDeletion, parseSignedRequest } from "@/lib/data-deletion.server";
import { allowRequest, requestIp, tooManyRequests } from "@/lib/rate-limit.server";

/**
 * Data Deletion Request Callback voor Meta.
 *
 * Zet deze URL in de Meta-app onder Instellingen → Basis →
 * "Data deletion request URL":
 *   https://www.elevatedesign.nl/api/public/meta/data-deletion
 *
 * Meta post hier `signed_request` (form-encoded of JSON) en verwacht meteen
 * `{ url, confirmation_code }` terug.
 */
export const Route = createFileRoute("/api/public/meta/data-deletion")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Elk geldig verzoek verwijdert data; brute force op signed_request is
        // kansloos (HMAC), maar spam mag hier geen verwijderingslus draaien.
        if (!allowRequest(`meta-del:${requestIp(request)}`, 10, 60_000)) {
          return tooManyRequests();
        }
        let signedRequest = "";
        const contentType = request.headers.get("content-type") ?? "";
        try {
          if (contentType.includes("application/json")) {
            const body = (await request.json()) as { signed_request?: string };
            signedRequest = body.signed_request ?? "";
          } else {
            const form = await request.formData();
            signedRequest = String(form.get("signed_request") ?? "");
          }
        } catch {
          signedRequest = "";
        }

        const payload = signedRequest ? parseSignedRequest(signedRequest) : null;
        if (!payload?.user_id) {
          return Response.json({ error: "invalid_signed_request" }, { status: 400 });
        }

        const origin = (() => {
          try {
            return new URL(request.url).origin;
          } catch {
            return undefined;
          }
        })();

        const { confirmationCode, statusUrl } = await handleMetaDeletion(
          String(payload.user_id),
          origin,
        );
        return Response.json({ url: statusUrl, confirmation_code: confirmationCode });
      },
    },
  },
});
