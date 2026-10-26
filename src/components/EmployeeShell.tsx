"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./EmployeeShell.module.css";
import { NexoLogo, ChatIcon, UserIcon, LogoutIcon } from "@/components/icons";
import type { User } from "@/domain/types";

interface Props {
  user: User;
  active: "atendimento" | "perfil";
  breadcrumbLast: string;
  showOnline?: boolean;
  children: React.ReactNode;
}

export default function EmployeeShell({
  user,
  active,
  breadcrumbLast,
  showOnline = false,
  children,
}: Props) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <NexoLogo /> Nexo Assist
        </div>

        <nav className={styles.nav}>
          <Link
            href="/atendimento"
            className={`${styles.navItem} ${active === "atendimento" ? styles.navItemActive : ""}`}
          >
            <ChatIcon width={17} height={17} /> Atendimento
          </Link>
          <Link
            href="/perfil"
            className={`${styles.navItem} ${active === "perfil" ? styles.navItemActive : ""}`}
          >
            <UserIcon width={17} height={17} /> Meu perfil
          </Link>
        </nav>

        <div className={styles.spacer} />

        <div className={styles.userBox}>
          <div className={styles.userRow}>
            <div className={styles.avatar}>{user.avatarInitials}</div>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userEmail}>{user.email}</div>
            </div>
          </div>
          <button className={styles.logout} onClick={logout}>
            <LogoutIcon width={16} height={16} /> Sair
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <div className={styles.topbar}>
          <div className={styles.breadcrumb}>
            Service desk de TI {" › "} <b>{breadcrumbLast}</b>
          </div>
          {showOnline && (
            <span className={styles.online}>
              <span className="dot" /> Assistente online
            </span>
          )}
        </div>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
