"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Oportunidad {
  id: string;
  codigo: string;
  nombre: string;
  modalidad: string;
  entidadContratante: string;
  estado: string;
  valorEstimado: number | null;
  fechaInicioPlaneada: string | null;
  fechaFinPlaneada: string | null;
  alcance: string | null;
  motivoCierre: string | null;
  cliente: { nombre: string } | null;
  responsable: { nombre: string } | null;
}

export default function OportunidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [oportunidad, setOportunidad] = useState<Oportunidad | null>(null);
  const [cargando, setCargando] = useState(true);
  const [mostrarCerrar, setMostrarCerrar] = useState(false);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    fetch(`/api/oportunidades/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setOportunidad(data);
        setCargando(false);
      })
      .catch(() => setCargando(false));
  }, [id]);

  const convertir = async () => {
    await fetch(`/api/oportunidades/${id}/convertir`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    router.push("/portafolio");
  };

  const cerrar = async () => {
    await fetch(`/api/oportunidades/${id}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivoCierre: motivo }),
    });
    router.refresh();
    setMostrarCerrar(false);
    if (oportunidad) setOportunidad({ ...oportunidad, estado: "NO_ADJUDICADA", motivoCierre: motivo });
  };

  if (cargando) return <div className="page-enter text-white/50">Cargando oportunidad...</div>;
  if (!oportunidad) return <div className="page-enter text-white/50">Oportunidad no encontrada</div>;

  const statusClass = (estado: string) => {
    switch (estado) {
      case "IDENTIFICADA": return "status-identificada";
      case "EN_PROPUESTA": return "status-propuesta";
      case "PRESENTADA": return "status-presentada";
      case "ADJUDICADA": return "status-adjudicada";
      case "NO_ADJUDICADA": return "status-no-adjudicada";
      case "CERRADA": return "status-cerrada";
      default: return "status-identificada";
    }
  };

  return (
    <div className="page-enter max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/oportunidades" className="btn-secondary"><i className="fas fa-arrow-left"></i></Link>
        <div className="flex-1">
          <h2 className="text-2xl font-bold">{oportunidad.nombre}</h2>
          <p className="text-white/50 text-sm">{oportunidad.codigo}</p>
        </div>
        <span className={`status-badge ${statusClass(oportunidad.estado)}`}>{oportunidad.estado.replace("_", " ")}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="font-bold mb-4">Información</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-white/60 mb-2">MODALIDAD</label><input className="input-field" value={oportunidad.modalidad} readOnly /></div>
            <div><label className="block text-xs font-semibold text-white/60 mb-2">ENTIDAD</label><input className="input-field" value={oportunidad.entidadContratante} readOnly /></div>
            <div><label className="block text-xs font-semibold text-white/60 mb-2">CLIENTE</label><input className="input-field" value={oportunidad.cliente?.nombre || "-"} readOnly /></div>
            <div><label className="block text-xs font-semibold text-white/60 mb-2">RESPONSABLE</label><input className="input-field" value={oportunidad.responsable?.nombre || "-"} readOnly /></div>
            <div><label className="block text-xs font-semibold text-white/60 mb-2">VALOR ESTIMADO</label><input className="input-field" value={oportunidad.valorEstimado ? `$${(oportunidad.valorEstimado / 1_000_000).toFixed(0)}M` : "-"} readOnly /></div>
            <div><label className="block text-xs font-semibold text-white/60 mb-2">FECHA FIN PLANEADA</label><input className="input-field" value={oportunidad.fechaFinPlaneada ? new Date(oportunidad.fechaFinPlaneada).toLocaleDateString("es-CO") : "-"} readOnly /></div>
            <div className="md:col-span-2"><label className="block text-xs font-semibold text-white/60 mb-2">ALCANCE</label><textarea className="input-field" rows={3} value={oportunidad.alcance || ""} readOnly /></div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Acciones</h3>
            <div className="space-y-3">
              {(oportunidad.estado === "PRESENTADA" || oportunidad.estado === "ADJUDICADA") && (
                <button onClick={convertir} className="btn-primary w-full">Convertir a proyecto</button>
              )}
              {!mostrarCerrar && oportunidad.estado !== "NO_ADJUDICADA" && oportunidad.estado !== "CERRADA" && (
                <button onClick={() => setMostrarCerrar(true)} className="btn-secondary w-full"><i className="fas fa-lock mr-2"></i>Cerrar oportunidad</button>
              )}
              {mostrarCerrar && (
                <div className="space-y-3">
                  <select className="input-field" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                    <option value="">Selecciona motivo</option>
                    <option value="Perdió contra competidor">Perdió contra competidor</option>
                    <option value="Se declaró desierta">Se declaró desierta</option>
                    <option value="Cancelada por el cliente">Cancelada por el cliente</option>
                    <option value="No cumplimos requisitos">No cumplimos requisitos</option>
                    <option value="No es rentable">No es rentable</option>
                    <option value="Postergada indefinidamente">Postergada indefinidamente</option>
                    <option value="Descartada por Innovadataco">Descartada por Innovadataco</option>
                    <option value="Otro">Otro</option>
                  </select>
                  <button onClick={cerrar} className="btn-danger w-full">Confirmar cierre</button>
                </div>
              )}
            </div>
          </div>

          {oportunidad.motivoCierre && (
            <div className="glass-card p-6">
              <h3 className="font-bold mb-2">Motivo de cierre</h3>
              <p className="text-white/60 text-sm">{oportunidad.motivoCierre}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
