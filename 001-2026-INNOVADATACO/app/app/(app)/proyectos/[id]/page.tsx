"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getProyectoById, statusClass, statusLabel, type Hito } from "../../../lib/data";

export default function ProyectoEditarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const proyectoBase = getProyectoById(id);

  const [nombre, setNombre] = useState(proyectoBase?.nombre || "Nuevo Proyecto");
  const [descripcion, setDescripcion] = useState(proyectoBase?.descripcion || "");
  const [cliente, setCliente] = useState(proyectoBase?.cliente || "");
  const [estado, setEstado] = useState<string>(proyectoBase?.estado || "Activo");
  const [fechaInicio, setFechaInicio] = useState(proyectoBase?.fechaInicio || "");
  const [fechaEntrega, setFechaEntrega] = useState(proyectoBase?.fechaEntrega || "");
  const [hitos, setHitos] = useState<Hito[]>(proyectoBase?.hitos || []);
  const [toast, setToast] = useState<string | null>(null);

  if (!proyectoBase && id !== "nuevo") {
    return (
      <div className="page-enter text-center py-20">
        <h2 className="text-2xl font-bold mb-4">Proyecto no encontrado</h2>
        <Link href="/portafolio" className="btn-primary">Volver al portafolio</Link>
      </div>
    );
  }

  const progreso = proyectoBase?.progreso || 0;
  const completados = hitos.filter((h) => h.estado === "completado").length;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const agregarHito = () => {
    setHitos([
      ...hitos,
      {
        id: `h${Date.now()}`,
        nombre: "Nuevo hito",
        fechaInicio: "",
        fechaFin: "",
        estado: "pendiente",
      },
    ]);
    showToast("Hito agregado");
  };

  const actualizarHito = (index: number, campo: keyof Hito, valor: string) => {
    const nuevos = [...hitos];
    nuevos[index] = { ...nuevos[index], [campo]: valor };
    setHitos(nuevos);
  };

  const guardar = () => {
    showToast("Proyecto guardado correctamente");
  };

  return (
    <div className="page-enter">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.push("/portafolio")} className="btn-secondary">
          <i className="fas fa-arrow-left" />
        </button>
        <div>
          <h2 className="text-2xl font-bold">{nombre}</h2>
          <p className="text-white/50 text-sm">
            Editar proyecto · <span className="text-[var(--data-light)]">ID #{id}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold mb-5 flex items-center gap-2">
              <i className="fas fa-info-circle text-[var(--data-light)]" /> Información general
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-white/60 mb-2">NOMBRE DEL PROYECTO</label>
                <input
                  type="text"
                  className="input-field"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-white/60 mb-2">DESCRIPCIÓN</label>
                <textarea
                  className="input-field"
                  rows={3}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">CLIENTE</label>
                <input
                  type="text"
                  className="input-field"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">ESTADO</label>
                <select
                  className="input-field"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                >
                  <option value="Activo">Activo</option>
                  <option value="Planificación">Planificación</option>
                  <option value="En pausa">En pausa</option>
                  <option value="Entregado">Entregado</option>
                  <option value="Cerrado">Cerrado</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">FECHA INICIO</label>
                <input
                  type="date"
                  className="input-field"
                  value={fechaInicio}
                  onChange={(e) => setFechaInicio(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-2">FECHA ENTREGA</label>
                <input
                  type="date"
                  className="input-field"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-5 flex items-center gap-2">
              <i className="fas fa-flag text-[var(--gold-light)]" /> Hitos
            </h3>
            <div className="space-y-3">
              {hitos.map((hito, idx) => (
                <div key={hito.id} className="flex flex-col md:flex-row gap-3 p-3 rounded-xl bg-white/5">
                  <div className="flex items-center gap-3 md:w-8">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${
                      hito.estado === "completado"
                        ? "bg-green-500/20 text-green-400"
                        : hito.estado === "en-curso"
                        ? "bg-[var(--data)]/20 text-[var(--data-light)]"
                        : "bg-white/10 text-white/50"
                    }`}>
                      <i className={`fas ${
                        hito.estado === "completado" ? "fa-check" : hito.estado === "en-curso" ? "fa-spinner" : "fa-lock"
                      }`} />
                    </div>
                  </div>
                  <input
                    type="text"
                    className="input-field flex-1 py-2 px-3 text-sm"
                    value={hito.nombre}
                    onChange={(e) => actualizarHito(idx, "nombre", e.target.value)}
                  />
                  <input
                    type="date"
                    className="input-field py-2 px-3 text-sm md:w-36"
                    value={hito.fechaInicio}
                    onChange={(e) => actualizarHito(idx, "fechaInicio", e.target.value)}
                  />
                  <input
                    type="date"
                    className="input-field py-2 px-3 text-sm md:w-36"
                    value={hito.fechaFin}
                    onChange={(e) => actualizarHito(idx, "fechaFin", e.target.value)}
                  />
                  <select
                    className="input-field py-2 px-3 text-sm md:w-32"
                    value={hito.estado}
                    onChange={(e) => actualizarHito(idx, "estado", e.target.value)}
                  >
                    <option value="pendiente">Pendiente</option>
                    <option value="en-curso">En curso</option>
                    <option value="completado">Completado</option>
                  </select>
                </div>
              ))}
            </div>
            <button onClick={agregarHito} className="btn-secondary w-full mt-4">
              <i className="fas fa-plus mr-2" />Agregar hito
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Progreso</h3>
            <div className="text-4xl font-bold text-[var(--data-light)] mb-2">{progreso}%</div>
            <div className="progress-bar mb-4">
              <div className="progress-fill" style={{ width: `${progreso}%` }} />
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/50">Hitos completados</span>
                <span>{completados} de {hitos.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Tareas abiertas</span>
                <span>{proyectoBase?.tareasAbiertas || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/50">Días restantes</span>
                <span>{proyectoBase?.diasRestantes || 0}</span>
              </div>
            </div>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Equipo</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--data)] to-[var(--gold)] flex items-center justify-center text-xs font-bold">JE</div>
                <div><div className="text-sm font-medium">Jelkin</div><div className="text-xs text-white/40">Product Owner</div></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-xs font-bold">AN</div>
                <div><div className="text-sm font-medium">Andrea</div><div className="text-xs text-white/40">Tech Lead</div></div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-xs font-bold">LU</div>
                <div><div className="text-sm font-medium">Luis</div><div className="text-xs text-white/40">Backend</div></div>
              </div>
            </div>
            <button className="btn-secondary w-full mt-4">
              <i className="fas fa-user-plus mr-2" />Invitar
            </button>
          </div>

          <div className="glass-card p-6">
            <h3 className="font-bold mb-4">Acciones</h3>
            <div className="space-y-3">
              <button onClick={guardar} className="btn-primary w-full">Guardar cambios</button>
              <button className="btn-secondary w-full">
                <i className="fas fa-file-export mr-2" />Exportar ficha
              </button>
              <button className="btn-secondary w-full text-[var(--red)]">
                <i className="fas fa-trash mr-2" />Archivar proyecto
              </button>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-8 right-8 glass px-6 py-4 rounded-2xl z-50 flex items-center gap-3">
          <i className="fas fa-check-circle text-green-400" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
