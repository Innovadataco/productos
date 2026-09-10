/**
 * SPEC-606 (2026-09-09) — step-up del texto sensible con código de 6 dígitos.
 *
 * El código viaja al correo del padre (cualquier cuenta PARENT, con o sin
 * contraseña), en BD vive SOLO su sha-256, vence en `padre.texto.codigo_minutos`
 * (default 10), aguanta 5 intentos, es de un solo uso y hay un solo código
 * vigente por usuario con cooldown de reenvío de 60 s. Al verificar se emite
 * el MISMO sello step-up de siempre: la autoridad posterior no distingue el
 * camino. Todo queda en AuditLog SIN el código ni el texto.
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
import { hashCodigoStepUp, MAX_INTENTOS_CODIGO_STEPUP } from "@/lib/dal/services/stepup-codigo";

const TEXTO = "El texto sensible que el padre revela con el código de su correo.";

const reqCodigo = () => new Request("http://localhost:5005/api/padre/step-up/codigo", { method: "POST" });
const reqVerificar = (codigo: string) =>
    new Request("http://localhost:5005/api/padre/step-up/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
    });

async function crearPadreConReporte(email: string, opciones?: { oauth?: boolean }) {
    const padre = await crearUsuario("PARENT", email);
    if (opciones?.oauth) {
        await prisma.usuario.update({
            where: { id: padre.id },
            data: { googleSub: `google-sub-${Date.now()}` },
        });
    }
    const plataforma = await prisma.plataforma.findFirstOrThrow();
    const reporte = await crearReporteFixture(prisma, {
        data: {
            identificador: `300${Date.now()}`,
            plataformaId: plataforma.id,
            texto: TEXTO,
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            usuarioId: padre.id,
            estado: "CLASIFICADO",
            numeroSeguimiento: `SU-${Date.now()}`,
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

/** Lee el código de 6 dígitos que el motor encoló para el padre. */
async function leerCodigoDelCorreo(padreId: string): Promise<string> {
    const notificacion = await prisma.notificacion.findFirstOrThrow({
        where: { evento: "padre.stepup.codigo", destinatarioUsuarioId: padreId },
        orderBy: { createdAt: "desc" },
    });
    return (notificacion.variables as { codigo: string }).codigo;
}

/** Retrocede el reloj de creación del código: salta el cooldown de reenvío. */
async function saltarCooldown(padreId: string) {
    await prisma.codigoStepUp.updateMany({
        where: { usuarioId: padreId },
        data: { creadoEn: new Date(Date.now() - 120_000) },
    });
}

describe("step-up con código de 6 dígitos (SPEC-606)", { timeout: 60_000 }, () => {
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

    it("el 403 del texto ofrece SIEMPRE codigo_email (con o sin contraseña)", async () => {
        const { padre: padreOAuth, reporte: reporteOAuth } = await crearPadreConReporte(
            `oauth-606-${Date.now()}@test.local`,
            { oauth: true }
        );
        const { padre: padreClave, reporte: reporteClave } = await crearPadreConReporte(
            `clave-606-${Date.now()}@test.local`
        );

        mockToken = await tokenViejo(padreOAuth.id);
        const resOAuth = await getTexto(
            new Request(`http://localhost:5005/api/padre/reportes/${reporteOAuth.id}/texto`),
            { params: Promise.resolve({ id: reporteOAuth.id }) }
        );
        expect(resOAuth.status).toBe(403);
        expect((await resOAuth.json()).error.metodos).toEqual(["codigo_email"]);

        mockToken = await tokenViejo(padreClave.id);
        const resClave = await getTexto(
            new Request(`http://localhost:5005/api/padre/reportes/${reporteClave.id}/texto`),
            { params: Promise.resolve({ id: reporteClave.id }) }
        );
        expect(resClave.status).toBe(403);
        const dataClave = await resClave.json();
        expect(dataClave.error.metodos).toEqual(["codigo_email"]);
        expect(dataClave.error.message).toContain("código");
    });

    it("solicitar: envía el correo con 6 dígitos, guarda SOLO el hash y audita sin el código", async () => {
        const { padre } = await crearPadreConReporte(`sol-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });

        // Sin regla activa: fail-closed, no promete un correo que no saldrá.
        const resSinRegla = await postCodigo(reqCodigo());
        expect(resSinRegla.status).toBe(502);
        // La fila creada quedó expirada: el reintento no paga cooldown por un correo que no salió.
        const resAunSinRegla = await postCodigo(reqCodigo());
        expect(resAunSinRegla.status).toBe(502);

        await sembrarReglaStepupCodigo();
        const res = await postCodigo(reqCodigo());
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.enviado).toBe(true);
        expect(data.vigenciaMinutos).toBe(10);
        expect(data.cooldownSegundos).toBe(60);
        expect(data.correoEnmascarado).toMatch(/^.•••••@test\.local$/);

        const codigo = await leerCodigoDelCorreo(padre.id);
        expect(codigo).toMatch(/^\d{6}$/);

        // En reposo SOLO el hash: jamás el código en claro.
        const registro = await prisma.codigoStepUp.findFirstOrThrow({ where: { usuarioId: padre.id } });
        expect(registro.codigoHash).toBe(hashCodigoStepUp(codigo));
        expect(registro.codigoHash).not.toBe(codigo);
        expect(registro.intentos).toBe(0);
        expect(registro.consumidoEn).toBeNull();

        // Auditoría de la solicitud SIN el código (hubo 3 solicitudes: 2 sin
        // regla + la buena — cada una con SU hash, nunca el plano).
        const auditorias = await prisma.auditLog.findMany({
            where: { accion: "STEP_UP_CODIGO_SOLICITADO", usuarioId: padre.id },
        });
        expect(auditorias.length).toBeGreaterThan(0);
        for (const fila of auditorias) {
            const meta = fila.metadatos as { codigoHash?: string };
            expect(meta.codigoHash).toBeDefined();
            expect(meta.codigoHash).not.toBe(codigo);
        }
        expect(
            auditorias.some((fila) => (fila.metadatos as { codigoHash?: string }).codigoHash === hashCodigoStepUp(codigo))
        ).toBe(true);
    });

    it("cuenta CON contraseña también pide el código (deroga el candado solo-OAuth)", async () => {
        const { padre } = await crearPadreConReporte(`clave2-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        const res = await postCodigo(reqCodigo());
        expect(res.status).toBe(200);
    });

    it("cooldown de reenvío: el segundo pedido inmediato responde 429 con reintentaEnSegundos", async () => {
        const { padre } = await crearPadreConReporte(`cool-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        expect((await postCodigo(reqCodigo())).status).toBe(200);
        const res = await postCodigo(reqCodigo());
        expect(res.status).toBe(429);
        const data = await res.json();
        expect(data.error.reintentaEnSegundos).toBeGreaterThan(0);
        expect(data.error.reintentaEnSegundos).toBeLessThanOrEqual(60);
        expect(data.error.correoEnmascarado).toContain("@test.local");

        // Pasado el cooldown (reloj retrocedido), el reenvío sí sale.
        await saltarCooldown(padre.id);
        expect((await postCodigo(reqCodigo())).status).toBe(200);
    });

    it("un solo código vigente: un nuevo pedido expira el anterior", async () => {
        const { padre } = await crearPadreConReporte(`unico-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        await postCodigo(reqCodigo());
        const codigoViejo = await leerCodigoDelCorreo(padre.id);
        await saltarCooldown(padre.id);
        await postCodigo(reqCodigo());
        const codigoNuevo = await leerCodigoDelCorreo(padre.id);
        expect(codigoNuevo).not.toBe(codigoViejo);

        // El viejo quedó expirado en BD y ya no verifica (401 contra el vigente).
        const registros = await prisma.codigoStepUp.findMany({
            where: { usuarioId: padre.id },
            orderBy: { creadoEn: "asc" },
        });
        expect(registros).toHaveLength(2);
        expect(registros[0].vigenteHasta.getTime()).toBeLessThanOrEqual(Date.now());
        expect(registros[1].vigenteHasta.getTime()).toBeGreaterThan(Date.now());

        expect((await postVerificar(reqVerificar(codigoViejo))).status).toBe(401);
        expect((await postVerificar(reqVerificar(codigoNuevo))).status).toBe(204);
    });

    it("rate limit del scope propio (stepup_codigo): superado el máximo responde 429", async () => {
        // .env.test trae DISABLE_RATE_LIMIT=true: este test lo enciende a propósito
        // (mismo patrón que oauth/google/route.test.ts).
        const estabaApagado = process.env.DISABLE_RATE_LIMIT === "true";
        if (estabaApagado) process.env.DISABLE_RATE_LIMIT = "false";
        try {
            const { padre } = await crearPadreConReporte(`rl-606-${Date.now()}@test.local`);
            mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
            await sembrarReglaStepupCodigo();
            await prisma.parametroSistema.create({
                data: { clave: "ratelimit.stepup_codigo.max_requests", valor: "1", tipo: "INTEGER", categoria: "SYSTEM", descripcion: "t" },
            });

            expect((await postCodigo(reqCodigo())).status).toBe(200);
            await saltarCooldown(padre.id); // aisla el rate limit del cooldown
            const res = await postCodigo(reqCodigo());
            expect(res.status).toBe(429);
            expect((await res.json()).error.code).toBe("RATE_LIMITED");
        } finally {
            if (estabaApagado) process.env.DISABLE_RATE_LIMIT = "true";
        }
    });

    it("verificar correcto → 204 + sello + texto fluye; el código es de UN solo uso", async () => {
        const { padre, reporte } = await crearPadreConReporte(`ok-606-${Date.now()}@test.local`, { oauth: true });
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        await postCodigo(reqCodigo());
        const codigo = await leerCodigoDelCorreo(padre.id);

        const resOk = await postVerificar(reqVerificar(codigo));
        expect(resOk.status).toBe(204);
        const setCookie = resOk.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("stepup_sello=");
        mockSello = /stepup_sello=([^;]+)/.exec(setCookie)?.[1];

        // Consumido: un segundo canje del mismo código ya no vale.
        const registro = await prisma.codigoStepUp.findFirstOrThrow({ where: { usuarioId: padre.id } });
        expect(registro.consumidoEn).not.toBeNull();
        expect((await postVerificar(reqVerificar(codigo))).status).toBe(401);

        // Auditoría de la verificación SIN el código.
        const auditorias = await prisma.auditLog.findMany({
            where: { accion: "STEP_UP_CODIGO_VERIFICADO", usuarioId: padre.id },
        });
        expect(auditorias).toHaveLength(1);
        const meta = auditorias[0].metadatos as { codigoHash?: string };
        expect(meta.codigoHash).toBe(hashCodigoStepUp(codigo));
        expect(meta.codigoHash).not.toBe(codigo);

        // Con sello fresco el texto se entrega (autoridad idéntica a la vía vieja).
        mockToken = await tokenViejo(padre.id);
        const resTexto = await getTexto(
            new Request(`http://localhost:5005/api/padre/reportes/${reporte.id}/texto`),
            { params: Promise.resolve({ id: reporte.id }) }
        );
        expect(resTexto.status).toBe(200);
        expect((await resTexto.json()).texto).toBe(TEXTO);
    });

    it("incorrecto ×5: cuatro 401 con intentos restantes y el 5º bloquea (429) matando el código", async () => {
        const { padre } = await crearPadreConReporte(`fallos-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        await postCodigo(reqCodigo());
        const codigo = await leerCodigoDelCorreo(padre.id);
        const errado = codigo === "000000" ? "000001" : "000000";

        for (let i = 1; i < MAX_INTENTOS_CODIGO_STEPUP; i++) {
            const res = await postVerificar(reqVerificar(errado));
            expect(res.status).toBe(401);
            const data = await res.json();
            expect(data.error.message).toContain(`${MAX_INTENTOS_CODIGO_STEPUP - i}`);
        }

        const resBloqueo = await postVerificar(reqVerificar(errado));
        expect(resBloqueo.status).toBe(429);

        // El código quedó consumido: ni siquiera el código CORRECTO ya vale.
        const registro = await prisma.codigoStepUp.findFirstOrThrow({ where: { usuarioId: padre.id } });
        expect(registro.consumidoEn).not.toBeNull();
        expect(registro.intentos).toBe(MAX_INTENTOS_CODIGO_STEPUP);
        expect((await postVerificar(reqVerificar(codigo))).status).toBe(401);

        // Cada fallo auditado con motivo, JAMÁS con el código digitado.
        const auditorias = await prisma.auditLog.findMany({
            where: { accion: "STEP_UP_CODIGO_FALLIDO", usuarioId: padre.id },
        });
        expect(auditorias).toHaveLength(MAX_INTENTOS_CODIGO_STEPUP);
        const motivos: string[] = [];
        for (const fila of auditorias) {
            const meta = fila.metadatos as Record<string, unknown>;
            expect(Object.values(meta)).not.toContain(errado);
            expect(Object.values(meta)).not.toContain(codigo);
            motivos.push(String(meta.motivo));
        }
        expect(motivos).toContain("bloqueado");
        expect(motivos).toContain("incorrecto");
    });

    it("código vencido → 403", async () => {
        const { padre } = await crearPadreConReporte(`vence-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        await sembrarReglaStepupCodigo();

        await postCodigo(reqCodigo());
        const codigo = await leerCodigoDelCorreo(padre.id);
        await prisma.codigoStepUp.updateMany({
            where: { usuarioId: padre.id },
            data: { vigenteHasta: new Date(Date.now() - 1000) },
        });

        const res = await postVerificar(reqVerificar(codigo));
        expect(res.status).toBe(403);
        expect((await res.json()).error.message).toContain("venció");
    });

    it("verificación exige formato de 6 dígitos (400) y sesión (401)", async () => {
        const { padre } = await crearPadreConReporte(`formato-606-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });

        expect((await postVerificar(reqVerificar("abc"))).status).toBe(400);
        expect((await postVerificar(reqVerificar("12345"))).status).toBe(400);

        mockToken = undefined;
        expect((await postVerificar(reqVerificar("123456"))).status).toBe(401);
        expect((await postCodigo(reqCodigo())).status).toBe(401);
    });
});
