/**
 * SPEC-340 (A-68 §3.3-bis · T021) — el step-up del texto sensible.
 *
 * La autoridad es del SERVIDOR: sesión joven entrega, vieja exige contraseña,
 * la errada alimenta el contador GLOBAL (sin contador paralelo), y el texto
 * jamás está en el payload del listado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

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

import { POST as postStepUp } from "./route";
import { GET as getTexto } from "../reportes/[id]/texto/route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { createToken, hashPassword } from "@/lib/auth";
import { cifrarTextoReporte } from "@/lib/texto-reporte-cifrado";
import { firmarSelloStepUp } from "@/lib/routing/stepup-sello";

const PASSWORD = "MiClave123!";
const TEXTO = "El texto sensible que el agresor en la misma casa no puede ver por encima del hombro.";

async function crearPadreConReporte() {
    const padre = await crearUsuario("PARENT", `stepup-${Date.now()}@test.local`, PASSWORD);
    await prisma.usuario.update({
        where: { id: padre.id },
        data: { passwordHash: await hashPassword(PASSWORD) },
    });
    const plataforma = await prisma.plataforma.findFirstOrThrow();
    const reporte = await prisma.reporte.create({
        data: {
            identificador: "300stepup",
            plataformaId: plataforma.id,
            texto: cifrarTextoReporte(TEXTO),
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

/** JWT con iat controlado: joven (ahora) o viejo (hace `edadSeg`). */
async function tokenConEdad(padreId: string, edadSeg: number): Promise<string> {
    // createToken firma iat=ahora; para envejecerlo se firma directo con jose.
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    return new SignJWT({ sub: padreId, rol: "PARENT" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - edadSeg)
        .setExpirationTime("24h")
        .sign(secret);
}

function reqTexto(id: string): [Request, { params: Promise<{ id: string }> }] {
    return [new Request(`http://localhost:5005/api/padre/reportes/${id}/texto`), { params: Promise.resolve({ id }) }];
}

function reqStepUp(password: string): Request {
    return new Request("http://localhost:5005/api/padre/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });
}

describe("step-up del texto sensible (SPEC-340)", { timeout: 60_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        await resetRateLimitStore();
        mockSello = undefined;
        await prisma.parametroSistema.upsert({
            where: { clave: "padre.texto.stepup_minutos" },
            update: { valor: "30" },
            create: { clave: "padre.texto.stepup_minutos", valor: "30", tipo: "INTEGER", categoria: "SECURITY", descripcion: "t" },
        });
    });

    it("sesión JOVEN: entrega el texto descifrado sin pedir nada", async () => {
        const { padre, reporte } = await crearPadreConReporte();
        mockToken = await createToken({ sub: padre.id, rol: "PARENT" });
        const [req, ctx] = reqTexto(reporte.id);
        const res = await getTexto(req, ctx);
        expect(res.status).toBe(200);
        expect((await res.json()).texto).toBe(TEXTO);
    });

    it("sesión VIEJA sin sello: 403 STEP_UP_REQUERIDO — el texto NO sale", async () => {
        const { padre, reporte } = await crearPadreConReporte();
        mockToken = await tokenConEdad(padre.id, 45 * 60); // 45 min > 30
        const [req, ctx] = reqTexto(reporte.id);
        const res = await getTexto(req, ctx);
        expect(res.status).toBe(403);
        const body = await res.json();
        expect(body.error.code).toBe("STEP_UP_REQUERIDO");
        expect(JSON.stringify(body)).not.toContain(TEXTO.slice(0, 20));
    });

    it("contraseña correcta → sello → el texto sale con la sesión vieja", async () => {
        const { padre, reporte } = await crearPadreConReporte();
        mockToken = await tokenConEdad(padre.id, 45 * 60);

        const resStepUp = await postStepUp(reqStepUp(PASSWORD));
        expect(resStepUp.status).toBe(204);
        const setCookie = resStepUp.headers.get("set-cookie") ?? "";
        expect(setCookie).toContain("stepup_sello=");
        mockSello = /stepup_sello=([^;]+)/.exec(setCookie)?.[1];

        const [req, ctx] = reqTexto(reporte.id);
        const res = await getTexto(req, ctx);
        expect(res.status).toBe(200);
        expect((await res.json()).texto).toBe(TEXTO);
    });

    it("contraseña ERRADA: 401 sereno y alimenta el contador GLOBAL (sin contador paralelo)", async () => {
        const { padre } = await crearPadreConReporte();
        mockToken = await tokenConEdad(padre.id, 45 * 60);

        const res = await postStepUp(reqStepUp("Equivocada1!"));
        expect(res.status).toBe(401);

        const enBd = await prisma.usuario.findUniqueOrThrow({ where: { id: padre.id } });
        expect(enBd.intentosFallidos, "MISMO contador que el login").toBe(1);
    });

    it("el sello VENCE: uno más viejo que M minutos no abre", async () => {
        const { padre, reporte } = await crearPadreConReporte();
        mockToken = await tokenConEdad(padre.id, 45 * 60);
        // Sello firmado a mano con iat viejo: reusar el firmador con reloj falso.
        vi.useFakeTimers();
        vi.setSystemTime(Date.now() - 40 * 60 * 1000);
        mockSello = firmarSelloStepUp(padre.id, process.env.JWT_SECRET!);
        vi.useRealTimers();

        const [req, ctx] = reqTexto(reporte.id);
        const res = await getTexto(req, ctx);
        expect(res.status).toBe(403);
    });

    it("el sello NO es transferible: el de otro usuario no abre", async () => {
        const { reporte, padre } = await crearPadreConReporte();
        const otro = await crearUsuario("PARENT", `otro-stepup-${Date.now()}@test.local`);
        mockToken = await tokenConEdad(padre.id, 45 * 60);
        mockSello = firmarSelloStepUp(otro.id, process.env.JWT_SECRET!);

        const [req, ctx] = reqTexto(reporte.id);
        expect((await getTexto(req, ctx)).status).toBe(403);
    });

    it("el reporte AJENO no existe por esta vía (404, no 403): PII de dueño único", async () => {
        const { reporte } = await crearPadreConReporte();
        const otro = await crearUsuario("PARENT", `ajeno-stepup-${Date.now()}@test.local`);
        mockToken = await createToken({ sub: otro.id, rol: "PARENT" });
        const [req, ctx] = reqTexto(reporte.id);
        expect((await getTexto(req, ctx)).status).toBe(404);
    });
});
