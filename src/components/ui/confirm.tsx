import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /**
   * A09: voor onomkeerbare acties met echte impact (een gebruiker
   * verwijderen) — de bevestigknop blijft uit tot dit exact is overgetypt.
   * Laat dit weg voor een gewone bevestiging.
   */
  confirmValue?: string;
  confirmValueLabel?: string;
};

type Pending = ConfirmOptions & { resolve: (v: boolean) => void };

let openConfirm: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;

/**
 * Gebrande, promise-based bevestiging — vervangt het kale window.confirm().
 * Gebruik: `if (!(await confirmDialog("Verwijderen?"))) return;`
 */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o = typeof opts === "string" ? { description: opts } : opts;
  if (!openConfirm) {
    // Vangnet als de host (nog) niet gemount is.
    return Promise.resolve(window.confirm(o.description ?? o.title ?? "Weet je het zeker?"));
  }
  return openConfirm(o);
}

/** Eén keer mounten in de root. */
export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    openConfirm = (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
    return () => {
      openConfirm = null;
    };
  }, []);

  const close = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
    setTyped("");
  };

  const needsTypedConfirm = !!pending?.confirmValue;
  const canConfirm = !needsTypedConfirm || typed === pending?.confirmValue;

  return (
    <AlertDialog
      open={!!pending}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{pending?.title ?? "Weet je het zeker?"}</AlertDialogTitle>
          {pending?.description && (
            <AlertDialogDescription>{pending.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {needsTypedConfirm && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-typed-value" className="text-xs text-muted-foreground">
              Typ <span className="font-semibold text-foreground">{pending.confirmValue}</span> om
              te bevestigen
            </Label>
            <Input
              id="confirm-typed-value"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelLabel ?? "Annuleren"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => canConfirm && close(true)}
            disabled={!canConfirm}
            className={cn(
              pending?.destructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              !canConfirm && "opacity-50 cursor-not-allowed",
            )}
          >
            {pending?.confirmLabel ?? "Bevestigen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
