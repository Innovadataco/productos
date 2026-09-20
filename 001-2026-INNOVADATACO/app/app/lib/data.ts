export interface Hito {
  id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  estado: "completado" | "en-curso" | "pendiente";
}

export interface Proyecto {
  id: string;
  nombre: string;
  descripcion: string;
  cliente: string;
  estado: "Activo" | "Planificación" | "En pausa" | "Entregado" | "Cerrado";
  fechaInicio: string;
  fechaEntrega: string;
  progreso: number;
  hitos: Hito[];
  icono: string;
  color: string;
  tareasAbiertas: number;
  diasRestantes: number;
}

export const proyectos: Proyecto[] = [
  {
    id: "2026-001",
    nombre: "PI Web",
    descripcion: "Plataforma integral para la gestión de alertas, casos y reportes de protección infantil.",
    cliente: "PGN - Protección Infantil",
    estado: "Activo",
    fechaInicio: "2026-01-15",
    fechaEntrega: "2026-12-20",
    progreso: 78,
    icono: "fa-shield-alt",
    color: "from-[var(--data)] to-[var(--navy-mid)]",
    tareasAbiertas: 24,
    diasRestantes: 92,
    hitos: [
      { id: "h1", nombre: "Levantamiento de requerimientos", fechaInicio: "2026-01-15", fechaFin: "2026-01-30", estado: "completado" },
      { id: "h2", nombre: "Desarrollo módulo de reportes", fechaInicio: "2026-02-01", fechaFin: "2026-09-30", estado: "en-curso" },
      { id: "h3", nombre: "Lanzamiento a producción", fechaInicio: "2026-10-01", fechaFin: "2026-12-20", estado: "pendiente" },
    ],
  },
  {
    id: "2026-002",
    nombre: "BI Inteligencia de Negocio",
    descripcion: "Dashboards y análisis de datos para la toma de decisiones.",
    cliente: "Innovadataco",
    estado: "Activo",
    fechaInicio: "2026-03-01",
    fechaEntrega: "2026-11-30",
    progreso: 45,
    icono: "fa-chart-bar",
    color: "from-[var(--gold)] to-[var(--red)]",
    tareasAbiertas: 18,
    diasRestantes: 72,
    hitos: [
      { id: "h1", nombre: "Diseño de modelo de datos", fechaInicio: "2026-03-01", fechaFin: "2026-04-15", estado: "completado" },
      { id: "h2", nombre: "Construcción de dashboards", fechaInicio: "2026-04-16", fechaFin: "2026-10-30", estado: "en-curso" },
    ],
  },
  {
    id: "2026-003",
    nombre: "SICOV OTPC",
    descripcion: "Sistema de Convocatorias OTPC.",
    cliente: "OTPC",
    estado: "Planificación",
    fechaInicio: "2026-10-01",
    fechaEntrega: "2027-03-31",
    progreso: 12,
    icono: "fa-ambulance",
    color: "from-emerald-500 to-emerald-800",
    tareasAbiertas: 8,
    diasRestantes: 193,
    hitos: [
      { id: "h1", nombre: "Kickoff y alcance", fechaInicio: "2026-10-01", fechaFin: "2026-10-15", estado: "en-curso" },
    ],
  },
  {
    id: "2026-004",
    nombre: "SARLAFT",
    descripcion: "Sistema de Riesgo LA/FT.",
    cliente: "Supertransporte",
    estado: "Cerrado",
    fechaInicio: "2025-06-01",
    fechaEntrega: "2026-02-28",
    progreso: 100,
    icono: "fa-search-dollar",
    color: "from-purple-500 to-purple-800",
    tareasAbiertas: 0,
    diasRestantes: 0,
    hitos: [
      { id: "h1", nombre: "Análisis regulatorio", fechaInicio: "2025-06-01", fechaFin: "2025-07-15", estado: "completado" },
      { id: "h2", nombre: "Desarrollo", fechaInicio: "2025-07-16", fechaFin: "2025-12-20", estado: "completado" },
      { id: "h3", nombre: "Entrega", fechaInicio: "2026-01-01", fechaFin: "2026-02-28", estado: "completado" },
    ],
  },
];

export function getProyectoById(id: string): Proyecto | undefined {
  return proyectos.find((p) => p.id === id);
}

export function statusClass(estado: string): string {
  switch (estado) {
    case "Activo":
    case "completado":
    case "en-curso":
      return "status-activo";
    case "Planificación":
    case "pendiente":
    case "En pausa":
      return "status-planificacion";
    case "Cerrado":
    case "Entregado":
      return "status-cerrado";
    default:
      return "status-planificacion";
  }
}

export function statusLabel(estado: string): string {
  const labels: Record<string, string> = {
    completado: "Completado",
    "en-curso": "En curso",
    pendiente: "Pendiente",
  };
  return labels[estado] || estado;
}
