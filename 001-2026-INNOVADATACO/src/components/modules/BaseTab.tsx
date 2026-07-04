"use client";

export default function BaseTab({ submoduleId }: { submoduleId: string }) {
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-neonCyan text-[10px] font-bold uppercase tracking-[0.3em]">
          Base Oficial
        </div>
        <h1 className="text-3xl font-bold tracking-tight uppercase">Documentos</h1>
      </header>
      <p className="text-[10px] text-[#444] uppercase tracking-widest">Submódulo documentos en construcción.</p>
    </div>
  );
}
