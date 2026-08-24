/* Herexport van de bewegingsprimitieven (voorheen landing-only) zodat
   admin/client-portalpagina's dezelfde IntersectionObserver-hooks kunnen
   gebruiken zonder een "landing-*"-bestand te importeren. De implementatie
   blijft in landing-motion.ts staan — geen duplicatie, alleen een
   duidelijker importpad voor gebruik buiten de marketingsite. */
export {
  prefersReducedMotion,
  useInView,
  useReveal,
  useParallax,
} from "@/components/landing-motion";
