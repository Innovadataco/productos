"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth } from "./AuthProvider";
import Logo from "./Logo";

const menuItems = [
  { href: "/dashboard", label: "Dashboard", icon: "fa-home" },
  { href: "/portafolio", label: "Portafolio", icon: "fa-briefcase" },
  { href: "/portafolio", label: "Proyectos", icon: "fa-folder-open" },
  { href: "/clientes", label: "Clientes", icon: "fa-users" },
  { href: "/contratos", label: "Contratos", icon: "fa-file-signature" },
  { href: "/finanzas", label: "Finanzas", icon: "fa-chart-line" },
  { href: "/reportes", label: "Reportes", icon: "fa-chart-pie" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-5 left-5 z-60 w-11 h-11 rounded-xl glass flex items-center justify-center text-white"
        aria-label="Toggle menu"
      >
        <i className={`fas ${mobileOpen ? "fa-times" : "fa-bars"}`} />
      </button>

      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-screen w-64 glass p-5 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 px-2 mb-10">
          <Logo width={42} height={46} animated={false} />
          <div>
            <div className="font-bold text-sm leading-tight">INNOVADATACO</div>
            <div className="text-[10px] text-white/40 tracking-wider">ADMIN</div>
          </div>
        </div>

        <nav className="flex-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.label + item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-item ${isActive ? "active" : ""}`}
              >
                <i className={`fas ${item.icon} w-5`} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="pt-6 border-t border-white/10">
          <button onClick={logout} className="sidebar-item w-full text-left">
            <i className="fas fa-sign-out-alt w-5" />
            <span className="font-medium">Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
