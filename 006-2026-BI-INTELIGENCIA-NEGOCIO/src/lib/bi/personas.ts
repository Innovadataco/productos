// src/lib/bi/personas.ts · Capa de datos de Personas (BI v2 · réplica real de PI)
// Producto 006 · BI v2
//
// Alimenta la pestaña "Personas" del mockup v3 con datos REALES de la réplica
// read-only de PI: rosters de colegios ("Profesor", "Alumno",
// "AcudienteEstudiante"), sus identificadores tipados ("IdentificadorAlumno",
// "IdentificadorAcudiente", "IdentificadorProfesor" — SIN `valor`, cortado en
// origen por la publicación, ver 02-pi-db-publicacion.sql), alertas por
// sujeto/estado ("AlertaColegio") y el círculo familiar del lado padre
// ("Hijo", "ContactoConfianza", "IdentificadorHijo").
//
// PII: en el suscriptor NO existen nombres, documentos ni valores de
// identificadores. Aquí solo se CUENTA — jamás se intenta leer una columna
// que no viaja (defensa en profundidad de la réplica).
//
// Candado 9 (honestidad): toda cifra sale del ResultSet; una consulta rota
// degrada SU sección a ceros/vacío con warn (mismo patrón que pulso.ts) y
// el resto de la pestaña vive. Candado 10: ningún número quemado.
//
// Criterios documentados:
//   · Rosters y conteos de personas: solo filas con estado 'activo' (la baja
//     en PI es lógica; lo inactivo no es red vigente).
//   · Madres/padres: AcudienteEstudiante.relacion es texto libre corto; se
//     cuenta como madre/padre solo la coincidencia exacta normalizada
//     (lower + btrim). Otras relaciones ("tía", "abuela", …) NO se reparten
//     a ningún cubo: se muestran solo dentro del total (no se adivinan).
//   · Identificadores por plataforma: union de las tres tablas de
//     identificadores con LEFT JOIN a "Plataforma" (nombre legible);
//     plataformaId NULL → cubo honesto "Sin plataforma".
//   · Círculo: hijos activos, contactos de confianza activos e
//     identificadores de hijo activos. El vínculo padre-hijo real
//     (Hijo.usuarioId) no está publicado en la réplica por decisión de
//     producto (SPEC-339) y "HijoPadre" quedó obsoleta en PI: el embudo ya
//     no intenta medir ese paso (auditoría DEFECTO 1, 03-09-2026).

import { prisma } from "@/lib/db";

// ─── Contrato expuesto a la UI de Personas ───────────────────────────────────
export interface PersonasData {
    profesores: number;
    /** Profesores activos con ≥1 identificador activo (red monitoreada) */
    profesoresVigilados: number;
    alumnos: number;
    acudientes: number;
    /** relacion normalizada = 'madre' (exacta; otras relaciones no se reparten) */
    acudientesMadres: number;
    /** relacion normalizada = 'padre' */
    acudientesPadres: number;
    identificadores: {
        alumnos: number;
        acudientes: number;
        profesores: number;
        /** Suma de los tres conteos del ResultSet */
        total: number;
    };
    alertasPorSujeto: { sujeto: string; total: number }[];
    alertasPorEstado: { estado: string; total: number }[];
    /** Plataforma legible (Plataforma.nombre); "Sin plataforma" si NULL */
    identificadoresPorPlataforma: { plataforma: string; total: number }[];
    circulo: {
        hijos: number;
        contactos: number;
        identificadoresHijo: number;
    };
}

// ─── Filas crudas de las consultas ───────────────────────────────────────────
interface FilaBase {
    profesores: number;
    profesores_vigilados: number;
    alumnos: number;
    acudientes: number;
    acudientes_madres: number;
    acudientes_padres: number;
}
interface FilaIdentificadores {
    alumnos: number;
    acudientes: number;
    profesores: number;
}
interface FilaSujeto {
    sujeto: string;
    total: number;
}
interface FilaEstadoAlerta {
    estado: string;
    total: number;
}
interface FilaPlataforma {
    plataforma: string;
    total: number;
}
interface FilaCirculo {
    hijos: number;
    contactos: number;
    identificadores_hijo: number;
}

// Fallbacks de degradación (consulta rota → ceros con warn; candado 9).
const BASE_VACIA: FilaBase = {
    profesores: 0,
    profesores_vigilados: 0,
    alumnos: 0,
    acudientes: 0,
    acudientes_madres: 0,
    acudientes_padres: 0,
};
const IDS_VACIOS: FilaIdentificadores = { alumnos: 0, acudientes: 0, profesores: 0 };
const CIRCULO_VACIO: FilaCirculo = {
    hijos: 0,
    contactos: 0,
    identificadores_hijo: 0,
};

/**
 * Ejecuta una consulta de una sección de Personas. Si falla (réplica caída,
 * tabla ausente), la sección degrada a VACÍO con warn — nunca se inventa un
 * dato para rellenarla (candado 9) y el resto de la pestaña vive.
 */
async function intentar<T>(seccion: string, consulta: Promise<T[]>): Promise<T[]> {
    try {
        return await consulta;
    } catch (error) {
        console.warn(
            `[Personas] Sección '${seccion}' degradada a vacío: consulta falló — ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return [];
    }
}

/**
 * Datos de Personas. Seis sondeos independientes en paralelo (cada uno
 * degrada por su cuenta). Queries $queryRaw con identificadores citados;
 * conteos casteados a ::int en SQL (bigint no es serializable).
 */
export async function getPersonas(): Promise<PersonasData> {
    const [
        filasBase,
        filasIdentificadores,
        filasSujeto,
        filasEstado,
        filasPlataforma,
        filasCirculo,
    ] = await Promise.all([
        // Rosters activos + madres/padres + profesores con red monitoreada.
        intentar(
            "base",
            prisma.$queryRaw<FilaBase[]>`
                SELECT
                  (SELECT count(*) FROM "Profesor" WHERE "estado" = 'activo')::int
                    AS profesores,
                  (SELECT count(DISTINCT ip."profesorId")
                     FROM "IdentificadorProfesor" ip
                     JOIN "Profesor" p ON p."id" = ip."profesorId"
                    WHERE ip."estado" = 'activo' AND p."estado" = 'activo')::int
                    AS profesores_vigilados,
                  (SELECT count(*) FROM "Alumno" WHERE "estado" = 'activo')::int
                    AS alumnos,
                  (SELECT count(*) FROM "AcudienteEstudiante" WHERE "estado" = 'activo')::int
                    AS acudientes,
                  (SELECT count(*) FROM "AcudienteEstudiante"
                    WHERE "estado" = 'activo' AND lower(btrim("relacion")) = 'madre')::int
                    AS acudientes_madres,
                  (SELECT count(*) FROM "AcudienteEstudiante"
                    WHERE "estado" = 'activo' AND lower(btrim("relacion")) = 'padre')::int
                    AS acudientes_padres`,
        ),
        intentar(
            "identificadores",
            prisma.$queryRaw<FilaIdentificadores[]>`
                SELECT
                  (SELECT count(*) FROM "IdentificadorAlumno" WHERE "estado" = 'activo')::int
                    AS alumnos,
                  (SELECT count(*) FROM "IdentificadorAcudiente" WHERE "estado" = 'activo')::int
                    AS acudientes,
                  (SELECT count(*) FROM "IdentificadorProfesor" WHERE "estado" = 'activo')::int
                    AS profesores`,
        ),
        intentar(
            "alertas-por-sujeto",
            prisma.$queryRaw<FilaSujeto[]>`
                SELECT "tipoSujeto" AS sujeto, count(*)::int AS total
                FROM "AlertaColegio"
                GROUP BY "tipoSujeto"
                ORDER BY total DESC, "tipoSujeto"`,
        ),
        intentar(
            "alertas-por-estado",
            prisma.$queryRaw<FilaEstadoAlerta[]>`
                SELECT "estado" AS estado, count(*)::int AS total
                FROM "AlertaColegio"
                GROUP BY "estado"
                ORDER BY total DESC, "estado"`,
        ),
        // Identificadores activos por plataforma (nombre legible; NULL →
        // cubo "Sin plataforma"). UNION ALL de las tres tablas: el valor del
        // identificador NO existe en el suscriptor, solo se cuentan filas.
        intentar(
            "identificadores-por-plataforma",
            prisma.$queryRaw<FilaPlataforma[]>`
                SELECT COALESCE(p."nombre", 'Sin plataforma') AS plataforma,
                       count(*)::int AS total
                FROM (
                    SELECT "plataformaId" FROM "IdentificadorAlumno" WHERE "estado" = 'activo'
                    UNION ALL
                    SELECT "plataformaId" FROM "IdentificadorAcudiente" WHERE "estado" = 'activo'
                    UNION ALL
                    SELECT "plataformaId" FROM "IdentificadorProfesor" WHERE "estado" = 'activo'
                ) ids
                LEFT JOIN "Plataforma" p ON p."id" = ids."plataformaId"
                GROUP BY COALESCE(p."nombre", 'Sin plataforma')
                ORDER BY total DESC, plataforma`,
        ),
        intentar(
            "circulo",
            prisma.$queryRaw<FilaCirculo[]>`
                SELECT
                  (SELECT count(*) FROM "Hijo" WHERE "estado" = 'activo')::int
                    AS hijos,
                  (SELECT count(*) FROM "ContactoConfianza" WHERE "activo" = true)::int
                    AS contactos,
                  (SELECT count(*) FROM "IdentificadorHijo" WHERE "activo" = true)::int
                    AS identificadores_hijo`,
        ),
    ]);

    const base = filasBase[0] ?? BASE_VACIA;
    const ids = filasIdentificadores[0] ?? IDS_VACIOS;
    const circulo = filasCirculo[0] ?? CIRCULO_VACIO;

    return {
        profesores: base.profesores,
        profesoresVigilados: base.profesores_vigilados,
        alumnos: base.alumnos,
        acudientes: base.acudientes,
        acudientesMadres: base.acudientes_madres,
        acudientesPadres: base.acudientes_padres,
        identificadores: {
            alumnos: ids.alumnos,
            acudientes: ids.acudientes,
            profesores: ids.profesores,
            total: ids.alumnos + ids.acudientes + ids.profesores,
        },
        alertasPorSujeto: filasSujeto.map((f) => ({ sujeto: f.sujeto, total: f.total })),
        alertasPorEstado: filasEstado.map((f) => ({ estado: f.estado, total: f.total })),
        identificadoresPorPlataforma: filasPlataforma.map((f) => ({
            plataforma: f.plataforma,
            total: f.total,
        })),
        circulo: {
            hijos: circulo.hijos,
            contactos: circulo.contactos,
            identificadoresHijo: circulo.identificadores_hijo,
        },
    };
}
