import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatCurrency(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value + (value.length === 10 ? "T00:00:00" : "")) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function relativeFromNow(value: string | Date | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  if (Math.abs(diffDays) < 1) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) return "agora";
    return rtf.format(diffHours, "hour");
  }
  return rtf.format(diffDays, "day");
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function isPastDate(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  const today = todayISO();
  return dateStr < today;
}

export function isTodayDate(dateStr: string | null | undefined) {
  if (!dateStr) return false;
  return dateStr === todayISO();
}

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
