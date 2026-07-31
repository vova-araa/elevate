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
import { cn } from "@/lib/utils";

type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
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

  useEffect(() => {
    openConfirm = (opts) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve }));
    return () => {
      openConfirm = null;
    };
  }, []);

  const close = (result: boolean) => {
    pending?.resolve(result);
    setPending(null);
  };

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
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => close(false)}>
            {pending?.cancelLabel ?? "Annuleren"}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => close(true)}
            className={cn(
              pending?.destructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
            )}
          >
            {pending?.confirmLabel ?? "Bevestigen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
