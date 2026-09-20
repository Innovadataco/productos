"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatCOP, parseCOP, diasEjecucion } from "../../../lib/format";

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export default function NuevaOportunidadPage() {
  const router = useRouter();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nombre: "",
    modalidad: "LICITACION",
    entidadContratante: "",
    responsableId: "",
    fechaInicioPlaneada: "",
    fechaFinPlaneada: "",
    valorEstimado: "",
    alcance: "",
  });

  useEffect(() => {
    fetch("/api/usuarios")
      .then((res) => res.json())
      .then((usrs) => setUsuarios(Array.isArray(usrs) ? usrs : []));
  }, []);

  const dias = useMemo(
    () => diasEjecucion(form.fechaInicioPlaneada, form.fechaFinPlaneada),
    [form.fechaInicioPlaneada, form.fechaFinPlaneada]
  );

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.fechaInicioPlaneada && form.fechaFinPlaneada) {
      const inicio = new Date(form.fechaInicioPlaneada);
      const fin = new Date(form.fechaFinPlaneada);
      if (fin < inicio) {
        setError("La fecha de fin no puede ser menor a la fecha de inicio.");
        return;
      }
    }

    const valorNumerico = parseCOP(form.valorEstimado);

    await fetch("/api/oportunidades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        clienteId: null,
        valorEstimado: valorNumerico,
      }),
    });
    router.push("/oportunidades");
  };

  return (
    <div className="page-enter max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/oportunidades" className="btn-secondary"><i className="fas fa-arrow-left"></i></Link>
        <h2 className="text-2xl font-bold">Nueva oportunidad</h2>
      </div>

      <form onSubmit={guardar} className="glass-card p-6 space-y-4">
        {error && (
          <div className="text-sm p-4 rounded-2xl bg-red-500/10 text-red-300 border border-red-500/20">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-white/60 mb-2">NOMBRE</label>
            <input className="input-field" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">MODALIDAD</label>
            <select className="input-field" value={form.modalidad} onChange={(e) => setForm({ ...form, modalidad: e.target.value })}>
              <option value="LICITACION">Licitación</option>
              <option value="CONTRATACION_DIRECTA">Contratación de mérito</option>
              <option value="SUBASTA_INVERSA">Subasta inversa</option>
              <option value="CONTRATO_PRIVADO">Contrato privado</option>
              <option value="CONVENIO">Convenio</option>
              <option value="OTRO">Otro</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">ENTIDAD / CONTRATANTE</label>
            <input className="input-field" value={form.entidadContratante} onChange={(e) => setForm({ ...form, entidadContratante: e.target.value })} required />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">RESPONSABLE</label>
            <select className="input-field" value={form.responsableId} onChange={(e) => setForm({ ...form, responsableId: e.target.value })}>
              <option value="">-- Sin responsable --</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">VALOR ESTIMADO</label>
            <input
              inputMode="numeric"
              className="input-field"
              value={form.valorEstimado}
              onChange={(e) => {
                const raw = e.target.value;
                const numeric = parseCOP(raw);
                setForm({ ...form, valorEstimado: numeric === null ? "" : formatCOP(numeric) });
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
            <label className="block text-xs font-semibold text-white/60 mb-2">FECHA INICIO PLANEADA</label>
            <input type="date" className="input-field" value={form.fechaInicioPlaneada} onChange={(e) => setForm({ ...form, fechaInicioPlaneada: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/60 mb-2">FECHA FIN PLANEADA</label>
            <input type="date" className="input-field" value={form.fechaFinPlaneada} onChange={(e) => setForm({ ...form, fechaFinPlaneada: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-white/60 mb-2">ALCANCE</label>
            <textarea className="input-field" rows={3} value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Link href="/oportunidades" className="btn-secondary">Cancelar</Link>
          <button type="submit" className="btn-primary">Guardar oportunidad</button>
        </div>
      </form>
    </div>
  );
}
