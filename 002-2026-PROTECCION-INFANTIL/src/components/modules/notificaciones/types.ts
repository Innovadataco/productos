export type EstadoEnvio =
    | "ENCOLADA"
    | "ENVIANDO"
    | "ENVIADA"
    | "ABIERTA"
    | "CLICADA"
    | "FALLIDA"
    | "REINTENTANDO"
    | "CANCELADA";

export const ESTADO_LABELS: Record<EstadoEnvio, string> = {
    ENCOLADA: "Encolada",
    ENVIANDO: "Enviando",
    ENVIADA: "Enviada",
    ABIERTA: "Abierta",
    CLICADA: "Clicada",
    FALLIDA: "Fallida",
    REINTENTANDO: "Reintentando",
    CANCELADA: "Cancelada",
};

export const CANAL_LABELS: Record<string, string> = {
    EMAIL: "Email",
    IN_APP: "In-app",
};

export type NotificacionItem = {
    id: string;
    evento: string;
    destinatarioEmail: string;
    canal: "EMAIL" | "IN_APP";
    estado: EstadoEnvio;
    enviarEn: string | null;
    sentAt: string | null;
    openedAt: string | null;
    intentos: number;
    ultimoError: string | null;
    createdAt: string;
    plantillaClave: string;
};

export type PlantillaItem = {
    clave: string;
    canal: "EMAIL" | "IN_APP";
    asunto: string | null;
    cuerpoMarkdown: string;
    variablesSchema: Record<string, unknown>;
    version: number;
    activa: boolean;
};

export type ReglaItem = {
    id: string;
    evento: string;
    rol: string;
    offset: string;
    canal: "EMAIL" | "IN_APP";
    plantillaClave: string;
    obligatoria: boolean;
    activa: boolean;
    programadas: number;
};

export type ParametroNotificacionItem = {
    id: string;
    clave: string;
    valor: string;
    tipo: string;
    descripcion: string | null;
    esSecreto: boolean;
};

export type SaludMotor = {
    colaActual: number;
    atrasadas: number;
    tasaEntrega7d: number | null;
    tasaApertura7d: number | null;
    errores24h: number;
    latenciaPromedioMs: number | null;
    enviadas7d: number;
    intervaloSegundos: number;
};
