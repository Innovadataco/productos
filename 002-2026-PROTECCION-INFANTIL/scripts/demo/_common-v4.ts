/**
 * SPEC-382 · poblador demo v4 — 5.000 reportes con más geografía para BI.
 *
 * Qué lo separa de v1/v2/v3 y por qué se puede borrar sin miedo:
 *  · IDs con prefijo propio `demo4-` (v1 `demo-`, v2 `demo2-`, v3 `demo3-`).
 *    Ningún prefijo es prefijo de otro (test lo prueba en ambas direcciones).
 *  · Volumen 5.000 (v2 puso 2.000). El demo4 SE SUMA — no reemplaza a v2.
 *  · Fechas ene-2024 → hoy con densidad en los tres tramos (Jelkin: "reportes
 *    del 25 y del 24 también"), nunca futuro.
 *  · MÁS PAÍSES y MÁS CIUDADES que v2 (18 vs 7 · 100+ vs 26).
 *  · Textos creíbles por categoría, sensibles con más peso — reusa el pool
 *    `RELATOS` de v2 (misma redacción, sin PII real).
 *
 * Candados: sin correos, sin pg-boss ni Ollama, insert directo, idempotente
 * por id determinista, PII ficticia, hora en punto (G20).
 */

// Reusamos el catálogo de relatos y nicks del v2 — la variedad ya está
// probada y el pool tipa las claves; no se copia texto, se importa.
export { RELATOS, NICKS_DEMO2 as NICKS_DEMO4, PESOS_CATEGORIA, elegirPonderado, type CategoriaDemo2 as CategoriaDemo4 } from "./_common-v2";

export const DEMO4 = {
    prefix: "demo4-",
    emailMarca: "+demo4-",
    dominio: "innovadataco.com",
    /** Volumen — orden expresa de Jelkin. */
    nReportes: 5000,
    /** Ventana de fechas: desde el 1-ene-2024 hasta hoy. */
    desde: new Date("2024-01-01T00:00:00Z"),
} as const;

/** IDs deterministas — idempotente por skipDuplicates y borrable por prefijo. */
export const id4 = {
    reporte: (n: number) => `demo4-r-${String(n).padStart(5, "0")}`,
    clasificacion: (rId: string) => `demo4-cl-${rId.slice(6)}`,
} as const;

/**
 * Reparto de años. Densidad en LOS TRES tramos. 2026 pesa más porque el año
 * en curso mueve todos los cortes, pero 2024 y 2025 quedan bien poblados
 * (~1250 y ~1750 respectivamente sobre 5000).
 */
export const PESOS_ANIO_V4 = [
    { anio: 2024, peso: 0.25 },
    { anio: 2025, peso: 0.35 },
    { anio: 2026, peso: 0.4 },
] as const;

/**
 * Catálogo de países + ciudades del v4. 18 países × ~5-8 ciudades cada uno
 * = 100+ ciudades reales. Todas están en el seed (idempotente); las nuevas
 * (ES, US) se agregaron en el mismo PR.
 *
 * Formato "XX:Nombre exacto como aparece en el catálogo" — el poblador
 * resuelve `ciudadId`/`paisId` contra la tabla; si alguna no matchea, el
 * reporte se guarda con `paisId=null` pero **no debería pasar** porque el
 * seed corre antes que la carga. El test lo verifica cross-check.
 */
export const CIUDADES_DEMO4 = [
    // Colombia — cobertura amplia.
    "CO:Bogotá", "CO:Medellín", "CO:Cali", "CO:Barranquilla", "CO:Cartagena",
    "CO:Bucaramanga", "CO:Pereira", "CO:Manizales", "CO:Cúcuta", "CO:Ibagué",
    // México.
    "MX:Ciudad de México", "MX:Guadalajara", "MX:Monterrey", "MX:Puebla",
    "MX:Tijuana", "MX:León", "MX:Cancún", "MX:Mérida",
    // Argentina.
    "AR:Buenos Aires", "AR:Córdoba", "AR:Rosario", "AR:Mendoza",
    "AR:La Plata", "AR:Mar del Plata", "AR:Salta", "AR:Tucumán",
    // Brasil (SPEC-382: nuevo respecto a v2).
    "BR:São Paulo", "BR:Río de Janeiro", "BR:Brasilia", "BR:Salvador",
    "BR:Fortaleza", "BR:Belo Horizonte", "BR:Manaos", "BR:Curitiba",
    // Chile.
    "CL:Santiago", "CL:Valparaíso", "CL:Concepción", "CL:La Serena",
    "CL:Antofagasta", "CL:Temuco",
    // Perú.
    "PE:Lima", "PE:Arequipa", "PE:Trujillo", "PE:Cusco", "PE:Chiclayo", "PE:Piura",
    // Ecuador.
    "EC:Quito", "EC:Guayaquil", "EC:Cuenca", "EC:Ambato", "EC:Manta",
    // Venezuela (nuevo).
    "VE:Caracas", "VE:Maracaibo", "VE:Valencia", "VE:Barquisimeto", "VE:Maracay", "VE:San Cristóbal",
    // Uruguay.
    "UY:Montevideo", "UY:Punta del Este", "UY:Salto", "UY:Paysandú", "UY:Maldonado",
    // Paraguay (nuevo).
    "PY:Asunción", "PY:Ciudad del Este", "PY:San Lorenzo", "PY:Luque", "PY:Capiatá",
    // Bolivia (nuevo).
    "BO:La Paz", "BO:Santa Cruz de la Sierra", "BO:Cochabamba", "BO:Sucre", "BO:Oruro", "BO:Tarija",
    // Costa Rica (nuevo).
    "CR:San José", "CR:Cartago", "CR:Alajuela", "CR:Heredia", "CR:Liberia",
    // Panamá (nuevo).
    "PA:Ciudad de Panamá", "PA:Colón", "PA:David", "PA:Santiago", "PA:Chitré",
    // Guatemala (nuevo).
    "GT:Ciudad de Guatemala", "GT:Quetzaltenango", "GT:Escuintla", "GT:Villa Nueva", "GT:Cobán",
    // República Dominicana (nuevo).
    "DO:Santo Domingo", "DO:Santiago", "DO:La Romana", "DO:San Pedro de Macorís", "DO:Puerto Plata",
    // Honduras (nuevo).
    "HN:Tegucigalpa", "HN:San Pedro Sula", "HN:La Ceiba", "HN:Choluteca", "HN:Comayagua",
    // El Salvador (ya sembrado — se usa).
    "SV:San Salvador", "SV:Santa Ana", "SV:San Miguel", "SV:Soyapango",
    // Nicaragua (ya sembrado — se usa).
    "NI:Managua", "NI:León", "NI:Masaya", "NI:Matagalpa",
    // España (nuevo · SPEC-382).
    "ES:Madrid", "ES:Barcelona", "ES:Valencia", "ES:Sevilla", "ES:Bilbao", "ES:Málaga", "ES:Zaragoza",
    // Estados Unidos (nuevo · SPEC-382).
    "US:Miami", "US:Nueva York", "US:Los Ángeles", "US:Houston", "US:Chicago", "US:Orlando", "US:Boston",
] as const;

export const PAISES_DEMO4 = [
    "CO", "MX", "AR", "BR", "CL", "PE", "EC", "VE", "UY",
    "PY", "BO", "CR", "PA", "GT", "DO", "HN", "SV", "NI",
    "ES", "US",
] as const;

/**
 * Fecha repartida por año según PESOS_ANIO_V4. Nunca futuro (dato sucio
 * para BI); hora en punto (G20 · coherente con v2/v3).
 */
export function fechaRepartidaV4(r: () => number, ahora: Date): Date {
    let anio = 2026;
    let x = r();
    for (const p of PESOS_ANIO_V4) {
        x -= p.peso;
        if (x <= 0) { anio = p.anio; break; }
    }
    const inicio = new Date(Date.UTC(anio, 0, 1));
    const finAnio = new Date(Date.UTC(anio + 1, 0, 1));
    const fin = finAnio > ahora ? ahora : finAnio;
    if (fin <= inicio) return new Date(inicio);
    const ms = inicio.getTime() + Math.floor(r() * (fin.getTime() - inicio.getTime()));
    const fecha = new Date(ms);
    fecha.setUTCMinutes(0, 0, 0);
    return fecha;
}
