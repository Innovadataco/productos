/**
 * SPEC-918 · Copy del correo de ACTIVACIÓN por enlace del colegio
 * (`colegio.registro_enlace.email`, evento SPEC-344).
 *
 * FUENTE ÚNICA del seed (`prisma/seed.ts`) Y del corrector in-place
 * (`scripts/corregir-colegio-registro-enlace-boton.ts`) — una sola sede, sin derivar
 * (lección SPEC-908/909). El motor (SPEC-909) convierte el `[Activar…]({{url}})` a solas en
 * su párrafo → BOTÓN primario bulletproof, igual que `comite.invitacion.enviada.email`. Antes
 * el cuerpo tenía `{{url}}` SUELTA (URL pelada), no un botón.
 *
 * PRESERVA la variable `{{url}}` (NO es `{{linkActivacion}}`): este evento la usa — el schema
 * de la plantilla declara `url` + `nombreColegio`. Voz USTED (D-107). No se toca
 * `variablesSchema` ni la clave (§3 de la FORMA): es re-seed de `asunto` + `cuerpoMarkdown`.
 *
 * El copy EXACTO del botón lo confirma Diseño vía CEO; «Activar mi cuenta» es provisional
 * (iguala al botón de `colegio.invitacion.enviada.email`). El candado es ESTRUCTURAL —no
 * depende del texto del botón—, así que un ajuste de copy no lo rompe.
 */
export interface PlantillaRegistroEnlaceCopy {
    /** Clave de la plantilla EMAIL del evento (no se cambia). */
    clave: string;
    asunto: string;
    cuerpoMarkdown: string;
}

export const COLEGIO_REGISTRO_ENLACE_COPY: PlantillaRegistroEnlaceCopy = {
    clave: "colegio.registro_enlace.email",
    asunto: "Cree su contraseña y empecemos",
    cuerpoMarkdown:
        "Hola,\n\n" +
        "Usted está por activar la cuenta del **{{nombreColegio}}** en Protección Infantil.\n\n" +
        "Para crear su contraseña y activar la cuenta, haga clic en el botón:\n\n" +
        "[Activar mi cuenta]({{url}})\n\n" +
        "El enlace vence en 24 horas y solo se puede usar una vez. Si no fue usted quien lo pidió, no tiene que hacer nada.",
};

/** Las filas vivas que el corrector in-place trae a este copy (hoy una sola). */
export const COLEGIO_REGISTRO_ENLACE_COPIES: PlantillaRegistroEnlaceCopy[] = [COLEGIO_REGISTRO_ENLACE_COPY];
