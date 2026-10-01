/**
 * SPEC-818 (recorrido de cobertura, Calidad) · El profesional APAGA una modalidad y su oferta RE-EVALÚA.
 *
 * LA CONDUCTA QUE NADIE CAMINÓ (hueco #3 de la auditoría). `whereFranjaOfrecible`
 * (`franja-disponible.ts`) decide qué franja es ofrecible leyendo `profesional.atiendeVirtual/atiendePresencial`
 * EN TIEMPO DE LECTURA (filtro de relación), no al crear la franja. Entonces: si el profesional APAGA una
 * modalidad por su pantalla «Mi perfil» (PUT parcial a `/api/profesional/perfil`, sin enviar a revisión), sus
 * franjas de esa modalidad SALEN del picker del padre al instante —aunque ya existieran— y re-encenderla las
 * DEVUELVE. Nadie lo caminó: `atiende*` solo se fijaba al CREAR. Esto prueba las dos direcciones + la no-fuga
 * del eje contrario.
 *
 * QUÉ AFIRMA (conducta en vivo, el picker REAL — no una bandera en la base):
 *   (1) ON: el padre VE la franja VIRTUAL y la PRESENCIAL en el picker.
 *   (2) APAGAR VIRTUAL: la VIRTUAL SALE del picker (oculta, no borrada); la PRESENCIAL del MISMO profesional
 *       SIGUE ofrecible — el filtro es por EJE, no un apagón total (no-fuga del eje contrario).
 *   (3) RE-PRENDER: la MISMA franja VIRTUAL reaparece (estaba oculta).
 *
 * El profesional apaga UNA modalidad, nunca las dos (invariante de modalidad del estado, SPEC-673: un
 * no-BORRADOR conserva ≥1). Se LEE `whereFranjaOfrecible`, no se toca. La vigencia interna está FUERA de
 * alcance (ya cubierta): el profesional nace ACTIVO y ofrecible y no se toca, así que la ÚNICA variable
 * acá es la bandera de modalidad del propio profesional.
 *
 * AISLAMIENTO. Corrida por `randomUUID`, prefijo `e2e-818-`. Limpieza FK-safe en afterAll (fixture).
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { crearProfesionalVisible, limpiarProfesionalVisible, type ProfesionalVisible } from "./fixtures/profesional-visible";

const CORRIDA = `e2e-818-${randomUUID().slice(0, 8)}`;
const PASSWORD = "Modalidad818!Secure";
const PROFESIONAL_EMAIL = `${CORRIDA}-prof@proteccion.local`;

let profesional: ProfesionalVisible | undefined;
let perfilProfesionalId = "";
let franjaVirtualId = "";
let franjaPresencialId = "";

async function ctx(): Promise<APIRequestContext> {
    return playwrightRequest.newContext();
}

async function login(request: APIRequestContext, email: string) {
    const res = await request.post("/api/auth/login", { data: { email, password: PASSWORD } });
    expect(res.status(), `login ${email}`).toBe(200);
}

/** El profesional edita SU bandera de modalidad por «Mi perfil» (PUT parcial, SIN enviar a revisión → se
 *  guarda y el ACTIVO sigue ACTIVO). Es su pantalla real, no la ficha de registro. */
async function fijarModalidades(atiendeVirtual: boolean, atiendePresencial: boolean) {
    const req = await ctx();
    try {
        await login(req, PROFESIONAL_EMAIL);
        const res = await req.put("/api/profesional/perfil", { data: { atiendeVirtual, atiendePresencial } });
        expect(
            res.status(),
            `PUT perfil atiendeVirtual=${atiendeVirtual} atiendePresencial=${atiendePresencial} body=${(await res.text().catch(() => "")).slice(0, 200)}`,
        ).toBeLessThan(300);
    } finally {
        await req.dispose();
    }
}

/** El picker PÚBLICO del padre (visor real; el profesional es de flujo real): ids de las franjas ofrecibles. */
async function franjasOfrecidas(): Promise<string[]> {
    const req = await ctx();
    try {
        const res = await req.get(`/api/publico/profesionales/${perfilProfesionalId}/franjas`);
        expect(res.status(), `picker body=${(await res.text().catch(() => "")).slice(0, 200)}`).toBe(200);
        const data: Array<{ id: string }> = (await res.json())?.data ?? [];
        return data.map((f) => f.id);
    } finally {
        await req.dispose();
    }
}

test.describe.serial("SPEC-818 · apagar una modalidad re-evalúa la oferta en LECTURA, por eje", () => {
    test.beforeAll(async () => {
        // Profesional VISIBLE por su flujo real (ACTIVO, atiendeVirtual, 1 franja VIRTUAL +7d, SIN_VERIFICAR).
        const reqProf = await ctx();
        try {
            profesional = await crearProfesionalVisible({ request: reqProf, email: PROFESIONAL_EMAIL, password: PASSWORD, corrida: CORRIDA });
        } finally {
            await reqProf.dispose();
        }
        perfilProfesionalId = profesional.perfilId;
        franjaVirtualId = profesional.franjaId ?? "";
        expect(franjaVirtualId, "el profesional nace con una franja VIRTUAL +7d").toBeTruthy();

        // Encender TAMBIÉN presencial (por «Mi perfil») y publicar una franja PRESENCIAL — el eje contrario
        // del no-fuga. (El profesional nace ACTIVO, así que puede publicarla; el server valida la modalidad.)
        await fijarModalidades(true, true);
        const req = await ctx();
        try {
            await login(req, PROFESIONAL_EMAIL);
            const inicio = new Date(Date.now() + 8 * 24 * 3600 * 1000).toISOString();
            const fin = new Date(Date.now() + 8 * 24 * 3600 * 1000 + 60 * 60 * 1000).toISOString();
            const r = await req.post("/api/profesional/franjas", { data: { inicio, fin, modalidad: "PRESENCIAL" } });
            expect(r.status(), `crear franja PRESENCIAL body=${(await r.text().catch(() => "")).slice(0, 200)}`).toBeLessThan(300);
            franjaPresencialId = (await r.json())?.data?.id ?? "";
            expect(franjaPresencialId, "la franja PRESENCIAL +8d existe").toBeTruthy();
        } finally {
            await req.dispose();
        }
    });

    test.afterAll(async () => {
        if (profesional) await limpiarProfesionalVisible(profesional);
    });

    test("(1) ON · el padre VE la franja VIRTUAL y la PRESENCIAL en el picker", async () => {
        const ids = await franjasOfrecidas();
        expect(ids, "la franja VIRTUAL se ofrece").toContain(franjaVirtualId);
        expect(ids, "la franja PRESENCIAL se ofrece").toContain(franjaPresencialId);
    });

    test("(2) APAGAR VIRTUAL · la VIRTUAL sale del picker; la PRESENCIAL SIGUE (no-fuga del eje contrario)", async () => {
        // Apaga SOLO virtual, mantiene presencial (nunca las dos — invariante de modalidad del estado).
        await fijarModalidades(false, true);
        const ids = await franjasOfrecidas();
        expect(ids, "la VIRTUAL deja de ofrecerse al instante (oculta en LECTURA, no borrada)").not.toContain(franjaVirtualId);
        expect(ids, "la PRESENCIAL del MISMO profesional SIGUE ofrecible — el filtro es por EJE").toContain(franjaPresencialId);
    });

    test("(3) RE-PRENDER VIRTUAL · la MISMA franja reaparece (estaba oculta, no borrada)", async () => {
        await fijarModalidades(true, true);
        const ids = await franjasOfrecidas();
        expect(ids, "la VIRTUAL reaparece en el picker al re-encender la modalidad").toContain(franjaVirtualId);
        expect(ids, "la PRESENCIAL sigue ofrecible").toContain(franjaPresencialId);
    });
});
