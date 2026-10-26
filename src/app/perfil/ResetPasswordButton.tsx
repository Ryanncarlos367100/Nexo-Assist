"use client";

import { useState } from "react";
import styles from "./profile.module.css";
import { RefreshIcon } from "@/components/icons";

export default function ResetPasswordButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  return (
    <>
      <button className="btn btn-outline" onClick={() => setSent(true)}>
        <RefreshIcon width={15} height={15} /> Redefinir senha
      </button>
      {sent && (
        <span className={styles.sent} style={{ marginLeft: 12, fontSize: 12.5 }}>
          Link enviado para {email}.
        </span>
      )}
    </>
  );
}
