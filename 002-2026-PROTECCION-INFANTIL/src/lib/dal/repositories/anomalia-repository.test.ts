/**
 * SPEC-225 (002-PI-126): tests de integración del AnomaliaRepository
 * (deduplicación por anomalía abierta, paginación de la API admin y
 * resolución). Las lecturas por regla se ejercitan en
 * `src/lib/analisis/anomalias/reglas.test.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { AnomaliaRepository, type NuevaAnomalia } from "./anomalia-repository";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

function nuevaAnomalia(overrides: Partial<NuevaAnomalia> = {}): NuevaAnomalia {
    return {
        tipo: "CAIDA_RECAUDO_CIUDAD",
        sujetoTipo: "Ciudad",
        sujetoId: unico("ciudad"),
        severidad: "ALTA",
        descripcion: "El recaudo autorizado cayó 41% respecto a la semana anterior.",
        datosContexto: { variacionPct: -41, umbralPct: 30 },
        ...overrides,
    };
}

describe("AnomaliaRepository · crearSiNoExisteAbierta (FR-007)", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("crea la anomalía cuando no hay una abierta del mismo tipo+sujeto", async () => {
        const repo = new AnomaliaRepository();
        const data = nuevaAnomalia();
        const creada = await repo.crearSiNoExisteAbierta(data);
        expect(creada).not.toBeNull();
        expect(creada?.tipo).toBe(data.tipo);
        expect(creada?.resueltaEn).toBeNull();
    });

    it("no duplica mientras la anterior sigue abierta; sí crea tras resolverla", async () => {
        const repo = new AnomaliaRepository();
        const data = nuevaAnomalia();
        const primera = await repo.crearSiNoExisteAbierta(data);
        expect(primera).not.toBeNull();

        const duplicada = await repo.crearSiNoExisteAbierta(data);
        expect(duplicada).toBeNull();
        expect(await prisma.anomalia.count()).toBe(1);

        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        await repo.marcarResuelta(primera!.id, admin.id, { variacionPct: -41, umbralPct: 30 });
        const trasResolver = await repo.crearSiNoExisteAbierta(data);
        expect(trasResolver).not.toBeNull();
        expect(await prisma.anomalia.count()).toBe(2);
    });

    it("misma tipo pero distinto sujeto no deduplica; anomalía global (sujeto null) sí", async () => {
        const repo = new AnomaliaRepository();
        await repo.crearSiNoExisteAbierta(nuevaAnomalia({ sujetoId: "ciudad-a" }));
        const otroSujeto = await repo.crearSiNoExisteAbierta(nuevaAnomalia({ sujetoId: "ciudad-b" }));
        expect(otroSujeto).not.toBeNull();

        const global1 = await repo.crearSiNoExisteAbierta(
            nuevaAnomalia({ tipo: "CANCELACIONES_MASIVAS_24H", sujetoTipo: null, sujetoId: null })
        );
        expect(global1).not.toBeNull();
        const global2 = await repo.crearSiNoExisteAbierta(
            nuevaAnomalia({ tipo: "CANCELACIONES_MASIVAS_24H", sujetoTipo: null, sujetoId: null })
        );
        expect(global2).toBeNull();
    });
});

describe("AnomaliaRepository · listarAnomalias / obtener / marcarResuelta", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("pagina y ordena por detectadaEn desc con filtros tipados", async () => {
        const repo = new AnomaliaRepository();
        for (let i = 0; i < 3; i++) {
            await repo.crearSiNoExisteAbierta(nuevaAnomalia({ sujetoId: unico("c") }));
            // Garantiza orden temporal determinista entre inserts.
            await new Promise((r) => setTimeout(r, 5));
        }
        await repo.crearSiNoExisteAbierta(
            nuevaAnomalia({ tipo: "USO_CAIDO_ABRUPTO", severidad: "MEDIA", sujetoTipo: "Colegio" })
        );

        const pagina1 = await repo.listarAnomalias({ severidad: "ALTA" }, 1, 2);
        expect(pagina1.total).toBe(3);
        expect(pagina1.items).toHaveLength(2);
        expect(pagina1.items[0]!.detectadaEn.getTime()).toBeGreaterThanOrEqual(
            pagina1.items[1]!.detectadaEn.getTime()
        );

        const pagina2 = await repo.listarAnomalias({ severidad: "ALTA" }, 2, 2);
        expect(pagina2.items).toHaveLength(1);

        const abiertas = await repo.listarAnomalias({ resueltaEn: null }, 1, 25);
        expect(abiertas.total).toBe(4);
    });

    it("marcarResuelta fija resueltaEn/resueltaPorAdminId y conserva el merge de datosContexto", async () => {
        const repo = new AnomaliaRepository();
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const creada = await repo.crearSiNoExisteAbierta(nuevaAnomalia());
        expect(creada).not.toBeNull();

        const merge = { variacionPct: -41, umbralPct: 30, notaResolucion: "Gestionada por teléfono" };
        const resuelta = await repo.marcarResuelta(creada!.id, admin.id, merge);
        expect(resuelta.resueltaEn).not.toBeNull();
        expect(resuelta.resueltaPorAdminId).toBe(admin.id);
        expect(resuelta.datosContexto).toMatchObject({ notaResolucion: "Gestionada por teléfono" });

        const detalle = await repo.obtenerAnomalia(creada!.id);
        expect(detalle?.resueltaEn).not.toBeNull();
    });

    it("listarAdminsActivos solo devuelve ADMIN en estado activo", async () => {
        const repo = new AnomaliaRepository();
        await crearUsuario("ADMIN", unico("a1") + "@test.local");
        const inactivo = await crearUsuario("ADMIN", unico("a2") + "@test.local");
        await prisma.usuario.update({ where: { id: inactivo.id }, data: { estado: "inactivo" } });
        await crearUsuario("PARENT", unico("p") + "@test.local");

        const admins = await repo.listarAdminsActivos();
        expect(admins).toHaveLength(1);
    });
});
