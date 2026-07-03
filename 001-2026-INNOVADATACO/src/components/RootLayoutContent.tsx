"use client";
import { useState } from "react";
import { Menu, X, Terminal, LayoutGrid, Database, Settings, Zap, User, Bell } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const pathname = usePathname();

  const menuItems = [
    { icon: <Terminal size={20} />, label: "Investigación", href: "/research" },
    { icon: <LayoutGrid size={20} />, label: "Proyectos", href: "/projects" },
    { icon: <Database size={20} />, label: "Base Oficial", href: "/base" },
    { icon: <Settings size={20} />, label: "Configuración", href: "/configuracion" },
  ];

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
          {menuItems.map((item, i) => (
            <Link key={i} href={item.href} className={`flex items-center gap-4 p-4 rounded-xl transition-all ${pathname === item.href ? "bg-[#00F0FF]/10 text-[#00F0FF] border border-[#00F0FF]/20" : "text-white/30 hover:bg-white/5 hover:text-white"}`}>
              <div className="shrink-0">{item.icon}</div>
              {expanded && <span className="text-[10px] font-black uppercase tracking-widest">{item.label}</span>}
            </Link>
          ))}
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
        <main className="p-12 max-w-7xl mx-auto">{children}</main>
      </div>
    </div>
  );
}
