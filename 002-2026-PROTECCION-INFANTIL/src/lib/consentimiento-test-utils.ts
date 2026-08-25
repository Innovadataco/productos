/**
 * Helpers de test para SPEC-241 (consentimiento informado).
 * Sembrado mínimo idempotente de parámetros y reglas/plantillas del Motor Notif.
 */
import { prisma } from "./prisma";
import { TipoParametro, CategoriaParametro } from "@prisma/client";

export async function crearParametrosConsentimiento() {
    await prisma.parametroSistema.upsert({
        where: { clave: "consentimiento.version_actual" },
        update: { valor: "v0.4" },
        create: {
            clave: "consentimiento.version_actual",
            valor: "v0.4",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.LEGAL,
            esPublico: false,
            descripcion: "Versión vigente del consentimiento informado (SPEC-241)",
        },
    });

    await prisma.parametroSistema.upsert({
        where: { clave: "consentimiento.padre.documento_ruta" },
        update: { valor: "public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md" },
        create: {
            clave: "consentimiento.padre.documento_ruta",
            valor: "public/legal/POLITICA-TRATAMIENTO-DATOS-v0.4.md",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.LEGAL,
            esPublico: false,
            descripcion: "Ruta del documento legal para padres/tutores (SPEC-241)",
        },
    });

    await prisma.parametroSistema.upsert({
        where: { clave: "consentimiento.colegio.documento_ruta" },
        update: { valor: "public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md" },
        create: {
            clave: "consentimiento.colegio.documento_ruta",
            valor: "public/legal/CONVENIO-TRATAMIENTO-DATOS-COLEGIOS.md",
            tipo: TipoParametro.STRING,
            categoria: CategoriaParametro.LEGAL,
            esPublico: false,
            descripcion: "Ruta del convenio institucional para colegios (SPEC-241)",
        },
    });
}

export async function crearEventoConsentimiento() {
    const evento = "consentimiento.aceptado";
    const asunto = "Confirmación de aceptación de términos";
    const cuerpoEmail = "Hola {{nombreUsuario}},\n\nConfirmamos que aceptaste la versión {{version}}.";
    const cuerpoInApp = "Aceptaste los términos de tratamiento de datos personales (versión {{version}}).";

    const plantillas = [
        { clave: `${evento}.email`, canal: "EMAIL" as const, asunto, cuerpoMarkdown: cuerpoEmail },
        { clave: `${evento}.in_app`, canal: "IN_APP" as const, asunto: undefined, cuerpoMarkdown: cuerpoInApp },
    ];

    for (const pl of plantillas) {
        await prisma.notificacionPlantilla.upsert({
            where: { clave: pl.clave },
            update: {
                canal: pl.canal,
                asunto: pl.asunto ?? null,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
            create: {
                clave: pl.clave,
                canal: pl.canal,
                asunto: pl.asunto ?? null,
                cuerpoMarkdown: pl.cuerpoMarkdown,
                variablesSchema: { type: "object", properties: {} },
                activa: true,
            },
        });
    }

    // SPEC-247 (002-PI-150): el schema impone @@unique([evento, canal, plantillaClave]).
    // El motor de notificaciones programa UNA notificación por canal para el evento,
    // sin filtrar por rol del destinatario; basta con una regla representativa.
    for (const canal of ["EMAIL", "IN_APP"] as const) {
        await prisma.notificacionRegla.upsert({
            where: {
                evento_canal_plantillaClave: {
                    evento,
                    canal,
                    plantillaClave: `${evento}.${canal.toLowerCase()}`,
                },
            },
            update: {
                offset: "+0m",
                obligatoria: false,
                activa: true,
            },
            create: {
                evento,
                rol: "PARENT",
                offset: "+0m",
                canal,
                plantillaClave: `${evento}.${canal.toLowerCase()}`,
                obligatoria: false,
                activa: true,
            },
        });
    }
}
