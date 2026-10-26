import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ConsoleClient from "./ConsoleClient";

export default async function ConsolePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "analyst") redirect("/atendimento");

  return <ConsoleClient analyst={user} />;
}
