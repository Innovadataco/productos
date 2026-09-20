"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DocumentosSection from "../../../components/DocumentosSection";

interface Cliente { id: string; nombre: string; }
interface Usuario { id: string; nombre: string; email: string; rol: string; }

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
  clienteId: string | null;
  cliente: { nombre: string } | null;
  responsableId: string | null;
  responsable: { nombre: string } | null;
}

const modalidades = [
  { key: "LICITACION", label: "Licitación" },
  { key: "CONTRATACION_DIRECTA", label: "Contratación de mérito" },
  { key: "SUBASTA_INVERSA", label: "Subasta inversa" },
  { key: "CONTRATO_PRIVADO", label: "Contrato privado" },
  { key: "CONVENIO", label: "Convenio" },
  { key: "OTRO", label: "Otro" },
];

const estados = [
  { key: "IDENTIFICADA", label: "Identificada" },
  { key: "EN_PROPUESTA", label: "En propuesta" },
  { key: "PRESENTADA", label: "Presentada" },
  { key: "ADJUDICADA", label: "Adjudicada" },
  { key: "NO_ADJUDICADA", label: "No adjudicada" },
  { key: "CERRADA", label: "Cerrada" },
];

export default function OportunidadDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [oportunidad, setOportunidad] = useState<Oportunidad | null>(null);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);
  const [mostrarCerrar, setMostrarCerrar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/oportunidades/${id}`).then((r) => r.json()),
      fetch("/api/clientes").then((r) => r.json()),
      fetch("/api/usuarios").then((r) => r.json()),
    ]).then(([opp, cli, usrs]) => {
      setOportunidad(opp);
      setClientes(Array.isArray(cli) ? cli : []);
      setUsuarios(Array.isArray(usrs) ? usrs : []);
      setCargando(false);
    }).catch(() => setCargando(false));
  }, [id]);

  const actualizarCampo = (campo: keyof Oportunidad, valor: string | null) => {
    if (!oportunidad) return;
    setOportunidad({ ...oportunidad, [campo]: valor } as Oportunidad);
  };

  const guardar = async () => {
    if (!oportunidad) return;
    setGuardando(true);
    setMensaje(null);

    const res = await fetch(`/api/oportunidades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: oportunidad.nombre,
        modalidad: oportunidad.modalidad,
        entidadContratante: oportunidad.entidadContratante,
        clienteId: oportunidad.clienteId,
        responsableId: oportunidad.responsableId,
        fechaInicioPlaneada: oportunidad.fechaInicioPlaneada,
        fechaFinPlaneada: oportunidad.fechaFinPlaneada,
        valorEstimado: oportunidad.valorEstimado,
        alcance: oportunidad.alcance,
        estado: oportunidad.estado,
      }),
    });

    setGuardando(false);
    if (res.ok) {
      const actualizada = await res.json();
      setOportunidad(actualizada);
      setEditando(false);
      setMensaje({ tipo: "exito", texto: "Oportunidad actualizada correctamente" });
    } else {
      setMensaje({ tipo: "error", texto: "Error al guardar la oportunidad" });
    }
  };

  const cancelar = async () => {
    setEditando(false);
    setMensaje(null);
    const res = await fetch(`/api/oportunidades/${id}`);
    if (res.ok) setOportunidad(await res.json());
  };

  const convertir = async () => {
    await fetch(`/api/oportunidades/${id}/convertir`, { method: "POST" });
    router.push("/portafolio");
  };

  const cerrar = async () => {
    await fetch(`/api/oportunidades/${id}/cerrar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivoCierre: motivo }),
    });
    setMostrarCerrar(false);
    const res = await fetch(`/api/oportunidades/${id}`);
    if (res.ok) setOportunidad(await res.json());
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

  const inputFecha = (valor: string | null) => valor ? new Date(valor).toISOString().split("T")[0] : "";

  return (
    <div className="page-enter max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/oportunidades" className="btn-secondary"><i className="fas fa-arrow-left"></i></Link>
        <div className="flex-1">
          {editando ? (
            <input
              className="input-field text-2xl font-bold py-2"
              value={oportunidad.nombre}
              onChange={(e) => actualizarCampo("nombre", e.target.value)}
            />
          ) : (
            <>
              <h2 className="text-2xl font-bold">{oportunidad.nombre}</h2>
              <p className="text-white/50 text-sm">{oportunidad.codigo}</p>
            </>
          )}
        </div>
        <span className={`status-badge ${statusClass(oportunidad.estado)}`}>{oportunidad.estado.replace("_", " ")}</span>
      </div>

      {mensaje && (
        <div className={`mb-6 text-sm p-4 rounded-2xl ${mensaje.tipo === "exito" ? "bg-green-500/10 text-green-300 border border-green-500/20" : "bg-red-500/10 text-red-300 border border-red-500/20"}`}>
          {mensaje.texto}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">Información</h3>
            {!editando && (
              <button onClick={() => setEditando(true)} className="btn-secondary text-sm">
                <i className="fas fa-pen mr-2"></i>Editar
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">MODALIDAD</label>
              {editando ? (
                <select className="input-field" value={oportunidad.modalidad} onChange={(e) => actualizarCampo("modalidad", e.target.value)}>
                  {modalidades.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                </select>
              ) : (
                <input className="input-field" value={modalidades.find((m) => m.key === oportunidad.modalidad)?.label || oportunidad.modalidad} readOnly />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">ESTADO</label>
              {editando ? (
                <select className="input-field" value={oportunidad.estado} onChange={(e) => actualizarCampo("estado", e.target.value)}>
                  {estados.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                </select>
              ) : (
                <input className="input-field" value={estados.find((e) => e.key === oportunidad.estado)?.label || oportunidad.estado} readOnly />
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-white/60 mb-2">ENTIDAD / CONTRATANTE</label>
              {editando ? (
                <input className="input-field" value={oportunidad.entidadContratante} onChange={(e) => actualizarCampo("entidadContratante", e.target.value)} />
              ) : (
                <input className="input-field" value={oportunidad.entidadContratante} readOnly />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">CLIENTE</label>
              {editando ? (
                <select className="input-field" value={oportunidad.clienteId || ""} onChange={(e) => actualizarCampo("clienteId", e.target.value || null)}>
                  <option value="">-- Sin cliente --</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              ) : (
                <input className="input-field" value={oportunidad.cliente?.nombre || "-"} readOnly />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">RESPONSABLE</label>
              {editando ? (
                <select className="input-field" value={oportunidad.responsableId || ""} onChange={(e) => actualizarCampo("responsableId", e.target.value || null)}>
                  <option value="">-- Sin responsable --</option>
                  {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
                </select>
              ) : (
                <input className="input-field" value={oportunidad.responsable?.nombre || "-"} readOnly />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">VALOR ESTIMADO</label>
              {editando ? (
                <input type="number" className="input-field" value={oportunidad.valorEstimado ?? ""} onChange={(e) => actualizarCampo("valorEstimado", e.target.value === "" ? null : e.target.value)} />
              ) : (
                <input className="input-field" value={oportunidad.valorEstimado ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(oportunidad.valorEstimado)) : "-"} readOnly />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">FECHA INICIO PLANEADA</label>
              {editando ? (
                <input type="date" className="input-field" value={inputFecha(oportunidad.fechaInicioPlaneada)} onChange={(e) => actualizarCampo("fechaInicioPlaneada", e.target.value || null)} />
              ) : (
                <input className="input-field" value={oportunidad.fechaInicioPlaneada ? new Date(oportunidad.fechaInicioPlaneada).toLocaleDateString("es-CO") : "-"} readOnly />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/60 mb-2">FECHA FIN PLANEADA</label>
              {editando ? (
                <input type="date" className="input-field" value={inputFecha(oportunidad.fechaFinPlaneada)} onChange={(e) => actualizarCampo("fechaFinPlaneada", e.target.value || null)} />
              ) : (
                <input className="input-field" value={oportunidad.fechaFinPlaneada ? new Date(oportunidad.fechaFinPlaneada).toLocaleDateString("es-CO") : "-"} readOnly />
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-white/60 mb-2">ALCANCE</label>
              {editando ? (
                <textarea className="input-field" rows={3} value={oportunidad.alcance || ""} onChange={(e) => actualizarCampo("alcance", e.target.value)} />
              ) : (
                <textarea className="input-field" rows={3} value={oportunidad.alcance || ""} readOnly />
              )}
            </div>
          </div>

          {editando && (
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button onClick={cancelar} className="btn-secondary">Cancelar</button>
              <button onClick={guardar} disabled={guardando} className="btn-primary disabled:opacity-50">
                {guardando ? <><i className="fas fa-circle-notch fa-spin" /> Guardando...</> : <><i className="fas fa-save" /> Guardar cambios</>}
              </button>
            </div>
          )}
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

      <DocumentosSection relacion="oportunidad" entidadId={id} />
    </div>
  );
}
