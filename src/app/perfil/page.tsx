import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EmployeeShell from "@/components/EmployeeShell";
import ResetPasswordButton from "./ResetPasswordButton";
import styles from "./profile.module.css";
import { LockIcon, KeyIcon, MailIcon } from "@/components/icons";

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "analyst") redirect("/console");

  const days = daysSince(user.passwordChangedAt);

  return (
    <EmployeeShell user={user} active="perfil" breadcrumbLast="Meu perfil">
      <div className={styles.wrap}>
        <h1 className={styles.h1}>Meu perfil</h1>
        <p className={styles.sub}>Seus dados de acesso ao service desk de TI.</p>

        <div className={`card ${styles.card}`}>
          <div className={styles.row}>
            <div className={styles.rowLabel}>Nome</div>
            <div className={styles.rowValue}>{user.name}</div>
          </div>
          <div className={`${styles.row} ${styles.rowDivider}`}>
            <div className={styles.rowLabel}>E-mail corporativo</div>
            <div className={styles.rowValue}>{user.email}</div>
            <span className={styles.managed}>
              <LockIcon width={14} height={14} /> Gerenciado pela TI
            </span>
          </div>
        </div>

        <div className={`card ${styles.card}`}>
          <div className={styles.pwRow}>
            <div className={styles.pwIcon}>
              <KeyIcon width={18} height={18} />
            </div>
            <div>
              <div className={styles.pwTitle}>Senha</div>
              <div className={styles.pwSub}>Alterada há {days} dias</div>
            </div>
            <div className={styles.pwSpacer} />
            <ResetPasswordButton email={user.email} />
          </div>
          <div className={styles.notice}>
            <MailIcon width={15} height={15} /> Enviaremos um link de redefinição
            para {user.email}.
          </div>
        </div>
      </div>
    </EmployeeShell>
  );
}
