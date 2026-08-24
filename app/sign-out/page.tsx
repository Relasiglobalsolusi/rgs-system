"use client";

import { useRouter } from "next/navigation";

import SignOutConfirmDialog from "@/components/auth/SignOutConfirmDialog";

export default function SignOutPage() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-background">
      <SignOutConfirmDialog
        open
        onOpenChange={(open) => {
          if (!open) {
            router.replace("/dashboard");
          }
        }}
      />
    </main>
  );
}
