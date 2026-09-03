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
}

/**
 * Lista declarada — fuente única de verdad del guardián.
 *
 * **Hoy tiene solo los dos eventos de SPEC-418.** En `src/` hay 15 callsites
 * que fallan en cerrado (`programadas === 0` → throw): `email.ts`,
 * `email-colegio.ts`, `email-padre.ts`, `email-profesional.ts` y el ejecutor de
 * acciones. Declararlos todos acá es lo correcto a futuro, pero es decisión del
 * CEO: si alguno tuviera hoy su regla ausente en producción, este guardián
 * pasaría a frenar el despliegue por una brecha que ya existía y que nadie
 * eligió atender en este momento. Se agregan cuando él lo diga.
 */
export const REGLAS_REQUERIDAS: ReglaRequerida[] = [
    {
        evento: "profesional.verificacion.aprobada",
        sostiene: "avisarle al profesional que su perfil quedó activo — sin esto la aprobación no se puede guardar",
        callsite: "src/lib/profesionales/verificador/service.ts",
    },
    {
        evento: "profesional.verificacion.devuelta",
        sostiene: "avisarle al profesional QUÉ corregir — sin esto el ciclo de admisión se detiene (I-295)",
        callsite: "src/lib/profesionales/verificador/service.ts",
    },
];

export interface HallazgoRegla {
    evento: string;
    ok: boolean;
    motivo: string;
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
            hallazgos.push({ evento: req.evento, ok: false, motivo: "sin regla activa" });
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
            });
            continue;
        }
        hallazgos.push({
            evento: req.evento,
            ok: true,
            motivo: `${reglas.length} regla(s) activa(s) · plantilla(s) OK`,
        });
    }
    return hallazgos;
}

async function main(): Promise<void> {
    const json = process.argv.includes("--json");
    const hallazgos = await verificarReglas();
    const faltan = hallazgos.filter((h) => !h.ok);

    if (json) {
        console.log(JSON.stringify({ ok: faltan.length === 0, hallazgos }, null, 2));
    } else {
        for (const h of hallazgos) {
            console.log(`[reglas:check] ${h.ok ? "OK  " : "FALTA"} ${h.evento} — ${h.motivo}`);
        }
    }

    if (faltan.length > 0) {
        for (const h of faltan) {
            const req = REGLAS_REQUERIDAS.find((r) => r.evento === h.evento);
            console.error(`[reglas:check] ROJO: falta "${h.evento}" (${h.motivo}).`);
            console.error(`[reglas:check]   sostiene: ${req?.sostiene}`);
            console.error(`[reglas:check]   callsite:  ${req?.callsite}`);
        }
        console.error("[reglas:check] Corré el seed (`node --import tsx prisma/seed.ts`) y volvé a verificar.");
        process.exitCode = 1;
        return;
    }
    console.log(`[reglas:check] VERDE — ${hallazgos.length} evento(s) con regla y plantilla activas.`);
}

if (process.argv[1]?.endsWith("verify-reglas-notificacion.ts")) {
    main()
        .catch((err: unknown) => {
            console.error("[reglas:check] Error de infraestructura:", err instanceof Error ? err.message : err);
            process.exitCode = 2;
        })
        .finally(() => prisma.$disconnect());
}
