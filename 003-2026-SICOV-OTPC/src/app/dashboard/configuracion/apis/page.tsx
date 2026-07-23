"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/// Consola de APIs (rol 1, Fase 1). Lista de operaciones + formulario (ejemplo editable) + resultado
/// (contra el STUB) + bitácora. El botón "Ejecutar en real" está VISIBLE pero DESHABILITADO
/// ("Fase 2 — requiere habilitación del CEO"); el endpoint real también responde 403.
interface Operacion {
  clave: string;
  titulo: string;
  metodo: string;
  pathExterno: string;
  cabeceras: string[];
  ejemplo: Record<string, unknown>;
  pendiente?: boolean;
}
interface Resultado {
  respuesta: unknown;
  duracionMs: number;
  logId: number;
  modo: string;
  status: number;
  error: string | null;
}
interface LlamadaFila {
  id: number;
  operacion: string;
  modo: string;
  status: number | null;
  duracionMs: number | null;
  error: string | null;
  creado: string | null;
}

export default function ConsolaApisPage() {
  const router = useRouter();
  const [rol, setRol] = useState(0);
  const [fase, setFase] = useState(1);
  const [ops, setOps] = useState<Operacion[]>([]);
  const [sel, setSel] = useState<Operacion | null>(null);
  const [payload, setPayload] = useState("{}");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [bitacora, setBitacora] = useState<LlamadaFila[]>([]);

  const cargarBitacora = useCallback(async () => {
    const res = await fetch("/api/configuracion/apis/llamadas?pageSize=25");
    if (res.ok) setBitacora(((await res.json()) as { items: LlamadaFila[] }).items);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/me");
      if (me.status === 401) return router.replace("/login");
      const s = (await me.json()) as { usuario: { rol: number } };
      if (s.usuario.rol !== 1) return router.replace("/dashboard");
      setRol(1);
      const cat = await fetch("/api/configuracion/apis/catalogo");
      if (cat.ok) {
        const d = (await cat.json()) as { fase: number; items: Operacion[] };
        setFase(d.fase);
        setOps(d.items);
      }
      await cargarBitacora();
    })();
  }, [router, cargarBitacora]);

  function elegir(op: Operacion) {
    setSel(op);
    setPayload(JSON.stringify(op.ejemplo, null, 2));
    setResultado(null);
    setMensaje(null);
  }

  async function ejecutarStub() {
    if (!sel) return;
    setMensaje(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(payload) as Record<string, unknown>;
    } catch {
      return setMensaje("El payload no es JSON válido");
    }
    const res = await fetch("/api/configuracion/apis/ejecutar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ operacion: sel.clave, payload: parsed }),
    });
    const d = (await res.json().catch(() => ({}))) as Resultado & { error?: string };
    if (!res.ok) return setMensaje(d.error ?? "Error al ejecutar");
    setResultado(d);
    await cargarBitacora();
  }

  if (rol !== 1) return <main className="p-8">Cargando…</main>;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-xl font-semibold text-sicov-700 mb-4">Consola de APIs</h1>
      <p className="text-xs text-gray-500 mb-4">
        Fase {fase}: las operaciones se ejecutan contra el <strong>stub</strong> (cero tráfico a la Super).
      </p>
      {mensaje && <p className="mb-4 text-sm text-red-700 bg-white border rounded px-3 py-2">{mensaje}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lista de operaciones */}
        <section className="bg-white border rounded shadow-sm p-4">
          <h2 className="font-semibold text-sm mb-3">Operaciones</h2>
          <ul className="space-y-1 text-sm">
            {ops.map((op) => (
              <li key={op.clave}>
                <button
                  disabled={op.pendiente}
                  onClick={() => elegir(op)}
                  className={`w-full text-left px-2 py-1 rounded ${sel?.clave === op.clave ? "bg-sicov-50 text-sicov-700 font-medium" : "hover:bg-gray-50"} ${op.pendiente ? "text-gray-400 cursor-not-allowed" : ""}`}
                >
                  {op.titulo} {op.pendiente && <span className="text-xs">(pendiente)</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Formulario + resultado */}
        <section className="bg-white border rounded shadow-sm p-4 lg:col-span-2">
          {!sel ? (
            <p className="text-sm text-gray-500">Seleccione una operación.</p>
          ) : (
            <>
              <div className="mb-2 text-sm">
                <span className="font-semibold">{sel.metodo}</span> <code className="text-gray-600">{sel.pathExterno}</code>
              </div>
              <p className="text-xs text-gray-500 mb-2">Cabeceras aplicables: {sel.cabeceras.join(", ") || "—"} (solo nombres)</p>
              <label className="block text-sm mb-2">Payload (JSON)
                <textarea className="mt-1 w-full border rounded px-2 py-1 font-mono text-xs" rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-sicov-700 text-white rounded text-sm" onClick={ejecutarStub}>Ejecutar (stub)</button>
                <button
                  disabled
                  title="Fase 2 — requiere habilitación del CEO"
                  className="px-3 py-1.5 border rounded text-sm text-gray-400 cursor-not-allowed"
                >
                  Ejecutar en real (Fase 2)
                </button>
              </div>
              {resultado && (
                <div className="mt-3 text-sm">
                  <p className="text-xs text-gray-500">
                    modo={resultado.modo} · status={resultado.status} · {resultado.duracionMs} ms · log #{resultado.logId}
                  </p>
                  <pre className="mt-1 bg-gray-50 border rounded p-2 text-xs overflow-x-auto max-h-60">
                    {JSON.stringify(resultado.error ?? resultado.respuesta, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Bitácora */}
      <section className="bg-white border rounded shadow-sm p-4 mt-4">
        <h2 className="font-semibold text-sm mb-3">Bitácora</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Operación</th>
              <th className="px-2 py-1">Modo</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Duración</th>
              <th className="px-2 py-1">Error</th>
              <th className="px-2 py-1">Fecha</th>
            </tr>
          </thead>
          <tbody>
            {bitacora.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-3 text-center text-gray-500">Sin llamadas registradas</td></tr>
            )}
            {bitacora.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="px-2 py-1">{l.id}</td>
                <td className="px-2 py-1">{l.operacion}</td>
                <td className="px-2 py-1">{l.modo}</td>
                <td className="px-2 py-1">{l.status ?? "—"}</td>
                <td className="px-2 py-1">{l.duracionMs ?? "—"} ms</td>
                <td className="px-2 py-1 max-w-xs truncate" title={l.error ?? ""}>{l.error ?? "—"}</td>
                <td className="px-2 py-1">{l.creado ? new Date(l.creado).toLocaleString("es-CO") : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
