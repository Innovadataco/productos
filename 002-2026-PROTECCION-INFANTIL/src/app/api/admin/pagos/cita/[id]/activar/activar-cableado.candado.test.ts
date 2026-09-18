/**
 * CANDADO · SPEC-713 · El admin puede aprobar el pago de una cita — y hay pantalla que lo llama.
 *
 * (a) Conducta: `POST /api/admin/pagos/cita/[id]/activar` sobre una solicitud
 *     SIN_CONFIRMAR la deja PAGADA_PENDIENTE con `pagoAprobadoEn` (arranca el reloj 48 h).
 * (b) Cableado (la lección de dev-funcion-construida-sin-cablear): la ruta activar TIENE
 *     una pantalla que la llama — el botón de `CitasPorAprobarClient`. La ruta existía
 *     desde SPEC-395 sin caller; este candado muere si vuelve a quedar sin pantalla.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearPaisCiudad, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { crearSolicitudCita } from "@/lib/profesional/cita/cita.service";

declare global {
    var __testToken: string | undefined;
}

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && globalThis.__testToken
                ? { name: "token", value: globalThis.__testToken as string }
                : undefined,
    }),
}));

async function seedProfesionalActivo() {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Uno",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["Ansiedad"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Acompaño familias.",
            tarifaConsultaCOP: 120_000,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    const revisor = await crearUsuario("ADMIN");
    await prisma.verificacionProfesional.create({
        data: {
            perfilProfesionalId: perfil.id,
            revisadoPorId: revisor.id,
            revisadoEn: new Date(Date.now() - 24 * 60 * 60 * 1000),
            checklist: {},
            resultado: "APROBADO",
            autorizacionArchivoId: "archivo-de-prueba",
            venceEn: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
    });
    return perfil;
}

async function seedFranja(profesionalId: string) {
    const inicio = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin: new Date(inicio.getTime() + 50 * 60 * 1000), modalidad: "VIRTUAL", tomada: false },
    });
}

async function crearSolicitudSinConfirmar() {
    const padre = await crearUsuario("PARENT");
    const pro = await seedProfesionalActivo();
    const franja = await seedFranja(pro.id);
    return crearSolicitudCita({
        padreUsuarioId: padre.id,
        profesionalId: pro.id,
        franjaId: franja.id,
        presentacion: "Contexto suficiente para pasar el mínimo del schema.",
        urgencia: "SIN_APURO",
        porcentajeServicio: 15,
        montoConsultaOverride: 50_000, // 1ª cita al estándar → SIN_CONFIRMAR, pago por aprobar
    });
}

describe("SPEC-713 · aprobar el pago de una cita", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        globalThis.__testToken = undefined;
    });

    it("(a) POST activar deja la solicitud PAGADA_PENDIENTE con pagoAprobadoEn", async () => {
        const solicitud = await crearSolicitudSinConfirmar();
        expect(solicitud.estado).toBe("SIN_CONFIRMAR");
        expect(solicitud.pagoAprobadoEn).toBeNull();

        const admin = await crearUsuario("ADMIN");
        globalThis.__testToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await POST(new Request("http://localhost/api/admin/pagos/cita/x/activar", { method: "POST" }), {
            params: Promise.resolve({ id: solicitud.id }),
        });
        expect(res.status, `respuesta: ${await res.clone().text().catch(() => "")}`).toBe(200);

        const fila = await prisma.solicitudCita.findUnique({
            where: { id: solicitud.id },
            select: { estado: true, pagoAprobadoEn: true },
        });
        expect(fila?.estado).toBe("PAGADA_PENDIENTE");
        expect(fila?.pagoAprobadoEn).not.toBeNull();
    });

    it("(b) la ruta activar TIENE pantalla que la llama (no vuelve a quedar sin cablear)", () => {
        const cliente = fs.readFileSync(
            path.resolve(process.cwd(), "src/components/modules/pagos/CitasPorAprobarClient.tsx"),
            "utf-8",
        );
        // El botón hace fetch a la ruta activar (con el id interpolado).
        expect(/fetch\(\s*`\/api\/admin\/pagos\/cita\/\$\{[^}]+\}\/activar`/.test(cliente)).toBe(true);
    });
});
