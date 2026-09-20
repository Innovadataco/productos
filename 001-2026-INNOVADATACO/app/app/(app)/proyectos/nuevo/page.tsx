"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatCOP, parseCOP, diasEjecucion, formatDateInput } from "../../../lib/format";

interface Oportunidad {
  id: string;
  nombre: string;
  alcance: string | null;
  fechaInicioPlaneada: string | null;
  fechaFinPlaneada: string | null;
  valorEstimado: number | null;
  responsableId: string | null;
  entidadContratante: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export default function NuevoProyectoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oportunidadId = searchParams.get("oportunidadId");

  const [oportunidad, setOportunidad] = useState<Oportunidad | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState({
    nombre: "",
    estado: "PLANIFICACION",
    alcance: "",
    fechaInicioReal: "",
    fechaEntregaPlaneada: "",
    valorContratado: "",
    responsableId: "",
  });

  useEffect(() => {
    const promises: Promise<unknown>[] = [
      fetch("/api/usuarios").then((r) => r.json()).then((usrs) => setUsuarios(Array.isArray(usrs) ? usrs : [])),
    ];

    if (oportunidadId) {
      promises.push(
        fetch(`/api/oportunidades/${oportunidadId}`)
          .then((r) => r.json())
          .then((opp: Oportunidad) => {
            setOportunidad(opp);
            setForm((f) => ({
              ...f,
              nombre: opp.nombre,
              alcance: opp.alcance || "",
              fechaInicioReal: formatDateInput(opp.fechaInicioPlaneada),
              fechaEntregaPlaneada: formatDateInput(opp.fechaFinPlaneada),
              valorContratado: opp.valorEstimado !== null ? formatCOP(opp.valorEstimado) : "",
              responsableId: opp.responsableId || "",
            }));
          })
      );
    }

    Promise.all(promises);
  }, [oportunidadId]);

  const dias = diasEjecucion(form.fechaInicioReal, form.fechaEntregaPlaneada);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setGuardando(true);

    if (form.fechaInicioReal && form.fechaEntregaPlaneada) {
      const inicio = new Date(form.fechaInicioReal);
      const fin = new Date(form.fechaEntregaPlaneada);
      if (fin < inicio) {
        setError("La fecha de entrega no puede ser menor a la fecha de inicio.");
        setGuardando(false);
        return;
      }
    }

    const res = await fetch("/api/proyectos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: form.nombre,
        estado: form.estado,
        alcance: form.alcance,
        fechaInicioReal: form.fechaInicioReal || null,
        fechaEntregaPlaneada: form.fechaEntregaPlaneada || null,
        valorContratado: parseCOP(form.valorContratado),
        responsableId: form.responsableId || null,
        oportunidadId: oportunidadId || null,
      }),
    });

    setGuardando(false);

    if (res.ok) {
      const proyecto = await res.json();
      router.push(`/proyectos/${proyecto.id}`);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Error al crear el proyecto");
    }
  };

  return (
    <div className="page-enter max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href={oportunidadId ? `/oportunidades/${oportunidadId}` : "/portafolio"} className="btn-secondary">
          <i className="fas fa-arrow-left"></i>
        </Link>
        <div>
          <h2 className="text-2xl font-bold">Nuevo proyecto</h2>
          {oportunidad && (
            <p className="text-white/50 text-sm">Desde oportunidad: {oportunidad.nombre}</p>
          )}
        </div>
      </div>

      <form onSubmit={guardar} className="glass-card p-6 space-y-4">
        {error && (
          <div className="text-sm p-4 rounded-2xl bg-red-500/10 text-red-300 border border-red-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-white/60 mb-2">NOMBRE DEL PROYECTO</label>
            <input
              className="input-field"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">ESTADO</label>
            <select className="input-field" value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
              <option value="PLANIFICACION">Planificación</option>
              <option value="ACTIVO">Activo</option>
              <option value="EN_PAUSA">En pausa</option>
              <option value="ENTREGADO">Entregado</option>
              <option value="CERRADO">Cerrado</option>
              <option value="CANCELADO">Cancelado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">RESPONSABLE</label>
            <select className="input-field" value={form.responsableId} onChange={(e) => setForm({ ...form, responsableId: e.target.value })}>
              <option value="">-- Sin responsable --</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">VALOR CONTRATADO</label>
            <input
              inputMode="numeric"
              className="input-field"
              value={form.valorContratado}
              onChange={(e) => {
                const num = parseCOP(e.target.value);
                setForm({ ...form, valorContratado: num === null ? "" : formatCOP(num) });
              }}
              placeholder="$0"
            />
          </div>

          <div className="flex items-end">
            <div className="w-full">
              <label className="block text-xs font-semibold text-white/60 mb-2">DÍAS DE EJECUCIÓN</label>
              <div className="input-field flex items-center text-white/70">
                {dias !== null ? `${dias} días` : "--"}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">FECHA INICIO REAL</label>
            <input
              type="date"
              className="input-field"
              value={form.fechaInicioReal}
              onChange={(e) => setForm({ ...form, fechaInicioReal: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">FECHA ENTREGA PLANEADA</label>
            <input
              type="date"
              className="input-field"
              value={form.fechaEntregaPlaneada}
              onChange={(e) => setForm({ ...form, fechaEntregaPlaneada: e.target.value })}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-white/60 mb-2">ALCANCE</label>
            <textarea
              className="input-field"
              rows={4}
              value={form.alcance}
              onChange={(e) => setForm({ ...form, alcance: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Link href={oportunidadId ? `/oportunidades/${oportunidadId}` : "/portafolio"} className="btn-secondary">
            Cancelar
          </Link>
          <button type="submit" disabled={guardando} className="btn-primary disabled:opacity-50">
            {guardando ? <><i className="fas fa-circle-notch fa-spin" /> Creando...</> : <><i className="fas fa-save" /> Crear proyecto</>}
          </button>
        </div>
      </form>
    </div>
  );
}
