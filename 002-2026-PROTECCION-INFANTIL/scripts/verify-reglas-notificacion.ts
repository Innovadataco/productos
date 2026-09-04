#!/usr/bin/env tsx
/**
 * SPEC-418 (I-295) · Guardián de las reglas del motor de notificaciones que el
 * producto necesita para **fallar en cerrado**.
 *
 * Por qué existe: hay callsites que, si el motor no encuentra regla activa,
 * LANZAN en vez de seguir — y con razón, porque perder el aviso en silencio es
 * peor que fallar a la vista (I-295). Pero eso mueve el problema: un seed que
 * no corrió se descubre cuando alguien hace clic, con un 500 en la cara.
 *
 * **Descubrir un seed faltante al desplegar es barato; descubrirlo cuando
 * alguien hace clic es caro.** Este guardián corre en `deploy-prod.sh` justo
 * después del seed y para el despliegue si falta algo.
 *
 * Igual que el guardián de índices (SPEC-251), **solo observa y reporta**:
 * nunca crea ni repara una regla. Sembrar es del seed; reparar es humano.
 *
 * Uso:
 *   npm run reglas:check          → verificación humana
 *   npm run reglas:check --json   → salida para consumo por máquina
 *
 * Exit codes:
 *   0 — todas las reglas declaradas existen, activas y con plantilla activa
 *   1 — falta al menos una regla o su plantilla
 *   2 — error de infraestructura (BD no alcanzable)
 */
import { prisma } from "../src/lib/prisma";

export interface ReglaRequerida {
    evento: string;
    /** Qué se rompe si falta. En cristiano: lo lee quien mira el deploy caído. */
    sostiene: string;
    /** Dónde está el callsite que falla en cerrado. */
    callsite: string;
    /**
     * `true` → su ausencia **para el despliegue**. `false` → solo avisa.
     *
     * Decisión del CEO (03-09 18:2x): hoy bloquean únicamente los dos eventos
     * de SPEC-418. Los otros trece se declaran en modo aviso, porque volverlos
     * bloqueantes de golpe significaría **enterarse de una brecha preexistente
     * por no poder desplegar**, en el peor momento. En modo aviso la brecha se
     * descubre con calma y él decide cuáles pasan a bloquear, con el dato en la
     * mano. Es el mismo criterio del barrido de SPEC-415: inventario primero,
     * decisión después.
     */
    bloquea: boolean;
}

/**
 * Lista declarada — fuente única de verdad del guardián.
 *
 * Son los **15 eventos** detrás de los callsites que fallan en cerrado
 * (`programadas === 0` → throw). Las cuentas, porque no son obvias: hay 15
 * callsites; uno —`analisis/acciones/handlers/enviar-notificacion.ts:62`—
 * dispara un evento **dinámico** (`params.evento`, lo elige la regla de
 * análisis) y no se puede declarar sin inventar la lista, así que queda fuera a
 * propósito; y el del Verificador emite **dos** eventos según el resultado. 13
 * de otros callsites + 2 del Verificador = 15.
 *
 * Agregar un `programadas === 0` nuevo en `src/` obliga a declarar su evento
 * acá. Esa es la disciplina que este guardián quiere forzar.
 */
export const REGLAS_REQUERIDAS: ReglaRequerida[] = [
    // ── Bloquean el despliegue (SPEC-418) ───────────────────────────────────
    {
        evento: "profesional.verificacion.aprobada",
        sostiene: "avisarle al profesional que su perfil quedó activo — sin esto la aprobación no se puede guardar",
        callsite: "src/lib/profesionales/verificador/service.ts",
        bloquea: true,
    },
    {
        evento: "profesional.verificacion.devuelta",
        sostiene: "avisarle al profesional QUÉ corregir — sin esto el ciclo de admisión se detiene (I-295)",
        callsite: "src/lib/profesionales/verificador/service.ts",
        bloquea: true,
    },
    {
        evento: "cita.codigo.recordatorio",
        sostiene: "llevarle al padre el código con el que se cierra la cita — sin esto NINGUNA cita puede quedar CUMPLIDA (SPEC-427)",
        callsite: "src/lib/profesional/cita/cierre.service.ts",
        bloquea: true,
    },
    {
        evento: "cita.no_asistio.padre",
        sostiene: "avisarle al padre que el profesional declaró que no se presentó — es una declaración sobre él y tiene que poder responderla (SPEC-427)",
        callsite: "src/lib/profesional/cita/cierre.service.ts",
        bloquea: false,
    },
    {
        evento: "cita.autocerrada.padre",
        sostiene: "avisarle al padre que su cita murió sin confirmar — es su única señal de que algo salió mal (SPEC-427)",
        callsite: "src/lib/profesional/cita/cierre.service.ts",
        bloquea: true,
    },
    // ── Solo avisan, por ahora ──────────────────────────────────────────────
    { evento: "auth.codigo_verificacion", sostiene: "el código de verificación de la cuenta", callsite: "src/lib/email.ts:49", bloquea: false },
    { evento: "auth.cuenta_existente", sostiene: "avisar que ese correo ya tiene cuenta (anti-enumeración)", callsite: "src/lib/email.ts:71", bloquea: false },
    { evento: "auth.password_recuperacion", sostiene: "el enlace para recuperar la clave", callsite: "src/lib/email.ts:82", bloquea: false },
    { evento: "padre.circulo_confianza.reporte_enriquecido", sostiene: "avisar al padre de un reporte sobre su círculo", callsite: "src/lib/email.ts:301", bloquea: false },
    { evento: "colegio.registro_enlace", sostiene: "el enlace de registro del colegio", callsite: "src/lib/email-colegio.ts:27", bloquea: false },
    { evento: "colegio.registro_enlace.cuenta_existente", sostiene: "registro de colegio con cuenta ya existente", callsite: "src/lib/email-colegio.ts:53", bloquea: false },
    { evento: "colegio.registro_enlace.nit_ya_registrado", sostiene: "registro de colegio con NIT ya registrado", callsite: "src/lib/email-colegio.ts:79", bloquea: false },
    { evento: "colegio.bienvenida_rector", sostiene: "la bienvenida al rector", callsite: "src/lib/email-colegio.ts:130", bloquea: false },
    { evento: "auth.registro_enlace", sostiene: "el enlace de registro del padre", callsite: "src/lib/email-padre.ts:26", bloquea: false },
    { evento: "auth.bienvenida_padre", sostiene: "la bienvenida al padre", callsite: "src/lib/email-padre.ts:39", bloquea: false },
    { evento: "padre.hijo.reporte", sostiene: "avisar al padre de un reporte sobre su hijo", callsite: "src/lib/email-padre.ts:75", bloquea: false },
    { evento: "auth.registro_enlace_profesional", sostiene: "el enlace de registro del profesional", callsite: "src/lib/email-profesional.ts:18", bloquea: false },
    { evento: "auth.bienvenida_profesional", sostiene: "la bienvenida al profesional", callsite: "src/lib/email-profesional.ts:36", bloquea: false },
];

export interface HallazgoRegla {
    evento: string;
    ok: boolean;
    motivo: string;
    bloquea: boolean;
}

/**
 * Una regla sirve solo si está activa **y** su plantilla existe y está activa:
 * el motor con una plantilla ausente registra un warning, sigue de largo y
 * devuelve `programadas: 0` — indistinguible de no tener regla.
 */
export async function verificarReglas(requeridas = REGLAS_REQUERIDAS): Promise<HallazgoRegla[]> {
    const hallazgos: HallazgoRegla[] = [];
    for (const req of requeridas) {
        const reglas = await prisma.notificacionRegla.findMany({
            where: { evento: req.evento, activa: true },
            select: { plantillaClave: true, canal: true, obligatoria: true },
        });
        if (reglas.length === 0) {
            hallazgos.push({ evento: req.evento, ok: false, motivo: "sin regla activa", bloquea: req.bloquea });
            continue;
        }
        const claves = [...new Set(reglas.map((r) => r.plantillaClave))];
        const plantillas = await prisma.notificacionPlantilla.findMany({
            where: { clave: { in: claves }, activa: true },
            select: { clave: true },
        });
        const presentes = new Set(plantillas.map((p) => p.clave));
        const faltantes = claves.filter((c) => !presentes.has(c));
        if (faltantes.length > 0) {
            hallazgos.push({
                evento: req.evento,
                ok: false,
                motivo: `plantilla ausente o inactiva: ${faltantes.join(", ")}`,
                bloquea: req.bloquea,
            });
            continue;
        }
        hallazgos.push({
            evento: req.evento,
            ok: true,
            motivo: `${reglas.length} regla(s) activa(s) · plantilla(s) OK`,
            bloquea: req.bloquea,
        });
    }
    return hallazgos;
}

function detallar(nivel: "ROJO" | "AVISO", h: HallazgoRegla): void {
    const req = REGLAS_REQUERIDAS.find((r) => r.evento === h.evento);
    const salida = nivel === "ROJO" ? console.error : console.warn;
    salida(`[reglas:check] ${nivel}: falta "${h.evento}" (${h.motivo}).`);
    salida(`[reglas:check]   sostiene: ${req?.sostiene}`);
    salida(`[reglas:check]   callsite: ${req?.callsite}`);
}

async function main(): Promise<void> {
    const json = process.argv.includes("--json");
    const hallazgos = await verificarReglas();
    const faltan = hallazgos.filter((h) => !h.ok);
    const bloqueantes = faltan.filter((h) => h.bloquea);
    const avisos = faltan.filter((h) => !h.bloquea);

    if (json) {
        console.log(JSON.stringify({ ok: bloqueantes.length === 0, hallazgos }, null, 2));
    } else {
        for (const h of hallazgos) {
            const etiqueta = h.ok ? "OK   " : h.bloquea ? "FALTA" : "AVISO";
            console.log(`[reglas:check] ${etiqueta} ${h.evento} — ${h.motivo}`);
        }
    }

    for (const h of avisos) detallar("AVISO", h);
    for (const h of bloqueantes) detallar("ROJO", h);

    if (avisos.length > 0) {
        console.warn(
            `[reglas:check] ${avisos.length} evento(s) SIN regla que NO frenan el despliegue (decisión del CEO 03-09).`,
        );
        console.warn("[reglas:check] Su callsite falla en cerrado: si alguien los dispara, verá un error.");
    }

    if (bloqueantes.length > 0) {
        console.error("[reglas:check] Corré el seed (`node --import tsx prisma/seed.ts`) y volvé a verificar.");
        process.exitCode = 1;
        return;
    }
    const ok = hallazgos.filter((h) => h.ok).length;
    console.log(`[reglas:check] VERDE — ${ok}/${hallazgos.length} evento(s) con regla y plantilla activas.`);
}

if (process.argv[1]?.endsWith("verify-reglas-notificacion.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[reglas:check] Error de infraestructura:", err instanceof Error ? err.message : err);
            process.exitCode = 2;
        })
        .finally(() => prisma.$disconnect());
}
