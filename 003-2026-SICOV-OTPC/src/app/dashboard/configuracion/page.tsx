"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/// Configuración (rol 1 exclusivo): tarjetas Empresas (009) y APIs (013). La navegación de retorno
/// la hereda del layout del dashboard (I-14). El acceso lo protege el guard server-side de cada API.
interface Sesion {
  usuario: { id: number; rol: number };
}

const TARJETAS = [
  { href: "/dashboard/configuracion/empresas", titulo: "Empresas", desc: "Clientes vigilados, token y módulos.", icono: "🏢" },
  { href: "/dashboard/configuracion/apis", titulo: "APIs", desc: "Consola de operaciones de la Super (Fase 1: stub).", icono: "🔌" },
];

export default function ConfiguracionPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) return;
      const s = (await res.json()) as Sesion;
      if (s.usuario.rol !== 1) return router.replace("/dashboard");
      setSesion(s);
    })();
  }, [router]);

  if (!sesion) return <main className="p-8">Cargando…</main>;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-semibold text-sicov-700 mb-6">Configuración</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        {TARJETAS.map((t) => (
          <a
            key={t.href}
            href={t.href}
            className="bg-white border rounded shadow-sm p-5 hover:shadow-md transition"
          >
            <div className="text-2xl mb-2">{t.icono}</div>
            <h2 className="font-semibold text-sicov-700">{t.titulo}</h2>
            <p className="text-sm text-gray-600 mt-1">{t.desc}</p>
          </a>
        ))}
      </div>
    </main>
  );
}
