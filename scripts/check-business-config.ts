// Print een niet te missen waarschuwing als src/config/business.ts nog
// placeholders bevat. Faalt bewust NIET (exit 0) — zie S05: de site moet
// kunnen bouwen en draaien terwijl de wettelijke gegevens nog ontbreken, de
// UI zelf toont die velden al zichtbaar als "<<NOG INVULLEN>>".
import { BUSINESS_FIELD_STATUS } from "../src/config/business";

const missing = Object.entries(BUSINESS_FIELD_STATUS)
  .filter(([, filled]) => !filled)
  .map(([key]) => key);

if (missing.length > 0) {
  console.warn(
    `\n⚠  src/config/business.ts is niet compleet: ${missing.join(", ")}\n` +
      `   De site bouwt door, maar toont deze velden voorlopig als "<<NOG INVULLEN>>".\n` +
      `   Vul ze in via TODO-VOVA.md voor je live gaat.\n`,
  );
}
