/**
 * SPEC-135 (E-2, F2): prueba del fix N+1 — `listarContactos` ejecuta ≤ 3 queries
 * constantes (1 de contactos+identificadores + 1 de reportes) con CUALQUIER número
 * de contactos, y devuelve EXACTAMENTE la semántica anterior (estados, conteos y
 * resumen). Incluye el candado FR-004 de `notificarCambioCirculoSiCorresponde`
 * (una sola query de reportes para varios usuarios notificados).
 *
 * Mecanismo de conteo: mock de `@/lib/prisma` con un Proxy transparente sobre el
 * cliente real que cuenta `findMany` por modelo (los delegates de Prisma 5 viven
 * tras getters y no soportan `vi.spyOn`; el Proxy envuelve cada acceso).
 * El contador se reinicia tras la siembra: solo cuentan las queries del SUT.
 */
import { describe, it, expect, beforeEach, vi, afterAll } from "vitest";
import { unmockPrisma } from "@/lib/test-mocks/unmock-prisma";

const conteo = vi.hoisted(() => ({
    contactoConfianzaFindMany: 0,
    reporteFindMany: 0,
    identificadorContactoFindMany: 0,
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
    const mod = await importOriginal<typeof import("@/lib/prisma")>();
    const envolverDelegado = (delegado: unknown, contador: () => void) =>
        new Proxy(delegado as object, {
            get(target, prop) {
                const valor = Reflect.get(target, prop);
                if (prop !== "findMany" || typeof valor !== "function") return valor;
                return (...args: unknown[]) => {
                    contador();
                    return (valor as (...a: unknown[]) => unknown).apply(target, args);
                };
            },
        });
    const contado = new Proxy(mod.prisma, {
        get(target, prop) {
            const valor = Reflect.get(target, prop);
            if (prop === "contactoConfianza") return envolverDelegado(valor, () => conteo.contactoConfianzaFindMany++);
            if (prop === "reporte") return envolverDelegado(valor, () => conteo.reporteFindMany++);
            if (prop === "identificadorContacto") return envolverDelegado(valor, () => conteo.identificadorContactoFindMany++);
            return valor;
        },
    });
    return { ...mod, prisma: contado };
});

vi.mock("@/lib/email", () => ({
    enviarAlertaCirculoConfianza: vi.fn().mockResolvedValue(undefined),
}));

afterAll(() => unmockPrisma());

import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { listarContactos, agregarContacto, obtenerDetalleContacto, notificarCambioCirculoSiCorresponde } from "./circulo-confianza";
import { crearUsuario, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { enviarAlertaCirculoConfianza } from "@/lib/email";
import type { CategoriaConducta, EstadoReporte } from "@prisma/client";

function reiniciarConteo() {
    conteo.contactoConfianzaFindMany = 0;
    conteo.reporteFindMany = 0;
    conteo.identificadorContactoFindMany = 0;
}

async function crearReporte(identificador: string, plataformaId: string, estado: EstadoReporte, categoria?: CategoriaConducta) {
    const reporte = await prisma.reporte.create({
        data: {
            identificador,
            plataformaId,
            texto: "Texto de prueba N+1",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado,
        },
    });
    if (categoria) {
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria,
                confianza: 0.8,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
    }
    return reporte;
}

describe("SPEC-135 · listarContactos sin N+1", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        await crearPaisCiudad();
    });

    it("≤ 3 queries constantes con varios contactos Y misma semántica (estados, conteos, resumen)", async () => {
        const usuario = await crearUsuario("PARENT");
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // 4 contactos: sin reportes, clasificado (2 reportes), en revisión, inhabilitado
        const cSin = await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300N1A", plataformaId: plataforma.id }] });
        const cClas = await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300N1B", plataformaId: plataforma.id }] });
        const cRev = await agregarContacto(usuario.id, {
            identificadores: [
                { valor: "+57300N1C", plataformaId: plataforma.id },
                { valor: "+57300N1C2", plataformaId: plataforma.id },
            ],
        });
        const cInactivo = await agregarContacto(usuario.id, { identificadores: [{ valor: "+57300N1D", plataformaId: plataforma.id }] });
        await prisma.contactoConfianza.update({ where: { id: cInactivo.id }, data: { activo: false } });
        await crearReporte("+57300N1B", plataforma.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
        await crearReporte("+57300N1B", plataforma.id, "CLASIFICADO", "EXTORSION");
        await crearReporte("+57300N1C2", plataforma.id, "REVISION_MANUAL");

        reiniciarConteo();
        const { contactos, resumen } = await listarContactos(usuario.id);

        // Candado de queries: 1 (contactos+identificadores) + 1 (reportes) + 0 extra
        expect(conteo.contactoConfianzaFindMany, "una sola query de contactos").toBe(1);
        expect(conteo.reporteFindMany, "UNA sola query de reportes para TODOS los contactos").toBe(1);
        expect(conteo.identificadorContactoFindMany, "cero queries extra de identificadores (ya venían en la inicial)").toBe(0);
        const totalQueries = conteo.contactoConfianzaFindMany + conteo.reporteFindMany + conteo.identificadorContactoFindMany;
        expect(totalQueries, "≤ 3 queries constantes (independiente del número de contactos)").toBeLessThanOrEqual(3);

        // Misma semántica que la versión por contacto
        expect(contactos).toHaveLength(4);
        const porId = new Map(contactos.map((c) => [c.id, c]));
        expect(porId.get(cSin.id)!.estado).toBe("sinReportes");
        expect(porId.get(cSin.id)!.totalReportes).toBe(0);
        expect(porId.get(cClas.id)!.estado).toBe("clasificado");
        expect(porId.get(cClas.id)!.totalReportes).toBe(2);
        expect(porId.get(cRev.id)!.estado).toBe("enRevision");
        expect(porId.get(cRev.id)!.totalReportes).toBe(1);

        expect(resumen.activos).toBe(3);
        expect(resumen.inhabilitados).toBe(1);
        expect(resumen.sinReportes).toBe(1);
        expect(resumen.clasificado).toBe(1);
        expect(resumen.enRevision).toBe(1);
    });

    it("sin identificadores no dispara la query de reportes", async () => {
        const usuario = await crearUsuario("PARENT");

        reiniciarConteo();
        const { contactos, resumen } = await listarContactos(usuario.id);

        expect(contactos).toHaveLength(0);
        expect(resumen.activos).toBe(0);
        expect(conteo.reporteFindMany, "sin valores no hay query de reportes").toBe(0);
    });

    it("obtenerDetalleContacto con varios identificadores: queries constantes y mismos datos (FR-004)", async () => {
        const usuario = await crearUsuario("PARENT");
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;

        // Un contacto con 3 identificadores: uno clasificado (2 reportes), uno en revisión, uno sin reportes
        const contacto = await agregarContacto(usuario.id, {
            etiqueta: "Detalle N+1",
            identificadores: [
                { valor: "+57300DET-A", plataformaId: plataforma.id },
                { valor: "+57300DET-B", plataformaId: plataforma.id },
                { valor: "+57300DET-C", plataformaId: plataforma.id },
            ],
        });
        await crearReporte("+57300DET-A", plataforma.id, "CLASIFICADO", "SOLICITUD_MATERIAL");
        await crearReporte("+57300DET-A", plataforma.id, "CLASIFICADO", "EXTORSION");
        await crearReporte("+57300DET-B", plataforma.id, "REVISION_MANUAL");

        reiniciarConteo();
        const detalle = await obtenerDetalleContacto(contacto.id, usuario.id);

        // Candado de queries CONSTANTES de datos: 1 findMany de contactos NO aplica aquí
        // (el detalle usa findFirst), 1 de identificadores y UNA de reportes para TODOS
        // los identificadores (antes: 1 + N — una por identificador).
        expect(conteo.reporteFindMany, "UNA sola query de reportes para todos los identificadores").toBe(1);
        expect(conteo.identificadorContactoFindMany, "una sola query de identificadores").toBe(1);

        // Mismo resultado por construcción: estado, conteos y reportes por identificador
        expect(detalle.estado).toBe("enRevision");
        expect(detalle.totalReportes).toBe(3);
        expect(detalle.identificadores).toHaveLength(3);
        const porValor = new Map(detalle.identificadores.map((i) => [i.valor, i]));
        expect(porValor.get("+57300DET-A")!.estado).toBe("clasificado");
        expect(porValor.get("+57300DET-A")!.totalReportes).toBe(2);
        expect(porValor.get("+57300DET-A")!.reportes.map((r) => r.identificador)).toEqual(["+57300DET-A", "+57300DET-A"]);
        expect(porValor.get("+57300DET-B")!.estado).toBe("enRevision");
        expect(porValor.get("+57300DET-B")!.totalReportes).toBe(1);
        expect(porValor.get("+57300DET-C")!.estado).toBe("sinReportes");
        expect(porValor.get("+57300DET-C")!.totalReportes).toBe(0);
        expect(porValor.get("+57300DET-C")!.reportes).toEqual([]);
        expect(detalle.agregado, "con reportes hay agregado").not.toBeNull();
        expect(detalle.agregado!.totalReportes).toBe(3);
    });
});

describe("SPEC-135 · notificarCambioCirculoSiCorresponde sin N+1 (FR-004)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma("whatsapp", "WhatsApp", "mensajeria");
        await crearPaisCiudad();
        await prisma.parametroSistema.createMany({
            data: [
                { clave: "circulo.notificaciones.enabled", valor: "true", tipo: "BOOLEAN", categoria: "EMAIL", esPublico: false },
                { clave: "circulo.notificaciones.cooldown_horas", valor: "24", tipo: "INTEGER", categoria: "EMAIL", esPublico: false },
            ],
        });
        vi.mocked(enviarAlertaCirculoConfianza).mockClear();
    });

    it("UNA sola query de reportes para dos usuarios notificados (mismo resultado: ambos reciben el email)", async () => {
        const plataforma = (await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } }))!;
        const usuario1 = await crearUsuario("PARENT", "n1-u1@test.local");
        const usuario2 = await crearUsuario("PARENT", "n1-u2@test.local");
        await agregarContacto(usuario1.id, { identificadores: [{ valor: "+57300N1SHARED", plataformaId: plataforma.id }] });
        await agregarContacto(usuario2.id, { identificadores: [{ valor: "+57300N1SHARED", plataformaId: plataforma.id }] });
        const reporte = await crearReporte("+57300N1SHARED", plataforma.id, "CLASIFICADO", "SOLICITUD_MATERIAL");

        reiniciarConteo();
        await notificarCambioCirculoSiCorresponde(reporte.id);

        // El conteo de novedades por usuario era 1 query POR usuario (N+1); ahora es UNA global
        expect(conteo.reporteFindMany, "una sola query de reportes para todos los usuarios candidatos").toBe(1);
        // Mismo resultado: ambos usuarios notificados y su timestamp actualizado
        expect(enviarAlertaCirculoConfianza).toHaveBeenCalledTimes(2);
        const destinos = vi.mocked(enviarAlertaCirculoConfianza).mock.calls.map((c) => c[0]).sort();
        expect(destinos).toEqual([usuario1.email, usuario2.email].sort());
        for (const u of [usuario1, usuario2]) {
            const actualizado = await prisma.usuario.findUnique({ where: { id: u.id }, select: { ultimaNotificacionCirculoEn: true } });
            expect(actualizado?.ultimaNotificacionCirculoEn).not.toBeNull();
        }
    });
});
