/**
 * SPEC-768 · Festivos de Colombia, ALGORÍTMICOS por año (sin tabla que mantener).
 *
 * Tres familias: FIJOS (se celebran en la fecha), EMILIANI (Ley 51/1983: si no
 * caen lunes, se corren al lunes siguiente) y RELATIVOS a Pascua (Jueves y Viernes
 * Santo NO se corren; Ascensión, Corpus y Sagrado Corazón sí, por Emiliani).
 *
 * PURA y en FECHA CALENDARIO — nunca instantes con hora. El portador de una fecha
 * es el MEDIODÍA UTC (07:00 en Bogotá, UTC-5): nunca cruza la frontera de día en
 * Bogotá, así el día de la semana es inequívoco (el bug de tipos que originó
 * SPEC-768 fue justo mezclar medianoche UTC con lecturas conscientes de zona).
 */

/** Portador de fecha calendario: mediodía UTC del día. */
function cal(anio: number, mes: number, dia: number): Date {
    return new Date(Date.UTC(anio, mes - 1, dia, 12));
}

/** `yyyy-mm-dd` del portador (leído en UTC; a mediodía UTC coincide con Bogotá). */
export function isoCalendario(c: Date): string {
    const y = c.getUTCFullYear();
    const m = String(c.getUTCMonth() + 1).padStart(2, "0");
    const d = String(c.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function sumarDiasCalendario(c: Date, n: number): Date {
    const r = new Date(c);
    r.setUTCDate(r.getUTCDate() + n);
    return r;
}

/** Ley Emiliani: si NO es lunes (getUTCDay===1), corre al lunes SIGUIENTE. */
function alLunesSiguiente(c: Date): Date {
    const dow = c.getUTCDay(); // 0=domingo … 6=sábado
    const delta = (1 - dow + 7) % 7; // 0 si ya es lunes
    return delta === 0 ? c : sumarDiasCalendario(c, delta);
}

/** Domingo de Pascua (gregoriano) — algoritmo de Meeus/Jones/Butcher. */
export function domingoDePascua(anio: number): Date {
    const a = anio % 19;
    const b = Math.floor(anio / 100);
    const c = anio % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mes = Math.floor((h + l - 7 * m + 114) / 31); // 3=marzo, 4=abril
    const dia = ((h + l - 7 * m + 114) % 31) + 1;
    return cal(anio, mes, dia);
}

const cache = new Map<number, Set<string>>();

/** Los festivos de Colombia del año, como `yyyy-mm-dd` (memorizado por año). */
export function festivosColombia(anio: number): Set<string> {
    const hit = cache.get(anio);
    if (hit) return hit;

    const fijos = [
        cal(anio, 1, 1), // Año Nuevo
        cal(anio, 5, 1), // Día del Trabajo
        cal(anio, 7, 20), // Independencia
        cal(anio, 8, 7), // Batalla de Boyacá
        cal(anio, 12, 8), // Inmaculada Concepción
        cal(anio, 12, 25), // Navidad
    ];

    const emiliani = [
        cal(anio, 1, 6), // Reyes Magos
        cal(anio, 3, 19), // San José
        cal(anio, 6, 29), // San Pedro y San Pablo
        cal(anio, 8, 15), // Asunción de la Virgen
        cal(anio, 10, 12), // Día de la Raza
        cal(anio, 11, 1), // Todos los Santos
        cal(anio, 11, 11), // Independencia de Cartagena
    ].map(alLunesSiguiente);

    const pascua = domingoDePascua(anio);
    const relativos = [
        sumarDiasCalendario(pascua, -3), // Jueves Santo (no se corre)
        sumarDiasCalendario(pascua, -2), // Viernes Santo (no se corre)
        alLunesSiguiente(sumarDiasCalendario(pascua, 39)), // Ascensión (Emiliani)
        alLunesSiguiente(sumarDiasCalendario(pascua, 60)), // Corpus Christi (Emiliani)
        alLunesSiguiente(sumarDiasCalendario(pascua, 68)), // Sagrado Corazón (Emiliani)
    ];

    const set = new Set([...fijos, ...emiliani, ...relativos].map(isoCalendario));
    cache.set(anio, set);
    return set;
}

/** ¿Ese `yyyy-mm-dd` es festivo en Colombia? */
export function esFestivoColombia(iso: string): boolean {
    return festivosColombia(Number(iso.slice(0, 4))).has(iso);
}
