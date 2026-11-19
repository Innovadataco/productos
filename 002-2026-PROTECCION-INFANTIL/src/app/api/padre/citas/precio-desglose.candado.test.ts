/**
 * CANDADO · SPEC-934 (I-450) — el total que el padre VE es exactamente el `montoTotal` que se GUARDA.
 *
 * El defecto: la ficha y el modal mostraban solo el precio de la consulta ($50.000) y `crearSolicitudCita`
 * guardaba consulta + servicio de la red ($55.000). D-103(c): se cobra la tarifa MÁS el porcentaje.
 *
 * Por la ruta REAL (`POST /api/padre/citas`) y la BD:
 *   (1) el total de `cotizarCitaNueva()` (lo que pintan ficha y modal) == `montoTotal` guardado;
 *   (2) control POSITIVO: se cambia la comisión → la cotización cambia con ella, y un `totalEsperado` viejo
 *       (lo que el padre aceptó antes del cambio) → 409, SIN crear la solicitud ni tomar la franja;
 *   (3) con el total nuevo se crea y lo guardado vuelve a coincidir.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearPaisCiudad, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { cotizarCitaNueva, MENSAJE_TOTAL_CAMBIO } from "@/lib/profesional/cita/cotizacion-cita";

let mockToken: string | undefined;
vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) => (name === "token" && mockToken ? { name: "token", value: mockToken } : undefined),
    }),
}));

import { POST } from "./route";

async function seedProfesional(tarifaCOP: number | null = 120_000) {
    const { ciudad } = await crearPaisCiudad();
    const usuario = await crearUsuario("PROFESIONAL");
    const perfil = await prisma.perfilProfesional.create({
        data: {
            usuarioId: usuario.id,
            nombreVisible: "Prof. Uno",
            tituloProfesional: "Psicólogo clínico",
            especialidades: ["TRAUMA_INFANTIL"],
            ciudadId: ciudad.id,
            atiendeVirtual: true,
            atiendePresencial: false,
            aniosExperiencia: 3,
            presentacion: "Trabaja con niños.",
            tarifaConsultaCOP: tarifaCOP,
            duracionMinutos: 50,
            estado: "ACTIVO",
        },
    });
    // SPEC-449: un perfil ACTIVO **sin** verificación aprobada vigente no existe
    // en producción — el estado lo escribe la aprobación, y `venceEn` es lo que
    // la Ley 2375/2024 obliga a revalidar. Este fixture lo sembraba así y pasaba
    // solo porque la consulta vieja no miraba la vigencia; `obtenerPublicoPorId`
    // ahora sí. Se endurece el fixture, NO se afloja el guard: aflojarlo dejaría
    // agendando a un profesional con los antecedentes caducados.
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

async function seedFranja(profesionalId: string, offsetDias = 3) {
    const inicio = new Date(Date.now() + offsetDias * 24 * 60 * 60 * 1000);
    const fin = new Date(inicio.getTime() + 50 * 60 * 1000);
    return prisma.franjaDisponible.create({
        data: { profesionalId, inicio, fin, modalidad: "VIRTUAL", tomada: false },
    });
}

async function sembrarParametro(clave: string, valor: number) {
    await prisma.parametroSistema.upsert({
        where: { clave },
        update: { valor: String(valor) },
        create: { clave, valor: String(valor), tipo: "INTEGER", categoria: "SYSTEM", esPublico: false, descripcion: "test SPEC-934" },
    });
}

function pedir(profesionalId: string, franjaId: string, totalEsperado: number): Request {
    return new Request("http://localhost:5005/api/padre/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: `token=${mockToken}` },
        body: JSON.stringify({
            profesionalId,
            franjaId,
            presentacion: "Mi hijo recibe mensajes que lo asustan, quiero orientación.",
            urgencia: "SIN_APURO",
            totalEsperado,
        }),
    });
}

describe("SPEC-934 · el total mostrado al padre == montoTotal guardado", { timeout: 30_000 }, () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await sembrarParametro("profesional.cita.precio_estandar_primera_cita_cop", 50_000);
        await sembrarParametro("comision.porcentaje", 10);
    });
    afterAll(async () => prisma.$disconnect());

    it("(1) lo que pinta la ficha/el modal es lo que se guarda: 50.000 + 10 % = 55.000", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const pro = await seedProfesional(120_000);
        const franja = await seedFranja(pro.id);

        const cotizacion = await cotizarCitaNueva();
        expect(cotizacion).toMatchObject({ tarifaProfesional: 50_000, servicioRed: 5_000, pagaElPadre: 55_000 });

        const res = await POST(pedir(pro.id, franja.id, cotizacion.pagaElPadre));
        expect(res.status).toBe(200);
        const { data } = await res.json();
        const guardada = await prisma.solicitudCita.findUniqueOrThrow({ where: { id: data.id } });
        expect(guardada.montoTotal).toBe(cotizacion.pagaElPadre);
        expect(guardada.montoConsulta).toBe(cotizacion.tarifaProfesional);
        expect(guardada.montoServicio).toBe(cotizacion.servicioRed);
        expect(guardada.porcentajeServicio).toBe(cotizacion.porcentajeServicio);
    });

    it("(2)+(3) control POSITIVO: cambia la comisión → cambia la cotización; el total viejo da 409 y no cobra", async () => {
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const pro = await seedProfesional(120_000);
        const franja = await seedFranja(pro.id);

        const vista = await cotizarCitaNueva(); // lo que el padre vio: 55.000
        await sembrarParametro("comision.porcentaje", 15); // el admin cambia la comisión
        const vigente = await cotizarCitaNueva();
        expect(vigente.pagaElPadre).toBe(57_500);
        expect(vigente.pagaElPadre).not.toBe(vista.pagaElPadre);

        const viejo = await POST(pedir(pro.id, franja.id, vista.pagaElPadre));
        expect(viejo.status).toBe(409);
        expect((await viejo.json()).error.message).toBe(MENSAJE_TOTAL_CAMBIO);
        expect(await prisma.solicitudCita.count()).toBe(0);
        expect((await prisma.franjaDisponible.findUniqueOrThrow({ where: { id: franja.id } })).tomada).toBe(false);

        const nuevo = await POST(pedir(pro.id, franja.id, vigente.pagaElPadre));
        expect(nuevo.status).toBe(200);
        const guardada = await prisma.solicitudCita.findFirstOrThrow();
        expect(guardada.montoTotal).toBe(vigente.pagaElPadre);
    });

    it("(4) REDONDEO: consulta impar → el preview y lo guardado redondean IGUAL (50.005 × 10 % = 5.000,5 → 5.001)", async () => {
        await sembrarParametro("profesional.cita.precio_estandar_primera_cita_cop", 50_005);
        const padre = await crearUsuario("PARENT");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const pro = await seedProfesional(120_000);
        const franja = await seedFranja(pro.id);

        const cotizacion = await cotizarCitaNueva();
        expect(cotizacion).toMatchObject({ tarifaProfesional: 50_005, servicioRed: 5_001, pagaElPadre: 55_006 });
        const res = await POST(pedir(pro.id, franja.id, cotizacion.pagaElPadre));
        expect(res.status).toBe(200);
        const guardada = await prisma.solicitudCita.findFirstOrThrow();
        expect(guardada.montoServicio).toBe(cotizacion.servicioRed);
        expect(guardada.montoTotal).toBe(cotizacion.pagaElPadre);
    });
});
