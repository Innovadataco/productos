/**
 * SPEC-395 (L4) · Franjas del profesional.
 * GET  — lista las franjas del profesional autenticado (futuras).
 * POST — crea una franja disponible.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyAuth } from "@/lib/auth";
import { exigirProfesionalHabilitadoApi } from "@/lib/profesionales/habilitacion";
import { assertModulo } from "@/lib/permisos-modulos";
import { errorToResponse } from "@/lib/api-handler";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { DiaBloqueadoRepository } from "@/lib/dal/repositories/dia-bloqueado";
import { diaBogota } from "@/lib/fechas/formato-bogota";
import { modalidadRepsRequerida } from "@/lib/profesional/reps/modalidad-cita-a-reps";
import { AppError, ERROR_CODES } from "@/lib/errors";

const crearSchema = z.object({
    inicio: z.string().datetime(),
    fin: z.string().datetime(),
    modalidad: z.enum(["VIRTUAL", "PRESENCIAL"]),
});

// SPEC-834 · mitad 2 — MENSAJE al PROFESIONAL cuando su REPS no cubre la modalidad de la
// franja que publica. Copy VERBATIM de Diseño (FORMA-SPEC834, v1.0, commit 95a0d5a en
// Gestión), voz usted. La puerta unitaria es el único punto donde se le dice al profesional
// —el único que puede arreglarlo— que su franja no sirve, justo al publicarla (el lote solo
// CUENTA las omitidas). Dos formas, según si la OTRA modalidad es un pivote REAL:
//   (a) con pivote: «… Renueve su inscripción o publíquela en {otra}.»
//   (b) sin pivote: «… Renueve su inscripción para volver a publicar.»
// Cumple los cuatro límites de la forma: el sujeto es «su inscripción» (no «usted») → no
// culpa; «ahora» → estado fixable; los verbos de salida (Renueve/publíquela) son del
// profesional → el sistema no actúa solo; no recita el estado regulatorio. No se reescribe;
// si Diseño reemite, se re-transcribe.
function palabraModalidadFranja(modalidad: "VIRTUAL" | "PRESENCIAL"): string {
    return modalidad === "VIRTUAL" ? "virtual" : "presencial";
}

function mensajeRechazoRepsModalidad(
    modalidad: "VIRTUAL" | "PRESENCIAL",
    pivoteOtraModalidad: "VIRTUAL" | "PRESENCIAL" | null,
): string {
    const base = `No pudimos publicar esta franja: su inscripción en el registro no cubre la modalidad ${palabraModalidadFranja(modalidad)} ahora.`;
    return pivoteOtraModalidad
        ? `${base} Renueve su inscripción o publíquela en ${palabraModalidadFranja(pivoteOtraModalidad)}.`
        : `${base} Renueve su inscripción para volver a publicar.`;
}

export async function GET() {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await exigirProfesionalHabilitadoApi(user.id); // SPEC-690: ruta operativa — solo habilitado
        await assertModulo(user, "profesional_calendario");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const franjas = await new FranjaDisponibleRepository().listarDeProfesional(perfil.id);
        return NextResponse.json({ data: franjas });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/FRANJAS/GET]");
    }
}

export async function POST(request: Request) {
    try {
        const user = await verifyAuth("PROFESIONAL");
        await exigirProfesionalHabilitadoApi(user.id); // SPEC-690: ruta operativa — solo habilitado
        await assertModulo(user, "profesional_calendario");
        const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(user.id);
        if (!perfil) throw new AppError("Perfil profesional no existe", ERROR_CODES.NOT_FOUND, 404);
        const body = crearSchema.parse(await request.json());
        const inicio = new Date(body.inicio);
        const fin = new Date(body.fin);
        if (fin.getTime() <= inicio.getTime()) {
            throw new AppError("El fin debe ser posterior al inicio", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        // SPEC-714 (regla 1 · CEO): no se publica una franja en un día que el
        // profesional CERRÓ en su agenda. La misma decisión que el rayado de la
        // cuadrícula, pero del lado del SERVIDOR (no solo la pantalla). El día se
        // compara en Bogotá —igual que lo ve el profesional y como se guarda el
        // bloqueo—, con la misma proyección que usa el DTO del calendario.
        const diaFranja = diaBogota(inicio);
        if (await new DiaBloqueadoRepository().estaBloqueado(perfil.id, diaFranja)) {
            throw new AppError(
                "Ese día está bloqueado en su agenda. Reábralo para publicar franjas.",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        // SPEC-447 (I-311): dos validaciones que la ruta no tenía y que la
        // pantalla nueva vuelve alcanzables por primera vez de verdad.
        //
        // 1) Modalidad que el profesional NO atiende. Publicarla es prometerle
        //    a una familia algo que no va a poder cumplir; el directorio del
        //    padre filtra por estos mismos dos campos.
        if (body.modalidad === "VIRTUAL" && !perfil.atiendeVirtual) {
            throw new AppError("No atiende de forma virtual", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        if (body.modalidad === "PRESENCIAL" && !perfil.atiendePresencial) {
            throw new AppError("No atiende de forma presencial", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        // SPEC-834 (VEREDICTO A) · la SEGUNDA puerta de creación de franja (la unitaria) acota al
        // HUECO DE MODALIDAD puro: rechaza SOLO cuando la vigencia y NUESTRO re-chequeo están al día
        // (`repsAlDia`) pero el REPS NO cubre ESTA modalidad. Las causas de vigencia —REPS vencido, o
        // nuestro re-chequeo envejecido («estado 7», autoridad aún vigente)— NO las bloquea 834: son
        // el aviso de 813, la cola del operador de 836 y el backstop de 828 al reservar. Por qué NO
        // bloquearlas acá: (1) bloquear por NUESTRA demora le impediría trabajar a alguien con la
        // inscripción perfecta —peor que el vacío—; (2) el vacío que deja 834 se cura solo (el filtro
        // de 825 es DERIVADO: al re-verificar, sus franjas reaparecen sin tocar nada). Y así el
        // mensaje de Diseño queda SIEMPRE correcto: nunca le dice «su inscripción no cubre la
        // modalidad» a quien el problema es nuestra demora. FUENTE ÚNICA, sin reimplementar criterio:
        // `repsAlDia` (vigencia-only) + `esRepsElegibleParaModalidad` (SPEC-790 T4 · motor
        // `repsElegible`) + mapeo `modalidadRepsRequerida` (VIRTUAL→TELEMEDICINA). Un valor sin mapeo
        // NIEGA (fail-closed).
        const perfilRepo = new PerfilProfesionalRepository();
        const modalidadReps = modalidadRepsRequerida(body.modalidad);
        const repsAlDia = await perfilRepo.repsAlDia(perfil.id);
        const cubreModalidad =
            modalidadReps !== null &&
            (await perfilRepo.esRepsElegibleParaModalidad(perfil.id, modalidadReps));
        if (repsAlDia && !cubreModalidad) {
            // PIVOTE POR DATO (FORMA-SPEC834): ofrecer «publíquela en la otra modalidad» SOLO si esa
            // publicación sería REAL — el profesional ATIENDE la otra modalidad Y su REPS la cubre. La
            // forma nombra `esRepsElegibleParaModalidad(otra)`; se le SUMA `atiende(otra)` porque la
            // compuerta de banderas está DELANTE de ésta: sin el atiende, el pivote prometería una
            // publicación que esa compuerta rechaza — la segunda promesa falsa que el mensaje existe
            // para no hacer. Sin pivote real → forma (b), solo renovar.
            const otra = body.modalidad === "VIRTUAL" ? "PRESENCIAL" : "VIRTUAL";
            const atiendeOtra = otra === "VIRTUAL" ? perfil.atiendeVirtual : perfil.atiendePresencial;
            const otraReps = modalidadRepsRequerida(otra);
            const otraPublicable =
                atiendeOtra &&
                otraReps !== null &&
                (await perfilRepo.esRepsElegibleParaModalidad(perfil.id, otraReps));
            throw new AppError(
                mensajeRechazoRepsModalidad(body.modalidad, otraPublicable ? otra : null),
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        // 3) SPEC-449 (I-313) · TOPE DE HORIZONTE. La Ley 2375/2024 mide la
        //    obligación en el momento de la ATENCIÓN, no en el de la reserva:
        //    una franja que termina después de que caduquen los antecedentes es
        //    una cita agendada para cuando ya no valen.
        //
        //    Este tope es lo que DISUELVE el dilema del punto 4 de SPEC-449 —
        //    qué hacer con las citas confirmadas de un profesional que vence—:
        //    con él, ninguna cita nueva puede caer del otro lado del
        //    vencimiento, así que el caso deja de ser alcanzable por la vía
        //    normal. Prevenir en vez de cortar.
        const venceEn = await new PerfilProfesionalRepository().venceEnVigente(perfil.id);
        if (!venceEn) {
            throw new AppError(
                "Necesita una verificación aprobada para publicar disponibilidad",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        if (fin.getTime() > venceEn.getTime()) {
            throw new AppError(
                "Esa franja cae después de que venza su verificación. Renuévela y vuelva a publicarla.",
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
        const repo = new FranjaDisponibleRepository();
        // 2) Solape con una franja suya. Una agenda con dos franjas encimadas
        //    puede comprometer dos citas en el mismo rato.
        const solapada = await repo.existeSolapada(perfil.id, inicio, fin);
        if (solapada) {
            throw new AppError("Ya tiene una franja en ese horario", ERROR_CODES.VALIDATION_ERROR, 400);
        }
        const creada = await repo.crear({
            profesional: { connect: { id: perfil.id } },
            inicio,
            fin,
            modalidad: body.modalidad,
            tomada: false,
        });
        return NextResponse.json({ data: creada });
    } catch (error) {
        return errorToResponse(error, "[PROFESIONAL/FRANJAS/POST]");
    }
}
