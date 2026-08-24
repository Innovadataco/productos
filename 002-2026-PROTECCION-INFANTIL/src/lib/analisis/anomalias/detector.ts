/**
 * SPEC-225 (US1, FR-004/FR-007/FR-009): orquestador del detector de
 * anomalías. Un tick = leer umbrales frescos + calcular ventanas Bogotá +
 * ejecutar las 6 reglas en secuencia + deduplicar por anomalía abierta +
 * persistir cada hallazgo en su propia transacción + alertar al CEO las
 * ALTA (si el kill-switch `email_inmediato_habilitado` está activo).
 *
 * Robustez (edge cases del spec): un fallo en la regla N no impide evaluar
 * la N+1; un fallo persistiendo una anomalía no impide persistir la
 * siguiente; Motor Notif es fail-open (`alertas.ts`).
 */
import type { Prisma } from "@prisma/client";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import { leerParametrosAnomalias } from "./parametros";
import { semanaCalendarioBogota, semanaAnterior, ultimas24h } from "./ventanas";
import { alertarAnomaliaAlta } from "./alertas";
import { detectarMoraAnomala } from "./reglas/mora-anomala";
import { detectarCrecimientoAnomaloCiudad } from "./reglas/crecimiento-anomalo-ciudad";
import { detectarUsoCaidoAbrupto } from "./reglas/uso-caido-abrupto";
import { detectarCancelacionColegioGrande } from "./reglas/cancelacion-colegio-grande";
import { detectarCaidaRecaudoCiudad } from "./reglas/caida-recaudo-ciudad";
import { detectarCancelacionesMasivas24h } from "./reglas/cancelaciones-masivas-24h";
import type { CandidatoAnomalia, ContextoDeteccion, ResumenTick } from "./tipos";

type ReglaAnomalia = (ctx: ContextoDeteccion) => Promise<CandidatoAnomalia[]>;

const REGLAS: { nombre: string; evaluar: ReglaAnomalia }[] = [
    { nombre: "PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL", evaluar: detectarMoraAnomala },
    { nombre: "CRECIMIENTO_ANOMALO_CIUDAD", evaluar: detectarCrecimientoAnomaloCiudad },
    { nombre: "USO_CAIDO_ABRUPTO", evaluar: detectarUsoCaidoAbrupto },
    { nombre: "CANCELACION_COLEGIO_GRANDE", evaluar: detectarCancelacionColegioGrande },
    { nombre: "CAIDA_RECAUDO_CIUDAD", evaluar: detectarCaidaRecaudoCiudad },
    { nombre: "CANCELACIONES_MASIVAS_24H", evaluar: detectarCancelacionesMasivas24h },
];

function mensajeError(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/**
 * Ejecuta un tick completo de detección. `ahora` es inyectable para tests y
 * para el quickstart (`--run-once`). Devuelve el resumen para los logs del
 * worker; nunca lanza por errores de reglas/persistencia/notificación.
 */
export async function ejecutarDeteccion(
    ahora: Date = new Date(),
    repo: AnomaliaRepository = new AnomaliaRepository()
): Promise<ResumenTick> {
    const parametros = await leerParametrosAnomalias();
    const semanaActual = semanaCalendarioBogota(ahora);
    const ctx: ContextoDeteccion = {
        ahora,
        parametros,
        ventanas: {
            semanaActual,
            semanaAnterior: semanaAnterior(semanaActual),
            ultimas24h: ultimas24h(ahora),
        },
        repo,
    };

    const resumen: ResumenTick = { detectadas: 0, altas: 0, notificadas: 0, errores: [] };

    for (const regla of REGLAS) {
        let candidatos: CandidatoAnomalia[];
        try {
            candidatos = await regla.evaluar(ctx);
        } catch (err) {
            const msg = `${regla.nombre}: ${mensajeError(err)}`;
            resumen.errores.push(msg);
            console.error(`[Anomalias] Regla ${msg}`);
            continue;
        }

        for (const candidato of candidatos) {
            try {
                const creada = await repo.crearSiNoExisteAbierta({
                    tipo: candidato.tipo,
                    sujetoTipo: candidato.sujetoTipo,
                    sujetoId: candidato.sujetoId,
                    severidad: candidato.severidad,
                    descripcion: candidato.descripcion,
                    datosContexto: candidato.datosContexto as Prisma.InputJsonValue,
                });
                if (!creada) continue; // deduplicada: ya hay una abierta del mismo tipo+sujeto
                resumen.detectadas++;
                if (creada.severidad === "ALTA") {
                    resumen.altas++;
                    if (parametros.emailInmediatoHabilitado) {
                        resumen.notificadas += await alertarAnomaliaAlta(creada, repo);
                    }
                }
            } catch (err) {
                const msg = `${regla.nombre} (persistir ${candidato.sujetoId ?? "global"}): ${mensajeError(err)}`;
                resumen.errores.push(msg);
                console.error(`[Anomalias] Error ${msg}`);
            }
        }
    }

    console.log(
        `[Anomalias] Tick: ${resumen.detectadas} detectadas (${resumen.altas} ALTA) — ${resumen.notificadas} notificaciones programadas`
    );
    return resumen;
}
