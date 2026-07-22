import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

export function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required ? <span className="text-rose-500"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

const baseClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition-colors focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${baseClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${baseClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${baseClass} ${props.className ?? ""}`} />;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${props.className ?? ""}`}
    />
  );
}
