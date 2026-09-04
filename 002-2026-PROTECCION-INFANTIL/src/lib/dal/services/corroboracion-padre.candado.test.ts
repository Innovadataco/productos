/**
 * SPEC-439 · candados del aviso al padre.
 *
 * El defecto que cierra esta spec **no fue código faltante: fue código muerto**.
 * `notificarCambioCirculoSiCorresponde` se construyó en SPEC-135 (E-2), se
 * enriqueció en SPEC-308 (A-50), tiene sus tests… y **nunca tuvo un llamador**.
 * Su propia spec afirma «el punto de disparo es este flujo, ya invocado cuando
 * un reporte pasa a estado visible» — no lo estaba. Es el segundo caso en dos
 * días: I-303 (`leerAutorizacion`) fue idéntico.
 *
 * Por qué los tests de entonces no lo cazaron: **llamaban la función directo**.
 * Probaban que funciona sin probar que se usa. Los candados de acá miran el
 * CABLEADO, no la existencia.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";

const RAIZ = path.resolve(__dirname, "../../../..");

/** Fuente sin comentarios: nombrar el defecto no puede dar el candado por bueno. */
function leerCodigo(rel: string): string {
    return fs
        .readFileSync(path.join(RAIZ, rel), "utf-8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .map((l) => l.replace(/\/\/.*$/, ""))
        .join("\n");
}

describe("SPEC-439 · candado de cableado: los avisos tienen un llamador REAL", () => {
    it("el aviso al círculo se dispara desde el flujo que lo vuelve visible", () => {
        const finalizacion = leerCodigo("src/lib/dal/services/reporte-processing/finalizacion.ts");

        expect(
            /notificarCambioCirculoSiCorresponde\s*\(\s*reporteId\s*\)/.test(finalizacion),
            "SPEC-135/308 construyó el aviso al círculo y nadie lo llamaba. Si esta " +
                "línea desaparece de `finalizacion.ts`, el padre deja de enterarse otra vez.",
        ).toBe(true);
    });

    it("el aviso al padre que reportó se dispara desde la detección del match", () => {
        const eventoMatch = leerCodigo("src/lib/dal/services/evento-match.ts");

        expect(
            /avisarPadresQueReportaronSinFallar\s*\(/.test(eventoMatch),
            "El aviso al padre que ya había reportado se llama desde `detectarYRegistrarMatch`, " +
                "que es idempotente por `reporteNuevoId`. Sin esa llamada no avisa nadie.",
        ).toBe(true);
    });

    it("el aviso al padre va DESPUÉS de crear el evento — si no, un reintento avisa dos veces", () => {
        const fuente = leerCodigo("src/lib/dal/services/evento-match.ts");
        const posCrear = fuente.indexOf("eventos.crear(");
        const posAviso = fuente.indexOf("avisarPadresQueReportaronSinFallar(");

        expect(posCrear, "no se encontró `eventos.crear(`").toBeGreaterThan(-1);
        expect(posAviso, "no se encontró la llamada al aviso").toBeGreaterThan(-1);
        expect(
            posAviso,
            "La unicidad de `reporteNuevoId` es lo único que impide un aviso duplicado: " +
                "el aviso TIENE que ir después de que la creación haya pasado.",
        ).toBeGreaterThan(posCrear);
    });
});

describe("SPEC-439 · candado de reserva: la identidad del otro reportante no puede salir", () => {
    it("el select de `otrosReportes` no carga autor ni texto", () => {
        const repo = leerCodigo("src/lib/dal/repositories/reporte-seguimiento.ts");
        const bloque = repo.slice(repo.indexOf("findOtrosPorIdentificador"));

        for (const prohibido of ["usuarioId", "texto", "textoOriginal", "fuente", "email"]) {
            expect(
                new RegExp(`${prohibido}\\s*:\\s*true`).test(bloque),
                `\`${prohibido}\` NO puede cargarse en el select de otros reportes: ` +
                    "lo que no se carga no se puede filtrar mal después (A-60 · criterio 5).",
            ).toBe(false);
        }
        // Y sí carga el TIPO de autor, que es lo que Jelkin pidió ver.
        expect(/esAnonimo\s*:\s*true/.test(bloque)).toBe(true);
    });

    it("el DTO de otros reportes expone exactamente los seis campos acordados", () => {
        const tipos = leerCodigo("src/lib/dal/types/reporte.ts");
        const inicio = tipos.indexOf("export interface OtroReporteDto");
        const bloque = tipos.slice(inicio, tipos.indexOf("}", inicio));
        const campos = [...bloque.matchAll(/^\s{4}(\w+)\??:/gm)].map((m) => m[1]).sort();

        expect(campos).toEqual(["categoriaLabel", "ciudad", "creadoEn", "esAnonimo", "id", "pais"]);
    });
});

// ── Conducta del aviso ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
    findManyUsuario: vi.fn(),
    findUniquePlataforma: vi.fn(),
    programar: vi.fn(),
    despacharEnvios: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    prisma: {
        usuario: { findMany: mocks.findManyUsuario },
        plataforma: { findUnique: mocks.findUniquePlataforma },
    },
}));

vi.mock("@/lib/notificaciones/motor", () => ({
    programar: mocks.programar,
    despacharEnvios: mocks.despacharEnvios,
}));

import { avisarPadresQueReportaron } from "./corroboracion-padre";

const BASE = {
    reporteNuevoId: "rep-nuevo",
    plataformaId: "plat-1",
    ciudad: "Bogotá",
    categoria: "OFRECIMIENTO_REGALOS",
    conteoAcumulado: 3,
};

describe("SPEC-439 · a quién avisa y qué le manda", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.findUniquePlataforma.mockResolvedValue({ nombre: "WhatsApp" });
        mocks.programar.mockResolvedValue({ programadas: 1, canceladasPorReemplazo: 0, envios: [] });
        mocks.findManyUsuario.mockImplementation(({ where }: { where: { id: { in: string[] } } }) =>
            Promise.resolve(where.id.in.map((id) => ({ id })))
        );
    });

    it("avisa al padre que ya había reportado", async () => {
        const r = await avisarPadresQueReportaron({ ...BASE, usuariosPrevios: ["padre-1"], autorNuevoId: null });

        expect(r.avisados).toBe(1);
        expect(mocks.programar).toHaveBeenCalledTimes(1);
        expect(mocks.programar.mock.calls[0]?.[0]?.evento).toBe("reporte.corroborado_por_otro");
    });

    it("NO se avisa a sí mismo cuando el reporte nuevo es del mismo padre", async () => {
        const r = await avisarPadresQueReportaron({
            ...BASE,
            usuariosPrevios: ["padre-1"],
            autorNuevoId: "padre-1",
        });

        expect(r.avisados).toBe(0);
        expect(mocks.programar).not.toHaveBeenCalled();
    });

    it("no manda dos correos al mismo padre por dos reportes suyos previos", async () => {
        await avisarPadresQueReportaron({
            ...BASE,
            usuariosPrevios: ["padre-1", "padre-1", "padre-2"],
            autorNuevoId: null,
        });

        const destinatarios = mocks.programar.mock.calls[0]?.[0]?.destinatarios ?? [];
        expect(destinatarios.map((d: { usuarioId: string }) => d.usuarioId).sort()).toEqual([
            "padre-1",
            "padre-2",
        ]);
    });

    it("los reportes anónimos previos no producen destinatario", async () => {
        const r = await avisarPadresQueReportaron({
            ...BASE,
            usuariosPrevios: [null, null],
            autorNuevoId: null,
        });

        expect(r.avisados).toBe(0);
        expect(r.motivo).toBe("sin_padres_previos");
    });

    it("RESERVA: las variables del correo no llevan identidad de nadie", async () => {
        await avisarPadresQueReportaron({
            ...BASE,
            usuariosPrevios: ["padre-1"],
            autorNuevoId: "padre-otro",
        });

        const variables = mocks.programar.mock.calls[0]?.[0]?.destinatarios?.[0]?.variables ?? {};
        expect(Object.keys(variables).sort()).toEqual(["ciudad", "conducta", "plataforma", "totalReportes"]);

        const serializado = JSON.stringify(variables);
        for (const prohibido of ["padre-1", "padre-otro", "rep-nuevo"]) {
            expect(
                serializado.includes(prohibido),
                `El correo no puede llevar \`${prohibido}\`: solo qué pasó, nunca quién.`,
            ).toBe(false);
        }
    });
});

/**
 * SPEC-439 · candados sobre lo que YA estaba construido y nadie protegía.
 *
 * El radicado 439 mandó a reconstruir la Parte 1 porque **nadie sabía que
 * existía**: SPEC-366 la había hecho y ningún candado la nombraba. Estos tests
 * no agregan conducta nueva; le ponen nombre y alarma a la que ya hay, para que
 * no se vuelva a olvidar ni a romper en silencio.
 */
describe("SPEC-439 · el duplicado no enciende modelos y no infla el patrón", () => {
    it("el corte por duplicado va ANTES de la clasificación y sale por return", () => {
        const pipeline = leerCodigo("src/lib/dal/services/reporte-processing/index.ts");
        const posDuplicado = pipeline.indexOf("detectarDuplicado({");
        const posSalida = pipeline.indexOf("duplicado.response");
        const posCache = pipeline.indexOf("buscarClasificacionCache(");
        const posClasificar = pipeline.indexOf("clasificarReporte({");

        expect(posDuplicado, "no se encontró la llamada a `detectarDuplicado`").toBeGreaterThan(-1);
        expect(posSalida, "el duplicado tiene que SALIR con return, no seguir").toBeGreaterThan(posDuplicado);
        expect(
            posSalida,
            "Si la salida del duplicado queda DESPUÉS de clasificar, un duplicado " +
                "enciende los modelos: es justo el gasto que el corte evita.",
        ).toBeLessThan(posClasificar);
        expect(posSalida).toBeLessThan(posCache);
    });

    it("un duplicado sigue excluido de las señales — heredar respuesta no es contar dos veces", () => {
        const embedding = leerCodigo("src/lib/dal/repositories/embedding.ts");
        const exclusiones = [...embedding.matchAll(/estado\s+NOT\s+IN\s*\(([^)]*)\)/gi)];

        expect(
            exclusiones.length,
            "Las consultas de señal excluían DUPLICADO para que una ráfaga no inflara " +
                "un patrón. Si esa exclusión desaparece, el duplicado se cuenta dos veces.",
        ).toBeGreaterThanOrEqual(2);
        for (const [, lista] of exclusiones) {
            expect(lista).toContain("DUPLICADO");
        }
    });

    it("el seguimiento resuelve el duplicado contra el original (SPEC-366), no contra sí mismo", () => {
        const query = leerCodigo("src/lib/dal/services/reporte-query.ts");

        expect(
            /const\s+efectivo\s*=\s*reporte\.reporteOrigen\s*\?\?\s*reporte/.test(query),
            "SPEC-366 (A-71): el duplicado muestra el estado y la clasificación VIVOS " +
                "del original. Sin esta línea vuelve a no recibir respuesta.",
        ).toBe(true);
        expect(
            /estadoInterno:\s*reporte\.estado/.test(query),
            "El estado ALMACENADO del duplicado NO se materializa: sigue DUPLICADO para " +
                "que la señal lo excluya igual.",
        ).toBe(true);
    });
});
