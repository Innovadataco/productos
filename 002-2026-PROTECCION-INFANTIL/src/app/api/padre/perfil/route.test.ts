/**
 * SPEC-339 (A-67 · T051/T074/T079) — PATCH /api/padre/perfil.
 *
 * Documento del padre entra; y al guardar, la cookie de estado sale RE-SELLADA
 * en la misma respuesta — la prueba de que el padre no se atasca en el Paso 2.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    sellarCookieSesionEstado: vi.fn(),
    // SPEC-590: el aviso de cambio de email pasa por el motor de notificaciones;
    // en test no hay reglas sembradas (resetDatabase trunca todo) y el envío es
    // colateral al cambio — se aisla para afirmar que SÍ se dispara.
    enviarAvisoCambioEmail: vi.fn(),
}));

vi.mock("@/lib/routing/sellar-sesion-estado", () => ({
    sellarCookieSesionEstado: mocks.sellarCookieSesionEstado,
}));

vi.mock("@/lib/email-padre", () => ({
    enviarAvisoCambioEmail: mocks.enviarAvisoCambioEmail,
}));

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

import { PATCH, GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

function crearRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/padre/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/padre/perfil (SPEC-339)", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        vi.clearAllMocks();
        mocks.sellarCookieSesionEstado.mockResolvedValue(true);
        mocks.enviarAvisoCambioEmail.mockResolvedValue(undefined);
    });

    async function comoPadre() {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        return padre;
    }

    it("guarda tipo y número de documento del padre", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ documentoTipo: "CC", documentoNumero: "79123456" }));
        expect(res.status).toBe(200);
        const enBd = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(enBd?.documentoTipo).toBe("CC");
        expect(enBd?.documentoNumero).toBe("79123456");
    });

    it("rechaza un tipo de documento fuera del set", async () => {
        await comoPadre();
        const res = await PATCH(crearRequest({ documentoTipo: "XX", documentoNumero: "123456" }));
        expect(res.status).toBe(400);
    });

    // T074: la prueba de que el padre no se atasca en el Paso 2.
    it("al guardar, RE-SELLA la cookie de estado en la misma respuesta", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ nombre: "Carlos" }));
        expect(res.status).toBe(200);
        expect(mocks.sellarCookieSesionEstado).toHaveBeenCalledOnce();
        expect(mocks.sellarCookieSesionEstado.mock.calls[0][1]).toBe(padre.id);
    });

    // T079 (Calidad · R1-8): el sellado fallido no es silencioso.
    it("SELLADO FALLIDO: el dato queda guardado y el padre recibe el aviso", async () => {
        mocks.sellarCookieSesionEstado.mockResolvedValue(false);
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ nombre: "Carlos" }));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.aviso).toContain("recárgala");
        expect((await prisma.usuario.findUnique({ where: { id: padre.id } }))?.nombre).toBe("Carlos");
    });

    // Calidad (SPEC-342): el fallo del sellado como EXCEPCIÓN, no solo false.
    it("SELLADO QUE LANZA: el dato queda guardado y el padre recibe el aviso", async () => {
        mocks.sellarCookieSesionEstado.mockRejectedValue(new Error("selló mal"));
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ nombre: "Ana" }));
        // La ruta no debe reventar en 500 por el sellado: el dato ya está.
        expect(res.status).toBe(200);
        expect((await prisma.usuario.findUnique({ where: { id: padre.id } }))?.nombre).toBe("Ana");
    });

    it("GET devuelve el documento junto al resto del perfil", async () => {
        const padre = await comoPadre();
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { documentoTipo: "CE", documentoNumero: "555444" },
        });
        const res = await GET();
        const json = await res.json();
        expect(json.perfil.documentoTipo).toBe("CE");
        expect(json.perfil.documentoNumero).toBe("555444");
    });

    it("fechaNacimiento se sigue ACEPTANDO (el campo vive) aunque el camino no la pida", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ fechaNacimiento: "1990-05-10" }));
        expect(res.status).toBe(200);
        expect((await prisma.usuario.findUnique({ where: { id: padre.id } }))?.fechaNacimiento).not.toBeNull();
    });

    // SPEC-440 P5 (Jelkin vivo 04-09) · «que no le vuelva a pedir la presentación
    // en cada ingreso». El endpoint acepta y persiste presentación + urgencia
    // estándar; el GET los devuelve para prellenar el form del padre en la
    // próxima visita a /dashboard/padre/profesionales.
    it("SPEC-440 P5: PATCH persiste presentacionEstandar y urgenciaEstandar", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({
            presentacionEstandar: "Buscamos apoyo para un hijo de 12 años.",
            urgenciaEstandar: "ESTA_SEMANA",
        }));
        expect(res.status).toBe(200);
        const guardado = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(guardado?.presentacionEstandar).toBe("Buscamos apoyo para un hijo de 12 años.");
        expect(guardado?.urgenciaEstandar).toBe("ESTA_SEMANA");
    });

    it("SPEC-440 P5: GET devuelve presentacionEstandar y urgenciaEstandar del perfil", async () => {
        const padre = await comoPadre();
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { presentacionEstandar: "Necesito hablar con alguien pronto.", urgenciaEstandar: "SIN_APURO" },
        });
        const res = await GET();
        const json = await res.json();
        expect(json.perfil.presentacionEstandar).toBe("Necesito hablar con alguien pronto.");
        expect(json.perfil.urgenciaEstandar).toBe("SIN_APURO");
    });

    it("SPEC-440 P5: rechaza urgenciaEstandar fuera del enum", async () => {
        await comoPadre();
        const res = await PATCH(crearRequest({ urgenciaEstandar: "URGENTE" }));
        expect(res.status).toBe(400);
    });

    it("SPEC-440 P5: rechaza presentacionEstandar de menos de 10 caracteres", async () => {
        await comoPadre();
        const res = await PATCH(crearRequest({ presentacionEstandar: "corta" }));
        expect(res.status).toBe(400);
    });

    // ── SPEC-590 (decisión CEO 06-09): email editable + historial de cambios ──

    it("SPEC-590: guarda el email nuevo normalizado a minúsculas y avisa al buzón nuevo", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ email: "Nuevo@Mail.COM" }));
        expect(res.status).toBe(200);
        const enBd = await prisma.usuario.findUnique({ where: { id: padre.id } });
        expect(enBd?.email).toBe("nuevo@mail.com");
        expect(mocks.enviarAvisoCambioEmail).toHaveBeenCalledWith("nuevo@mail.com");
    });

    it("SPEC-590: 409 cuando el email lo tiene OTRO usuario", async () => {
        await comoPadre();
        await crearUsuario("PARENT", "ocupado@example.com");
        const res = await PATCH(crearRequest({ email: "ocupado@example.com" }));
        expect(res.status).toBe(409);
        expect(mocks.enviarAvisoCambioEmail).not.toHaveBeenCalled();
    });

    it("SPEC-590: aceptar su propio email no escribe auditoría ni dispara aviso", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ email: padre.email }));
        expect(res.status).toBe(200);
        const auditoria = await prisma.auditLog.count({
            where: { usuarioId: padre.id, accion: "PERFIL_CAMBIO" },
        });
        expect(auditoria).toBe(0);
        expect(mocks.enviarAvisoCambioEmail).not.toHaveBeenCalled();
    });

    it("SPEC-590: rechaza un email inválido", async () => {
        await comoPadre();
        const res = await PATCH(crearRequest({ email: "no-es-un-correo" }));
        expect(res.status).toBe(400);
    });

    it("SPEC-590: cada campo cambiado escribe una fila AuditLog PERFIL_CAMBIO con anterior→nuevo", async () => {
        const padre = await comoPadre();
        const res = await PATCH(crearRequest({ telefono: "+57 300 123 4567" }));
        expect(res.status).toBe(200);
        const filas = await prisma.auditLog.findMany({
            where: { usuarioId: padre.id, accion: "PERFIL_CAMBIO" },
        });
        expect(filas).toHaveLength(1);
        expect(JSON.parse(filas[0].valorAnterior ?? "{}")).toEqual({ campo: "telefono", valor: null });
        expect(JSON.parse(filas[0].valorNuevo ?? "{}")).toEqual({ campo: "telefono", valor: "+57 300 123 4567" });
    });

    it("SPEC-590: un PATCH sin cambios no escribe auditoría", async () => {
        const padre = await comoPadre();
        // paisId ya es null: null→null no es un cambio.
        const res = await PATCH(crearRequest({ paisId: null }));
        expect(res.status).toBe(200);
        const filas = await prisma.auditLog.findMany({
            where: { usuarioId: padre.id, accion: "PERFIL_CAMBIO" },
        });
        expect(filas).toHaveLength(0);
    });

    it("SPEC-590: GET devuelve el email del perfil", async () => {
        const padre = await comoPadre();
        const res = await GET();
        const json = await res.json();
        expect(json.perfil.email).toBe(padre.email);
    });
});
