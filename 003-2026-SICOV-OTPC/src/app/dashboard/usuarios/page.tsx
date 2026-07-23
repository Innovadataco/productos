"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/// Usuarios en cascada (rol 1 y 2). Tabla del alcance + modal crear/editar con selector
/// módulos→submódulos ANIDADO, limitado al set del otorgante (servido por la API, nunca calculado
/// en cliente — D-015). "Módulo completo" y "submódulos" son excluyentes (B2, materializado server-side).
interface SubAsignable { id: number; nombre: string | null; nombreMostrar: string | null }
interface ModAsignable { id: number; nombre: string | null; nombreMostrar: string | null; puedeCompleto: boolean; submodulos: SubAsignable[] }
interface UsuarioFila { id: number; nombre: string; identificacion: string | null; correo: string | null; rolId: number | null; estado: boolean | null }

/// Selección por módulo: 'completo' o lista de submódulos.
type Seleccion = Record<number, { completo: boolean; subs: number[] }>;

export default function UsuariosPage() {
  const router = useRouter();
  const [rol, setRol] = useState(0);
  const [items, setItems] = useState<UsuarioFila[]>([]);
  const [asignables, setAsignables] = useState<ModAsignable[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [modal, setModal] = useState<"crear" | "editar" | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ nombre: "", identificacion: "", correo: "", rolId: 3 as 2 | 3 });
  const [sel, setSel] = useState<Seleccion>({});

  const cargar = useCallback(async () => {
    const res = await fetch("/api/usuarios?pageSize=100");
    if (res.ok) setItems(((await res.json()) as { items: UsuarioFila[] }).items);
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetch("/api/me");
      if (me.status === 401) return router.replace("/login");
      const s = (await me.json()) as { usuario: { rol: number } };
      if (s.usuario.rol !== 1 && s.usuario.rol !== 2) return router.replace("/dashboard");
      setRol(s.usuario.rol);
      const a = await fetch("/api/usuarios/asignables");
      if (a.ok) setAsignables(((await a.json()) as { items: ModAsignable[] }).items);
      await cargar();
    })();
  }, [router, cargar]);

  function abrirCrear() {
    setForm({ nombre: "", identificacion: "", correo: "", rolId: 3 });
    setSel({});
    setEditId(null);
    setModal("crear");
    setMensaje(null);
  }

  function toggleCompleto(moduloId: number) {
    setSel((s) => {
      const actual = s[moduloId];
      if (actual?.completo) { const { [moduloId]: _omit, ...resto } = s; return resto; }
      return { ...s, [moduloId]: { completo: true, subs: [] } };
    });
  }

  function toggleSub(moduloId: number, subId: number) {
    setSel((s) => {
      const actual = s[moduloId] ?? { completo: false, subs: [] };
      const subs = actual.subs.includes(subId) ? actual.subs.filter((x) => x !== subId) : [...actual.subs, subId];
      if (subs.length === 0) { const { [moduloId]: _omit, ...resto } = s; return resto; }
      return { ...s, [moduloId]: { completo: false, subs } };
    });
  }

  function permisosPayload() {
    return Object.entries(sel).map(([moduloId, v]) => ({
      moduloId: Number(moduloId),
      submoduloIds: v.completo ? [] : v.subs,
    }));
  }

  async function guardar() {
    setMensaje(null);
    if (modal === "crear") {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, permisos: permisosPayload() }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; correoEnviado?: boolean };
      if (!res.ok) return setMensaje(d.error ?? "No fue posible crear el usuario");
      setMensaje(d.correoEnviado ? "Usuario creado; credencial enviada." : "Usuario creado; correo no enviado.");
    } else if (modal === "editar" && editId) {
      const res = await fetch(`/api/usuarios/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: form.nombre, correo: form.correo, permisos: permisosPayload() }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setMensaje(d.error ?? "No fue posible editar");
      setMensaje("Usuario actualizado.");
    }
    setModal(null);
    await cargar();
  }

  async function cambiarEstado(id: number, estado: boolean) {
    await fetch(`/api/usuarios/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ estado }) });
    await cargar();
  }

  async function reenviar(id: number) {
    const res = await fetch(`/api/usuarios/${id}/reenviar-credencial`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { correoEnviado?: boolean; error?: string };
    setMensaje(res.ok ? (d.correoEnviado ? "Credencial reenviada." : "Credencial regenerada; correo no enviado.") : (d.error ?? "Error"));
  }

  if (rol !== 1 && rol !== 2) return <main className="p-8">Cargando…</main>;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-sicov-700">Usuarios</h1>
        <button className="bg-sicov-700 text-white rounded px-3 py-1.5 text-sm" onClick={abrirCrear}>Nuevo usuario</button>
      </div>

      {mensaje && <p className="mb-4 text-sm text-sicov-700 bg-white border rounded px-3 py-2">{mensaje}</p>}

      <section className="bg-white border rounded shadow-sm p-4">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-600">
              <th className="px-2 py-1">Identificación</th>
              <th className="px-2 py-1">Nombre</th>
              <th className="px-2 py-1">Rol</th>
              <th className="px-2 py-1">Estado</th>
              <th className="px-2 py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-3 text-center text-gray-500">Sin usuarios en el alcance</td></tr>
            )}
            {items.map((u) => (
              <tr key={u.id} className="border-b">
                <td className="px-2 py-1 font-medium">{u.identificacion}</td>
                <td className="px-2 py-1">{u.nombre}</td>
                <td className="px-2 py-1">{u.rolId === 2 ? "Admin empresa" : "Operador"}</td>
                <td className="px-2 py-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.estado ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"}`}>
                    {u.estado ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-2 py-1 flex flex-wrap gap-2">
                  <button className="text-sicov-700 hover:underline" onClick={() => { setEditId(u.id); setForm({ nombre: u.nombre, identificacion: u.identificacion ?? "", correo: u.correo ?? "", rolId: (u.rolId === 2 ? 2 : 3) }); setSel({}); setModal("editar"); }}>Editar</button>
                  <button className="text-sicov-700 hover:underline" onClick={() => reenviar(u.id)}>Reenviar credencial</button>
                  <button className="text-gray-600 hover:underline" onClick={() => cambiarEstado(u.id, !u.estado)}>{u.estado ? "Desactivar" : "Activar"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4" role="dialog">
          <div className="bg-white rounded shadow-lg p-5 w-full max-w-lg space-y-3 text-sm max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold">{modal === "crear" ? "Nuevo usuario" : `Editar usuario ${form.identificacion}`}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label>Nombre
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label>Identificación
                <input className="mt-1 w-full border rounded px-2 py-1 disabled:bg-gray-100" value={form.identificacion} disabled={modal === "editar"} onChange={(e) => setForm({ ...form, identificacion: e.target.value })} />
              </label>
              <label>Correo
                <input className="mt-1 w-full border rounded px-2 py-1" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </label>
              <label>Rol
                <select className="mt-1 w-full border rounded px-2 py-1 disabled:bg-gray-100" value={form.rolId} disabled={modal === "editar"} onChange={(e) => setForm({ ...form, rolId: (Number(e.target.value) === 2 ? 2 : 3) })}>
                  <option value={3}>Operador (rol 3)</option>
                  <option value={2}>Admin de empresa (rol 2)</option>
                </select>
              </label>
            </div>

            <fieldset className="border rounded p-2">
              <legend className="text-xs text-gray-500 px-1">Permisos (módulos y submódulos) — máximo: lo que usted tiene</legend>
              <p className="text-xs text-gray-400 mb-2">"Módulo completo" y elegir submódulos son excluyentes.</p>
              {asignables.map((m) => (
                <div key={m.id} className="mb-2 border-b pb-2">
                  <label className="flex items-center gap-2 font-medium">
                    {m.puedeCompleto && (
                      <input type="checkbox" checked={sel[m.id]?.completo ?? false} onChange={() => toggleCompleto(m.id)} />
                    )}
                    {m.nombreMostrar ?? m.nombre}
                    {m.puedeCompleto && <span className="text-xs text-gray-400">(completo)</span>}
                  </label>
                  {m.submodulos.length > 0 && (
                    <div className="pl-6 mt-1 grid grid-cols-2 gap-1">
                      {m.submodulos.map((s) => (
                        <label key={s.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sel[m.id]?.subs.includes(s.id) ?? false}
                            disabled={sel[m.id]?.completo ?? false}
                            onChange={() => toggleSub(m.id, s.id)}
                          />
                          {s.nombreMostrar ?? s.nombre}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </fieldset>

            <div className="flex justify-end gap-2">
              <button className="px-3 py-1.5 border rounded" onClick={() => setModal(null)}>Cancelar</button>
              <button className="px-3 py-1.5 bg-sicov-700 text-white rounded" onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
