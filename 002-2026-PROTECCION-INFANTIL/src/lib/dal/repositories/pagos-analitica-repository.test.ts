/**
 * SPEC-218 (002-PI-118): tests de integración de PagosAnaliticaRepository
 * (queries de los 4 widgets + KPIs de la analítica dinero-vs-valor).
 * BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    EstadoPago,
    MetodoPago,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "./pagos-repository";
import { PagosAnaliticaRepository } from "./pagos-analitica-repository";

function nuevoEmail() {
    return `test-218-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
}

async function crearAdmin() {
    return prisma.usuario.create({
        data: {
            email: nuevoEmail(),
            passwordHash: "hash",
            rol: RolUsuario.ADMIN,
            estado: "activo",
        },
    });
}

async function crearUsuarioPadre() {
    return prisma.usuario.create({
        data: {
            email: nuevoEmail(),
            passwordHash: "hash",
            rol: RolUsuario.PARENT,
            estado: "activo",
        },
    });
}

async function crearPlan(adminId: string) {
    return new PagosRepository().crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_1,
        anio: 2026,
        nombre: "Plan test 218",
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

let correlativo = 0;

async function crearSuscripcionTest(
    repo: PagosRepository,
    planId: string,
    data: Partial<Parameters<PagosRepository["crearSuscripcion"]>[0]> = {}
) {
    correlativo += 1;
    return repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: planId,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-218-${Date.now()}-${correlativo}`,
        monedaLocal: "COP",
        paisCliente: "CO",
        ...data,
    });
}

async function crearPagoAutorizado(
    repo: PagosRepository,
    suscripcionId: string,
    montoNetoUSD: number,
    createdAt?: Date
) {
    return repo.crearPago({
        suscripcionId,
        duracionCubierta: DuracionPlan.MES_1,
        montoBaseUSD: montoNetoUSD,
        montoNetoUSD,
        tasaCambioAplicada: 4000,
        montoLocalPagado: montoNetoUSD * 4000,
        monedaLocal: "COP",
        metodoDeclarado: MetodoPago.TRANSFERENCIA,
        comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
        comprobanteMimeType: "image/jpeg",
        comprobanteHashSha256: "abc123",
        fechaReporte: createdAt ?? new Date(),
        estado: EstadoPago.AUTORIZADO,
        ...(createdAt ? { createdAt } : {}),
    });
}

describe("PagosAnaliticaRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("listarSuscripcionesVencenEntre: solo ACTIVA dentro de la ventana", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();
        const analitica = new PagosAnaliticaRepository();
        const ahora = new Date();

        const dentro = await crearSuscripcionTest(repo, plan.id, {
            fechaFin: new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000),
        });
        await crearSuscripcionTest(repo, plan.id, {
            fechaFin: new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000),
        });
        await crearSuscripcionTest(repo, plan.id, {
            estado: EstadoSuscripcion.SUSPENDIDA,
            fechaFin: new Date(ahora.getTime() + 3 * 24 * 60 * 60 * 1000),
        });

        const items = await analitica.listarSuscripcionesVencenEntre(
            ahora,
            new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000)
        );
        expect(items.map((s) => s.id)).toEqual([dentro.id]);
    });

    it("listarMoraLargaAntesDe: EN_GRACIA/SUSPENDIDA ya vencidas, más antigua primero", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();
        const analitica = new PagosAnaliticaRepository();
        const ahora = new Date();

        const mora40 = await crearSuscripcionTest(repo, plan.id, {
            estado: EstadoSuscripcion.SUSPENDIDA,
            fechaFin: new Date(ahora.getTime() - 40 * 24 * 60 * 60 * 1000),
        });
        const mora50 = await crearSuscripcionTest(repo, plan.id, {
            estado: EstadoSuscripcion.EN_GRACIA,
            fechaFin: new Date(ahora.getTime() - 50 * 24 * 60 * 60 * 1000),
        });
        // Morosa pero reciente (< 30 días): no aplica al corte.
        await crearSuscripcionTest(repo, plan.id, {
            estado: EstadoSuscripcion.SUSPENDIDA,
            fechaFin: new Date(ahora.getTime() - 10 * 24 * 60 * 60 * 1000),
        });
        // Activa aunque esté vencida hace mucho: no es mora.
        await crearSuscripcionTest(repo, plan.id, {
            estado: EstadoSuscripcion.ACTIVA,
            fechaFin: new Date(ahora.getTime() - 60 * 24 * 60 * 60 * 1000),
        });

        const items = await analitica.listarMoraLargaAntesDe(new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000));
        expect(items.map((s) => s.id)).toEqual([mora50.id, mora40.id]);
    });

    it("listarPadresPagantesColegiosNoRenovados: padre ACTIVO con colegio del tenant caído", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();
        const analitica = new PagosAnaliticaRepository();
        const { colegio, tenant } = await crearColegioConAdmin();

        await crearSuscripcionTest(repo, plan.id, {
            tipoTitular: TipoTitular.COLEGIO,
            colegioId: colegio.id,
            estado: EstadoSuscripcion.SUSPENDIDA,
        });
        const padre = await prisma.usuario.create({
            data: {
                email: nuevoEmail(),
                passwordHash: "hash",
                rol: RolUsuario.PARENT,
                estado: "activo",
                tenantId: tenant.id,
            },
        });
        const subPadre = await crearSuscripcionTest(repo, plan.id, { usuarioId: padre.id });

        // Negativo: padre activo sin tenant (su colegio no está caído).
        const padreLibre = await crearUsuarioPadre();
        await crearSuscripcionTest(repo, plan.id, { usuarioId: padreLibre.id });

        const items = await analitica.listarPadresPagantesColegiosNoRenovados();
        expect(items).toHaveLength(1);
        expect(items[0].id).toBe(subPadre.id);
        expect(items[0].usuario?.tenant?.colegio?.id).toBe(colegio.id);
        expect(items[0].usuario?.tenant?.colegio?.suscripciones[0]?.estado).toBe(EstadoSuscripcion.SUSPENDIDA);
    });

    it("listarAltasPorPaisDesde: solo altas desde el corte", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();
        const analitica = new PagosAnaliticaRepository();

        await crearSuscripcionTest(repo, plan.id, { paisCliente: "CO" });
        await crearSuscripcionTest(repo, plan.id, {
            paisCliente: "CL",
            createdAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        });

        const items = await analitica.listarAltasPorPaisDesde(new Date(Date.now() - 200 * 24 * 60 * 60 * 1000));
        expect(items).toHaveLength(1);
        expect(items[0].paisCliente).toBe("CO");
    });

    it("obtenerKpiAnalitica: agregados por rango de mes", async () => {
        const admin = await crearAdmin();
        const plan = await crearPlan(admin.id);
        const repo = new PagosRepository();
        const analitica = new PagosAnaliticaRepository();
        const ahora = new Date();
        const hace30 = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);
        const mesActual = {
            inicio: new Date(ahora.getTime() - 15 * 24 * 60 * 60 * 1000),
            fin: new Date(ahora.getTime() + 15 * 24 * 60 * 60 * 1000),
        };
        const mesAnterior = { inicio: new Date(ahora.getTime() - 45 * 24 * 60 * 60 * 1000), fin: mesActual.inicio };

        // Nueva del mes: creada ahora, pago autorizado de 100 ahora.
        const subNueva = await crearSuscripcionTest(repo, plan.id);
        await crearPagoAutorizado(repo, subNueva.id, 100);

        // Renovación: creada hace 30 días, pago de 70 hace 30 días y pago de 50 ahora.
        const subVieja = await crearSuscripcionTest(repo, plan.id, {
            createdAt: hace30,
            esFreemium: true,
            codigoReferidoUsado: "REF-ORIGEN",
        });
        await crearPagoAutorizado(repo, subVieja.id, 70, hace30);
        await crearPagoAutorizado(repo, subVieja.id, 50);

        const kpi = await analitica.obtenerKpiAnalitica({ mesActual, mesAnterior });
        expect(kpi.recaudoMesActualUSD).toBe(150);
        expect(kpi.recaudoMesAnteriorUSD).toBe(70);
        expect(kpi.nuevasEsteMes).toBe(1);
        expect(kpi.renovacionesEsteMes).toBe(1);
        expect(kpi.ticketPromedioMesUSD).toBe(75);
        expect(kpi.recaudoTotalUSD).toBe(220);
        expect(kpi.suscripcionesPagantes).toBe(2);
        expect(kpi.freemiumTotal).toBe(1);
        expect(kpi.freemiumConvertidas).toBe(1);
        expect(kpi.conCodigoReferido).toBe(1);
        expect(kpi.totalSuscripciones).toBe(2);
        expect(kpi.conteoPorEstado).toEqual([{ estado: EstadoSuscripcion.ACTIVA, total: 2 }]);
    });
});
