"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Sesion {
  usuario: { id: number; nombre: string; usuario: string; rol: number };
  modulos: { id: number; nombreMostrar: string | null; ruta: string | null }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) {
        // Bug 4: ante 401 (sesión expirada) se fuerza re-login; NUNCA se muestran datos demo.
        router.replace("/login");
        return;
      }
      if (res.ok) setSesion((await res.json()) as Sesion);
      setCargando(false);
    })();
  }, [router]);

  if (cargando) return <main className="p-8">Cargando…</main>;
  if (!sesion) return null;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sicov-700">SICOV-OTPC · Inicio</h1>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.replace("/login");
          }}
          className="text-sm text-gray-600 hover:underline"
        >
          Cerrar sesión
        </button>
      </header>

      <p className="text-sm text-gray-600 mb-4">
        {sesion.usuario.nombre} — rol {sesion.usuario.rol}
      </p>

      <nav className="flex flex-wrap gap-3">
        {sesion.modulos.map((m) => (
          <a
            key={m.id}
            href={m.ruta ?? "#"}
            className="px-4 py-2 bg-white border rounded shadow-sm text-sm hover:bg-gray-100"
          >
            {m.nombreMostrar ?? m.ruta}
          </a>
        ))}
        <a
          href="/dashboard/integradora"
          className="px-4 py-2 bg-white border rounded shadow-sm text-sm hover:bg-gray-100"
        >
          Consulta integradora
        </a>
      </nav>
    </main>
  );
}
