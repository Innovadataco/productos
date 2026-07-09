"use client";

import { ReactNode, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserCircle, ChevronDown, ChevronUp, LogOut } from "lucide-react";
import { SIDEBAR_ITEMS } from "./modules/BaseTab";

export default function RootLayoutContent({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [modulesOpen, setModulesOpen] = useState(false);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-20 border-r border-white/10 flex flex-col items-center py-8 gap-8 bg-[#020203] z-10">
        <div className="font-black text-neonCyan text-[10px] tracking-[0.2em] uppercase text-center leading-tight">
          <div>INN</div><div>OVA</div>
        </div>
        <nav className="flex flex-col gap-2 w-full px-2">
          {SIDEBAR_ITEMS.map((item) => (
            <a key={item.href} href={item.href} className="flex flex-col items-center gap-1 py-3 text-[9px] text-[#666] hover:text-neonCyan transition-colors uppercase tracking-widest">
              <item.icon className="w-4 h-4" /><span className="text-center">{item.label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 flex flex-col">
        <header className="border-b border-white/10 flex items-center justify-between px-8 py-4 bg-[#020203]">
          <h1 className="text-lg font-black uppercase tracking-widest">Plataforma de Gestión</h1>
          <div className="flex items-center gap-4">
            <button onClick={handleLogout} className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#888] hover:text-red-400 transition-colors">
              <LogOut className="w-4 h-4" /><span>Cerrar sesión</span>
            </button>
            <UserCircle className="w-6 h-6 text-[#666]" />
          </div>
        </header>
        <section className="flex-1 p-8 overflow-auto">{children}</section>
      </main>
    </div>
  );
}
