/**
 * 002-PI-345 · marcas y helpers del poblador/borrador demo.
 *
 * Todo lo que este guión inserta lleva una marca reconocible → el gemelo
 * `borrar-demo.ts` lo revierte por marca sin rozar datos reales.
 *
 * Candados (spec 002-PI-345):
 *  1) IDs deterministas con prefijo `demo-` → upsert idempotente, borrado por prefijo.
 *  2) NITs en la serie `900.000.001..900.000.050`.
 *  3) Emails de admins/comités con `+demo-`.
 *  4) INTOCABLES: nunca se tocan los ids/emails de la lista.
 */
import type { Prisma } from "@prisma/client";

export const DEMO = {
    prefix: "demo-",
    nitInicio: 900_000_001,
    nitFin: 900_000_050,
    emailMarca: "+demo-",
    dominio: "innovadataco.com",
    // La misma contraseña sin sentido en producción — los admins demo no van a login real.
    passwordSimulada: "PruebaDemo2026!",
    nColegios: 50,
    nProfesoresTotal: 300,
    nAlumnosTotal: 2000,
    nReportesTotal: 2000,
    reportesADemoPct: 0.83, // 83% apuntan a identificadores de sujetos demo (adendo CEO 01-09 03:00)
    reincidenciaPct: 0.35, // 35% de los reportes-a-demo reincide sobre el mismo (nick, plataforma)
    cadenaPct: 0.4, // 40% de los reincidentes van encadenados por reportePrincipalId
    intocables: {
        // Colegio de Calidad — jamás tocar (Bloque D §5).
        colegios: ["cmticor7l000kglr93d1ypox6"],
        // Buzones que no se tocan aunque calzaran con la marca.
        usuarios: ["soporte@innovadataco.com"],
        // Nombres normalizados de colegios reales — protección extra por si algún NIT calzara.
        nombresColegio: ["sagrado corazon", "colegio prueba calidad"],
    },
} as const;

export const DEMO_PLATAFORMAS = ["whatsapp", "instagram", "tiktok", "discord", "telegram", "snapchat", "roblox"] as const;

export const DEMO_CATEGORIAS_REPORTE = [
    // Serias, en la mezcla que espera BI. SPAM aparte para la fracción benigna.
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "CIBERACOSO",
    "HAPPY_SLAPPING",
    "STALKING",
    "OTRO",
] as const;

export type CategoriaDemo = (typeof DEMO_CATEGORIAS_REPORTE)[number] | "SPAM";

/** RNG mulberry32 — semilla fija = corrida reproducible. Node no trae seedable rand. */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function pick<T>(r: () => number, arr: readonly T[]): T {
    return arr[Math.floor(r() * arr.length)];
}

export function pickN<T>(r: () => number, arr: readonly T[], n: number): T[] {
    if (n >= arr.length) return [...arr];
    const copia = [...arr];
    for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [copia[i], copia[j]] = [copia[j], copia[i]];
    }
    return copia.slice(0, n);
}

/** Fecha aleatoria en los últimos N meses. */
export function fechaAtras(r: () => number, mesesAtras: number, ahora: Date): Date {
    const rangoMs = mesesAtras * 30 * 24 * 60 * 60 * 1000;
    return new Date(ahora.getTime() - Math.floor(r() * rangoMs));
}

export interface ArgsDemo {
    confirm: boolean;
    motivo: string;
    semilla: number;
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
    const args: Record<string, string | boolean> = {};
    for (const raw of argv.slice(2)) {
        if (!raw.startsWith("--")) continue;
        const [k, v] = raw.slice(2).split("=");
        if (!k) continue;
        args[k] = v === undefined ? true : v;
    }
    return args;
}

export function requerirMotivo(motivo: string | undefined): string {
    if (!motivo || motivo.length < 20) {
        throw new Error(
            '[demo] Falta --motivo=<texto>. Mínimo 20 caracteres. Ejemplo: --motivo="poblar demo BI campaña septiembre 2026"'
        );
    }
    return motivo;
}

export function log(prefix: string, msg: string): void {
    console.log(`[demo/${prefix}] ${msg}`);
}

/**
 * Audit trail — misma acción del bloque de limpieza para reusar el canal,
 * discriminada en metadatos.tipo="demo_poblar"/"demo_borrar" (candado
 * "cero migraciones" de _common de limpieza).
 */
export async function registrarAuditoriaDemo(
    tx: Prisma.TransactionClient,
    tipo: "demo_poblar" | "demo_borrar",
    motivo: string,
    filas: number,
    detalle: Record<string, unknown>,
): Promise<void> {
    await tx.auditLog.create({
        data: {
            accion: "LOGS_MANTENIMIENTO_PURGA",
            tipoRecurso: "PurgaData",
            usuarioId: null,
            ipAddress: "script",
            userAgent: `scripts/demo/${tipo}`,
            metadatos: { tipo, motivo, filas, ...detalle } satisfies Prisma.InputJsonValue,
        },
    });
}

/** Emails de admin/comité del colegio demo NN (1..50). */
export function emailAdmin(idxColegio: number): string {
    const nn = String(idxColegio).padStart(2, "0");
    return `soporte+demo-c${nn}@${DEMO.dominio}`;
}
export function emailComite(idxColegio: number): string {
    const nn = String(idxColegio).padStart(2, "0");
    return `soporte+demo-c${nn}-comite@${DEMO.dominio}`;
}
export function nitColegio(idxColegio: number): string {
    return String(DEMO.nitInicio + idxColegio - 1);
}
export function nombreColegio(idxColegio: number): string {
    const nn = String(idxColegio).padStart(2, "0");
    return `Colegio Demo ${nn} (BI)`;
}

/** IDs deterministas con prefijo demo-. */
export const id = {
    tenant: (c: number) => `demo-t-${String(c).padStart(2, "0")}`,
    colegio: (c: number) => `demo-c-${String(c).padStart(2, "0")}`,
    onboarding: (c: number) => `demo-onb-${String(c).padStart(2, "0")}`,
    suscripcion: (c: number) => `demo-sus-${String(c).padStart(2, "0")}`,
    admin: (c: number) => `demo-u-adm-${String(c).padStart(2, "0")}`,
    comite: (c: number) => `demo-u-cvi-${String(c).padStart(2, "0")}`,
    curso: (c: number, k: number) => `demo-cur-${String(c).padStart(2, "0")}-${String(k).padStart(2, "0")}`,
    profesor: (c: number, k: number) => `demo-p-${String(c).padStart(2, "0")}-${String(k).padStart(3, "0")}`,
    estudiante: (c: number, k: number) => `demo-e-${String(c).padStart(2, "0")}-${String(k).padStart(4, "0")}`,
    acudiente: (eId: string, orden: number) => `demo-ac-${eId.slice(5)}-${orden}`,
    identAcu: (acId: string, k: number) => `demo-ia-${acId.slice(5)}-${k}`,
    identEst: (eId: string, k: number) => `demo-ie-${eId.slice(5)}-${k}`,
    identProf: (pId: string, k: number) => `demo-ip-${pId.slice(5)}-${k}`,
    reporte: (n: number) => `demo-r-${String(n).padStart(5, "0")}`,
    clasificacion: (rId: string) => `demo-cl-${rId.slice(5)}`,
    alerta: (rId: string, sujeto: string) => `demo-al-${rId.slice(5)}-${sujeto}`,
    preferencia: (c: number, evento: string) => `demo-pref-${String(c).padStart(2, "0")}-${evento}`,
} as const;
