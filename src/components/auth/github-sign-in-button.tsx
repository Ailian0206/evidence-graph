"use client";

import { LoaderCircle, LogIn } from "lucide-react";
import { useFormStatus } from "react-dom";

import styles from "@/app/[locale]/auth/login/login.module.css";

export function GitHubSignInButton({
  configured,
  label,
  pendingLabel,
}: {
  configured: boolean;
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className={styles.button} type="submit" disabled={!configured || pending}>
      {pending ? (
        <LoaderCircle
          aria-hidden="true"
          className={styles.spinner}
          data-loading-indicator="true"
          data-testid="github-login-loading"
          size={18}
        />
      ) : (
        <LogIn aria-hidden="true" size={18} />
      )}
      {pending ? pendingLabel : label}
    </button>
  );
}
