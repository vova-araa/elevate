import { useState } from "react";
import { format, isValid, parse } from "date-fns";
import { nl } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A16: één datepicker-component voor de hele app in plaats van kale native
 * <input type="date">-velden tussen verder verzorgde selects. value/onChange
 * werken op dezelfde "yyyy-MM-dd"-string als een native date-input, dus dit
 * is overal een drop-in vervanging — inclusief de bestaande className (bv.
 * de gedeelde `inp`-stijl) die nu op de knop terechtkomt.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Kies een datum",
  className,
  ariaLabel,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = value ? parse(value, "yyyy-MM-dd", new Date()) : undefined;
  const selected = parsed && isValid(parsed) ? parsed : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "inline-flex items-center justify-start gap-2 text-left font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-gold" />
          {selected ? format(selected, "d MMMM yyyy", { locale: nl }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onChange(date ? format(date, "yyyy-MM-dd") : "");
            setOpen(false);
          }}
          locale={nl}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
