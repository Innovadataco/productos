/**
 * SPEC-205 (002-PI-102): DTOs de la vista consolidada de usuarios por rol.
 * Nunca expone texto de reporte, identificador de menor ni datos del denunciante.
 */

export type RolUsuariosListado =
    | "PARENT"
    | "SCHOOL_ADMIN"
    | "OPERADOR"
    | "COMITE_VALIDACION"
    | "COMITE_CONVIVENCIA"
    | "ADMIN";

export type KpiRolCard = {
    key: "padres" | "rectores" | "operadores" | "comite" | "admins";
    label: string;
    total: number;
    activos: number;
    inactivos: number;
    bloqueados: number;
    alerta: boolean;
};

export type AlertaDashboard = {
    tipo: "operadores_sobrecargados" | "comite_sin_miembros" | "colegio_sin_rector" | string;
    mensaje: string;
    severidad: "warning" | "danger" | "info";
};

export type PaginacionDto = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};

export type PadreListItemDto = {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    reportesEnviados: number;
    reportesUltimos30Dias: number;
    colegiosAsociados: { id: string; nombre: string }[];
    creadoEn: string;
    ultimaSesion: string | null;
};

export type RectorListItemDto = {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    colegio: { id: string; nombre: string } | null;
    alumnos: number;
    profesores: number;
    cursos: number;
    reportesColegio: number;
    ultimaSesion: string | null;
};

export type OperadorListItemConsolidadoDto = {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    cupoMaximo: number;
    casosAbiertos: number;
    // Deuda técnica: en la primera versión se dejan en 0/null; se calcularán por lotes en mejora posterior.
    enProceso: number;
    cerrados30Dias: number;
    tiempoMedioResolucionMs: number | null;
};

export type ComiteConvivenciaListItemDto = {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    colegio: { id: string; nombre: string } | null;
    integrantesActivos: number;
    casosEscaladosAbiertos: number;
    casosEscaladosResueltos: number;
    tiempoMedioResolucionHoras: number | null;
};

export type DecisionComiteItemDto = {
    id: string;
    numero: string;
    estado: string;
    creadoEn: string;
    resueltoEn: string | null;
};

export type ComiteValidacionListItemDto = {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    casosEscaladosPlataforma: number;
    casosPendientes: number;
    casosResueltos: number;
    ultimasDecisiones: DecisionComiteItemDto[];
};

export type AdminListItemDto = {
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    modulosGestionados: { clave: string; nombre: string }[];
    ultimaSesion: string | null;
};

export type UsuarioListItemDto =
    | ({ rol: "PARENT" } & PadreListItemDto)
    | ({ rol: "SCHOOL_ADMIN" } & RectorListItemDto)
    | ({ rol: "OPERADOR" } & OperadorListItemConsolidadoDto)
    | ({ rol: "COMITE_CONVIVENCIA" } & ComiteConvivenciaListItemDto)
    | ({ rol: "COMITE_VALIDACION" } & ComiteValidacionListItemDto)
    | ({ rol: "ADMIN" } & AdminListItemDto);

export type ReporteMetadatoDto = {
    id: string;
    numeroSeguimiento: string | null;
    estado: string;
    creadoEn: string;
    esAnonimo: boolean;
    plataforma: { nombre: string; clave: string } | null;
    clasificacion: { categoria: string; confianza: number } | null;
};

export type DetallePadreDto = {
    rol: "PARENT";
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    creadoEn: string;
    ultimaSesion: string | null;
    reportes: { items: ReporteMetadatoDto[]; total: number };
    colegiosAsociados: { id: string; nombre: string }[];
};

export type ColegioRectorDetalleDto = {
    id: string;
    nombre: string;
    alumnos: number;
    profesores: number;
    cursos: number;
    reportesTotal: number;
    integrantesPorRol: {
        profesores: number;
        acudientes: number;
        integrantesComite: number;
    };
};

export type DetalleRectorDto = {
    rol: "SCHOOL_ADMIN";
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    creadoEn: string;
    ultimaSesion: string | null;
    colegios: ColegioRectorDetalleDto[];
};

export type CasoOperadorResumenDto = {
    id: string;
    numeroSeguimiento: string | null;
    estado: string;
    categoria: string | null;
    plataformaNombre: string;
    asignadoEn: string;
    tiempoDesdeAsignacionMs: number;
};

export type ReasignacionItemDto = {
    id: string;
    reporteId: string;
    actorEmail: string;
    actorNombre: string | null;
    creadoEn: string;
};

export type DetalleOperadorDto = {
    rol: "OPERADOR";
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    cupoMaximo: number;
    casosAbiertos: CasoOperadorResumenDto[];
    totalAbiertos: number;
    casosResueltos24h: number;
    casosResueltos7d: number;
    casosResueltos30d: number;
    tiempoMedioResolucionMs: number | null;
    tasaEscalamientoComite: number | null;
    reasignacionesRecientes: ReasignacionItemDto[];
};

export type DetalleComiteConvivenciaDto = {
    rol: "COMITE_CONVIVENCIA";
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    colegio: { id: string; nombre: string } | null;
    integrantesActivos: number;
    operadoresAsignados: { id: string; nombre: string | null; email: string }[];
    casosEscalados: DecisionComiteItemDto[];
    casosEscaladosTotal: number;
    casosResueltos: number;
    tiempoMedioResolucionHoras: number | null;
};

export type DetalleComiteValidacionDto = {
    rol: "COMITE_VALIDACION";
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    casosEnCurso: number;
    casosPendientes: number;
    casosResueltos: number;
    ultimasDecisiones: DecisionComiteItemDto[];
    tasaResolucion: number | null;
};

export type AccionAdminItemDto = {
    id: string;
    accion: string;
    tipoRecurso: string;
    recursoId: string | null;
    creadoEn: string;
};

export type DetalleAdminDto = {
    rol: "ADMIN";
    id: string;
    email: string;
    nombre: string | null;
    estado: string;
    creadoEn: string;
    ultimaSesion: string | null;
    modulosGestionados: { clave: string; nombre: string }[];
    ultimasAcciones: AccionAdminItemDto[];
};

export type DetalleConsolidadoDto =
    | DetallePadreDto
    | DetalleRectorDto
    | DetalleOperadorDto
    | DetalleComiteConvivenciaDto
    | DetalleComiteValidacionDto
    | DetalleAdminDto;
