"use client";

import { useState, useEffect } from "react";
import { FileText, Building2, Tag, Calendar, Plus, Search, Trash2, Edit, Eye, Loader2, X, Save } from "lucide-react";

interface Licitacion {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  fechaApertura: string;
  estadoId: number;
  entidadId: number | null;
  areaIdSala: number | null;
  documentoUrl: string | null;
  estado: {
    id: number;
    key: string;
    nombreOficial: string;
  };
  entidad?: {
    id: number;
    key: string;
    nombreOficial: string;
  };
  documentos?: Array<{
    id: string;
    nombre: string;
    tipo: string;
  }>;
}

interface Entidad {
  id: number;
  key: string;
  nombreOficial: string;
}

interface Estado {
  id: number;
  key: string;
  nombreOficial: string;
}

interface LicitacionesTabProps {
  submoduleId: string;
}

const estadoColores: Record<string, string> = {
  "en-proceso": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "abierta": "bg-green-500/20 text-green-400 border-green-500/30",
  "cerrada": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "adjudicada": "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "cancelada": "bg-red-500/20 text-red-400 border-red-500/30",
};

// Componente: Listado de Licitaciones
function ListadoSubmodulo() {
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);

  const [formData, setFormData] = useState({
    numero: "",
    titulo: "",
    descripcion: "",
    estadoId: "",
    entidadId: "",
    areaIdSala: "",
    fechaApertura: "",
    documentoUrl: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [licRes, entRes, estRes] = await Promise.all([
        fetch("/api/licitaciones"),
        fetch("/api/licitaciones/entidades"),
        fetch("/api/licitaciones/estados"),
      ]);

      if (licRes.ok) setLicitaciones(await licRes.json());
      if (entRes.ok) setEntidades(await entRes.json());
      if (estRes.ok) setEstados(await estRes.json());
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingId ? `/api/licitaciones/${editingId}` : "/api/licitaciones";
    const method = editingId ? "PATCH" : "POST";

    try {
      setFormLoading(true);
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await fetchData();
        closeModal();
      } else {
        const error = await response.json();
        alert(error.error || "Error al guardar");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta licitación?")) return;
    try {
      const response = await fetch(`/api/licitaciones/${id}`, { method: "DELETE" });
      if (response.ok) await fetchData();
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const openModal = (licitacion?: Licitacion) => {
    if (licitacion) {
      setEditingId(licitacion.id);
      setFormData({
        numero: licitacion.numero,
        titulo: licitacion.titulo,
        descripcion: licitacion.descripcion || "",
        estadoId: licitacion.estadoId?.toString() || "",
        entidadId: licitacion.entidadId?.toString() || "",
        areaIdSala: licitacion.areaIdSala?.toString() || "",
        fechaApertura: new Date(licitacion.fechaApertura).toISOString().slice(0, 16),
        documentoUrl: licitacion.documentoUrl || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        numero: "",
        titulo: "",
        descripcion: "",
        estadoId: "",
        entidadId: "",
        areaIdSala: "",
        fechaApertura: "",
        documentoUrl: "",
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  const filteredLicitaciones = licitaciones.filter(
    (lic) =>
      lic.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.titulo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40">Total</p>
          <p className="text-2xl font-black text-white mt-1">{licitaciones.length}</p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40">Abiertas</p>
          <p className="text-2xl font-black text-green-400 mt-1">
            {licitaciones.filter((l) => l.estado?.key === "abierta").length}
          </p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40">En Proceso</p>
          <p className="text-2xl font-black text-blue-400 mt-1">
            {licitaciones.filter((l) => l.estado?.key === "en-proceso").length}
          </p>
        </div>
        <div className="glass-panel p-4">
          <p className="text-[10px] uppercase tracking-widest text-foreground/40">Cerradas</p>
          <p className="text-2xl font-black text-gray-400 mt-1">
            {licitaciones.filter((l) => l.estado?.key === "cerrada").length}
          </p>
        </div>
      </div>

      {/* Search and Add */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar licitaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-white placeholder:text-foreground/30 focus:border-neonCyan focus:outline-none"
          />
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-3 bg-neonCyan/10 border border-neonCyan/30 rounded-lg text-neonCyan hover:bg-neonCyan/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">Nueva</span>
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neonCyan" />
        </div>
      ) : filteredLicitaciones.length === 0 ? (
        <div className="text-center py-12 text-foreground/30">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-sm">No hay licitaciones registradas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLicitaciones.map((licitacion) => (
            <div
              key={licitacion.id}
              className="glass-panel p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-mono text-neonCyan">{licitacion.numero}</span>
                    <span className={`px-2 py-1 rounded text-[10px] uppercase font-bold border ${estadoColores[licitacion.estado?.key] || "bg-gray-500/20 text-gray-400 border-gray-500/30"}`}>
                      {licitacion.estado?.nombreOficial}
                    </span>
                  </div>
                  <h3 className="text-white font-bold text-sm mb-1">{licitacion.titulo}</h3>
                  {licitacion.entidad && (
                    <p className="text-foreground/40 text-xs flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {licitacion.entidad.nombreOficial}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-foreground/30 text-xs">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(licitacion.fechaApertura).toLocaleDateString("es-CO")}
                    </span>
                    {licitacion.documentos && licitacion.documentos.length > 0 && (
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {licitacion.documentos.length} docs
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openModal(licitacion)}
                    className="p-2 text-foreground/40 hover:text-neonCyan hover:bg-white/5 rounded transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(licitacion.id)}
                    className="p-2 text-foreground/40 hover:text-red-400 hover:bg-white/5 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-white/10">
              <h2 className="text-lg font-bold text-white">
                {editingId ? "Editar Licitación" : "Nueva Licitación"}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Número *</label>
                  <input
                    type="text"
                    required
                    value={formData.numero}
                    onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                    placeholder="Ej: L-06196"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Fecha Apertura *</label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.fechaApertura}
                    onChange={(e) => setFormData({ ...formData, fechaApertura: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Título *</label>
                <input
                  type="text"
                  required
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                  placeholder="Título de la licitación"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Estado *</label>
                  <select
                    required
                    value={formData.estadoId}
                    onChange={(e) => setFormData({ ...formData, estadoId: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
                  >
                    <option value="" className="bg-[#0a0a0a]">Seleccione...</option>
                    {estados.map((e) => (
                      <option key={e.id} value={e.id} className="bg-[#0a0a0a]">{e.nombreOficial}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Entidad</label>
                  <select
                    value={formData.entidadId}
                    onChange={(e) => setFormData({ ...formData, entidadId: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
                  >
                    <option value="" className="bg-[#0a0a0a]">Seleccione...</option>
                    {entidades.map((e) => (
                      <option key={e.id} value={e.id} className="bg-[#0a0a0a]">{e.nombreOficial}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Descripción</label>
                <textarea
                  rows={3}
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  placeholder="Descripción de la licitación"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-6 py-3 text-foreground/60 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-3 bg-neonCyan/10 border border-neonCyan/30 rounded-lg text-neonCyan text-sm font-bold hover:bg-neonCyan/20 transition-colors disabled:opacity-50"
                >
                  {formLoading ? "Guardando..." : editingId ? "Actualizar" : "Crear"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente: Nueva Licitación (Formulario directo)
function NuevaSubmodulo() {
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    numero: "",
    titulo: "",
    descripcion: "",
    estadoId: "",
    entidadId: "",
    areaIdSala: "",
    fechaApertura: "",
    documentoUrl: "",
  });

  useEffect(() => {
    const fetchCatalogos = async () => {
      const [entRes, estRes] = await Promise.all([
        fetch("/api/licitaciones/entidades"),
        fetch("/api/licitaciones/estados"),
      ]);
      if (entRes.ok) setEntidades(await entRes.json());
      if (estRes.ok) setEstados(await estRes.json());
    };
    fetchCatalogos();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await fetch("/api/licitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({
          numero: "",
          titulo: "",
          descripcion: "",
          estadoId: "",
          entidadId: "",
          areaIdSala: "",
          fechaApertura: "",
          documentoUrl: "",
        });
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const error = await response.json();
        alert(error.error || "Error al crear");
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl animate-in fade-in duration-500">
      <div className="glass-panel p-6">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Plus className="w-5 h-5 text-neonCyan" />
          Crear Nueva Licitación
        </h2>

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm">
            ✅ Licitación creada exitosamente
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Número *</label>
              <input
                type="text"
                required
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="Ej: L-06196"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Fecha Apertura *</label>
              <input
                type="datetime-local"
                required
                value={formData.fechaApertura}
                onChange={(e) => setFormData({ ...formData, fechaApertura: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Título *</label>
            <input
              type="text"
              required
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
              placeholder="Título de la licitación"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Estado *</label>
              <select
                required
                value={formData.estadoId}
                onChange={(e) => setFormData({ ...formData, estadoId: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
              >
                <option value="">Seleccione...</option>
                {estados.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombreOficial}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Entidad</label>
              <select
                value={formData.entidadId}
                onChange={(e) => setFormData({ ...formData, entidadId: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
              >
                <option value="">Seleccione...</option>
                {entidades.map((e) => (
                  <option key={e.id} value={e.id}>{e.nombreOficial}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-foreground/40 mb-2">Descripción</label>
            <textarea
              rows={4}
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción detallada de la licitación..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-neonCyan text-black font-black text-xs uppercase tracking-widest hover:bg-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {loading ? "Creando..." : "Crear Licitación"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Componente: Entidades
function EntidadesSubmodulo() {
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEntidad, setNewEntidad] = useState({ key: "", nombreOficial: "" });

  const fetchEntidades = async () => {
    try {
      const res = await fetch("/api/licitaciones/entidades");
      if (res.ok) setEntidades(await res.json());
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEntidades();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/licitaciones/entidades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntidad),
      });
      if (res.ok) {
        setNewEntidad({ key: "", nombreOficial: "" });
        fetchEntidades();
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="glass-panel p-6">
        <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2">
          <Plus className="w-3 h-3" /> Nueva Entidad
        </h3>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="Key (ej: MINTIC)"
            value={newEntidad.key}
            onChange={(e) => setNewEntidad({ ...newEntidad, key: e.target.value })}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
            required
          />
          <input
            type="text"
            placeholder="Nombre oficial"
            value={newEntidad.nombreOficial}
            onChange={(e) => setNewEntidad({ ...newEntidad, nombreOficial: e.target.value })}
            className="flex-2 w-96 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
            required
          />
          <button
            type="submit"
            className="px-6 py-3 bg-neonCyan/10 border border-neonCyan/30 rounded-lg text-neonCyan text-sm font-bold hover:bg-neonCyan/20 transition-colors"
          >
            Agregar
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neonCyan" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {entidades.map((entidad) => (
            <div key={entidad.id} className="glass-panel p-4">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-neonCyan" />
                <div>
                  <p className="text-white font-medium text-sm">{entidad.nombreOficial}</p>
                  <p className="text-foreground/40 text-xs">Key: {entidad.key}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente: Estados
function EstadosSubmodulo() {
  const [estados, setEstados] = useState<Estado[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEstado, setNewEstado] = useState({ key: "", nombreOficial: "" });

  const fetchEstados = async () => {
    try {
      const res = await fetch("/api/licitaciones/estados");
      if (res.ok) setEstados(await res.json());
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstados();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/licitaciones/estados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEstado),
      });
      if (res.ok) {
        setNewEstado({ key: "", nombreOficial: "" });
        fetchEstados();
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="glass-panel p-6">
        <h3 className="text-xs font-bold uppercase mb-4 flex items-center gap-2">
          <Plus className="w-3 h-3" /> Nuevo Estado
        </h3>
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            placeholder="Key (ej: abierta)"
            value={newEstado.key}
            onChange={(e) => setNewEstado({ ...newEstado, key: e.target.value })}
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
            required
          />
          <input
            type="text"
            placeholder="Nombre oficial"
            value={newEstado.nombreOficial}
            onChange={(e) => setNewEstado({ ...newEstado, nombreOficial: e.target.value })}
            className="flex-2 w-96 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm focus:border-neonCyan focus:outline-none"
            required
          />
          <button
            type="submit"
            className="px-6 py-3 bg-neonCyan/10 border border-neonCyan/30 rounded-lg text-neonCyan text-sm font-bold hover:bg-neonCyan/20 transition-colors"
          >
            Agregar
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-neonCyan" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {estados.map((estado) => (
            <div key={estado.id} className="glass-panel p-4">
              <div className="flex items-center gap-3">
                <Tag className="w-5 h-5 text-neonCyan" />
                <div>
                  <p className="text-white font-medium text-sm">{estado.nombreOficial}</p>
                  <p className="text-foreground/40 text-xs">Key: {estado.key}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Componente principal que enruta a los submódulos
export default function LicitacionesTab({ submoduleId }: LicitacionesTabProps) {
  switch (submoduleId) {
    case "listado":
      return <ListadoSubmodulo />;
    case "nueva":
      return <NuevaSubmodulo />;
    case "entidades":
      return <EntidadesSubmodulo />;
    case "estados":
      return <EstadosSubmodulo />;
    default:
      return (
        <div className="flex flex-col items-center justify-center h-96 text-foreground/20">
          <FileText className="w-12 h-12 mb-4" />
          <p className="text-sm">Selecciona un submódulo de licitaciones</p>
        </div>
      );
  }
}
