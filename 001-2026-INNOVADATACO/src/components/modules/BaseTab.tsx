"use client";

import { Database } from "lucide-react";

export default function BaseTab({ submoduleId }: { submoduleId: string }) {
  const titles: Record<string, string> = {
    repositorio: "Repositorio",
    carga_documental: "Carga documental",
    busqueda_rag: "Búsqueda RAG",
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          <Database className="w-3 h-3" /> Base Oficial
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">{titles[submoduleId] || "Base Oficial"}</h1>
      </header>
      <p className="text-[10px] text-[#444] uppercase tracking-widest">Submódulo {titles[submoduleId] || ""} en construcción.</p>
    </div>
  );
}
