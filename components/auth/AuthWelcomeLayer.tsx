"use client";

import { useT } from "@/lib/i18n/use-t";
import {
  RGS_ONE_LOGO_HEIGHT,
  RGS_ONE_LOGO_SRC,
  RGS_ONE_LOGO_WIDTH,
} from "@/lib/brand";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  name: string;
  leaving?: boolean;
};

export default function AuthWelcomeLayer({ open, name, leaving = false }: Props) {
  const { t } = useT();
  if (!open) return null;

  return (
    <div
      className={cn("auth-welcome-layer", leaving && "auth-welcome-layer-leaving")}
      data-auth-welcome=""
      role="status"
      aria-live="polite"
      aria-label={
        name ? t("auth.welcomeName", { name }) : t("auth.welcomeGate")
      }
    >
      <div className="auth-welcome-copy">
        <img
          src={RGS_ONE_LOGO_SRC}
          alt="RGS ONE"
          width={RGS_ONE_LOGO_WIDTH}
          height={RGS_ONE_LOGO_HEIGHT}
          fetchPriority="high"
          decoding="async"
          draggable={false}
          className="auth-welcome-mark"
        />
        <p className="auth-welcome-kicker">{t("auth.welcomeGate")}</p>
        {name ? <p className="auth-welcome-name">{name}</p> : null}
      </div>
    </div>
  );
}
