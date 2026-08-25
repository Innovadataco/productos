import { describe, it, expect, beforeEach } from "vitest";
import { requiereConsentimientoActual } from "./guard";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario } from "@/lib/reporte-test-utils";
import { crearParametrosConsentimiento } from "@/lib/consentimiento-test-utils";

describe("requiereConsentimientoActual (SPEC-241)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosConsentimiento();
    });

    it("retorna true cuando el usuario no ha aceptado consentimiento", async () => {
        const padre = await crearUsuario("PARENT");
        const resultado = await requiereConsentimientoActual(padre.id);
        expect(resultado).toBe(true);
    });

    it("retorna false cuando el usuario ya aceptó la versión vigente", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: {
                consentimientoVersion: "v0.4",
                consentimientoAceptadoEn: new Date(),
                consentimientoDocumentoHash: "hash",
                consentimientoIP: "127.0.0.1",
            },
        });

        const resultado = await requiereConsentimientoActual(padre.id);
        expect(resultado).toBe(false);
    });

    it("retorna true cuando la versión vigente cambió después de aceptar", async () => {
        const padre = await crearUsuario("PARENT");
        await prisma.usuario.update({
            where: { id: padre.id },
            data: {
                consentimientoVersion: "v0.3",
                consentimientoAceptadoEn: new Date(),
                consentimientoDocumentoHash: "hash",
                consentimientoIP: "127.0.0.1",
            },
        });

        const resultado = await requiereConsentimientoActual(padre.id);
        expect(resultado).toBe(true);
    });

    it("retorna false (fail-open) si no existe parámetro de versión", async () => {
        await prisma.parametroSistema.deleteMany({ where: { clave: "consentimiento.version_actual" } });
        const padre = await crearUsuario("PARENT");

        const resultado = await requiereConsentimientoActual(padre.id);
        expect(resultado).toBe(false);
    });
});
