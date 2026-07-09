"use client";
// build-cache-invalidate: 2026-07-09T03:38:45
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Terminal, LayoutGrid, Database, Settings, Zap, User, Bell, FileText, LogOut } from "lucide-react";
import { useWorkspace, SUBMODULES, type ModuleId } from "@/context/WorkspaceContext";
import InvestigacionTab from "@/components/modules/InvestigacionTab";
import ProyectosTab from "@/components/modules/ProyectosTab";
import BaseTab from "@/components/modules/BaseTab";
import ConfiguracionTab from "@/components/modules/ConfiguracionTab";
import LicitacionesTab from "@/components/modules/LicitacionesTab";

const MODULES: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: "investigacion", icon: <Terminal size={20} />, label: "Investigación" },
  { id: "proyectos", icon: <LayoutGrid size={20} />, label: "Proyectos" },
  { id: "base", icon: <Database size={20} />, label: "Base Oficial" },
  { id: "licitaciones", icon: <FileText size={20} />, label: "Licitaciones" },
  { id: "configuracion", icon: <Settings size={20} />, label: "Configuración" },
];

const TAB_COMPONENTS: Record<ModuleId, React.ComponentType<{ submoduleId: string }>> = {
  investigacion: InvestigacionTab,
  proyectos: ProyectosTab,
  base: BaseTab,
  configuracion: ConfiguracionTab,
  licitaciones: LicitacionesTab,
};

export default function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const { activeModuleId, activeSubmoduleId, openModule, openSubmodule, closeModule } = useWorkspace();

  const ActiveComponent = activeModuleId && activeSubmoduleId ? TAB_COMPONENTS[activeModuleId] : null;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Si es la página de login, mostrar solo el contenido sin layout
  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#020203] text-white selection:bg-cyan-500/30">
      <aside className={`fixed top-0 left-0 h-full z-50 bg-[#050505] border-r border-white/5 transition-all duration-500 ${expanded ? "w-64" : "w-20"}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5 h-20">
          {expanded && <span className="font-black text-xs tracking-[0.3em] text-[#00F0FF] animate-in fade-in italic">INNOVADATACO</span>}
          <button onClick={() => setExpanded(!expanded)} className="p-2 text-[#00F0FF] hover:bg-white/5 rounded-lg ml-auto">
            {expanded ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="p-4 space-y-2 mt-4">
          {MODULES.map((item) => {
            const isActive = activeModuleId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => openModule(item.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${isActive
                  ? "bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20"
                  : "text-white/30 hover:bg-white/5 hover:text-white"
                  }`}
              >
                <div className="shrink-0">{item.icon}</div>
                {expanded && <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-8 left-0 w-full px-6 opacity-20">
          <div className="flex items-center gap-2">
            <Zap size={14} />
            {expanded && <span className="text-[8px] font-bold tracking-tighter uppercase">Protocolo Dios v3.1</span>}
          </div>
        </div>
      </aside>

      <div className={`flex-1 transition-all duration-500 ${expanded ? "ml-64" : "ml-20"}`}>
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-[#020203]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <div className="h-2 w-2 rounded-full bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]" />
            {activeModuleId && activeSubmoduleId ? (
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 italic">{MODULES.find(m => m.id === activeModuleId)?.label}</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-[#00F0FF]">{SUBMODULES[activeModuleId].find(s => s.id === activeSubmoduleId)?.title}</span>
              </div>
            ) : (
              <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 italic">Plataforma Operativa</h2>
            )}
          </div>
          <div className="flex items-center gap-4 opacity-40 hover:opacity-100 transition-opacity">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-colors"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
              <span>Cerrar sesión</span>
            </button>
            <Bell size={18} />
            <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center"><User size={16} /></div>
          </div>
        </header>

        {activeModuleId && SUBMODULES[activeModuleId].length > 0 && (
          <div className="flex items-center justify-between px-6 pt-4 border-b border-white/5">
            <div className="flex items-end gap-1">
              {SUBMODULES[activeModuleId].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => openSubmodule(activeModuleId, sub.id)}
                  className={`group flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest border-t border-l border-r border-white/5 rounded-t-lg transition-all ${activeSubmoduleId === sub.id
                    ? "bg-white/5 text-[#00F0FF] border-[#00F0FF]/30"
                    : "text-white/30 hover:text-white hover:bg-white/[0.02]"
                    }`}
                >
                  <span>{sub.title}</span>
                </button>
              ))}
            </div>
            <button
              onClick={closeModule}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-red-400 transition-colors"
            >
              <X size={12} className="inline mr-1" /> Cerrar
            </button>
          </div>
        )}

        <main className="p-12 max-w-7xl mx-auto">
          {ActiveComponent ? (
            <ActiveComponent submoduleId={activeSubmoduleId!} />
          ) : pathname === "/" ? (
            <div className="flex flex-col items-center justify-center h-96 text-white/20 gap-4">
              <LayoutGrid size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Selecciona un módulo del sidebar</p>
            </div>
          ) : children ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-white/20 gap-4">
              <LayoutGrid size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Selecciona un módulo del sidebar</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}