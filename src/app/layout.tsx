import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nexo Assist — Service desk de TI",
  description:
    "Assistente de atendimento de service desk de TI da Nexo. Descreva seu problema e resolva em uma conversa.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
