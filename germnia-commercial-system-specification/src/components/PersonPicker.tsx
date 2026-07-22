"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/form";

type PersonOption = { id: number; name: string; email?: string | null; phone?: string | null };

export function PersonPicker({
  value,
  onChange,
}: {
  value: PersonOption | null;
  onChange: (person: PersonOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonOption[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!query || value) {
      setResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await fetch(`/api/people?search=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.slice(0, 8));
        setOpen(true);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, value]);

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
        <div>
          <p className="font-medium text-slate-800">{value.name}</p>
          <p className="text-xs text-slate-500">{value.email ?? value.phone ?? ""}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="text-xs font-medium text-indigo-600 hover:underline">
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        placeholder="Buscar pessoa por nome, e-mail ou telefone..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
      />
      {open && results.length > 0 ? (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => {
                  onChange(p);
                  setOpen(false);
                  setQuery("");
                }}
              >
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="ml-2 text-xs text-slate-400">{p.email ?? p.phone ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
