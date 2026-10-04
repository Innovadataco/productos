/**
 * SPEC-655 / SPEC-414 · Predicado canónico «PerfilProfesional SEMBRADO (demo)» — UNA fuente.
 *
 * Un perfil sembrado está marcado en `demo_marcado` con `entidad = "PerfilProfesional"`
 * (para esta entidad ese es el predicado COMPLETO: `simulacion_reportes` guarda `reporteId`,
 * nunca un profesional — igual que `inicio-admin.ts` omite ese join). `demo_marcado` es
 * polimórfica y sin relación Prisma → se traen los ids y se excluyen con `NOT id in`, que
 * conserva el `select` con allowlist H-2 (un raw SQL lo saltaría).
 *
 * Vive acá y no duplicado porque lo consumen DOS carriles que no pueden divergir: el
 * directorio público / agendamiento (`perfil-profesional.ts`, SPEC-655) y la cola del
 * Verificador (`verificador-repository.ts`, I-419). Si el marcado cambia, cambia una vez.
 *
 * LÍMITE (SPEC-420): `NOT id in <ids>` gasta un bind por id; Postgres corta en 32.767. Con
 * ~decenas de sembrados sobra; para una entidad de VOLUMEN, pasar a anti-join antes de ese piso.
 */
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./unit-of-work";

/** ids de los `PerfilProfesional` sembrados (marca en `demo_marcado`). */
export async function idsPerfilesProfesionalesSembrados(db: DbClient): Promise<string[]> {
    const marcas = await db.demoMarcado.findMany({
        where: { entidad: "PerfilProfesional" },
        select: { entidadId: true },
    });
    return marcas.map((m) => m.entidadId);
}

/**
 * Fragmento WHERE que EXCLUYE los perfiles sembrados — incondicional (para superficies cuyo
 * visor es un operador real: la cola del Verificador). El directorio del padre usa su propia
 * versión CONDICIONADA al visor (un padre demo sí ve los demo); no confundir.
 */
export async function whereExcluirPerfilesSembrados(db: DbClient): Promise<Prisma.PerfilProfesionalWhereInput> {
    return { NOT: { id: { in: await idsPerfilesProfesionalesSembrados(db) } } };
}

/**
 * ═══ SPEC-863 (I-400) · predicado canónico «Reporte NO REAL» (de prueba) ═══
 *
 * Un `Reporte` es «no real» si está marcado en `demo_marcado` con `entidad = "Reporte"`
 * (poblador demo O simulador de abusos) O ligado a una corrida del simulador de clasificación
 * en `simulacion_reportes` (`reporteId`). Es EXACTAMENTE la misma unión «no es trabajo real»
 * que usa BI (006 `scripts/replica-setup/05-mv-fact.sql`: `demo_marcado ∪ simulacion_reportes`)
 * y que ya aplica `inicio-admin.ts` S3/S4 — una sola verdad entre 002 y 006. Si cambia la
 * definición de «no real», cambia acá y en esos dos sitios a la vez.
 *
 * `demo_marcado.metadata.origen` desambigua la PROCEDENCIA ("simulador-abuso" para el simulador
 * de abusos; el poblador demo marca sin ese origen). El consumidor NO mira el origen: la marca
 * basta para excluir — demo y simulacro son ambos «no trabajo real».
 *
 * LÍMITE (heredado del predicado de perfiles): `idsReportesNoReales` + `notIn` gasta un bind por
 * id de prueba; Postgres corta en 32.767. Los de prueba son POCOS por diseño (la IN-list son los
 * ids NO reales, no todos los reportes). Para una superficie de VOLUMEN, pasar a anti-join raw
 * (el patrón de `inicio-admin.ts`) antes de ese piso.
 */

/** Marca un `Reporte` como SIMULACRO (no real). Debe correr en la MISMA tx que la creación del
 *  reporte (atomicidad: un reporte de simulador NUNCA existe sin su marca) — ver `crearReporteConTexto`. */
export async function marcarReporteSimulacro(db: DbClient, reporteId: string, origen: string): Promise<void> {
    await db.demoMarcado.create({
        data: { entidad: "Reporte", entidadId: reporteId, metadata: { origen } },
    });
}

/** ¿Este reporte es de prueba (demo_marcado ∪ simulacion_reportes)? Dos lookups puntuales por índice. */
export async function esReporteNoReal(db: DbClient, reporteId: string): Promise<boolean> {
    const [demo, sim] = await Promise.all([
        db.demoMarcado.findUnique({
            where: { entidad_entidadId: { entidad: "Reporte", entidadId: reporteId } },
            select: { id: true },
        }),
        db.simulacionReporte.findUnique({ where: { reporteId }, select: { id: true } }),
    ]);
    return demo !== null || sim !== null;
}

/** ids de los reportes de prueba (demo_marcado entidad="Reporte" ∪ simulacion_reportes). */
export async function idsReportesNoReales(db: DbClient): Promise<string[]> {
    const [demo, sim] = await Promise.all([
        db.demoMarcado.findMany({ where: { entidad: "Reporte" }, select: { entidadId: true } }),
        db.simulacionReporte.findMany({ select: { reporteId: true } }),
    ]);
    return [...new Set([...demo.map((d) => d.entidadId), ...sim.map((s) => s.reporteId)])];
}

/**
 * Fragmento WHERE que EXCLUYE los reportes de prueba — incondicional (superficies cuyo visor es
 * un usuario real: avisos, patrones, match, conteos admin/rector, consulta pública, scoring).
 * Los listados SCOPED al propio padre NO lo usan (un padre demo sí ve sus demo): ver la decisión
 * de producto en la spec de SPEC-863.
 */
export async function whereExcluirReportesNoReales(db: DbClient): Promise<Prisma.ReporteWhereInput> {
    return { id: { notIn: await idsReportesNoReales(db) } };
}
