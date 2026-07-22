"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/form";
import { RefreshCw } from "lucide-react";

export function SyncAllButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    await fetch("/api/erp/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <PrimaryButton onClick={handleSync} disabled={loading}>
      <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> {loading ? "Sincronizando..." : "Sincronizar tudo"}
    </PrimaryButton>
  );
}
