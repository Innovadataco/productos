/**
 * SPEC-923 · PENDIENTES del barrido de correos — la otra mitad del candado de COBERTURA.
 *
 * Toda plantilla VIVA (`notificacion_plantillas` en prod) está en el REGISTRO ÚNICO, ACÁ, o en
 * HUERFANAS. Una clave nueva que no esté en ninguno de los tres → ROJO
 * (`correos-canonicos.cobertura*.test.ts`).
 *
 * Conciliado con el CRUCE de Diseño `26c2e1da` (FORMA-BARRIDO-09), hecho contra la TABLA VIVA (110
 * claves, no las 65 del grep literal: el grep perdía las claves por variable `${evento}.email`). La
 * FAMILIA sale del cruce, no de un grep: `referido.*`/`suscripcion.*` son familia 7 aunque su FORMA no
 * las nombre textualmente. `forma: null` = una de las 12 que ninguna FORMA cubre aún (pase «familia 9»).
 *
 * RATCHET: esta lista SOLO SE ACHICA. Cuando una familia entra al registro, sus claves SALEN de acá y
 * `TOPE_PENDIENTES` baja en el mismo PR. Subir el tope es agregar deuda, visible en el diff.
 */
export interface CopyPendiente {
    clave: string;
    /** Familia del barrido que la cubre (del cruce de Diseño). */
    familia: string;
    /** SHA (Gestión) del cruce/FORMA que asigna la familia, o `null` si aún sin FORMA. */
    forma: string | null;
    /** SPEC que la va a cubrir, o `null` si la familia aún no está radicada. */
    spec: string | null;
}

export const COPYS_PENDIENTES: readonly CopyPendiente[] = [
    { clave: "admin.contacto_bloqueado.email", familia: "8 · internas", forma: "26c2e1da", spec: null },
    { clave: "analisis.alerta.admin.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "analisis.anomalia.detectada.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "analisis.anomalia.detectada.in_app", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "analisis.digest.semanal.email", familia: "9 · interno/BI (pendiente FORMA)", forma: null, spec: null },
    { clave: "analisis.digest.semanal.in_app", familia: "9 · interno/BI (pendiente FORMA)", forma: null, spec: null },
    { clave: "analisis.operador.asignacion.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "analisis.operador.asignacion.in_app", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "bono.entregado_recompensa.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "bono.entregado_recompensa.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "caso.asignado.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "caso.asignado.in_app", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "colegio.bienvenida.email", familia: "3 · colegio", forma: "26c2e1da", spec: null },
    { clave: "colegio.comite.recomendacion_informe.in_app", familia: "3 · colegio", forma: "26c2e1da", spec: null },
    { clave: "colegio.invitacion.enviada.email", familia: "3 · colegio", forma: "26c2e1da", spec: null },
    { clave: "colegio.registro_enlace.email", familia: "3 · colegio", forma: "26c2e1da", spec: null },
    { clave: "comite.apelaciones.plazo.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "comite.invitacion.enviada.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "comite.pendientes.alerta.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "expediente.aclaracion.respondida.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.aclaracion.respondida.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.aclaracion.solicitada.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.aclaracion.solicitada.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.auto_cerrado_inactividad.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.auto_cerrado_inactividad.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.cerrado.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.cerrado.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.comite.aprobo.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.comite.aprobo.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.comite.sla_vencido.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.comite.sla_vencido.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.consolidacion.solicitada.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.consolidacion.solicitada.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.creado.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.creado.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.emergencia.activada.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.escalado.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.escalado.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.evento.agregado.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.evento.agregado.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.gravedad.subio_a_rojo.email", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "expediente.gravedad.subio_a_rojo.in_app", familia: "4 · expediente", forma: "26c2e1da", spec: null },
    { clave: "infra.alerta.email", familia: "8 · internas", forma: "26c2e1da", spec: null },
    { clave: "infra.rate_limit.email", familia: "8 · internas", forma: "26c2e1da", spec: null },
    { clave: "motor.deriva.alerta.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "padre.circulo_confianza.pendientes.email", familia: "2 · padre", forma: "26c2e1da", spec: null },
    { clave: "padre.circulo_confianza.reporte_enriquecido.email", familia: "2 · padre", forma: "26c2e1da", spec: null },
    { clave: "padre.circulo_confianza.reporte_enriquecido.in_app", familia: "2 · padre", forma: "26c2e1da", spec: null },
    { clave: "padre.hijo.reporte.email", familia: "2 · padre", forma: "26c2e1da", spec: null },
    { clave: "padre.hijo.reporte.in_app", familia: "2 · padre", forma: "26c2e1da", spec: null },
    { clave: "padre.perfil.email_cambiado.email", familia: "2 · padre", forma: "26c2e1da", spec: null },
    { clave: "padre.reporte.acceso_canjeado.email", familia: "9 · padre (pendiente FORMA)", forma: null, spec: null },
    { clave: "padre.reporte.acceso_canjeado.in_app", familia: "9 · padre (pendiente FORMA)", forma: null, spec: null },
    { clave: "padre.reporte.acceso_codigo.email", familia: "9 · padre (pendiente FORMA)", forma: null, spec: null },
    { clave: "padre.stepup.codigo.email", familia: "9 · padre (pendiente FORMA)", forma: null, spec: null },
    { clave: "profesional.verificacion.aprobada.email", familia: "9 · profesional (pendiente FORMA)", forma: null, spec: null },
    { clave: "profesional.verificacion.devuelta.email", familia: "9 · profesional (pendiente FORMA)", forma: null, spec: null },
    // DEUDA (VEREDICTO CEO 19-11): clave fuera de convención (guiones bajos, sin puntos). SÍ se emite
    // (corrida-vencimiento.service vía constante EVENTO_AVISO_VENCIMIENTO → el grep literal no la ve).
    // El rename a `profesional.verificacion.por_vencer` es migración de DATO + repuntar la constante del
    // emisor: lo decide la SPEC de la familia 9 que la meta al registro, no 923.
    { clave: "profesional_verificacion_por_vencer", familia: "9 · profesional (pendiente FORMA)", forma: null, spec: null },
    { clave: "referido.recompensa.otorgada.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "referido.recompensa.otorgada.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "referido.registrado.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "referido.registrado.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "referido.tope_anual.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "referido.tope_anual.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "reporte.circulo_confianza.aparece_menor.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "reporte.circulo_confianza.aparece_menor.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    // DEUDA (VEREDICTO CEO 19-11): clave sin puntos; SÍ se emite (corroboracion-padre, evento
    // `reporte.corroborado_por_otro`). Rename a `reporte.corroborado_por_otro` = migración de dato: familia 9.
    { clave: "reporte_corroborado_por_otro", familia: "9 · padre (pendiente FORMA)", forma: null, spec: null },
    { clave: "reporte.resuelto.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "reporte.resuelto.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "reporte.revision.requerida.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "reporte.score_critico.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.activada.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.activada.email.colegio", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.activada.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.cortada.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.cortada.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.en_gracia.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.en_gracia.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.por_vencer.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.por_vencer.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.solicitada.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.solicitada.email.colegio", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscripcion.solicitada.in_app", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "suscriptores.reporte_publicado.email", familia: "7 · extras comerciales", forma: "26c2e1da", spec: null },
    { clave: "usuario.bienvenida.comite.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "usuario.bienvenida.operador.email", familia: "5 · comité/operador/análisis", forma: "26c2e1da", spec: null },
    { clave: "usuario.credenciales.padre.email", familia: "6 · consentimiento/usuario", forma: "26c2e1da", spec: null },
];

/** RATCHET: igual al largo de la lista. Solo BAJA (una familia que entra al registro lo baja en su PR). */
export const TOPE_PENDIENTES = 87;

/**
 * HUÉRFANAS a retirar (VEREDICTO CEO 19-11): filas VIVAS en prod cuyo evento YA NO EXISTE, así que
 * ninguna FORMA se escribe para ellas. NO las crea el seed fresco (por eso el candado de BD fresca no
 * las ve); el guardián BLANDO contra la tabla viva (deploy `--aviso`) sí. SPEC-594 retiró el evento
 * `padre.reporte.texto_leido`; sus filas vivas quedaron. Datos/CEO decide cuándo borrarlas.
 */
export const COPYS_HUERFANOS: readonly { clave: string; motivo: string }[] = [
    { clave: "padre.reporte.texto_leido.email", motivo: "SPEC-594 retiró el evento; sin emisor" },
    { clave: "padre.reporte.texto_leido.in_app", motivo: "SPEC-594 retiró el evento; sin emisor" },
];

/**
 * Todo lo que está MAL en la cobertura. `vivas` = claves de la tabla (BD fresca = candado duro; tabla
 * viva de prod = guardián blando); `eventos` = eventos literales que el código emite (capa estática).
 * `[]` = cobertura completa.
 */
export function violacionesCobertura(
    entrada: { vivas?: readonly string[]; eventos?: readonly string[] },
    registro: readonly string[],
    pendientes: readonly string[],
    huerfanas: readonly string[] = []
): string[] {
    const v: string[] = [];
    const enRegistro = new Set(registro);
    const enPendientes = new Set(pendientes);
    const enHuerfanas = new Set(huerfanas);
    const cubiertas = new Set([...registro, ...pendientes, ...huerfanas]);
    for (const k of pendientes) if (enRegistro.has(k)) v.push(`«${k}» ya está en el registro: sacala de PENDIENTES (ratchet)`);
    for (const k of huerfanas) if (enRegistro.has(k) || enPendientes.has(k)) v.push(`huérfana «${k}» también en registro/pendientes: es una u otra`);
    if (enPendientes.size !== pendientes.length) v.push("PENDIENTES tiene claves repetidas");
    for (const k of entrada.vivas ?? []) if (!cubiertas.has(k)) v.push(`plantilla viva sin cubrir: «${k}» (ni registro, ni PENDIENTES, ni HUERFANAS)`);
    for (const e of entrada.eventos ?? []) {
        if (![`${e}.email`, `${e}.in_app`].some((k) => cubiertas.has(k))) v.push(`evento emitido sin plantilla cubierta: «${e}»`);
    }
    return v;
}
