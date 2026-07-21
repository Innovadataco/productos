"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Solicitud {
  id: number;
  placa?: string;
  estado: string;
  reintentos: number;
  idDespachoExterno: number | null;
  errorExterno: string | null;
}

export default function SalidasPage() {
  const router = useRouter();
  const [items, setItems] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/integracion/despachos?page=1&pageSize=25");
    if (res.status === 401) return router.replace("/login");
    if (res.ok) {
      const d = (await res.json()) as { items: Solicitud[] };
      setItems(d.items);
    }
    setCargando(false);
  }, [router]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function reintentar(id: number) {
    await fetch(`/api/despachos/${id}/reintentar`, { method: "POST" });
    await cargar();
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sicov-700">Salidas (despachos)</h1>
        <a href="/dashboard/salidas/nueva" className="bg-sicov-700 text-white rounded px-4 py-2 text-sm">
          Registrar salida
        </a>
      </div>

      {cargando ? (
        <p>Cargando…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border rounded text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Reintentos</th>
                <th className="px-3 py-2">ID externo</th>
                <th className="px-3 py-2">Acción</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="px-3 py-2">{s.id}</td>
                  <td className="px-3 py-2">
                    <span className={s.estado === "fallido" ? "text-red-600" : s.estado === "procesado" ? "text-sicov-700" : "text-gray-600"}>
                      {s.estado}
                    </span>
                  </td>
                  <td className="px-3 py-2">{s.reintentos}</td>
                  <td className="px-3 py-2">{s.idDespachoExterno ?? "—"}</td>
                  <td className="px-3 py-2">
                    {s.estado === "fallido" && (
                      <button onClick={() => reintentar(s.id)} className="text-sicov-600 hover:underline">
                        Reintentar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">Sin despachos aún.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
