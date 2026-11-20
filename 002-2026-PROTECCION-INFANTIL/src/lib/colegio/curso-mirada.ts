/**
 * SPEC-964 (FORMA Órbita · PARÁ 3) — umbral calma↔mirada de un curso, como PARÁMETRO SEMBRADO
 * (no una constante quemada). El color del nodo de curso en el overview radial (`colorCursoOrbita`)
 * lo consume: un curso con `alertas30d` que CRUZA el umbral pasa a ámbar; por debajo, pino.
 *
 * Valor inicial = 1 → ámbar exactamente para los cursos que HOY entran en «Cursos que merecen
 * mirada» (≥ 1 reporte distinto en 30 días) y pino al resto: NO cambia lo que hoy se ve (PARÁ 3).
 * El admin puede subirlo para exigir más reportes antes de encender el ámbar, sin desplegar.
 *
 * Clave dotada (convención de `ParametroSistema`); la FORMA la nombró `cursoMiradaUmbralReportes30d`.
 * Fuente ÚNICA de la clave y el default: la lee el repositorio (color) y la siembra `prisma/seed.ts`.
 */
export const CLAVE_CURSO_MIRADA_UMBRAL = "colegio.curso.mirada.umbral_reportes_30d";

/** Default que no cambia lo que hoy se ve (PARÁ 3): ámbar ⇔ el curso tiene ≥ 1 reporte en 30 días. */
export const CURSO_MIRADA_UMBRAL_DEFAULT = 1;
