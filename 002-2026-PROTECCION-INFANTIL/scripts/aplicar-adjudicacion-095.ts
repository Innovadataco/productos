/**
 * Aplica al banco gobernado (CasoEval, fixtureVersion=2) las 25 etiquetas adjudicadas
 * que DIFIEREN del banco (spec 095, cierre de curaduría; fuente:
 * ADJUDICACION-BANCO-PRIMERA-PASADA.md — 42/42 CEO 2026-07-24).
 * Los 17 casos de confirmación (banco ya correcto) NO se tocan:
 * #28,112,117,118,122,123,169,174,175,178,180,184,185,188,193,197,200.
 * Gobernanza (patrón de aplicar-curacion-fixture.ts): desactiva el caso viejo y crea
 * el nuevo (MANUAL_ADMIN, v2, creadoEn preservado para no romper el orden del banco),
 * ambos con AuditLog. Aborta en cualquier inconsistencia.
 * Uso: npx tsx scripts/aplicar-adjudicacion-095.ts
 */
import { prisma } from "../src/lib/prisma";
import { logAudit } from "../src/lib/audit";
import { CasoEvalFuente, RolUsuario } from "@prisma/client";

interface Cambio {
    caso: number;
    snippet: string;
    antesPrincipal: string;
    antesSecundaria: string | null;
    principal: string;
    secundaria: string | null;
    motivo: string;
}

const CAMBIOS: Cambio[] = [
    { caso: 5, snippet: "solicito imagenes intimas al menor a cambio de creditos", antesPrincipal: "SOLICITUD_MATERIAL", antesSecundaria: null, principal: "SOLICITUD_MATERIAL", secundaria: "OFRECIMIENTO_REGALOS", motivo: "Tipo 1: el regalo es el gancho; la solicitud es la conducta grave. Se agrega secundaria." },
    { caso: 43, snippet: "videollamada privada a un menor", antesPrincipal: "SOLICITUD_MATERIAL", antesSecundaria: null, principal: "SOLICITUD_MATERIAL", secundaria: "CONTACTO_INSISTENTE", motivo: "CEO (experto): pedir acceso visual íntimo en vivo a un menor es solicitud de material. Se agrega secundaria." },
    { caso: 44, snippet: "ofrecio dinero para que la menor le enviara fotos", antesPrincipal: "SOLICITUD_MATERIAL", antesSecundaria: null, principal: "SOLICITUD_MATERIAL", secundaria: "OFRECIMIENTO_REGALOS", motivo: "Tipo 1: la solicitud es la conducta grave, el pago es el gancho. Se agrega secundaria." },
    { caso: 67, snippet: "Lleva días escribiéndole a mi sobrina", antesPrincipal: "SOLICITUD_MATERIAL", antesSecundaria: null, principal: "SOLICITUD_MATERIAL", secundaria: "CONTACTO_INSISTENTE", motivo: "CEO (experto): adulto insistiendo en fotos de una niña de 12 = solicitud de material en curso. Se agrega secundaria." },
    { caso: 75, snippet: "ofreció dinero por Nequi", antesPrincipal: "OFRECIMIENTO_REGALOS", antesSecundaria: null, principal: "SOLICITUD_MATERIAL", secundaria: "OFRECIMIENTO_REGALOS", motivo: "Regla 3/Tipo 1: ofrece dinero por videos con secreto; la conducta grave es la solicitud." },
    { caso: 95, snippet: "lo espere sola a la salida del gimnasio", antesPrincipal: "SOLICITUD_ENCUENTRO", antesSecundaria: null, principal: "SOLICITUD_ENCUENTRO", secundaria: "CONTACTO_INSISTENTE", motivo: "Tipo 1: cita con secreto; los 3 modelos votaron ambas. Se agrega secundaria." },
    { caso: 97, snippet: "ya sabe en qué barrio vivimos", antesPrincipal: "SOLICITUD_ENCUENTRO", antesSecundaria: null, principal: "SOLICITUD_ENCUENTRO", secundaria: "CONTACTO_INSISTENTE", motivo: "Tipo 1: insiste en conocerla y ya sabe el barrio. Se agrega secundaria." },
    { caso: 98, snippet: "la quiere ver salir del colegio", antesPrincipal: "SOLICITUD_ENCUENTRO", antesSecundaria: null, principal: "SOLICITUD_ENCUENTRO", secundaria: "CONTACTO_INSISTENTE", motivo: "Tipo 1: solicitud de encuentro en preparación (pregunta hora y ruta). Se agrega secundaria." },
    { caso: 102, snippet: "fotos íntimas de una estudiante de noveno", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "COMPARTIMIENTO_SEXUAL", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "Regla 1: difusión de material de menor sin amenaza. Se agrega secundaria." },
    { caso: 103, snippet: "publicó en sus historias de Instagram fotos privadas", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "COMPARTIMIENTO_SEXUAL", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "Regla 1: difusión de material de menor sin amenaza. Se agrega secundaria." },
    { caso: 104, snippet: "grupo de Telegram está compartiendo imágenes íntimas", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "COMPARTIMIENTO_SEXUAL", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "Regla 1: red de distribución de material de menores. Se agrega secundaria." },
    { caso: 105, snippet: "capturas a un video íntimo", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "COMPARTIMIENTO_SEXUAL", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "CEO: principal COMPARTIMIENTO_SEXUAL; la amenaza si habla suma EXTORSION (tercera conducta, fuera del par principal/secundaria)." },
    { caso: 106, snippet: "reenvió a mi hijo de 13 años fotos íntimas", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "SOLICITUD_MATERIAL", secundaria: "COMPARTIMIENTO_SEXUAL", motivo: "Regla 1: hay solicitud ('pide que él también mande fotos') → SOLICITUD_MATERIAL principal." },
    { caso: 107, snippet: "guardó las fotos íntimas que ella le enviaba", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "COMPARTIMIENTO_SEXUAL", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "Regla 1: difusión acotada (mostrar en el celular) sin amenaza. Se agrega secundaria." },
    { caso: 108, snippet: "si no volvía con él iba a publicar", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "EXTORSION", secundaria: "COMPARTIMIENTO_SEXUAL", motivo: "Regla 1: sextorsión (amenaza explícita de publicar); el modelo acertaba más que el banco." },
    { caso: 109, snippet: "piden y reparten packs de niñas", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: null, principal: "COMPARTIMIENTO_SEXUAL", secundaria: "SOLICITUD_MATERIAL", motivo: "Regla 1: red que pide y reparte packs de menores (también DOXING como tercera conducta)." },
    { caso: 110, snippet: "si no le manda más fotos íntimas va a difundir", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: "SOLICITUD_MATERIAL", principal: "EXTORSION", secundaria: "SOLICITUD_MATERIAL", motivo: "Regla 1: sextorsión (difunde si no manda más; COMPARTIMIENTO_SEXUAL tercera conducta). Cambia principal." },
    { caso: 111, snippet: "la amenaza con subir sus fotos íntimas", antesPrincipal: "COMPARTIMIENTO_SEXUAL", antesSecundaria: "SOLICITUD_ENCUENTRO", principal: "EXTORSION", secundaria: "COMPARTIMIENTO_SEXUAL", motivo: "Regla 1: sextorsión para forzar un encuentro (SOLICITUD_ENCUENTRO tercera conducta). Cambia principal." },
    { caso: 131, snippet: "tenían a mi hijo afuera del colegio", antesPrincipal: "EXTORSION", antesSecundaria: null, principal: "EXTORSION", secundaria: "CONTACTO_INSISTENTE", motivo: "Tipo 1: secuestro virtual; los 3 modelos votaron EXTORSION y el colapso eligió la leve. Se agrega secundaria." },
    { caso: 135, snippet: "le exige a mi hija trescientos mil pesos", antesPrincipal: "DIFUSION_NO_CONSENTIDA", antesSecundaria: "EXTORSION", principal: "EXTORSION", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "Regla 1: sextorsión con exigencia de dinero y difusión ya realizada (COMPARTIMIENTO_SEXUAL tercera conducta). Se invierte principal/secundaria." },
    { caso: 138, snippet: "voz igualita a la de su mamá", antesPrincipal: "EXTORSION", antesSecundaria: "CONTENIDO_GENERADO_IA", principal: "EXTORSION", secundaria: "SUPLANTACION_IDENTIDAD", motivo: "Regla 3: la voz con IA es el método; la conducta es la extorsión (CONTENIDO_GENERADO_IA tercera conducta)." },
    { caso: 146, snippet: "hacerse pasar por un compañero y pedirle a mi hijo datos", antesPrincipal: "CONTENIDO_GENERADO_IA", antesSecundaria: null, principal: "SUPLANTACION_IDENTIDAD", secundaria: "CONTENIDO_GENERADO_IA", motivo: "Regla 3: el banco etiquetó por el método (IA); la conducta es la suplantación." },
    { caso: 149, snippet: "Crearon con inteligencia artificial imágenes íntimas de mi hija", antesPrincipal: "DIFUSION_NO_CONSENTIDA", antesSecundaria: "CONTENIDO_GENERADO_IA", principal: "COMPARTIMIENTO_SEXUAL", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "CEO: PROVISIONAL pendiente de confirmación legal (material de menor generado con IA) antes de producción (R08). CONTENIDO_GENERADO_IA tercera conducta." },
    { caso: 171, snippet: "dieron el nombre completo y el colegio", antesPrincipal: "DOXING", antesSecundaria: null, principal: "DOXING", secundaria: "DIFUSION_NO_CONSENTIDA", motivo: "Regla 2/Tipo 1: nombre + colegio identifican y localizan; los 3 modelos votaron DOXING. Se agrega secundaria." },
    { caso: 172, snippet: "Pasaron el número de mi hijo a un grupo grande", antesPrincipal: "DOXING", antesSecundaria: null, principal: "DOXING", secundaria: "CONTACTO_INSISTENTE", motivo: "Regla 2: difundir el número localiza al menor; el acoso resultante va de secundaria." },
];

const IP_ADDRESS = "script";
const USER_AGENT = "aplicar-adjudicacion-095";

async function getAdminUser() {
    const admin = await prisma.usuario.findFirst({
        where: { rol: RolUsuario.ADMIN, estado: "activo" },
        orderBy: { creadoEn: "asc" },
    });
    if (!admin) throw new Error("No se encontró un usuario ADMIN activo para auditar la adjudicación.");
    return admin;
}

async function main() {
    const admin = await getAdminUser();

    const banco = await prisma.casoEval.findMany({
        where: { fuente: CasoEvalFuente.SEMILLA, fixtureVersion: 2, activo: true },
        orderBy: { creadoEn: "asc" },
    });
    if (banco.length !== 200) throw new Error(`Se esperaban 200 casos SEMILLA v2 activos, hay ${banco.length}`);

    // Validación completa ANTES de escribir nada. Los casos se localizan por snippet
    // único de texto (el orden físico del banco no coincide con la numeración de la hoja).
    const localizados = new Map<number, (typeof banco)[number]>();
    for (const c of CAMBIOS) {
        const hits = banco.filter((r) => r.texto.includes(c.snippet));
        if (hits.length !== 1) {
            throw new Error(`#${c.caso}: snippet "${c.snippet}" con ${hits.length} coincidencias (se requiere exactamente 1)`);
        }
        const row = hits[0];
        if (row.categoriaEsperada !== c.antesPrincipal || (row.secundariaEsperada ?? null) !== c.antesSecundaria) {
            throw new Error(`#${c.caso}: etiqueta actual ${row.categoriaEsperada}/${row.secundariaEsperada ?? "—"} no coincide con la esperada ${c.antesPrincipal}/${c.antesSecundaria ?? "—"}`);
        }
        localizados.set(c.caso, row);
    }
    console.log(`Validación OK: ${CAMBIOS.length} cambios sobre 200 casos.`);

    const aplicados: { caso: number; antes: string; despues: string }[] = [];
    for (const c of CAMBIOS) {
        await prisma.$transaction(async (tx) => {
            const viejo = await tx.casoEval.findUnique({ where: { id: localizados.get(c.caso)!.id } });
            if (!viejo || !viejo.activo) throw new Error(`#${c.caso}: caso no encontrado o ya desactivado`);

            await tx.casoEval.update({ where: { id: viejo.id }, data: { activo: false } });
            await logAudit({
                accion: "EVAL_CASE_DISABLE",
                tipoRecurso: "CasoEval",
                recursoId: viejo.id,
                usuarioId: admin.id,
                valorAnterior: JSON.stringify({ activo: true, fixtureVersion: viejo.fixtureVersion, categoriaEsperada: viejo.categoriaEsperada, secundariaEsperada: viejo.secundariaEsperada }),
                valorNuevo: JSON.stringify({ activo: false, motivo: `adjudicación 095 caso #${c.caso}` }),
                ipAddress: IP_ADDRESS,
                userAgent: USER_AGENT,
                tx,
            });

            const creado = await tx.casoEval.create({
                data: {
                    texto: viejo.texto,
                    categoriaEsperada: c.principal,
                    secundariaEsperada: c.secundaria,
                    ruido: viejo.ruido,
                    fuente: CasoEvalFuente.MANUAL_ADMIN,
                    activo: true,
                    fixtureVersion: 2,
                    creadoPorId: admin.id,
                    creadoEn: viejo.creadoEn, // preserva el orden del banco en el export
                },
            });
            await logAudit({
                accion: "EVAL_CASE_CREATE",
                tipoRecurso: "CasoEval",
                recursoId: creado.id,
                usuarioId: admin.id,
                valorAnterior: JSON.stringify({ casoOrigenId: viejo.id, categoriaEsperada: viejo.categoriaEsperada, secundariaEsperada: viejo.secundariaEsperada }),
                valorNuevo: JSON.stringify({ categoriaEsperada: creado.categoriaEsperada, secundariaEsperada: creado.secundariaEsperada, fixtureVersion: 2, motivo: c.motivo }),
                ipAddress: IP_ADDRESS,
                userAgent: USER_AGENT,
                tx,
            });
        });
        const antes = `${c.antesPrincipal}${c.antesSecundaria ? ` (+${c.antesSecundaria})` : ""}`;
        const despues = `${c.principal}${c.secundaria ? ` (+${c.secundaria})` : ""}`;
        aplicados.push({ caso: c.caso, antes, despues });
        console.log(`#${c.caso}: ${antes} -> ${despues}`);
    }

    const activos = await prisma.casoEval.count({ where: { fixtureVersion: 2, activo: true } });
    console.log(`\nBanco v2 activo tras adjudicación: ${activos} casos (${aplicados.length} re-etiquetados).`);
    await prisma.$disconnect();
}

main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
