import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface StudioClient {
  id: string;
  name: string;
  industry?: string | null;
}

const NONE = "__none__";

export function ClientSelect({
  clients,
  value,
  onChange,
  allowNone = false,
  placeholder = "Kies een klant",
  className,
}: {
  clients: StudioClient[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone?: boolean;
  placeholder?: string;
  className?: string;
}) {
  return (
    <Select
      value={value ?? (allowNone ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
    >
      <SelectTrigger className={className ?? "w-full"}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>Geen klant</SelectItem>}
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
            {c.industry ? ` · ${c.industry}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
