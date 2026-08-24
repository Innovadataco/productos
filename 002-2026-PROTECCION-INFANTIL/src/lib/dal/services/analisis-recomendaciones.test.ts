/**
 * SPEC-227 (002-PI-128): tests de integración del servicio DAL del historial
 * (FR-012, SC-002/003): tasas con denominador de resueltas, tiempo promedio
 * solo sobre `resueltaEn` no nula, frontera de día calendario Bogotá, orden de
 * porRegla por tasa de ignorada desc, tope 413 y AuditLog de exportación.
 * NOTA: tests de integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { CategoriaParametro, TipoParametro, type EstadoRecomendacion } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import {
    AnalisisRecomendacionesService,
    CLAVE_EXPORT_MAX_FILAS,
    CLAVE_UMBRAL_IGNORADA,
} from "./analisis-recomendaciones";
import { resolverFiltros, filtrosHistorialSchema } from "@/lib/analisis/filtros-historial";
import { AppError } from "@/lib/errors";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function sembrarParametros() {
    const params = [
        { clave: CLAVE_UMBRAL_IGNORADA, valor: "70", tipo: TipoParametro.FLOAT },
        { clave: CLAVE_EXPORT_MAX_FILAS, valor: "5000", tipo: TipoParametro.INTEGER },
    ];
    for (const p of params) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: p.tipo,
                categoria: CategoriaParametro.SYSTEM,
                esPublico: false,
                esSecreto: false,
                descripcion: "test",
            },
        });
    }
}

async function crearRegla(adminId: string, clave = unico("regla")) {
    return prisma.reglaRecomendacion.create({
        data: {
            clave,
            nombre: `Regla ${clave}`,
            descripcion: "Regla de prueba",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
        },
    });
}

async function crearRecomendacion(
    reglaId: string,
    datos: {
        estado?: EstadoRecomendacion;
        generadaEn?: Date;
        resueltaEn?: Date | null;
        sujetoTipo?: string | null;
        sujetoId?: string | null;
        ejecutadaAutomatica?: boolean;
    } = {}
) {
    const generadaEn = datos.generadaEn ?? new Date("2026-08-20T14:00:00.000Z");
    return prisma.recomendacion.create({
        data: {
            reglaId,
            titulo: `Sugerencia ${unico("t")}`,
            descripcion: "Descripción",
            categoria: "renovacion",
            prioridad: 80,
            sujetoTipo: datos.sujetoTipo === undefined ? "Suscripcion" : datos.sujetoTipo,
            sujetoId: datos.sujetoId === undefined ? unico("suj") : datos.sujetoId,
            datosContexto: { dedupKey: unico("k") },
            estado: datos.estado ?? "PENDIENTE",
            generadaEn,
            resueltaEn: datos.resueltaEn ?? null,
            expiraEn: new Date(generadaEn.getTime() + 7 * 86_400_000),
            ejecutadaAutomatica: datos.ejecutadaAutomatica ?? false,
        },
    });
}

const servicio = () => new AnalisisRecomendacionesService();

describe("AnalisisRecomendacionesService", () => {
    beforeEach(async () => {
        await resetDatabase();
        await sembrarParametros();
    });

    it("listar: paginación estándar, orden generadaEn desc e include de regla", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        for (let i = 0; i < 30; i++) {
            await crearRecomendacion(regla.id, {
                generadaEn: new Date(Date.UTC(2026, 7, 1, 12, 0, i)),
            });
        }

        const pagina1 = await servicio().listar({}, 1, 25);
        expect(pagina1.items).toHaveLength(25);
        expect(pagina1.pagination).toEqual({ page: 1, pageSize: 25, total: 30, totalPages: 2 });

        const pagina2 = await servicio().listar({}, 2, 25);
        expect(pagina2.items).toHaveLength(5);

        const [primero, segundo] = pagina1.items;
        expect(primero!.generadaEn > segundo!.generadaEn).toBe(true);
        expect(primero!.regla.clave).toBe(regla.clave);
        expect(primero!.regla.nombre).toBe(regla.nombre);
    });

    it("métricas: tasas sobre resueltas (8 ignoradas / 2 aplicadas → 80% / 20%), pendientes fuera del denominador", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        for (let i = 0; i < 2; i++) await crearRecomendacion(regla.id, { estado: "APLICADA", resueltaEn: new Date() });
        for (let i = 0; i < 8; i++) await crearRecomendacion(regla.id, { estado: "IGNORADA", resueltaEn: new Date() });
        for (let i = 0; i < 3; i++) await crearRecomendacion(regla.id, { estado: "PENDIENTE" });

        const m = await servicio().metricas({}, {});
        expect(m.totalGeneradas).toBe(13);
        expect(m.totalResueltas).toBe(10);
        expect(m.pendientes).toBe(3);
        expect(m.tasaAplicacionPct).toBe(20);
        expect(m.tasaIgnoradaPct).toBe(80);
        expect(m.tasaExpiradaPct).toBe(0);
    });

    it("métricas: tiempo promedio solo sobre resueltaEn no nula", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        const base = new Date("2026-08-20T00:00:00.000Z").getTime();
        await crearRecomendacion(regla.id, {
            estado: "APLICADA",
            generadaEn: new Date(base),
            resueltaEn: new Date(base + 10 * 3_600_000),
        });
        await crearRecomendacion(regla.id, {
            estado: "IGNORADA",
            generadaEn: new Date(base),
            resueltaEn: new Date(base + 20 * 3_600_000),
        });
        await crearRecomendacion(regla.id, { estado: "PENDIENTE", generadaEn: new Date(base) });

        const m = await servicio().metricas({}, {});
        expect(m.tiempoPromedioResolucionHoras).toBe(15);
    });

    it("métricas: sin resueltas las tasas y el promedio son null (UI muestra '—')", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        await crearRecomendacion(regla.id, { estado: "PENDIENTE" });

        const m = await servicio().metricas({}, {});
        expect(m.totalResueltas).toBe(0);
        expect(m.tasaAplicacionPct).toBeNull();
        expect(m.tasaIgnoradaPct).toBeNull();
        expect(m.tasaExpiradaPct).toBeNull();
        expect(m.tiempoPromedioResolucionHoras).toBeNull();
    });

    it("métricas: frontera de día calendario Bogotá (23:59 del día 'hasta' incluido, 00:00 del siguiente excluido)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        // 2026-08-25 04:30 UTC = 2026-08-24 23:30 Bogotá → dentro del día "hasta" 2026-08-24.
        await crearRecomendacion(regla.id, { generadaEn: new Date("2026-08-25T04:30:00.000Z") });
        // 2026-08-25 05:30 UTC = 2026-08-25 00:30 Bogotá → fuera.
        await crearRecomendacion(regla.id, { generadaEn: new Date("2026-08-25T05:30:00.000Z") });

        const filtros = resolverFiltros(filtrosHistorialSchema.parse({ desde: "2026-08-24", hasta: "2026-08-24" }));
        const m = await servicio().metricas(filtros, { desde: "2026-08-24", hasta: "2026-08-24" });
        expect(m.totalGeneradas).toBe(1);
        expect(m.rango).toEqual({ desde: "2026-08-24", hasta: "2026-08-24" });
    });

    it("métricas: porRegla ordenado por tasa de ignorada desc y marca sobreUmbralAlerta", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const reglaMala = await crearRegla(admin.id);
        const reglaBuena = await crearRegla(admin.id);
        // Regla mala: 8 ignoradas / 2 aplicadas → 80% > umbral 70.
        for (let i = 0; i < 8; i++) await crearRecomendacion(reglaMala.id, { estado: "IGNORADA", resueltaEn: new Date() });
        for (let i = 0; i < 2; i++) await crearRecomendacion(reglaMala.id, { estado: "APLICADA", resueltaEn: new Date() });
        // Regla buena: 10 aplicadas → 0% ignorada.
        for (let i = 0; i < 10; i++) await crearRecomendacion(reglaBuena.id, { estado: "APLICADA", resueltaEn: new Date() });

        const m = await servicio().metricas({}, {});
        expect(m.umbralAlertaIgnoradaPct).toBe(70);
        expect(m.porRegla.map((r) => r.reglaId)).toEqual([reglaMala.id, reglaBuena.id]);
        expect(m.porRegla[0]!.sobreUmbralAlerta).toBe(true);
        expect(m.porRegla[0]!.reglaClave).toBe(reglaMala.clave);
        expect(m.porRegla[1]!.sobreUmbralAlerta).toBe(false);
    });

    it("prepararExport: 413 PAYLOAD_TOO_LARGE cuando el conjunto supera el tope parametrizado", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        await prisma.parametroSistema.update({ where: { clave: CLAVE_EXPORT_MAX_FILAS }, data: { valor: "1" } });
        await crearRecomendacion(regla.id, {});
        await crearRecomendacion(regla.id, {});

        const error = await servicio()
            .prepararExport({})
            .catch((e: unknown) => e);
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).statusCode).toBe(413);
        expect((error as AppError).code).toBe("PAYLOAD_TOO_LARGE");
    });

    it("prepararExport: el dataset NO incluye título, descripción ni datosContexto", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearRegla(admin.id);
        await crearRecomendacion(regla.id, {});

        const { filas, total } = await servicio().prepararExport({});
        expect(total).toBe(1);
        const claves = Object.keys(filas[0] as object);
        expect(claves).not.toContain("titulo");
        expect(claves).not.toContain("descripcion");
        expect(claves).not.toContain("datosContexto");
        expect(claves).toContain("sujetoId");
        expect(filas[0]!.regla.clave).toBe(regla.clave);
    });

    it("registrarAuditoriaExport: crea AuditLog con acción, filtros y conteo (sin contenido)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");

        await servicio().registrarAuditoriaExport({
            usuarioId: admin.id,
            filtros: { estado: "IGNORADA", desde: "2026-08-01" },
            filasExportadas: 8,
            ipAddress: "127.0.0.1",
            userAgent: "test",
        });

        const log = await prisma.auditLog.findFirst({
            where: { accion: "RECOMENDACIONES_EXPORT_CSV", usuarioId: admin.id },
        });
        expect(log).not.toBeNull();
        const metadatos = log!.metadatos as { filtros: { estado: string }; filasExportadas: number };
        expect(metadatos.filtros.estado).toBe("IGNORADA");
        expect(metadatos.filasExportadas).toBe(8);
    });
});
