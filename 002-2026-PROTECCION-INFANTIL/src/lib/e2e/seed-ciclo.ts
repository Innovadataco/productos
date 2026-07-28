/**
 * SPEC-114 — seed determinista POR CICLO: datos NUEVOS cada ciclo (identificadores, textos
 * y cantidades varían con el número de ciclo). Determinista = suite estable entre corridas.
 */
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { crearParametrosExpediente } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

export interface BancoCiclo {
    ciclo: number;
    identificadorPocos: string;   // I-11: identificador con pocos reportes (bajo umbral)
    identificadorVarios: string;  // I-11: con varios reportes (sobre umbral)
    identificadorComun: string;   // varios reportes al mismo identificador
    textoBase: string;
    cantidadComunes: number;
}

export function datosCiclo(ciclo: number): BancoCiclo {
    return {
        ciclo,
        identificadorPocos: `+57311${String(ciclo).padStart(4, "0")}11`,
        identificadorVarios: `+57311${String(ciclo).padStart(4, "0")}22`,
        identificadorComun: `+57311${String(ciclo).padStart(4, "0")}33`,
        textoBase: `Caso del ciclo ${ciclo}: un adulto insiste en pedir fotos íntimas a una menor de ${12 + ciclo} años ofreciéndole dinero.`,
        cantidadComunes: 3 + ciclo, // varía por ciclo: 4, 5, 6, 7, 8
    };
}

export const CATEGORIAS_BANCO: CategoriaConducta[] = [
    "SOLICITUD_MATERIAL",
    "CONTACTO_INSISTENTE",
    "OFRECIMIENTO_REGALOS",
    "EXTORSION",
];

/** Siembra la infraestructura base de TODOS los ciclos (idempotente con resetDatabase). */
export async function sembrarBase() {
    await resetDatabase();
    await crearParametrosReportes();
    await crearParametrosExpediente();
    await crearPlataforma();
    await crearPlataforma("instagram", "Instagram", "red_social");
    await crearPlataforma("telegram", "Telegram", "mensajeria");
    await crearPaisCiudad();
}

/** Siembra reportes del banco del ciclo (con la clasificación simulada ya persistida). */
export async function sembrarBancoCiclo(datos: BancoCiclo, plataformaClave = "whatsapp") {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: plataformaClave } });
    if (!plataforma) throw new Error(`Plataforma ${plataformaClave} no sembrada`);

    const crear = async (identificador: string, categoria: CategoriaConducta, anonimo: boolean, texto: string) => {
        const r = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma.id,
                texto,
                fechaIncidente: new Date("2026-07-20T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: anonimo,
                numeroSeguimiento: `RPT-C${datos.ciclo}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
                estado: "CLASIFICADO",
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: r.id,
                categoria,
                confianza: 0.9,
                contienePii: false,
                piiDetectada: [],
                modeloUsado: "rubrica:gemma2:27b+qwen2.5:14b+aya-expanse:32b",
                latenciaMs: 1000,
                categoriasSecundarias: [],
            },
        });
        return r;
    };

    // I-11: pocos (1 reporte, bajo umbral) y varios (sobre umbral, mayoría autenticados)
    await crear(datos.identificadorPocos, "CONTACTO_INSISTENTE", true, `${datos.textoBase} (rama pocos reportes)`);
    const umbral = 3; // visibility.report_threshold del seed de test
    for (let i = 0; i < umbral + 1; i++) {
        await crear(datos.identificadorVarios, "SOLICITUD_MATERIAL", i !== 0, `${datos.textoBase} (rama varios ${i + 1})`);
    }
    // Varios reportes al mismo identificador (para contadores D-08)
    const creados: string[] = [];
    for (let i = 0; i < datos.cantidadComunes; i++) {
        const categoria = CATEGORIAS_BANCO[i % CATEGORIAS_BANCO.length];
        const r = await crear(datos.identificadorComun, categoria, i % 2 === 0, `${datos.textoBase} (común ${i + 1})`);
        creados.push(r.id);
    }
    return creados;
}
