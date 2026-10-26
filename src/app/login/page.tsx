"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./login.module.css";
import {
  NexoLogo,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
} from "@/components/icons";

export default function LoginPage() {
  const router = useRouter();
  // Pré-preenchido para demonstração (ver README / modo demo).
  const [email, setEmail] = useState("ana.souza@nexo.com.br");
  const [password, setPassword] = useState("nexo123");
  const [remember, setRemember] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, remember }),
      });
      const data = (await res.json()) as { user?: { role: string }; error?: string };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      router.push(data.user.role === "analyst" ? "/console" : "/atendimento");
      router.refresh();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <aside className={styles.left}>
        <div className={styles.brand}>
          <NexoLogo /> Nexo Assist
        </div>

        <div className={styles.leftBody}>
          <div className={styles.eyebrow}>Service desk de TI da Nexo</div>
          <h1 className={styles.headline}>
            Seu problema de TI, resolvido em uma conversa.
          </h1>
          <p className={styles.subtext}>
            Descreva o que está acontecendo. O assistente consulta seus chamados,
            busca na central de ajuda e chama um analista quando precisa.
          </p>

          <div className={styles.preview}>
            <div className={styles.pvUser}>
              <div className={styles.pvUserBubble}>
                Meu notebook não conecta na VPN. Erro 809.
              </div>
            </div>
            <div className={styles.pvStatus}>
              Nexo Assist · consultou seus chamados · criou um chamado
            </div>
            <div className={styles.pvAgentBubble}>
              Pronto: abri o chamado com prioridade alta. Um analista fala com você
              em até 4h úteis.
            </div>
            <div className={styles.pvChip}>
              <span className="dot" /> INC-20517 · Rede e VPN · Alta · em até 4h
            </div>
          </div>

          <div className={styles.stats}>
            <div>
              <div className={styles.statNum}>8 s</div>
              <div className={styles.statLabel}>primeira resposta, em média</div>
            </div>
            <div>
              <div className={styles.statNum}>72%</div>
              <div className={styles.statLabel}>resolvidos sem fila</div>
            </div>
            <div>
              <div className={styles.statNum}>
                6 <span className={styles.online} />
              </div>
              <div className={styles.statLabel}>analistas online agora</div>
            </div>
          </div>
        </div>
      </aside>

      <main className={styles.right}>
        <div className={styles.topHint}>
          Problema para entrar? <a href="tel:4000">Ligue no ramal 4000</a>
        </div>

        <div className={styles.formWrap}>
          <h2 className={styles.h1}>Entrar</h2>
          <p className={styles.formSub}>
            Use seu e-mail corporativo e a senha da rede Nexo.
          </p>

          <form onSubmit={onSubmit}>
            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.label}>E-mail corporativo</div>
            <div className={styles.field}>
              <MailIcon />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana.souza@nexo.com.br"
                autoComplete="username"
              />
            </div>

            <div className={styles.label}>
              Senha
              <a className={styles.forgot} href="#">
                Esqueci minha senha
              </a>
            </div>
            <div className={styles.field}>
              <LockIcon />
              <input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={styles.eye}
                onClick={() => setShowPw((v) => !v)}
                aria-label={showPw ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPw ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>

            <label className={styles.remember}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Manter conectado neste computador
            </label>

            <button
              type="submit"
              className={`btn btn-primary ${styles.submit}`}
              disabled={loading}
            >
              {loading ? "Entrando..." : "Entrar →"}
            </button>
          </form>

          <div className={styles.demoHint}>
            <b>Contas de demonstração</b> (senha <b>nexo123</b>):<br />
            Funcionária: ana.souza@nexo.com.br · Analista: rafael.lima@nexo.com.br
          </div>
        </div>

        <div className={styles.footer}>
          <span>© 2026 Nexo · Service desk de TI</span>
          <a href="#">Privacidade e uso de dados</a>
        </div>
      </main>
    </div>
  );
}
