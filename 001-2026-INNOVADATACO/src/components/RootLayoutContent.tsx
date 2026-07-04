"use client";
import { useState } from "react";
import { Menu, X, Terminal, LayoutGrid, Database, Settings, Zap, User, Bell } from "lucide-react";
import { useWorkspace, type ModuleId } from "@/context/WorkspaceContext";
import InvestigacionTab from "@/components/modules/InvestigacionTab";
import ProyectosTab from "@/components/modules/ProyectosTab";
import BaseTab from "@/components/modules/BaseTab";
import ConfiguracionTab from "@/components/modules/ConfiguracionTab";

const MODULES: { id: ModuleId; icon: React.ReactNode; label: string }[] = [
  { id: "investigacion", icon: <Terminal size={20} />, label: "Investigación" },
  { id: "proyectos", icon: <LayoutGrid size={20} />, label: "Proyectos" },
  { id: "base", icon: <Database size={20} />, label: "Base Oficial" },
  { id: "configuracion", icon: <Settings size={20} />, label: "Configuración" },
];

const TAB_COMPONENTS: Record<ModuleId, React.ComponentType> = {
  investigacion: InvestigacionTab,
  proyectos: ProyectosTab,
  base: BaseTab,
  configuracion: ConfiguracionTab,
};

export default function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const { tabs, activeTabId, openTab, closeTab, activateTab } = useWorkspace();

  const ActiveComponent = activeTabId && tabs[0] ? TAB_COMPONENTS[tabs[0].moduleId] : null;

  return (
    <div className="flex min-h-screen bg-[#020203] text-white selection:bg-cyan-500/30">
      {/* SIDEBAR FIJO IZQUIERDA */}
      <aside className={`fixed top-0 left-0 h-full z-50 bg-[#050505] border-r border-white/5 transition-all duration-500 ${expanded ? "w-64" : "w-20"}`}>
        <div className="p-6 flex items-center justify-between border-b border-white/5 h-20">
          {expanded && <span className="font-black text-xs tracking-[0.3em] text-[#00F0FF] animate-in fade-in italic">INNOVADATACO</span>}
          <button onClick={() => setExpanded(!expanded)} className="p-2 text-[#00F0FF] hover:bg-white/5 rounded-lg ml-auto">
            {expanded ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        <nav className="p-4 space-y-2 mt-4">
          {MODULES.map((item) => {
            const isActive = activeTabId && tabs[0]?.moduleId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => openTab(item.id)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl transition-all text-left ${
                  isActive
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

      {/* CONTENIDO DERECHA */}
      <div className={`flex-1 transition-all duration-500 ${expanded ? "ml-64" : "ml-20"}`}>
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-[#020203]/80 backdrop-blur-xl sticky top-0 z-40">
           <div className="flex items-center gap-4">
             <div className="h-2 w-2 rounded-full bg-[#00F0FF] shadow-[0_0_10px_#00F0FF]" />
             <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 italic">Plataforma Operativa</h2>
           </div>
           <div className="flex items-center gap-6 opacity-40 hover:opacity-100 transition-opacity">
              <Bell size={18} />
              <div className="h-8 w-8 rounded-full border border-white/10 flex items-center justify-center"><User size={16} /></div>
           </div>
        </header>

        {/* TABS */}
        {tabs.length > 0 && (
          <div className="flex items-end gap-1 px-6 pt-4 border-b border-white/5">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className="group flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest cursor-pointer border-t border-l border-r border-white/5 rounded-t-lg bg-white/5 text-[#00F0FF] border-[#00F0FF]/30"
              >
                <span>{tab.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                  className="text-white/30 hover:text-red-400 transition-opacity"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <main className="p-12 max-w-7xl mx-auto">
          {ActiveComponent ? <ActiveComponent /> : (
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
