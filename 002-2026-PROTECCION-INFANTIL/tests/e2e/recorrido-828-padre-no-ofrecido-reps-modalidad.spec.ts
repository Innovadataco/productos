/**
 * SPEC-828 · ASERCIÓN 1 (Calidad) · El padre NUNCA ALCANZA el rechazo por modalidad sin REPS.
 *
 * LA COSTURA QUE CIERRA. SPEC-790 rechaza en el SERVIDOR la reserva de una franja cuya modalidad el REPS
 * del profesional no cubre (lo probó mi #817 · candado-cita, pieza 2). SPEC-825 puso la OTRA cara: el
 * picker y el chip del padre ya no ofrecen esa franja — «ofrecible» = banderas (atiende*) ∧ REPS POR
 * MODALIDAD, con `franja-disponible.ts` como fuente única del picker (`listarLibresDeProfesional`) y del
 * chip (`idsConHorariosDisponibles`). Esta aserción camina ESA cara: que al padre **no se le ofrece** lo
 * que el servidor rechazaría. Es la diferencia entre «no te dejo» y «ni te lo muestro».
 *
 * NIVEL. Es el PADRE caminando sus pantallas (endpoints reales), NO el candado de unidad de Dev-1
 * (SPEC-825, repositorio + fila plantada, las tres caras). No se repite su nivel: acá se entra COMO el
 * padre y se leen el picker (`GET /api/publico/profesionales/[id]/franjas`) y el chip del directorio
 * (`GET /api/padre/profesionales/[id]` → `tieneHorariosDisponibles`, la MISMA señal fuente-única SPEC-818).
 *
 * EL DISCRIMINADOR (lo que el radicado exige no confundir). Un profesional REPS-vigente **solo para
 * PRESENCIAL** con una franja **VIRTUAL** libre futura: sigue en el directorio (la compuerta de directorio
 * usa modalidad=null = «elegible para ALGUNA modalidad»), pero su franja virtual (eje TELEMEDICINA) no la
 * cubre el REPS. Se afirma: NO sale en el picker, NO cuenta para el chip. Y el CONTROL POSITIVO pesa más
 * acá que de costumbre: con el REPS cubriendo TELEMEDICINA, la MISMA franja reaparece y el chip cuenta —
 * sin esa mitad, un filtro que esconde TODO también «no ofrece lo rechazado» y la prueba pasa por vacío.
 *
 * NO se tocan ni se afirman las vistas de GESTIÓN del profesional: a propósito NO filtran (él debe ver sus
 * franjas para arreglarlas) — declarado como excepción en el candado de Dev-1.
 *
 * El profesional se VUELVE VIGENTE en los dos tests (no SIN_VERIFICAR): mientras es SIN_VERIFICAR el
 * cutover abierto lo da por ofrecible y el reloj de modalidad no corre; el filtro por modalidad solo
 * discrimina con una verificación VIGENTE. Aislamiento por `randomUUID`; limpieza FK-safe en afterAll.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { EstadoReps, ModalidadReps } from "@prisma/client";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";
import { crearPadreOnboarded, limpiarPadreOnboarded, type PadreOnboarded } from "./fixtures/padre-onboarded";

const CORRIDA = `e2e-828a1-${randomUUID().slice(0, 8)}`;
const PASSWORD = "NoAlcanza828!Secure";
const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;
const PADRE_EMAIL = `${CORRIDA}-padre@proteccion.local`;

let profesional: ProfesionalVisible | undefined;
let padre: PadreOnboarded | undefined;
let perfilProfesionalId = "";
let franjaVirtualId = "";

const DIA = 24 * 60 * 60 * 1000;
const hace = (dias: number) => new Date(Date.now() - dias * DIA);
const enDias = (dias: number) => new Date(Date.now() + dias * DIA);

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

/**
 * Planta el REPS del profesional (BORRA las previas + crea UNA) → estado inequívoco por test.
 * Excepción documentada (como el VENCIDO del 449/828 pieza 1): no hay endpoint que registre una
 * verificación caducada/por-modalidad-parcial, se planta por Prisma. `VIGENTE` EXIGE `vigenteHasta`.
 */
async function plantarReps(datos: { resultado: EstadoReps; verificadoEn: Date; vigenteHasta: Date | null; modalidades: ModalidadReps[] }) {
    await prisma.verificacionReps.deleteMany({ where: { profesionalId: perfilProfesionalId } });
    await prisma.verificacionReps.create({
        data: {
            profesionalId: perfilProfesionalId,
            verificadoEn: datos.verificadoEn,
            fuente: "MANUAL_ADMIN",
            resultado: datos.resultado,
            vigenteHasta: datos.vigenteHasta,
            modalidades: datos.modalidades,
            modalidadesNoMapeadas: [],
            verificadoPorSnapshot: `e2e SPEC-828-a1 (${CORRIDA})`,
        },
    });
}

/** La cara del PADRE · el PICKER: las franjas que la pantalla de reserva le OFRECE de este profesional. */
async function franjasOfrecidasAlPadre(): Promise<string[]> {
    const req = await ctx();
    try {
        await login(req, PADRE_EMAIL);
        const res = await req.get(`/api/publico/profesionales/${perfilProfesionalId}/franjas`);
        expect(res.status(), `picker de franjas body=${(await res.text().catch(() => "")).slice(0, 200)}`).toBe(200);
        const data: Array<{ id: string }> = (await res.json())?.data ?? [];
        return data.map((f) => f.id);
    } finally {
        await req.dispose();
    }
}

/** La cara del PADRE · el CHIP del directorio: la señal «tiene horarios» (fuente única SPEC-818). */
async function chipTieneHorarios(): Promise<boolean> {
    const req = await ctx();
    try {
        await login(req, PADRE_EMAIL);
        const res = await req.get(`/api/padre/profesionales/${perfilProfesionalId}`);
        expect(res.status(), `detalle del directorio body=${(await res.text().catch(() => "")).slice(0, 200)}`).toBe(200);
        // El detalle devuelve el DTO al nivel raíz (no envuelto en `data`); el chip es `tieneHorariosDisponibles`.
        return Boolean((await res.json())?.tieneHorariosDisponibles);
    } finally {
        await req.dispose();
    }
}

test.describe.serial("SPEC-828 aserción 1 · al padre no se le OFRECE la franja cuya modalidad el REPS no cubre", () => {
    test.beforeAll(async () => {
        // Profesional VISIBLE por su flujo real: ACTIVO, atiendeVirtual=true, con UNA franja VIRTUAL +7d.
        // Nace SIN_VERIFICAR; cada test le planta la verificación VIGENTE que corresponde.
        const reqProf = await ctx();
        try {
            profesional = await crearProfesionalVisible({ request: reqProf, email: PROFESIONAL_EMAIL, password: PASSWORD, corrida: CORRIDA });
        } finally {
            await reqProf.dispose();
        }
        perfilProfesionalId = profesional.perfilId;
        franjaVirtualId = profesional.franjaId ?? "";
        expect(franjaVirtualId, "crearProfesionalVisible publicó la franja VIRTUAL +7d").toBeTruthy();

        // Padre onboardeado por el camino real (el directorio del padre está detrás del guardián de camino).
        const reqPadre = await ctx();
        try {
            padre = await crearPadreOnboarded({ request: reqPadre, email: PADRE_EMAIL, password: PASSWORD });
        } finally {
            await reqPadre.dispose();
        }
    });

    test.afterAll(async () => {
        // VerificacionReps tiene FK Restrict al perfil → se borra ANTES de limpiarProfesionalVisible.
        await prisma.verificacionReps
            .deleteMany({ where: { profesionalId: perfilProfesionalId } })
            .catch((e) => console.warn("[SPEC-828] limpieza de VerificacionReps falló:", e));
        if (profesional) await limpiarProfesionalVisible(profesional);
        if (padre) await limpiarPadreOnboarded(padre);
    });

    test("REPS solo PRESENCIAL · la franja VIRTUAL NO se ofrece en el picker NI cuenta para el chip", async () => {
        // VIGENTE para SALIR del paso-cutover de SIN_VERIFICAR (ahí el reloj de modalidad corre). El perfil
        // SIGUE en el directorio (modalidad=null lo da por elegible), pero su franja VIRTUAL (eje TELEMEDICINA)
        // no la cubre el REPS. La cara que faltaba: el servidor ya la rechaza (#817); acá el padre NI LA VE.
        await plantarReps({ resultado: "VIGENTE", verificadoEn: hace(10), vigenteHasta: enDias(120), modalidades: ["PRESENCIAL"] });

        const franjas = await franjasOfrecidasAlPadre();
        expect(
            franjas,
            "el picker del padre NO ofrece la franja VIRTUAL (el REPS no cubre TELEMEDICINA)",
        ).not.toContain(franjaVirtualId);

        expect(
            await chipTieneHorarios(),
            "el chip del directorio NO cuenta al profesional (su única franja no es ofrecible)",
        ).toBe(false);
    });

    test("control positivo · con el REPS cubriendo TELEMEDICINA, la MISMA franja SÍ se ofrece y SÍ cuenta", async () => {
        // Remoción del discriminador: sin esta mitad el negativo pasa por vacío (un filtro que esconde TODO
        // también «no ofrece lo rechazado»). Misma franja, mismo padre: solo cambia que el REPS cubre la modalidad.
        await plantarReps({ resultado: "VIGENTE", verificadoEn: new Date(), vigenteHasta: enDias(120), modalidades: ["PRESENCIAL", "TELEMEDICINA"] });

        const franjas = await franjasOfrecidasAlPadre();
        expect(
            franjas,
            "con el REPS cubriendo TELEMEDICINA, el picker SÍ ofrece la franja VIRTUAL",
        ).toContain(franjaVirtualId);

        expect(
            await chipTieneHorarios(),
            "el chip del directorio SÍ cuenta (ahora tiene una franja ofrecible)",
        ).toBe(true);
    });
});
