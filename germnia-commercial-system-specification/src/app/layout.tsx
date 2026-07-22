import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "SCG — Sistema Comercial Germânia",
  description: "Sistema Comercial da Germânia Seguros — Pessoas, Oportunidades e Relacionamento.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <Sidebar />
        <div className="pl-64">
          <main className="mx-auto min-h-screen max-w-[1400px] px-8 py-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
