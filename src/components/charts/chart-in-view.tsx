import { Suspense, type CSSProperties, type ReactNode } from "react";
import { useInView } from "@/components/landing-motion";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Houdt een `React.lazy()`-geladen recharts-grafiek buiten de initiële
 * route-bundel: de chunk wordt pas opgehaald zodra dit blok in beeld
 * scrollt (IntersectionObserver via useInView), en tot die tijd — en
 * terwijl de chunk nog laadt — staat er een skeleton op exact dezelfde
 * plek, zodat er geen layout shift ontstaat. Dit skelet ligt bovenop, en
 * vervangt niet, de eigen `loading`-afhandeling van elke grafiek zelf.
 */
export function ChartInView({
  height,
  className,
  children,
}: {
  /** Vaste hoogte in px voor de skeleton/placeholder. */
  height?: number;
  /** Extra classNames voor de skeleton, bv. responsive hoogteklassen. */
  className?: string;
  children: ReactNode;
}) {
  const { ref, inView } = useInView<HTMLDivElement>({ rootMargin: "200px 0px" });
  const style: CSSProperties | undefined = height ? { height } : undefined;
  const skeleton = <Skeleton className={cn("w-full rounded-lg", className)} style={style} />;

  return (
    <div ref={ref}>{inView ? <Suspense fallback={skeleton}>{children}</Suspense> : skeleton}</div>
  );
}
