"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Cliente {
  id: string;
  nombre: string;
}

interface Usuario {
  id: string;
  nombre: string;
  email: string;
  rol: string;
}

export default function NuevaOportunidadPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [form, setForm] = useState({
    nombre: "",
    modalidad: "LICITACION",
    entidadContratante: "",
    clienteId: "",
    responsableId: "",
    fechaInicioPlaneada: "",
    fechaFinPlaneada: "",
    valorEstimado: "",
    alcance: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/clientes").then((res) => res.json()),
      fetch("/api/usuarios").then((res) => res.json()),
    ]).then(([cli, usrs]) => {
      setClientes(Array.isArray(cli) ? cli : []);
      setUsuarios(Array.isArray(usrs) ? usrs : []);
    });
  }, []);

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch("/api/oportunidades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        valorEstimado: form.valorEstimado ? Number(form.valorEstimado) : null,
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
            <label className="block text-xs font-semibold text-white/60 mb-2">CLIENTE</label>
            <select className="input-field" value={form.clienteId} onChange={(e) => setForm({ ...form, clienteId: e.target.value })}>
              <option value="">-- Nuevo / Sin cliente --</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            <label className="block text-xs font-semibold text-white/60 mb-2">VALOR ESTIMADO</label>
            <input type="number" className="input-field" value={form.valorEstimado} onChange={(e) => setForm({ ...form, valorEstimado: e.target.value })} />
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
