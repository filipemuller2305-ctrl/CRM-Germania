"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Field, Input, Select, TextArea, PrimaryButton, SecondaryButton } from "@/components/form";
import { originOptions } from "@/lib/labels";

type UserOption = { id: number; name: string };

export function NewPersonButton({ users }: { users: UserOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      phone: String(form.get("phone") || ""),
      whatsapp: String(form.get("whatsapp") || ""),
      email: String(form.get("email") || ""),
      document: String(form.get("document") || ""),
      origin: String(form.get("origin") || ""),
      ownerId: form.get("ownerId") ? Number(form.get("ownerId")) : null,
      status: String(form.get("status") || "lead"),
      notes: String(form.get("notes") || ""),
    };
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.formErrors?.[0] ?? "Não foi possível cadastrar a pessoa.");
      return;
    }
    const created = await res.json();
    setOpen(false);
    router.push(`/pessoas/${created.id}`);
    router.refresh();
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)}>
        <Plus size={16} /> Nova pessoa
      </PrimaryButton>
      <Modal open={open} onClose={() => setOpen(false)} title="Cadastrar nova pessoa">
        <form onSubmit={handleSubmit}>
          <Field label="Nome" required>
            <Input name="name" required placeholder="Nome completo ou razão social" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <Input name="phone" placeholder="(51) 99999-9999" />
            </Field>
            <Field label="WhatsApp">
              <Input name="whatsapp" placeholder="(51) 99999-9999" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="E-mail">
              <Input name="email" type="email" placeholder="nome@email.com" />
            </Field>
            <Field label="CPF/CNPJ">
              <Input name="document" placeholder="000.000.000-00" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem">
              <Select name="origin" defaultValue="">
                <option value="">Selecione...</option>
                {originOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsável Comercial">
              <Select name="ownerId" defaultValue="">
                <option value="">Sem responsável</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Status">
            <Select name="status" defaultValue="lead">
              <option value="lead">Lead</option>
              <option value="ativo">Em atendimento</option>
              <option value="cliente">Cliente</option>
              <option value="inativo">Inativo</option>
            </Select>
          </Field>
          <Field label="Observações">
            <TextArea name="notes" rows={3} placeholder="Alguma observação relevante..." />
          </Field>
          {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <SecondaryButton type="button" onClick={() => setOpen(false)}>
              Cancelar
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar pessoa"}
            </PrimaryButton>
          </div>
        </form>
      </Modal>
    </>
  );
}
