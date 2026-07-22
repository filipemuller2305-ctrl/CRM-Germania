"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  Repeat,
  HeartHandshake,
  Plug,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/pessoas", label: "Pessoas", icon: Users },
  { href: "/oportunidades", label: "Oportunidades", icon: KanbanSquare },
  { href: "/cross-selling", label: "Cross Selling", icon: Repeat },
  { href: "/customer-success", label: "Customer Success", icon: HeartHandshake },
  { href: "/integracao-erp", label: "Integração ERP", icon: Plug },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-200 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-base font-bold text-white">
          G
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-slate-900">Germânia</p>
          <p className="text-xs leading-tight text-slate-500">Sistema Comercial</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="h-4.5 w-4.5" size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-slate-200 px-4 py-4 text-xs text-slate-400">
        <p>SCG — Germânia Seguros</p>
        <p>Processo antes da ferramenta.</p>
      </div>
    </aside>
  );
}
