export const VENTANAS = [7, 30, 90] as const;
export type VentanaDias = (typeof VENTANAS)[number];

export type SpamReporteItem = {
    id: string;
    identificador: string;
    plataforma: { id: string; nombre: string; clave: string };
    texto: string;
    estado: string;
    creadoEn: string;
    prioridadAlta: boolean;
    operadorId: string | null;
    asignadoA: { id: string; nombre: string | null; email: string } | null;
    clasificacion: { categoria: string; confianza: number } | null;
    confianzaSpam: number;
};

export type Analitica = {
    generadoEn: string;
    metricas: Record<
        VentanaDias,
        {
            esSpam: number;
            corregidos: number;
            procesadosComoAcoso: number;
            totalResueltos: number;
            tasaSpam: number;
            tiempoPromedioResolucionMin: number | null;
        }
    >;
    serie: { fecha: string; esSpam: number; corregidos: number; procesadosComoAcoso: number }[];
    distribucion: {
        porPlataforma: { plataformaId: string; nombre: string; count: number }[];
        porCategoria: { categoria: string; count: number }[];
    };
    topIdentificadores: { identificador: string; plataformaId: string; plataformaNombre: string; count: number }[];
    topOperadores: { operadorId: string; nombre: string | null; email: string; count: number }[];
};
