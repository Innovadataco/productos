/**
 * CANDADO · SPEC-772 (dictamen D-121 de Datos) — la BD, no la app, garantiza el contrato de
 * `SolicitudHabeasData`. Prisma es CIEGO a los CHECK y al TRIGGER: este candado prueba la CONDUCTA
 * contra Postgres (inserción/actualización reales), no que el texto esté escrito. Si alguien dropea un
 * CHECK, afloja el trigger o abre el eje de sujeto, un test de acá se pone ROJO.
 *
 * Cubre las cuatro invariantes estructurales de la migración `20260930010000_spec772_...`:
 *   (1) EJE DE SUJETO — sujetoDelDato IS NULL ⟺ TITULAR_CUENTA; los otros dos lo exigen. Positivos y
 *       negativos (23514). + A-9: peticionario ≠ dueño del dato es CONSTRUIBLE (el modelo no lo ata).
 *   (2) TECHO LEGAL del plazo — CONSULTA 1..10, reclamo 1..15; 0 y los excesos → 23514 (10 ≠ 15 a propósito).
 *   (3) COHERENCIA TEMPORAL — venceEn > recibidoEn (el reloj arranca en recibidoEn, no en creadoEn).
 *   (4) recibidoEn INMUTABLE (trigger) — moverlo lanza; el resto de columnas se actualiza. + venceEn NOT NULL.
 *   (5) FK SetNull — borrar la cuenta vacía el enlace y la fila legal SOBREVIVE (prueba, de paso, que el
 *       CHECK del eje NO exige peticionarioUsuarioId; si lo exigiera, el SetNull la volvería inconstruible).
 *
 * Integración (BD de test, truncada por resetDatabase). NO toca prod.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { PLAZO_MAX_CONSULTA_DIAS_HABILES, PLAZO_MAX_RECLAMO_DIAS_HABILES, plazoMaximoLegalDiasHabiles } from "@/lib/habeas-data/plazos-legales";

let contador = 0;

type Tipo = "CONSULTA" | "RECTIFICACION" | "SUPRESION";
type Calidad = "TITULAR_CUENTA" | "REPRESENTANTE_LEGAL" | "TITULAR_MAYORIA_EDAD";
type Origen = "APLICACION" | "CORREO" | "OTRO";

interface Opts {
    tipo?: Tipo;
    calidad?: Calidad;
    peticionarioUsuarioId?: string | null;
    sujetoDelDato?: string | null;
    plazoDias?: number;
    recibidoEn?: Date;
    venceEn?: Date | null;
    origen?: Origen;
}

const RECIBIDO_BASE = new Date("2026-09-01T12:00:00Z");
const VENCE_BASE = new Date("2026-09-15T12:00:00Z");

function nuevoId(): string {
    return `shd-test-${Date.now()}-${contador++}`;
}

/** INSERT crudo con casts de enum explícitos. Baseline VÁLIDO: TITULAR_CUENTA sobre sí mismo, CONSULTA
 *  a 10 días, venceEn > recibidoEn. Cada test tuerce SOLO el campo que quiere probar. */
function insertarSQL(id: string, o: Opts = {}) {
    const vence = o.venceEn === undefined ? VENCE_BASE : o.venceEn;
    const tipo = o.tipo ?? "CONSULTA";
    // SPEC-827 · el baseline respeta el CHECK `objeto_por_tipo`: CONSULTA va con objeto vacío,
    // RECTIFICACION/SUPRESION con ≥1 clase (el requisito que agregó 827). Va como fragmento SQL (literal de
    // enum), no como param, para castear a "ClaseDatoTitular"[].
    const clasesSolicitadas =
        tipo === "CONSULTA"
            ? Prisma.raw("ARRAY[]::\"ClaseDatoTitular\"[]")
            : Prisma.raw("ARRAY['PERFIL']::\"ClaseDatoTitular\"[]");
    return prisma.$executeRaw`
        INSERT INTO "SolicitudHabeasData"
            (id, tipo, calidad, "peticionarioUsuarioId", "sujetoDelDato", "plazoDias", "recibidoEn", origen, "venceEn", "clasesSolicitadas")
        VALUES (
            ${id},
            ${tipo}::"TipoSolicitudHabeasData",
            ${o.calidad ?? "TITULAR_CUENTA"}::"CalidadPeticionario",
            ${o.peticionarioUsuarioId ?? null},
            ${o.sujetoDelDato ?? null},
            ${o.plazoDias ?? 10},
            ${o.recibidoEn ?? RECIBIDO_BASE},
            ${o.origen ?? "APLICACION"}::"OrigenSolicitudHabeasData",
            ${vence},
            ${clasesSolicitadas}
        )
    `;
}

/** Prisma envuelve el rechazo de la BD como P2010 con el SQLSTATE real en `meta`; lo aplanamos a texto. */
function detalleError(err: unknown): string {
    return `${(err as Error)?.message ?? ""} ${JSON.stringify((err as { meta?: unknown })?.meta ?? {})}`;
}

async function esperarRechazo(promesa: Promise<unknown>): Promise<string> {
    let err: unknown;
    try {
        await promesa;
    } catch (e) {
        err = e;
    }
    expect(err, "la BD DEBE rechazar esta fila: si pasa, la restricción ya no está").toBeDefined();
    return detalleError(err);
}

describe("SPEC-772 · eje de sujeto (CHECK, 23514)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("TITULAR_CUENTA con sujetoDelDato NOT NULL → rechazo (el titular no nombra un sujeto aparte)", async () => {
        const detalle = await esperarRechazo(insertarSQL(nuevoId(), { calidad: "TITULAR_CUENTA", sujetoDelDato: "otro" }));
        expect(detalle).toMatch(/23514|SolicitudHabeasData_eje_sujeto_check/);
    });

    it.each(["REPRESENTANTE_LEGAL", "TITULAR_MAYORIA_EDAD"] as const)(
        "%s con sujetoDelDato NULL → rechazo (pide sobre OTRO, tiene que nombrarlo)",
        async (calidad) => {
            const detalle = await esperarRechazo(insertarSQL(nuevoId(), { calidad, sujetoDelDato: null }));
            expect(detalle).toMatch(/23514|SolicitudHabeasData_eje_sujeto_check/);
        },
    );

    it("TITULAR_CUENTA sin sujeto → pasa (el sujeto es quien pide)", async () => {
        const id = nuevoId();
        await insertarSQL(id, { calidad: "TITULAR_CUENTA", sujetoDelDato: null });
        expect(await prisma.solicitudHabeasData.count({ where: { id } })).toBe(1);
    });

    it.each(["REPRESENTANTE_LEGAL", "TITULAR_MAYORIA_EDAD"] as const)(
        "%s con sujetoDelDato → pasa",
        async (calidad) => {
            const id = nuevoId();
            await insertarSQL(id, { calidad, sujetoDelDato: "alumno:menor-x" });
            expect(await prisma.solicitudHabeasData.count({ where: { id } })).toBe(1);
        },
    );

    it("A-9 · peticionario ≠ dueño del dato es CONSTRUIBLE (el modelo no ata la petición a la cuenta del sujeto)", async () => {
        const representante = await crearUsuario("PARENT");
        const id = nuevoId();
        // El representante tiene su propia cuenta y pide sobre OTRO (un menor, descriptor libre).
        await insertarSQL(id, { calidad: "REPRESENTANTE_LEGAL", peticionarioUsuarioId: representante.id, sujetoDelDato: "alumno:hijo-menor" });
        expect(await prisma.solicitudHabeasData.count({ where: { id } })).toBe(1);
    });
});

describe("SPEC-772 · techo legal del plazo (CHECK, 23514) — 10 ≠ 15 a propósito", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    // Pasan: bordes válidos por clase.
    it.each([
        ["CONSULTA", 1],
        ["CONSULTA", 10],
        ["RECTIFICACION", 15],
        ["SUPRESION", 15],
    ] as const)("%s plazoDias %i → pasa", async (tipo, plazoDias) => {
        const id = nuevoId();
        await insertarSQL(id, { tipo, plazoDias });
        expect(await prisma.solicitudHabeasData.count({ where: { id } })).toBe(1);
    });

    // Rechazan: 0 (bajo el piso), y cada clase por encima de SU techo (11 consulta, 16 reclamo, y 15 en consulta).
    it.each([
        ["CONSULTA", 0],
        ["CONSULTA", 11],
        ["CONSULTA", 15],
        ["CONSULTA", 30],
        ["RECTIFICACION", 16],
        ["SUPRESION", 16],
        ["RECTIFICACION", 0],
    ] as const)("%s plazoDias %i → rechazo (23514)", async (tipo, plazoDias) => {
        const detalle = await esperarRechazo(insertarSQL(nuevoId(), { tipo, plazoDias }));
        expect(detalle).toMatch(/23514|SolicitudHabeasData_plazo_techo_legal_check/);
    });
});

describe("SPEC-772 · coherencia temporal y venceEn (23514 / 23502)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it.each([
        ["venceEn = recibidoEn", RECIBIDO_BASE],
        ["venceEn < recibidoEn", new Date("2026-08-01T12:00:00Z")],
    ] as const)("%s → rechazo (venceEn > recibidoEn)", async (_caso, vence) => {
        const detalle = await esperarRechazo(insertarSQL(nuevoId(), { venceEn: vence }));
        expect(detalle).toMatch(/23514|SolicitudHabeasData_vence_gt_recibido_check/);
    });

    it("venceEn NULL → rechazo (NOT NULL, 23502): el reloj no puede faltar", async () => {
        const detalle = await esperarRechazo(insertarSQL(nuevoId(), { venceEn: null }));
        expect(detalle).toMatch(/23502|null value|not-null/i);
    });

    it("venceEn > recibidoEn → pasa", async () => {
        const id = nuevoId();
        await insertarSQL(id, { recibidoEn: RECIBIDO_BASE, venceEn: VENCE_BASE });
        expect(await prisma.solicitudHabeasData.count({ where: { id } })).toBe(1);
    });
});

describe("SPEC-772 · recibidoEn inmutable (trigger)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("mover recibidoEn lanza; cambiar estado (otra columna) se permite y recibidoEn no se mueve", async () => {
        const id = nuevoId();
        await insertarSQL(id, { calidad: "TITULAR_CUENTA", sujetoDelDato: null });

        // Control positivo: otra columna SÍ se actualiza (el trigger no bloquea el flujo normal).
        await prisma.$executeRaw`UPDATE "SolicitudHabeasData" SET estado = 'EN_REVISION'::"EstadoSolicitudHabeasData" WHERE id = ${id}`;

        // Mover recibidoEn DEBE lanzar (es la prueba del término legal).
        const detalle = await esperarRechazo(
            prisma.$executeRaw`UPDATE "SolicitudHabeasData" SET "recibidoEn" = ${new Date("2027-01-01T00:00:00Z")} WHERE id = ${id}`,
        );
        expect(detalle).toMatch(/inmutable/i);

        const row = await prisma.solicitudHabeasData.findUnique({ where: { id } });
        expect(row?.estado, "el cambio de estado SÍ quedó").toBe("EN_REVISION");
        expect(row?.recibidoEn.toISOString(), "recibidoEn sigue en su valor original").toBe(RECIBIDO_BASE.toISOString());
    });
});

describe("SPEC-772 · [NORMA] el techo legal en código coincide con el CHECK de la migración", () => {
    it("las constantes son 10 (consulta) / 15 (reclamo) — si alguien las sube, cambió la LEY, no el código", () => {
        // Estos valores están HARDCODEADOS en el CHECK plazo_techo_legal de la migración. Si cambian acá,
        // el CHECK deja de coincidir: este candado obliga a tocar los dos juntos (o a frenar: es la ley).
        expect(PLAZO_MAX_CONSULTA_DIAS_HABILES).toBe(10);
        expect(PLAZO_MAX_RECLAMO_DIAS_HABILES).toBe(15);
        expect(plazoMaximoLegalDiasHabiles("CONSULTA")).toBe(10);
        expect(plazoMaximoLegalDiasHabiles("RECTIFICACION")).toBe(15);
        expect(plazoMaximoLegalDiasHabiles("SUPRESION")).toBe(15);
    });
});

describe("SPEC-772 · resultado DESPOJADO — la constancia no puede contener lo eliminado", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("resultado NO admite narrativa libre: un texto con contenido → rechazo (enum, 22P02)", async () => {
        const contenidoEliminado = "se eliminó el reporte de Juan Pérez sobre el menor de 8 años";
        const detalle = await esperarRechazo(
            prisma.$executeRaw`
                INSERT INTO "SolicitudHabeasData" (id, tipo, calidad, "plazoDias", "recibidoEn", origen, "venceEn", resultado)
                VALUES (${nuevoId()}, 'CONSULTA'::"TipoSolicitudHabeasData", 'TITULAR_CUENTA'::"CalidadPeticionario", 10, ${RECIBIDO_BASE}, 'APLICACION'::"OrigenSolicitudHabeasData", ${VENCE_BASE}, ${contenidoEliminado}::"ResultadoSolicitudHabeasData")
            `,
        );
        expect(detalle).toMatch(/22P02|invalid input value for enum|ResultadoSolicitudHabeasData/);
    });

    it("clasesDatoAfectadas tampoco admite texto libre (enum array, 22P02)", async () => {
        const detalle = await esperarRechazo(
            prisma.$executeRaw`
                INSERT INTO "SolicitudHabeasData" (id, tipo, calidad, "plazoDias", "recibidoEn", origen, "venceEn", "clasesDatoAfectadas")
                VALUES (${nuevoId()}, 'CONSULTA'::"TipoSolicitudHabeasData", 'TITULAR_CUENTA'::"CalidadPeticionario", 10, ${RECIBIDO_BASE}, 'APLICACION'::"OrigenSolicitudHabeasData", ${VENCE_BASE}, ARRAY['nombre del menor Y']::"ClaseDatoTitular"[])
            `,
        );
        expect(detalle).toMatch(/22P02|invalid input value for enum|ClaseDatoTitular/);
    });

    it("una SUPRESIÓN atendida guarda SOLO disposición + CLASE; leer la fila NO revela el contenido eliminado", async () => {
        const id = nuevoId();
        // El contenido que el operador eliminó — jamás debe aterrizar en esta fila (que existe para PROBAR el borrado).
        const contenidoEliminado = "menor Y · reporte X · relato sensible del caso";
        // La constancia solo puede decir: qué se hizo (enum) + sobre qué CLASE (enum). Nada del contenido.
        await prisma.$executeRaw`
            INSERT INTO "SolicitudHabeasData"
                (id, tipo, calidad, "sujetoDelDato", "plazoDias", "recibidoEn", origen, "venceEn", estado, "resueltaEn", resultado, "clasesSolicitadas", "clasesDatoAfectadas")
            VALUES (${id}, 'SUPRESION'::"TipoSolicitudHabeasData", 'REPRESENTANTE_LEGAL'::"CalidadPeticionario", ${"alumno:menor-anon"}, 15, ${RECIBIDO_BASE}, 'CORREO'::"OrigenSolicitudHabeasData", ${VENCE_BASE}, 'RESUELTA'::"EstadoSolicitudHabeasData", ${VENCE_BASE}, 'ATENDIDA_COMPLETA'::"ResultadoSolicitudHabeasData", ARRAY['CONTENIDO_REPORTE']::"ClaseDatoTitular"[], ARRAY['CONTENIDO_REPORTE']::"ClaseDatoTitular"[])
        `;
        const row = await prisma.solicitudHabeasData.findUnique({ where: { id } });
        expect(row?.resultado, "control positivo: la disposición despojada SÍ se guarda").toBe("ATENDIDA_COMPLETA");
        expect(row?.clasesDatoAfectadas).toEqual(["CONTENIDO_REPORTE"]);
        // Afirmación central: ningún campo de la constancia contiene el contenido eliminado.
        const serializado = JSON.stringify(row);
        expect(serializado, "el contenido eliminado NO puede aparecer en la constancia").not.toContain(contenidoEliminado);
        expect(serializado).not.toContain("relato sensible");
    });
});

describe("SPEC-772 · FK SetNull durable (la fila legal sobrevive al borrado de la cuenta)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("borrar la cuenta del peticionario vacía el enlace pero conserva la fila (y el CHECK no la traba)", async () => {
        const peticionario = await crearUsuario("PARENT");
        const id = nuevoId();
        await insertarSQL(id, { calidad: "TITULAR_CUENTA", peticionarioUsuarioId: peticionario.id, sujetoDelDato: null });

        // Control positivo: el enlace EXISTE antes del borrado.
        const antes = await prisma.solicitudHabeasData.findUnique({ where: { id } });
        expect(antes?.peticionarioUsuarioId).toBe(peticionario.id);

        // Si el CHECK del eje exigiera peticionarioUsuarioId, este borrado lanzaría 23514 al hacer SET NULL.
        await prisma.usuario.delete({ where: { id: peticionario.id } });

        const despues = await prisma.solicitudHabeasData.findUnique({ where: { id } });
        expect(despues, "la fila legal DEBE sobrevivir al borrado de la cuenta").not.toBeNull();
        expect(despues?.peticionarioUsuarioId, "el enlace al actor se vacía (SetNull)").toBeNull();
    });
});
