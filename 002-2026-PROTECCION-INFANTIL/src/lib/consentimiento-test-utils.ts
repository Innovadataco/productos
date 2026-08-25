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

    const roles = ["PARENT", "SCHOOL_ADMIN", "ADMIN", "OPERADOR", "COMITE_VALIDACION", "COMITE_CONVIVENCIA"] as const;
    for (const rol of roles) {
        for (const canal of ["EMAIL", "IN_APP"] as const) {
            const existente = await prisma.notificacionRegla.findFirst({
                where: { evento, rol, canal },
                orderBy: { createdAt: "desc" },
            });
            const data = {
                evento,
                rol,
                offset: "+0m",
                canal,
                plantillaClave: `${evento}.${canal.toLowerCase()}`,
                obligatoria: false,
                activa: true,
            };
            if (existente) {
                await prisma.notificacionRegla.update({
                    where: { id: existente.id },
                    data: {
                        offset: data.offset,
                        plantillaClave: data.plantillaClave,
                        obligatoria: data.obligatoria,
                        activa: true,
                    },
                });
            } else {
                await prisma.notificacionRegla.create({ data });
            }
        }
    }
}
