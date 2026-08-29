/**
 * SPEC-237 (002-PI-mega-cola): tests de integración de los endpoints de
 * consolidación del comité (bandeja, detalle, aprobar, corregir, devolver).
 * Cubre T012/T031/T033/T034/T035/T037/T038: aprobación multi-miembro con
 * transición exactamente al umbral, corrección append-only, devolución con
 * motivo obligatorio y control estricto de rol (COMITE muta, ADMIN lee,
 * PARENT no accede).
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { EstadoExpediente } from "@prisma/client";
import { GET as GETLista } from "./route";
import { GET as GETDetalle } from "./[expedienteId]/route";
import { POST as POSTAprobar } from "./[expedienteId]/aprobar/route";
import { POST as POSTCorregir } from "./[expedienteId]/corregir/route";
import { POST as POSTDevolver } from "./[expedienteId]/devolver/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

// Motor Notif no debe frenar la aprobación: se simula la API estricta.
vi.mock("@/lib/notificaciones", () => ({
    programar: vi.fn(async () => ({ programadas: 1, canceladasPorReemplazo: 0 })),
}));

const BASE = "http://localhost:5005/api/admin/comite/consolidacion";

async function seedParametros(miembrosMinimos = 2) {
    for (const p of [
        { clave: "padre.comite.miembros_minimos_aprobacion", valor: String(miembrosMinimos) },
        { clave: "padre.comite.sla_horas_consolidacion", valor: "72" },
    ]) {
        await prisma.parametroSistema.upsert({
            where: { clave: p.clave },
            update: { valor: p.valor },
            create: {
                clave: p.clave,
                valor: p.valor,
                tipo: "INTEGER",
                categoria: "SYSTEM",
                esPublico: false,
                descripcion: "test",
            },
        });
    }
}

async function crearExpedienteConInforme(
    padreId: string,
    estadoExpediente: EstadoExpediente = EstadoExpediente.PENDIENTE_COMITE
) {
    const expediente = await prisma.expediente.create({
        data: {
            padreUsuarioId: padreId,
            identificadorReportado: `+57300${Math.floor(Date.now() % 10000000)}`,
            fechaApertura: new Date(),
            estado: estadoExpediente,
            numEventos: 3,
            categoriasDominantesJson: ["CONTACTO_INSISTENTE"],
        },
    });
    const informe = await prisma.informeConsolidado.create({
        data: {
            expedienteId: expediente.id,
            versionSecuencial: 1,
            scoreValor: 10,
            scoreGravedad: "VERDE",
            categoriasDetectadasJson: { CONTACTO_INSISTENTE: 3 },
            resumenTextoGenerado: "Resumen consolidado de prueba",
            estadoAprobacion: "PENDIENTE_COMITE",
        },
    });
    return { expediente, informe };
}

function request(url: string, init?: RequestInit): Request {
    return new Request(url, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
}

function paramsDe(expedienteId: string) {
    return { params: Promise.resolve({ expedienteId }) };
}

async function comoComite(nombre = "Comité") {
    const usuario = await crearUsuario("COMITE_VALIDACION");
    await prisma.usuario.update({ where: { id: usuario.id }, data: { nombre } });
    mockToken = await crearTokenUsuario(usuario.id, "COMITE_VALIDACION");
    return usuario;
}

describe("API consolidación del comité (SPEC-237)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await seedParametros();
        mockToken = undefined;
    });

    afterAll(async () => {
        await prisma.$disconnect();
    });

    it("GET lista devuelve solo pendientes de consolidación con SLA y paginación", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteConInforme(padre.id);
        // Un informe devuelto no debe aparecer.
        await prisma.informeConsolidado.update({
            where: { id: informe.id },
            data: { estadoAprobacion: "PENDIENTE_COMITE" },
        });
        await comoComite();

        const res = await GETLista(request(`${BASE}?page=1&pageSize=25`));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].expedienteId).toBe(expediente.id);
        expect(json.items[0].tipo).toBe("CONSOLIDACION_EXPEDIENTE");
        expect(json.items[0].sla.color).toMatch(/pino|ambar|rubi/);
        expect(json.items[0].aprobacionesRequeridas).toBe(2);
        expect(json.pagination.total).toBe(1);
    });

    it("GET lista rechaza a PARENT con 403", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await GETLista(request(BASE));
        expect(res.status).toBe(403);
    });

    it("GET detalle ensambla informe, expediente, patrones y permisos por rol", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteConInforme(padre.id);
        await prisma.patronExpediente.create({
            data: {
                expedienteId: expediente.id,
                tipoPatron: "ACELERACION",
                severidad: "ALTA",
                nivelConfianza: 0.9,
                descripcionTexto: "Aceleración de reportes",
                datosContextoJson: {},
                detectadoEn: new Date(),
            },
        });

        // COMITE puede actuar.
        await comoComite();
        const resComite = await GETDetalle(request(`${BASE}/${expediente.id}`), paramsDe(expediente.id));
        expect(resComite.status).toBe(200);
        const detalleComite = await resComite.json();
        expect(detalleComite.informe.estadoAprobacion).toBe("PENDIENTE_COMITE");
        expect(detalleComite.patrones).toHaveLength(1);
        expect(detalleComite.permisos.puedeAprobar).toBe(true);

        // ADMIN lee pero no puede actuar.
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const resAdmin = await GETDetalle(request(`${BASE}/${expediente.id}`), paramsDe(expediente.id));
        expect(resAdmin.status).toBe(200);
        const detalleAdmin = await resAdmin.json();
        expect(detalleAdmin.permisos.puedeAprobar).toBe(false);
        expect(detalleAdmin.permisos.puedeDevolver).toBe(false);
    });

    it("aprobación multi-miembro: 1/2 no transiciona, 2/2 transiciona y publica el evento, 3/2 se ignora", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteConInforme(padre.id);

        // Miembro 1: registra voto, sin transición.
        const m1 = await comoComite("Ana");
        const r1 = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        expect(r1.status).toBe(200);
        const j1 = await r1.json();
        expect(j1.aprobo).toBe(false);
        expect(j1.aprobacionesActuales).toBe(1);
        let exp = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(exp?.estado).toBe(EstadoExpediente.PENDIENTE_COMITE);

        // Miembro 1 duplicado: 409.
        const rDup = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        expect(rDup.status).toBe(409);

        // Miembro 2: alcanza el umbral → transición + evento (exactamente una vez).
        await comoComite("Luis");
        const r2 = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        expect(r2.status).toBe(200);
        const j2 = await r2.json();
        expect(j2.aprobo).toBe(true);
        expect(j2.evento).toBe("expediente.comite.aprobo");
        expect(j2.transicion.estadoNuevo).toBe(EstadoExpediente.EN_APROBACION_PADRE);
        exp = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(exp?.estado).toBe(EstadoExpediente.EN_APROBACION_PADRE);

        // Miembro 3: voto excedente ignorado, sin doble transición.
        await comoComite("Sara");
        const r3 = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        expect(r3.status).toBe(200);
        const j3 = await r3.json();
        expect(j3.aprobo).toBe(false);
        expect(j3.yaAprobado).toBe(true);

        const informeFinal = await prisma.informeConsolidado.findUnique({ where: { id: informe.id } });
        expect(Array.isArray(informeFinal?.aprobadoPorMiembrosJson)).toBe(true);
        expect((informeFinal?.aprobadoPorMiembrosJson as unknown[]).length).toBe(2);
        expect(m1.id).toBeTruthy();
    });

    it("POST aprobar rechaza a ADMIN y PARENT con 403", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteConInforme(padre.id);

        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const rAdmin = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        expect(rAdmin.status).toBe(403);

        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const rParent = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        expect(rParent.status).toBe(403);
    });

    it("corregir añade snapshot append-only, deja CORREGIDO y luego aprueba por umbral", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente, informe } = await crearExpedienteConInforme(padre.id);
        await comoComite("Ana");

        const rCorr = await POSTCorregir(
            request(`${BASE}/${expediente.id}/corregir`, {
                method: "POST",
                body: JSON.stringify({ resumenTextoGenerado: "Texto corregido", motivo: "Ajuste redacción" }),
            }),
            paramsDe(expediente.id)
        );
        expect(rCorr.status).toBe(200);
        const jCorr = await rCorr.json();
        expect(jCorr.informe.estadoAprobacion).toBe("CORREGIDO");
        expect(jCorr.informe.correcciones).toHaveLength(1);

        // Texto vacío: 400 por Zod antes de tocar la BD.
        const rVacio = await POSTCorregir(
            request(`${BASE}/${expediente.id}/corregir`, {
                method: "POST",
                body: JSON.stringify({ resumenTextoGenerado: "", motivo: "x" }),
            }),
            paramsDe(expediente.id)
        );
        expect(rVacio.status).toBe(400);

        // El informe CORREGIDO igual puede aprobarse por umbral (2 miembros).
        await comoComite("Ana2");
        await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        await comoComite("Luis");
        const rAprobo = await POSTAprobar(request(`${BASE}/${expediente.id}/aprobar`, { method: "POST", body: "{}" }), paramsDe(expediente.id));
        const jAprobo = await rAprobo.json();
        expect(jAprobo.aprobo).toBe(true);
        const exp = await prisma.expediente.findUnique({ where: { id: expediente.id } });
        expect(exp?.estado).toBe(EstadoExpediente.EN_APROBACION_PADRE);

        const correcciones = await prisma.informeConsolidado.findUnique({ where: { id: informe.id } });
        expect((correcciones?.correccionesJson as unknown[]).length).toBe(1);
    });

    it("devolver sin motivo es 400; con motivo pasa a DEVUELTO y sale de la bandeja", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteConInforme(padre.id);
        await comoComite();

        const rSin = await POSTDevolver(
            request(`${BASE}/${expediente.id}/devolver`, { method: "POST", body: JSON.stringify({ motivo: "" }) }),
            paramsDe(expediente.id)
        );
        expect(rSin.status).toBe(400);

        const rCon = await POSTDevolver(
            request(`${BASE}/${expediente.id}/devolver`, {
                method: "POST",
                body: JSON.stringify({ motivo: "Falta evidencia de respaldo" }),
            }),
            paramsDe(expediente.id)
        );
        expect(rCon.status).toBe(200);
        const jCon = await rCon.json();
        expect(jCon.informe.estadoAprobacion).toBe("DEVUELTO");
        expect(jCon.informe.motivoDevolucion).toBe("Falta evidencia de respaldo");

        const resLista = await GETLista(request(BASE));
        const lista = await resLista.json();
        expect(lista.items).toHaveLength(0);

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "INFORME_CONSOLIDADO_DEVUELTO" },
        });
        expect(audit).not.toBeNull();
    });

    it("devolver también exige rol COMITE_VALIDACION", async () => {
        const padre = await crearUsuario("PARENT");
        const { expediente } = await crearExpedienteConInforme(padre.id);
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POSTDevolver(
            request(`${BASE}/${expediente.id}/devolver`, {
                method: "POST",
                body: JSON.stringify({ motivo: "Motivo" }),
            }),
            paramsDe(expediente.id)
        );
        expect(res.status).toBe(403);
    });
});
