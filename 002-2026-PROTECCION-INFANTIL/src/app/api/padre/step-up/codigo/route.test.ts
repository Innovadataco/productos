/**
 * SPEC-592 (2026-09-08) — step-up por código temporal para cuentas OAuth.
 *
 * El padre que entró con Google no tiene contraseña que revalidar: el 403 de
 * STEP_UP_REQUERIDO trae `metodos: ["codigo_email"]`, el código firmado viaja a
 * SU correo (10 min de vigencia) y al verificarlo se emite el MISMO sello
 * step-up de la vía por contraseña. La autoridad posterior no distingue el camino.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { crearReporteFixture } from "@/lib/dal/testing/crear-reporte-fixture";

let mockToken: string | undefined;
let mockSello: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => {
            if (name === "token" && mockToken) return { name, value: mockToken };
            if (name === "stepup_sello" && mockSello) return { name, value: mockSello };
            return undefined;
        },
    }),
}));

import { POST as postCodigo } from "./route";
import { POST as postVerificar } from "../verificar/route";
import { GET as getTexto } from "../../reportes/[id]/texto/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { createToken } from "@/lib/auth";

const TEXTO = "El texto sensible que el padre OAuth debe poder revelar con el código de su correo.";

async function crearPadreOAuthConReporte() {
    const padre = await crearUsuario("PARENT", `oauth-stepup-${Date.now()}@test.local`);
    await prisma.usuario.update({
        where: { id: padre.id },
        data: { googleSub: `google-sub-${Date.now()}` },
    });
    const plataforma = await prisma.plataforma.findFirstOrThrow();
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: "300oauthstepup",
            plataformaId: plataforma.id,
            texto: TEXTO,
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: padre.id,
            estado: "CLASIFICADO",
            numeroSeguimiento: `SUO-${Date.now()}`,
        },
    });
    return { padre, reporte };
}

/** JWT envejecido (más de 30 min): fuerza el STEP_UP_REQUERIDO. */
async function tokenViejo(padreId: string): Promise<string> {
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    return new SignJWT({ sub: padreId, rol: "PARENT" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 60 * 60)
        .setExpirationTime("24h")
        .sign(secret);
}

async function sembrarReglaStepupCodigo() {
    await prisma.notificacionPlantilla.create({
        data: {
            clave: "padre.stepup.codigo.email",
            canal: "EMAIL",
            asunto: "Tu código para ver el texto de tu reporte",
            cuerpoMarkdown: "Código: {{codigo}} (vence en {{vigenciaMinutos}} minutos).",
            variablesSchema: {},
        },
    });
    await prisma.notificacionRegla.create({
        data: {
            evento: "padre.stepup.codigo",
            rol: "PARENT",
            offset: "+0m",
            canal: "EMAIL",
            plantillaClave: "padre.stepup.codigo.email",
        },
    });
}

describe("step-up por código temporal (SPEC-592)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await resetRateLimitStore();
        mockToken = undefined;
        mockSello = undefined;
        await prisma.parametroSistema.upsert({
            where: { clave: "padre.texto.stepup_minutos" },
            update: { valor: "30" },
            create: { clave: "padre.texto.stepup_minutos", valor: "30", tipo: "INTEGER", categoria: "SECURITY", descripcion: "t" },
        });
    });

    it("cuenta OAuth: el 403 ofrece el método codigo_email (no contraseña)", async () => {
        const { padre, reporte } = await crearPadreOAuthConReporte();
        mockToken = await tokenViejo(padre.id);

        const res = await getTexto(
            new Request(`http://localhost:5005/api/padre/reportes/${reporte.id}/texto`),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error.code).toBe("STEP_UP_REQUERIDO");
        expect(data.error.metodos).toEqual(["codigo_email"]);
    });

    it("cuenta con contraseña: el 403 sigue pidiendo password", async () => {
        const padre = await crearUsuario("PARENT", `pwd-stepup-${Date.now()}@test.local`);
        const plataforma = await prisma.plataforma.findFirstOrThrow();
        const reporte = await crearReporteFixture(prisma, {
            data: {
                identificador: "300pwdstepup",
                plataformaId: plataforma.id,
                texto: TEXTO,
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                usuarioId: padre.id,
                estado: "CLASIFICADO",
                numeroSeguimiento: `SUP-${Date.now()}`,
            },
        });
        mockToken = await tokenViejo(padre.id);

        const res = await getTexto(
            new Request(`http://localhost:5005/api/padre/reportes/${reporte.id}/texto`),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(res.status).toBe(403);
        const data = await res.json();
        expect(data.error.metodos).toEqual(["password"]);
    });

    it("solicita el código: lo encola por correo y sin regla activa falla (502)", async () => {
        const { padre } = await crearPadreOAuthConReporte();
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });

        // Sin regla activa: fail-closed, no promete un correo que no saldrá.
        const resSinRegla = await postCodigo(new Request("http://localhost:5005/api/padre/step-up/codigo", { method: "POST" }));
        expect(resSinRegla.status).toBe(502);

        await sembrarReglaStepupCodigo();
        const res = await postCodigo(new Request("http://localhost:5005/api/padre/step-up/codigo", { method: "POST" }));
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.enviado).toBe(true);
        expect(data.vigenciaMinutos).toBe(10);

        const notificacion = await prisma.notificacion.findFirstOrThrow({
            where: { evento: "padre.stepup.codigo", destinatarioUsuarioId: padre.id },
        });
        const variables = notificacion.variables as { codigo?: string; vigenciaMinutos?: number };
        expect(typeof variables.codigo).toBe("string");
        expect(variables.codigo!.length).toBeGreaterThan(20);
    });

    it("cuenta con contraseña: solicitar código responde 409 (usa la contraseña)", async () => {
        const padre = await crearUsuario("PARENT", `pwd2-stepup-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        const res = await postCodigo(new Request("http://localhost:5005/api/padre/step-up/codigo", { method: "POST" }));
        expect(res.status).toBe(409);
    });

    it("verifica el código: emite el sello y el texto se entrega; código errado → 401", async () => {
        const { padre, reporte } = await crearPadreOAuthConReporte();
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        await postCodigo(new Request("http://localhost:5005/api/padre/step-up/codigo", { method: "POST" }));
        const notificacion = await prisma.notificacion.findFirstOrThrow({
            where: { evento: "padre.stepup.codigo", destinatarioUsuarioId: padre.id },
        });
        const codigo = (notificacion.variables as { codigo: string }).codigo;

        // Código errado: 401 y sin sello.
        const resErrado = await postVerificar(
            new Request("http://localhost:5005/api/padre/step-up/verificar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo: "codigo.totalmente.errado" }),
            })
        );
        expect(resErrado.status).toBe(401);

        // Código correcto: 204 con Set-Cookie del sello step-up.
        const resOk = await postVerificar(
            new Request("http://localhost:5005/api/padre/step-up/verificar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo }),
            })
        );
        expect(resOk.status).toBe(204);
        const setCookie = resOk.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("stepup_sello=");
        mockSello = /stepup_sello=([^;]+)/.exec(setCookie)?.[1];

        // Con sello fresco el texto se entrega (autoridad idéntica a la vía password).
        mockToken = await tokenViejo(padre.id);
        const resTexto = await getTexto(
            new Request(`http://localhost:5005/api/padre/reportes/${reporte.id}/texto`),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(resTexto.status).toBe(200);
        const dataTexto = await resTexto.json();
        expect(dataTexto.texto).toBe(TEXTO);
    });

    it("el código firmado para OTRO usuario no vale (no transferible)", async () => {
        const { padre } = await crearPadreOAuthConReporte();
        const otro = await crearUsuario("PARENT", `otro-oauth-stepup-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        await postCodigo(new Request("http://localhost:5005/api/padre/step-up/codigo", { method: "POST" }));
        const notificacion = await prisma.notificacion.findFirstOrThrow({
            where: { evento: "padre.stepup.codigo", destinatarioUsuarioId: padre.id },
        });
        const codigo = (notificacion.variables as { codigo: string }).codigo;

        // El OTRO padre (OAuth también) intenta usar el código ajeno.
        await prisma.usuario.update({ where: { id: otro.id }, data: { googleSub: `otro-sub-${Date.now()}` } });
        mockToken = await createToken({ sub: otro.id, rol: "PARENT" });
        const res = await postVerificar(
            new Request("http://localhost:5005/api/padre/step-up/verificar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ codigo }),
            })
        );
        expect(res.status).toBe(401);
    });
});
