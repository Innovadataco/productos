export type OperadorHeader = {
    id: string;
    email: string;
    nombre: string | null;
    /** Tope de CASOS (reportes/comité). SPEC-779: libro separado del de sesiones. */
    cupoMaximo: number;
    /** Tope de SESIONES (videollamadas de citas). SPEC-779. */
    topeSesiones: number;
};

export type CasoAbierto = {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    categoria: string | null;
    estado: string;
    asignadoEn: string;
    tiempoDesdeAsignacionMs: number;
};

export type CategoriaConteo = {
    categoria: string;
    total: number;
};

export type Metricas = {
    operador: OperadorHeader;
    casosAbiertos: CasoAbierto[];
    /** SPEC-779 · Sesiones VIGENTES (misma fuente que el asignador). */
    sesionesVigentes: number;
    casosResueltos24h: number;
    casosResueltos7d: number;
    casosResueltos30d: number;
    tiempoMedioResolucionMs: number | null;
    casosPorCategoria: CategoriaConteo[];
    tasaEscalamientoComite: number | null;
};

export type CasoItem = {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    estado: string;
    categoria: string | null;
    asignadoEn: string;
};

export type Paginacion = {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
};
