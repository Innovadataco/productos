"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/// Pantalla Mantenimientos (US6, 005-B — paridad §10.2 del manual): tabs Preventivos/Correctivos.
/// El CLIENTE (rol 2) gestiona el PDF del PROGRAMA (el último cargado queda ACTIVO); el OPERADOR
/// (rol 3) registra individuales, usa la carga masiva y corrige-reenvía los fallidos.
/// La navegación de retorno la hereda del LAYOUT del dashboard (I-14): aquí no se crea otra.

interface Sesion {
  usuario: { id: number; rol: number; identificacion?: string | null };
}
interface Programa {
  id: number;
  nombreOriginal: string | null;
  fecha: string | null;
  estado: boolean | null;
}
interface Placa {
  placa: string;
  estado?: string;
  fecha?: string | null;
}
interface FilaHistorial {
  fecha?: string;
  hora?: string;
  nit?: number;
  razon_social?: string;
  nombres_responsable?: string;
  detalle_actividades?: string;
}
interface Job {
  id: number;
  tipo: string;
  estado: string;
  reintentos: number;
  ultimoError: string | null;
  payload?: { placa?: string } | null;
}
interface Resumen {
  total: number;
  exitosos: number;
  errores: string[];
}

const ETIQUETA_TIPO: Record<number, string> = { 1: "preventivo", 2: "correctivo" };
const RESPONSABLE: Record<number, string> = { 1: "Ingeniero mecánico responsable", 2: "Técnico mecánico responsable" };

export default function MantenimientosPage() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [tipo, setTipo] = useState<1 | 2>(1);
  const [programas, setProgramas] = useState<Programa[]>([]);
  const [placas, setPlacas] = useState<Placa[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [historial, setHistorial] = useState<{ placa: string; filas: FilaHistorial[] } | null>(null);
  const [registro, setRegistro] = useState<{ placa: string } | null>(null);
  const [corrigiendo, setCorrigiendo] = useState<Job | null>(null);
  const [placaCorregida, setPlacaCorregida] = useState("");
  const [form, setForm] = useState({
    fecha: "",
    hora: "",
    nit: "",
    razonSocial: "",
    tipoIdentificacion: "1",
    numeroIdentificacion: "",
    nombresResponsable: "",
    detalleActividades: "",
  });

  const rol = sesion?.usuario.rol ?? 0;
  const veProgramas = rol === 1 || rol === 2;
  const veVehiculos = rol === 1 || rol === 3;

  const cargar = useCallback(async (t: 1 | 2, r: number) => {
    if (r === 1 || r === 2) {
      const res = await fetch(`/api/archivos-programas?tipoId=${t}`);
      const d = res.status === 404 ? { items: [] } : ((await res.json()) as { items?: Programa[] });
      setProgramas(d.items ?? []);
    }
    if (r === 1 || r === 3) {
      const res = await fetch(`/api/mantenimientos/placas?tipoId=${t}`);
      if (res.ok) {
        const d = (await res.json()) as { data?: Placa[] };
        setPlacas(d.data ?? []);
      }
    }
    const resJobs = await fetch(`/api/mantenimientos/jobs?limite=10&tipo=${t === 1 ? "preventivo" : "correctivo"}`);
    if (resJobs.ok) {
      const d = (await resJobs.json()) as { items: Job[] };
      // La cola muestra también los jobs base asociados.
      const resBase = await fetch(`/api/mantenimientos/jobs?limite=10&tipo=base`);
      const db = resBase.ok ? ((await resBase.json()) as { items: Job[] }) : { items: [] };
      setJobs([...d.items, ...db.items].sort((a, b) => b.id - a.id).slice(0, 10));
    }
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/me");
      if (res.status === 401) return router.replace("/login");
      if (!res.ok) return;
      const s = (await res.json()) as Sesion;
      setSesion(s);
      await cargar(1, s.usuario.rol);
    })();
  }, [router, cargar]);

  async function cambiarTab(t: 1 | 2) {
    setTipo(t);
    setMensaje(null);
    if (sesion) await cargar(t, rol);
  }

  async function subirPrograma(file: File) {
    setMensaje(null);
    const fd = new FormData();
    fd.append("archivo", file);
    fd.append("tipoId", String(tipo));
    const res = await fetch("/api/archivos-programas", { method: "POST", body: fd });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setMensaje(res.ok ? "Programa cargado: queda ACTIVO y el anterior pasa a Inactivo" : (d.error ?? "Error al subir"));
    await cargar(tipo, rol);
  }

  async function cargaMasiva(file: File) {
    setMensaje(null);
    const ext = file.name.toLowerCase().endsWith(".csv") ? "csv" : "xlsx";
    const fd = new FormData();
    fd.append("archivo", file);
    const res = await fetch(`/api/mantenimientos/bulk/${ETIQUETA_TIPO[tipo]}/${ext}`, { method: "POST", body: fd });
    const d = (await res.json()) as Resumen;
    setResumen(d);
    await cargar(tipo, rol);
  }

  function descargarErrores() {
    if (!resumen) return;
    const blob = new Blob([resumen.errores.join("\n")], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `errores_cargue_${ETIQUETA_TIPO[tipo]}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function verHistorial(placa: string) {
    const res = await fetch(`/api/mantenimientos/historial?tipoId=${tipo}&placa=${encodeURIComponent(placa)}`);
    const d = res.ok ? ((await res.json()) as { data?: FilaHistorial[] }) : { data: [] };
    setHistorial({ placa, filas: d.data ?? [] });
  }

  async function registrar() {
    if (!registro) return;
    setMensaje(null);
    const resBase = await fetch("/api/mantenimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vigiladoId: sesion?.usuario.identificacion ?? "0", placa: registro.placa, tipoId: tipo }),
    });
    const base = (await resBase.json()) as { mantenimientoLocalId?: number; error?: string; mensaje?: string };
    if (!resBase.ok || !base.mantenimientoLocalId) {
      setMensaje(base.error ?? "No fue posible registrar el mantenimiento");
      return;
    }
    const resDet = await fetch(`/api/mantenimientos/${ETIQUETA_TIPO[tipo]}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, nit: form.nit, mantenimientoId: base.mantenimientoLocalId }),
    });
    const det = (await resDet.json()) as { error?: string; mensaje?: string };
    setMensaje(resDet.ok ? `Registrado: ${det.mensaje ?? "OK"}` : (det.error ?? "Error en el detalle"));
    if (resDet.ok) setRegistro(null);
    await cargar(tipo, rol);
  }

  async function reenviarCorregido() {
    if (!corrigiendo) return;
    const payload = placaCorregida ? { placa: placaCorregida.toUpperCase() } : null;
    const res = await fetch(`/api/mantenimientos/jobs/${corrigiendo.id}/reintentar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "actualizar", payload }),
    });
    const d = (await res.json()) as { mensaje?: string; error?: string };
    setMensaje(res.ok ? (d.mensaje ?? "Reprogramado") : (d.error ?? "No fue posible reintentar"));
    setCorrigiendo(null);
    setPlacaCorregida("");
    await cargar(tipo, rol);
  }

  if (!sesion) return <main className="p-8">Cargando…</main>;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-sicov-700">Mantenimientos</h1>
      </div>

      {/* Tabs Preventivos / Correctivos */}
      <div className="flex gap-2 mb-4" role="tablist">
        {([1, 2] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tipo === t}
            onClick={() => cambiarTab(t)}
            className={`px-4 py-2 rounded-t text-sm border-b-2 ${tipo === t ? "border-sicov-700 bg-white font-semibold text-sicov-700" : "border-transparent bg-gray-100 text-gray-600"}`}
          >
            {t === 1 ? "Preventivos" : "Correctivos"}
          </button>
        ))}
      </div>

      {mensaje && <p className="mb-4 text-sm text-sicov-700 bg-white border rounded px-3 py-2">{mensaje}</p>}

      {/* Card PDF del programa — lado del CLIENTE (roles 1-2, §10.2) */}
      {veProgramas && (
        <section className="bg-white border rounded shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">PDF del programa de mantenimiento {ETIQUETA_TIPO[tipo]}</h2>
            <label className="bg-sicov-700 text-white rounded px-3 py-1.5 text-sm cursor-pointer">
              Cargar archivo
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                data-testid="input-programa"
                onChange={(e) => e.target.files?.[0] && subirPrograma(e.target.files[0])}
              />
            </label>
          </div>
          <p className="text-xs text-gray-500 mb-2">Solo PDF, máx 4 MB. El último cargado queda ACTIVO.</p>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="px-2 py-1">Nombre</th>
                <th className="px-2 py-1">Fecha</th>
                <th className="px-2 py-1">Estado</th>
                <th className="px-2 py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {programas.length === 0 && (
                <tr><td colSpan={4} className="px-2 py-3 text-gray-500 text-center">Sin documentos cargados</td></tr>
              )}
              {programas.map((p) => (
                <tr key={p.id} className="border-b">
                  <td className="px-2 py-1">{p.nombreOriginal}</td>
                  <td className="px-2 py-1">{p.fecha ? new Date(p.fecha).toLocaleDateString("es-CO") : "—"}</td>
                  <td className="px-2 py-1">
                    <span className={`px-2 py-0.5 rounded text-xs ${p.estado ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                      {p.estado ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-2 py-1">
                    <a className="text-sicov-700 hover:underline" href={`/api/archivos-programas/${p.id}/descargar`}>Descargar</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Card Vehículos — lado del OPERADOR (roles 1-3, §10.2) */}
      {veVehiculos && (
        <section className="bg-white border rounded shadow-sm p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">Vehículos</h2>
            <div className="flex items-center gap-3 text-sm">
              <a className="text-sicov-700 hover:underline" href="/api/mantenimientos/plantillas/preventivo-correctivo">
                Descargar plantilla
              </a>
              <label className="bg-sicov-700 text-white rounded px-3 py-1.5 cursor-pointer">
                Cargue masivo (XLSX/CSV)
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  data-testid="input-masivo"
                  onChange={(e) => e.target.files?.[0] && cargaMasiva(e.target.files[0])}
                />
              </label>
            </div>
          </div>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-600">
                <th className="px-2 py-1">Placa</th>
                <th className="px-2 py-1">Estado</th>
                <th className="px-2 py-1">Último reporte</th>
                <th className="px-2 py-1">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {placas.map((p) => (
                <tr key={p.placa} className="border-b">
                  <td className="px-2 py-1 font-medium">{p.placa}</td>
                  <td className="px-2 py-1">{p.estado ?? "sin reporte"}</td>
                  <td className="px-2 py-1">{p.fecha ?? "—"}</td>
                  <td className="px-2 py-1 flex gap-2">
                    <button className="text-sicov-700 hover:underline" onClick={() => setRegistro({ placa: p.placa })}>
                      Registrar mantenimiento
                    </button>
                    <button className="text-gray-600 hover:underline" onClick={() => verHistorial(p.placa)}>
                      Historial
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Sincronización con la Super (jobs) */}
      <section className="bg-white border rounded shadow-sm p-4">
        <h2 className="font-semibold text-sm mb-3">Sincronización con la Superintendencia</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">Tipo</th>
              <th className="px-2 py-1">Placa</th>
              <th className="px-2 py-1">Estado</th>
              <th className="px-2 py-1">Reintentos</th>
              <th className="px-2 py-1">Error</th>
              <th className="px-2 py-1">Acción</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr><td colSpan={7} className="px-2 py-3 text-gray-500 text-center">Sin trabajos en cola</td></tr>
            )}
            {jobs.map((j) => (
              <tr key={j.id} className="border-b">
                <td className="px-2 py-1">{j.id}</td>
                <td className="px-2 py-1">{j.tipo}</td>
                <td className="px-2 py-1">{j.payload?.placa ?? "—"}</td>
                <td className="px-2 py-1">{j.estado}</td>
                <td className="px-2 py-1">{j.reintentos}</td>
                <td className="px-2 py-1 max-w-xs truncate" title={j.ultimoError ?? ""}>{j.ultimoError ?? "—"}</td>
                <td className="px-2 py-1">
                  {j.estado === "fallido" && (
                    <button className="text-sicov-700 hover:underline" onClick={() => { setCorrigiendo(j); setPlacaCorregida(j.payload?.placa ?? ""); }}>
                      Reintentar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Modal registro individual (2 pasos) */}
      {registro && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-lg space-y-3 text-sm">
            <h3 className="font-semibold">Nuevo mantenimiento {ETIQUETA_TIPO[tipo]} — placa {registro.placa}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label>Fecha (AAAA-MM-DD)
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} placeholder="2026-07-23" />
              </label>
              <label>Hora (HH:mm)
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} placeholder="08:30" />
              </label>
              <label>NIT del taller
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.nit} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
              </label>
              <label>Razón social
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.razonSocial} onChange={(e) => setForm({ ...form, razonSocial: e.target.value })} />
              </label>
              <label>Tipo de identificación (1-12)
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.tipoIdentificacion} onChange={(e) => setForm({ ...form, tipoIdentificacion: e.target.value })} />
              </label>
              <label>N.º identificación
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.numeroIdentificacion} onChange={(e) => setForm({ ...form, numeroIdentificacion: e.target.value })} />
              </label>
            </div>
            <label className="block">{RESPONSABLE[tipo]}
              <input className="mt-1 w-full border rounded px-2 py-1" value={form.nombresResponsable} onChange={(e) => setForm({ ...form, nombresResponsable: e.target.value })} />
            </label>
            <label className="block">Detalle de actividades
              <textarea className="mt-1 w-full border rounded px-2 py-1" rows={2} value={form.detalleActividades} onChange={(e) => setForm({ ...form, detalleActividades: e.target.value })} />
            </label>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={() => setRegistro(null)}>Cancelar</button>
              <button className="px-3 py-1.5 bg-sicov-700 text-white rounded" onClick={registrar}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal historial */}
      {historial && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-2xl text-sm">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Historial {ETIQUETA_TIPO[tipo]} — {historial.placa}</h3>
              <a className="text-sicov-700 hover:underline" href={`/api/mantenimientos/historial/exportar?tipoId=${tipo}&placa=${historial.placa}`}>
                Exportar XLSX
              </a>
            </div>
            <table className="min-w-full text-sm mb-3">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="px-2 py-1">Fecha</th><th className="px-2 py-1">Hora</th><th className="px-2 py-1">NIT</th>
                  <th className="px-2 py-1">Razón social</th><th className="px-2 py-1">Responsable</th><th className="px-2 py-1">Actividades</th>
                </tr>
              </thead>
              <tbody>
                {historial.filas.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-3 text-center text-gray-500">No hay registros disponibles</td></tr>
                )}
                {historial.filas.map((f, i) => (
                  <tr key={i} className="border-b">
                    <td className="px-2 py-1">{f.fecha}</td><td className="px-2 py-1">{f.hora}</td><td className="px-2 py-1">{f.nit}</td>
                    <td className="px-2 py-1">{f.razon_social}</td><td className="px-2 py-1">{f.nombres_responsable}</td>
                    <td className="px-2 py-1">{f.detalle_actividades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <button className="px-3 py-1.5 border rounded" onClick={() => setHistorial(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal resumen de carga masiva (§10.10) */}
      {resumen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-lg text-sm">
            <h3 className="font-semibold mb-2">Resultado del cargue</h3>
            <p className="mb-3">
              Se procesaron {resumen.total} registros. Exitosos: {resumen.exitosos}. Fallidos:{" "}
              {resumen.total - resumen.exitosos}. Errores a corregir: {resumen.errores.length}.
            </p>
            {resumen.errores.length > 0 && (
              <ul className="mb-3 max-h-40 overflow-y-auto list-disc pl-5 text-red-700">
                {resumen.errores.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}
                {resumen.errores.length > 10 && <li>… y {resumen.errores.length - 10} más (descárguelos)</li>}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              {resumen.errores.length > 0 && (
                <button className="px-3 py-1.5 border rounded" onClick={descargarErrores}>Descargar errores</button>
              )}
              <button className="px-3 py-1.5 bg-sicov-700 text-white rounded" onClick={() => setResumen(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal corregir-y-reenviar (§10.6) */}
      {corrigiendo && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-md text-sm space-y-3">
            <h3 className="font-semibold">Corregir y reenviar — trabajo #{corrigiendo.id}</h3>
            <p className="text-gray-600">{corrigiendo.ultimoError ?? "Sin detalle del error"}</p>
            <label className="block">Placa
              <input className="mt-1 w-full border rounded px-2 py-1" value={placaCorregida} onChange={(e) => setPlacaCorregida(e.target.value)} />
            </label>
            <p className="text-xs text-gray-500">El reenvío corrige el registro y dispara un ciclo completo nuevo de intentos.</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={() => setCorrigiendo(null)}>Cancelar</button>
              <button className="px-3 py-1.5 bg-sicov-700 text-white rounded" onClick={reenviarCorregido}>Reenviar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
