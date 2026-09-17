/**
 * SPEC-700 (I-425) · Corrector de PROD: retira el requisito «otro» del parámetro
 * `verificacion.requisitos`. Decisión de Jelkin (17-09-2026): quedan tarjeta_profesional,
 * antecedentes y cedula.
 *
 * NO toca documentos: los `otro` ya subidos quedan en la base. Tras la baja, la
 * completitud, la decisión del verificador y las vistas del profesional/verificador solo
 * miran los requisitos vigentes (D-121 SPEC-700: `estadoDeDocumentos`, `decidir`,
 * `vista-profesional` iteran la lista; sobre la cola «documentos nuevos» ver el reporte
 * D-121 — `listarRenovaciones` es la costura que se trata aparte).
 *
 * Quirúrgico e idempotente:
 *   - Reconcilia el valor EXISTENTE quitando la entrada con clave `otro` y PRESERVA
 *     cualquier edición de admin en las otras tres (no las reescribe con el default).
 *   - Si no hay `otro`, no escribe (no-op).
 *   - ABORTA sin escribir si el resultado no son EXACTAMENTE las 3 claves vigentes, o si
 *     algún texto que sobrevive quedara prohibido (nombre de persona / «pendiente de
 *     definir»). Un corrector que escribe sobre un estado que no reconoce es una trampa.
 *
 * DRY-RUN por defecto (solo lee e imprime el diff, NO escribe). `--confirm` aplica en una
 * transacción con re-lectura (no pisa una edición concurrente).
 *
 * Uso: node --import tsx scripts/spec-700-retirar-requisito-otro.ts [--confirm]
 */
import { prisma } from "../src/lib/prisma";
import { parseArgs } from "./limpieza/_common";
import {
    CLAVE_PARAMETRO_REQUISITOS,
    CLAVES_REQUISITOS_VIGENTES,
    detectarTextoProhibido,
} from "../src/lib/profesionales/verificador/requisitos-default";

const CLAVE_A_RETIRAR = "otro";

interface Requisito {
    clave: string;
    nombre: string;
    descripcion?: string;
}

const args = parseArgs(process.argv, ["confirm"]);
const CONFIRM = args.confirm === true;

function parsearRequisitos(raw: string): Requisito[] {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
        throw new Error(`[spec-700] el valor de ${CLAVE_PARAMETRO_REQUISITOS} no es un arreglo JSON`);
    }
    return parsed as Requisito[];
}

async function main() {
    console.log(
        `[spec-700] modo: ${CONFIRM ? "APLICAR (--confirm)" : "DRY-RUN (sin --confirm, no se escribe nada)"}`,
    );

    const fila = await prisma.parametroSistema.findUnique({
        where: { clave: CLAVE_PARAMETRO_REQUISITOS },
    });
    if (!fila) {
        throw new Error(`[spec-700] no existe el parámetro ${CLAVE_PARAMETRO_REQUISITOS} — corré el seed primero.`);
    }

    const antes = parsearRequisitos(fila.valor);
    const clavesAntes = antes.map((r) => r.clave);
    console.log(`[spec-700] ANTES (${antes.length}): [${clavesAntes.join(", ")}]`);

    if (!antes.some((r) => r.clave === CLAVE_A_RETIRAR)) {
        console.log(`[spec-700] no hay requisito «${CLAVE_A_RETIRAR}» — nada que hacer (idempotente). Fin.`);
        return;
    }

    const despues = antes.filter((r) => r.clave !== CLAVE_A_RETIRAR);
    const clavesDespues = despues.map((r) => r.clave);

    // Guarda dura: el resultado tiene que ser EXACTAMENTE las 3 claves vigentes de la
    // decisión. Si prod trae claves inesperadas (un 5º requisito, un rename), NO se
    // escribe: se aborta y el humano decide.
    const esperado = new Set<string>(CLAVES_REQUISITOS_VIGENTES);
    const sobran = clavesDespues.filter((k) => !esperado.has(k));
    const faltan = [...esperado].filter((k) => !clavesDespues.includes(k));
    if (sobran.length > 0 || faltan.length > 0 || clavesDespues.length !== esperado.size) {
        throw new Error(
            `[spec-700] estado inesperado tras quitar «${CLAVE_A_RETIRAR}»: quedarían [${clavesDespues.join(", ")}], ` +
                `se esperaba [${[...esperado].join(", ")}]. Sobran: [${sobran.join(", ")}]; faltan: [${faltan.join(", ")}]. ` +
                "ABORTA sin escribir — revisá el valor del parámetro en prod.",
        );
    }

    // Guarda de contenido: ningún texto que sobrevive puede seguir nombrando a una persona
    // ni diciendo «pendiente de definir» (el mismo invariante del candado).
    const prohibidos = despues.flatMap((r) => [
        ...detectarTextoProhibido(r.nombre).map((p) => `${r.clave}.nombre: «${p}»`),
        ...detectarTextoProhibido(r.descripcion ?? "").map((p) => `${r.clave}.descripcion: «${p}»`),
    ]);
    if (prohibidos.length > 0) {
        throw new Error(
            `[spec-700] los requisitos que sobreviven traen texto prohibido: ${prohibidos.join("; ")}. ` +
                "ABORTA — corregí esos textos en el admin antes de retirar «otro».",
        );
    }

    console.log(
        `[spec-700] DESPUÉS (${despues.length}): [${clavesDespues.join(", ")}]  (se retira «${CLAVE_A_RETIRAR}»)`,
    );

    if (!CONFIRM) {
        console.log("[spec-700] DRY-RUN: no se escribió nada. Corré con --confirm para aplicar.");
        return;
    }

    const nuevoValor = JSON.stringify(despues);
    await prisma.$transaction(async (tx) => {
        // Re-lectura dentro de la transacción: si alguien editó el parámetro entre el
        // dry-run y ahora, no piso su cambio a ciegas.
        const actual = await tx.parametroSistema.findUnique({ where: { clave: CLAVE_PARAMETRO_REQUISITOS } });
        if (!actual) throw new Error("[spec-700] el parámetro desapareció entre lecturas — aborta.");
        if (actual.valor !== fila.valor) {
            throw new Error(
                "[spec-700] el parámetro cambió entre el dry-run y el --confirm (otra edición). " +
                    "Volvé a correr el dry-run y revisá antes de aplicar.",
            );
        }
        await tx.parametroSistema.update({
            where: { clave: CLAVE_PARAMETRO_REQUISITOS },
            data: { valor: nuevoValor },
        });
    });
    console.log(`[spec-700] APLICADO: ${antes.length} → ${despues.length} requisitos. Listo.`);
}

main()
    .catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
