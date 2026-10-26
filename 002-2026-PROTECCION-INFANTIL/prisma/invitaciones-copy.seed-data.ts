/**
 * SPEC-909 · Copy USTED canónico de las invitaciones (Diseño · SHA Gestión `446e8dc2` §2).
 *
 * FUENTE ÚNICA del seed (`prisma/seed.ts`) Y del corrector in-place
 * (`scripts/corregir-invitaciones-usted.ts`) — una sola sede, sin derivar (lección del
 * corrector de guías, SPEC-908). El motor (SPEC-909) convierte este Markdown a HTML dentro
 * del layout institucional: `**x**`→`<strong>`, y el `[Activar…]({{linkActivacion}})` a
 * solas en su párrafo → BOTÓN primario.
 *
 * Voz USTED (D-107: colegio + comité). Antes: colegio en «tú», comité mixto + «link».
 * §3 de la FORMA: NO tocar `variablesSchema` ni las claves de evento/plantilla — esto es
 * re-seed de `asunto` + `cuerpoMarkdown` de las 2 filas vivas.
 */
export interface PlantillaInvitacionCopy {
    /** Clave de la plantilla EMAIL del evento (no se cambia). */
    clave: string;
    asunto: string;
    cuerpoMarkdown: string;
}

export const INVITACIONES_USTED: PlantillaInvitacionCopy[] = [
    {
        clave: "colegio.invitacion.enviada.email",
        asunto: "Active su cuenta de Protección Infantil",
        cuerpoMarkdown:
            "Hola, {{nombreRector}}:\n\n" +
            "Protección Infantil es la plataforma que acompaña a las instituciones educativas en la detección temprana y el manejo de riesgos para sus estudiantes. **{{nombreColegio}}** fue inscrito, y usted quedó registrado como su rector.\n\n" +
            "Para activar su cuenta y crear su contraseña, haga clic en el botón:\n\n" +
            "[Activar mi cuenta]({{linkActivacion}})\n\n" +
            "El enlace es de un solo uso y vence en 48 horas. Si usted no esperaba este registro, puede ignorar este mensaje.",
    },
    {
        clave: "comite.invitacion.enviada.email",
        asunto: "Active la cuenta del Comité de Convivencia",
        cuerpoMarkdown:
            "Hola:\n\n" +
            "Protección Infantil es la plataforma que acompaña a las instituciones educativas en la detección y el manejo de riesgos para sus estudiantes. Esta es la invitación a la **cuenta compartida del Comité de Convivencia** de **{{nombreColegio}}**.\n\n" +
            "Para activar la cuenta y definir su contraseña, haga clic en el botón:\n\n" +
            "[Activar la cuenta]({{linkActivacion}})\n\n" +
            "El enlace es de un solo uso y vence en 48 horas. Si no esperaba esta invitación, puede ignorar este mensaje.",
    },
];

/** Busca el copy canónico por clave de plantilla; falla-cerrado si falta (seed/corrector). */
export function copyInvitacion(clave: string): PlantillaInvitacionCopy {
    const copy = INVITACIONES_USTED.find((p) => p.clave === clave);
    if (!copy) throw new Error(`SPEC-909: no hay copy de invitación canónico para '${clave}'`);
    return copy;
}
