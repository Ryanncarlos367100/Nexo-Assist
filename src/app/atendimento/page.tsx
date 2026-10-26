import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import EmployeeShell from "@/components/EmployeeShell";
import ChatClient from "./ChatClient";

export default async function AtendimentoPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "analyst") redirect("/console");

  return (
    <EmployeeShell
      user={user}
      active="atendimento"
      breadcrumbLast="Atendimento"
      showOnline
    >
      <ChatClient />
    </EmployeeShell>
  );
}
