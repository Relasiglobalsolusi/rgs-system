"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { showRejectionFromError } from "@/components/ui/rejection-notice";

type GenerateResult = {
  year: number;
  created: number;
  updated: number;
  skipped: number;
};

type Props = {
  year: number;
  label: string;
  pendingLabel: string;
  successLabel: string;
  errorLabel: string;
  action: (year?: number) => Promise<GenerateResult>;
};

export default function ThrGenerateButton({
  year,
  label,
  pendingLabel,
  successLabel,
  errorLabel,
  action,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await action(year);
            toast.success(
              successLabel
                .replace("{created}", String(result.created))
                .replace("{updated}", String(result.updated))
                .replace("{skipped}", String(result.skipped))
            );
            router.refresh();
          } catch (error) {
            showRejectionFromError(error, errorLabel);
          }
        });
      }}
    >
      {pending ? pendingLabel : label}
    </Button>
  );
}
