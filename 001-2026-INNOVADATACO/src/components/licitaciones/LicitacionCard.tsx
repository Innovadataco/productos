"use client";



interface Licitacion {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  fechaApertura: string;
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

interface LicitacionCardProps {
  licitacion: Licitacion;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onView?: (id: string) => void;
}

const estadoColores: Record<string, string> = {
  "en-proceso": "bg-blue-100 text-blue-800",
  "abierta": "bg-green-100 text-green-800",
  "cerrada": "bg-gray-100 text-gray-800",
  "adjudicada": "bg-purple-100 text-purple-800",
  "cancelada": "bg-red-100 text-red-800",
};

export default function LicitacionCard({
  licitacion,
  onEdit,
  onDelete,
  onView,
}: LicitacionCardProps) {
  const formatoFecha = (fecha: string) => {
    return new Date(fecha).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const estadoClase = estadoColores[licitacion.estado?.key] || "bg-gray-100 text-gray-800";

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-mono text-gray-500">
              {licitacion.numero}
            </span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${estadoClase}`}>
              {licitacion.estado?.nombreOficial || "Sin estado"}
            </span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {licitacion.titulo}
          </h3>
          {licitacion.entidad && (
            <p className="text-sm text-gray-600">
              {licitacion.entidad.nombreOficial}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {onView && (
            <button
              onClick={() => onView(licitacion.id)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Ver detalles"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
          )}
          {onEdit && (
            <button
              onClick={() => onEdit(licitacion.id)}
              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Editar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(licitacion.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Eliminar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-600 line-clamp-2">
          {licitacion.descripcion || "Sin descripción"}
        </p>
        
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Apertura: {formatoFecha(licitacion.fechaApertura)}
          </span>
          {licitacion.documentos && licitacion.documentos.length > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {licitacion.documentos.length} documento(s)
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
