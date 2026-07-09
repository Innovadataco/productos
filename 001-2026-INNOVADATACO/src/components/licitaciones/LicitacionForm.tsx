"use client";

import { useState, useEffect } from "react";

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

interface LicitacionFormProps {
  initialData?: Partial<LicitacionFormData>;
  onSubmit: (data: LicitacionFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function LicitacionForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
}: LicitacionFormProps) {
  const [formData, setFormData] = useState<LicitacionFormData>({
    numero: "",
    titulo: "",
    descripcion: "",
    estadoId: "",
    entidadId: "",
    areaIdSala: "",
    fechaApertura: "",
    documentoUrl: "",
    ...initialData,
  });

  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [estados, setEstados] = useState<Estado[]>([]);
  const [loadingCatalogos, setLoadingCatalogos] = useState(true);

  useEffect(() => {
    const fetchCatalogos = async () => {
      try {
        const [entidadesRes, estadosRes] = await Promise.all([
          fetch("/api/licitaciones/entidades"),
          fetch("/api/licitaciones/estados"),
        ]);

        if (entidadesRes.ok) {
          const entidadesData = await entidadesRes.json();
          setEntidades(entidadesData);
        }

        if (estadosRes.ok) {
          const estadosData = await estadosRes.json();
          setEstados(estadosData);
        }
      } catch (error) {
        console.error("Error al cargar catálogos:", error);
      } finally {
        setLoadingCatalogos(false);
      }
    };

    fetchCatalogos();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Número */}
        <div>
          <label htmlFor="numero" className="block text-sm font-medium text-gray-700 mb-1">
            Número de Licitación *
          </label>
          <input
            type="text"
            id="numero"
            name="numero"
            value={formData.numero}
            onChange={handleChange}
            required
            placeholder="Ej: L-06196"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Fecha de Apertura */}
        <div>
          <label htmlFor="fechaApertura" className="block text-sm font-medium text-gray-700 mb-1">
            Fecha de Apertura *
          </label>
          <input
            type="datetime-local"
            id="fechaApertura"
            name="fechaApertura"
            value={formData.fechaApertura}
            onChange={handleChange}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Título */}
        <div className="md:col-span-2">
          <label htmlFor="titulo" className="block text-sm font-medium text-gray-700 mb-1">
            Título *
          </label>
          <input
            type="text"
            id="titulo"
            name="titulo"
            value={formData.titulo}
            onChange={handleChange}
            required
            placeholder="Título de la licitación"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Estado */}
        <div>
          <label htmlFor="estadoId" className="block text-sm font-medium text-gray-700 mb-1">
            Estado *
          </label>
          <select
            id="estadoId"
            name="estadoId"
            value={formData.estadoId}
            onChange={handleChange}
            required
            disabled={loadingCatalogos}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">Seleccione un estado</option>
            {estados.map((estado) => (
              <option key={estado.id} value={estado.id}>
                {estado.nombreOficial}
              </option>
            ))}
          </select>
        </div>

        {/* Entidad */}
        <div>
          <label htmlFor="entidadId" className="block text-sm font-medium text-gray-700 mb-1">
            Entidad
          </label>
          <select
            id="entidadId"
            name="entidadId"
            value={formData.entidadId}
            onChange={handleChange}
            disabled={loadingCatalogos}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">Seleccione una entidad</option>
            {entidades.map((entidad) => (
              <option key={entidad.id} value={entidad.id}>
                {entidad.nombreOficial}
              </option>
            ))}
          </select>
        </div>

        {/* Área/Sala */}
        <div>
          <label htmlFor="areaIdSala" className="block text-sm font-medium text-gray-700 mb-1">
            Área / Sala
          </label>
          <input
            type="number"
            id="areaIdSala"
            name="areaIdSala"
            value={formData.areaIdSala}
            onChange={handleChange}
            placeholder="ID del área"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* URL del Documento */}
        <div>
          <label htmlFor="documentoUrl" className="block text-sm font-medium text-gray-700 mb-1">
            URL del Documento
          </label>
          <input
            type="url"
            id="documentoUrl"
            name="documentoUrl"
            value={formData.documentoUrl}
            onChange={handleChange}
            placeholder="https://..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Descripción */}
        <div className="md:col-span-2">
          <label htmlFor="descripcion" className="block text-sm font-medium text-gray-700 mb-1">
            Descripción
          </label>
          <textarea
            id="descripcion"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            rows={4}
            placeholder="Descripción detallada de la licitación"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Botones */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Guardando..." : initialData ? "Actualizar" : "Crear Licitación"}
        </button>
      </div>
    </form>
  );
}
