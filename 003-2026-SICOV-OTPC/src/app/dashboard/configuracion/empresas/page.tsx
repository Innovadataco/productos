"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/// Empresas (rol 1): tabla + modal crear/editar + modal token + reenviar credencial (009 US1).
/// El token de empresa es MODIFICABLE. El NIT es inmutable. La navegación la hereda del layout.
interface Modulo {
  id: number;
  nombre: string | null;
  nombreMostrar: string | null;
}
interface EmpresaFila {
  nit: string | null;
  empresa: string | null;
  estado: boolean | null;
  fechaInicial: string | null;
  fechaFinal: string | null;
}
interface Detalle extends EmpresaFila {
  token: string | null;
  correo: string | null;
  modulos: number[];
}

const VACIO = { empresa: "", nit: "", correo: "", fechaInicial: "", fechaFinal: "", token: "", modulos: [] as number[] };

export default function EmpresasPage() {
  const router = useRouter();
  const [rol, setRol] = useState(0);
  const [items, setItems] = useState<EmpresaFila[]>([]);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<"crear" | "editar" | "token" | null>(null);
  const [editNit, setEditNit] = useState<string | null>(null);
  const [form, setForm] = useState({ ...VACIO });
  const [tokenNuevo, setTokenNuevo] = useState("");

  const cargar = useCallback(async () => {
    const res = await fetch("/api/configuracion/empresas?pageSize=100");
    if (res.ok) {
      const d = (await res.json()) as { items: EmpresaFila[] };
      setItems(d.items);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/me");
      if (me.status === 401) return router.replace("/login");
      const s = (await me.json()) as { usuario: { rol: number } };
      if (s.usuario.rol !== 1) return router.replace("/dashboard");
      setRol(s.usuario.rol);
      // Catálogo de módulos para asignar a la empresa.
      const mres = await fetch("/api/configuracion/modulos");
      if (mres.ok) setModulos(((await mres.json()) as { items: Modulo[] }).items);
      await cargar();
    })();
  }, [router, cargar]);

  function abrirCrear() {
    setForm({ ...VACIO });
    setEditNit(null);
    setModal("crear");
    setMensaje(null);
  }

  async function abrirEditar(nit: string) {
    const res = await fetch(`/api/configuracion/empresas/${nit}`);
    if (!res.ok) return;
    const d = (await res.json()) as Detalle;
    setForm({
      empresa: d.empresa ?? "",
      nit: d.nit ?? "",
      correo: d.correo ?? "",
      fechaInicial: d.fechaInicial?.slice(0, 10) ?? "",
      fechaFinal: d.fechaFinal?.slice(0, 10) ?? "",
      token: d.token ?? "",
      modulos: d.modulos ?? [],
    });
    setEditNit(nit);
    setModal("editar");
  }

  function toggleModulo(id: number) {
    setForm((f) => ({
      ...f,
      modulos: f.modulos.includes(id) ? f.modulos.filter((m) => m !== id) : [...f.modulos, id],
    }));
  }

  async function guardar() {
    setMensaje(null);
    if (modal === "crear") {
      const res = await fetch("/api/configuracion/empresas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; correoEnviado?: boolean };
      if (!res.ok) return setMensaje(d.error ?? "No fue posible crear la empresa");
      setMensaje(d.correoEnviado ? "Empresa creada; credencial enviada." : "Empresa creada; correo no enviado (reenvíe la credencial).");
    } else if (modal === "editar" && editNit) {
      const res = await fetch(`/api/configuracion/empresas/${editNit}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa: form.empresa, correo: form.correo, fechaInicial: form.fechaInicial, fechaFinal: form.fechaFinal }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setMensaje(d.error ?? "No fue posible editar");
      setMensaje("Empresa actualizada.");
    }
    setModal(null);
    await cargar();
  }

  async function cambiarEstado(nit: string, estado: boolean) {
    await fetch(`/api/configuracion/empresas/${nit}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    await cargar();
  }

  async function guardarToken() {
    if (!editNit) return;
    const res = await fetch(`/api/configuracion/empresas/${editNit}/token`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: tokenNuevo }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setMensaje(res.ok ? "Token actualizado (sincronizado con el admin)." : (d.error ?? "No fue posible actualizar el token"));
    setModal(null);
    await cargar();
  }

  async function reenviar(nit: string) {
    const res = await fetch(`/api/configuracion/empresas/${nit}/reenviar-credencial`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { correoEnviado?: boolean; error?: string };
    setMensaje(res.ok ? (d.correoEnviado ? "Credencial reenviada." : "Credencial regenerada; correo no enviado.") : (d.error ?? "Error"));
  }

  if (rol !== 1) return <main className="p-8">Cargando…</main>;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-sicov-700">Empresas</h1>
        <button className="bg-sicov-700 text-white rounded px-3 py-1.5 text-sm" onClick={abrirCrear}>
          Nueva empresa
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm text-sicov-700 bg-white border rounded px-3 py-2">{mensaje}</p>}

      <section className="bg-white border rounded shadow-sm p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="px-2 py-1">NIT</th>
              <th className="px-2 py-1">Empresa</th>
              <th className="px-2 py-1">Vigencia</th>
              <th className="px-2 py-1">Estado</th>
              <th className="px-2 py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-gray-500">Sin empresas registradas</td></tr>
            )}
            {items.map((e) => (
              <tr key={e.nit} className="border-b">
                <td className="px-2 py-1 font-medium">{e.nit}</td>
                <td className="px-2 py-1">{e.empresa}</td>
                <td className="px-2 py-1">{e.fechaInicial?.slice(0, 10) ?? "—"} → {e.fechaFinal?.slice(0, 10) ?? "—"}</td>
                <td className="px-2 py-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${e.estado ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                    {e.estado ? "Activa" : "Inactiva"}
                  </span>
                </td>
                <td className="px-2 py-1 flex flex-wrap gap-2">
                  <button className="text-sicov-700 hover:underline" onClick={() => e.nit && abrirEditar(e.nit)}>Editar</button>
                  <button className="text-sicov-700 hover:underline" onClick={() => { setEditNit(e.nit); setTokenNuevo(""); setModal("token"); }}>Token</button>
                  <button className="text-sicov-700 hover:underline" onClick={() => e.nit && reenviar(e.nit)}>Reenviar credencial</button>
                  <button className="text-gray-600 hover:underline" onClick={() => e.nit && cambiarEstado(e.nit, !e.estado)}>
                    {e.estado ? "Desactivar" : "Activar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(modal === "crear" || modal === "editar") && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-lg space-y-3 text-sm">
            <h3 className="font-semibold">{modal === "crear" ? "Nueva empresa" : `Editar empresa ${form.nit}`}</h3>
            <label className="block">Razón social
              <input className="mt-1 w-full border rounded px-2 py-1" value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label>NIT
                <input className="mt-1 w-full border rounded px-2 py-1 disabled:bg-gray-100" value={form.nit} disabled={modal === "editar"} onChange={(e) => setForm({ ...form, nit: e.target.value })} />
              </label>
              <label>Correo
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </label>
              <label>Vigencia desde
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={form.fechaInicial} onChange={(e) => setForm({ ...form, fechaInicial: e.target.value })} />
              </label>
              <label>Vigencia hasta
                <input type="date" className="mt-1 w-full border rounded px-2 py-1" value={form.fechaFinal} onChange={(e) => setForm({ ...form, fechaFinal: e.target.value })} />
              </label>
            </div>
            {modal === "crear" && (
              <label className="block">Token (opcional; se puede modificar luego)
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
              </label>
            )}
            <fieldset className="border rounded p-2">
              <legend className="text-xs text-gray-500 px-1">Módulos de la empresa</legend>
              <div className="grid grid-cols-2 gap-1">
                {modulos.map((m) => (
                  <label key={m.id} className="flex items-center gap-2">
                    <input type="checkbox" checked={form.modulos.includes(m.id)} onChange={() => toggleModulo(m.id)} disabled={modal === "editar"} />
                    {m.nombreMostrar ?? m.nombre}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={() => setModal(null)}>Cancelar</button>
              <button className="px-3 py-1.5 bg-sicov-700 text-white rounded" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {modal === "token" && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-md space-y-3 text-sm">
            <h3 className="font-semibold">Modificar token — {editNit}</h3>
            <label className="block">Nuevo token
              <input className="mt-1 w-full border rounded px-2 py-1" value={tokenNuevo} onChange={(e) => setTokenNuevo(e.target.value)} />
            </label>
            <p className="text-xs text-gray-500">Se sincroniza con el admin de la empresa; los operadores lo heredan.</p>
            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={() => setModal(null)}>Cancelar</button>
              <button className="px-3 py-1.5 bg-sicov-700 text-white rounded" onClick={guardarToken}>Guardar token</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
