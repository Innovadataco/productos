"use client";

import { useState, useEffect } from "react";
import LicitacionCard from "@/components/licitaciones/LicitacionCard";
import LicitacionForm from "@/components/licitaciones/LicitacionForm";
import LicitacionModal from "@/components/licitaciones/LicitacionModal";

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

interface LicitacionFormData {
  numero: string;
  titulo: string;
  descripcion: string;
  estadoId: string;
  entidadId: string;
  areaIdSala: string;
  fechaApertura: string;
  documentoUrl: string;
}

export default function LicitacionesPage() {
  const [licitaciones, setLicitaciones] = useState<Licitacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Cargar licitaciones
  const fetchLicitaciones = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/licitaciones");
      if (!response.ok) {
        throw new Error("Error al cargar licitaciones");
      }
      const data = await response.json();
      setLicitaciones(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicitaciones();
  }, []);

  // Filtrar licitaciones
  const filteredLicitaciones = licitaciones.filter(
    (lic) =>
      lic.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.titulo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lic.descripcion?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Crear nueva licitación
  const handleCreate = async (formData: LicitacionFormData) => {
    try {
      setFormLoading(true);
      const response = await fetch("/api/licitaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al crear licitación");
      }

      await fetchLicitaciones();
      setIsModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Editar licitación
  const handleEdit = async (formData: LicitacionFormData) => {
    if (!editingId) return;

    try {
      setFormLoading(true);
      const response = await fetch(`/api/licitaciones/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al actualizar licitación");
      }

      await fetchLicitaciones();
      setIsModalOpen(false);
      setEditingId(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Eliminar licitación
  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta licitación?")) return;

    try {
      const response = await fetch(`/api/licitaciones/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Error al eliminar licitación");
      }

      await fetchLicitaciones();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Abrir modal para editar
  const openEditModal = (id: string) => {
    const licitacion = licitaciones.find((l) => l.id === id);
    if (licitacion) {
      setEditingId(id);
      setIsModalOpen(true);
    }
  };

  // Abrir modal para crear
  const openCreateModal = () => {
    setEditingId(null);
    setIsModalOpen(true);
  };

  // Ver detalles
  const handleView = (id: string) => {
    window.open(`/licitaciones/${id}`, "_blank");
  };

  const editingLicitacion = editingId
    ? licitaciones.find((l) => l.id === editingId)
    : null;

  const initialFormData: Partial<LicitacionFormData> | undefined =
    editingLicitacion
      ? {
          numero: editingLicitacion.numero,
          titulo: editingLicitacion.titulo,
          descripcion: editingLicitacion.descripcion || "",
          estadoId: editingLicitacion.estadoId?.toString() || "",
          entidadId: editingLicitacion.entidadId?.toString() || "",
          areaIdSala: editingLicitacion.areaIdSala?.toString() || "",
          fechaApertura: new Date(editingLicitacion.fechaApertura)
            .toISOString()
            .slice(0, 16),
          documentoUrl: editingLicitacion.documentoUrl || "",
        }
      : undefined;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Módulo de Licitaciones
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Gestiona las licitaciones y sus documentos
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Nueva Licitación
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por número, título o descripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 pl-11 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <svg
              className="absolute left-3 top-3.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Total Licitaciones</p>
            <p className="text-2xl font-bold text-gray-900">
              {licitaciones.length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Abiertas</p>
            <p className="text-2xl font-bold text-green-600">
              {
                licitaciones.filter((l) => l.estado?.key === "abierta")
                  .length
              }
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">En Proceso</p>
            <p className="text-2xl font-bold text-blue-600">
              {
                licitaciones.filter((l) => l.estado?.key === "en-proceso")
                  .length
              }
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm">
            <p className="text-sm text-gray-600">Cerradas</p>
            <p className="text-2xl font-bold text-gray-600">
              {
                licitaciones.filter((l) => l.estado?.key === "cerrada")
                  .length
              }
            </p>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchLicitaciones}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : filteredLicitaciones.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="w-16 h-16 mx-auto text-gray-300 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No hay licitaciones
            </h3>
            <p className="text-gray-600 mb-4">
              {searchQuery
                ? "No se encontraron resultados para tu búsqueda"
                : "Comienza creando tu primera licitación"}
            </p>
            {!searchQuery && (
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Crear Licitación
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredLicitaciones.map((licitacion) => (
              <LicitacionCard
                key={licitacion.id}
                licitacion={licitacion}
                onView={handleView}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      <LicitacionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingId(null);
        }}
        title={editingId ? "Editar Licitación" : "Nueva Licitación"}
      >
        <LicitacionForm
          initialData={initialFormData}
          onSubmit={editingId ? handleEdit : handleCreate}
          onCancel={() => {
            setIsModalOpen(false);
            setEditingId(null);
          }}
          isLoading={formLoading}
        />
      </LicitacionModal>
    </div>
  );
}
