export type OperadorHeader = {
    id: string;
    email: string;
    nombre: string | null;
    cupoMaximo: number;
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
