/**
 * SPEC-615 (I-374) · Candado de CLASE derivado del CATÁLOGO: ninguna FK RESTRICT/NO-ACTION hacia el
 * núcleo purgable (Expediente/Reporte/ContenidoReporte) queda sin que la purga la contemple.
 *
 * El orden de borrado de la purga total se venía manteniendo A MANO y se descubría incompleto UNA
 * constraint por incidente, siempre en producción con el borrado a medias (I-374 = la tercera:
 * InformePadre). Este candado NO mantiene otra lista a mano: lee `pg_constraint` (las FKs REALES tras
 * migrate deploy) y exige que cada FK RESTRICT hacia el núcleo esté declarada como cubierta. Si el
 * esquema gana una FK nueva hacia esas tablas y nadie la borra + la declara → ROJO en CI, no una
 * cuarta rotura silenciosa en la próxima ventana. «Que muera la clase, no el caso» (CEO).
 *
 * Integración (usa la BD): el catálogo sólo tiene las constraints tras `migrate deploy`; un unit no
 * ve un orden de FK. El ensayo sobre clon con datos reales (carril del CEO) es el complemento.
 */
import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { HIJAS_RESTRICT_EXPEDIENTE } from "../../scripts/limpieza/_borrar-expediente";

// Núcleo que la purga total borra y que el CEO nombró (I-374). Ampliá acá si sumás otra raíz.
const PADRES_PURGABLES = ["Expediente", "Reporte", "ContenidoReporte"] as const;

/**
 * Cobertura DECLARADA por nombre de constraint (`conname`, estable y único), y DÓNDE la borra la
 * purga. Sumar una FK RESTRICT nueva a estas tablas OBLIGA a borrarla en la purga y a declararla
 * acá; si no, la aserción de abajo se pone roja. Verificado contra pg_constraint el 2026-09-10.
 */
const COBERTURA_FK: Record<string, string> = {
    // → Expediente · borrar-padre / borrar-colegio vía borrarSubarbolExpediente
    EventoExpediente_expedienteId_fkey: "borrarSubarbolExpediente",
    InformePadre_expedienteId_fkey: "borrarSubarbolExpediente", // la que faltaba (I-374)
    aclaracion_expediente_expedienteId_fkey: "borrarSubarbolExpediente",
    informes_consolidados_expedienteId_fkey: "borrarSubarbolExpediente",
    patrones_expediente_expedienteId_fkey: "borrarSubarbolExpediente",
    // → Reporte
    AlertaColegio_reporteId_fkey: "reset-piloto pre-borrado global",
    eventos_match_reporteNuevoId_fkey: "borrar-reporte",
    // → ContenidoReporte
    EventoExpediente_contenidoId_fkey: "borrarSubarbolExpediente (borra EventoExpediente antes)",
    Reporte_contenidoId_fkey: "borrar-reporte (Reporte antes que su ContenidoReporte)",
};

describe("SPEC-615 · cobertura FK de la purga (derivada del catálogo)", () => {
    it("toda FK RESTRICT/NO-ACTION hacia el núcleo purgable está declarada como cubierta", async () => {
        const inList = PADRES_PURGABLES.map((p) => `'${p}'`).join(",");
        const filas = await prisma.$queryRawUnsafe<Array<{ conname: string; parent: string; child: string; deltype: string }>>(
            `SELECT con.conname, parent.relname AS parent, child.relname AS child, con.confdeltype AS deltype
               FROM pg_constraint con
               JOIN pg_class child ON child.oid = con.conrelid
               JOIN pg_class parent ON parent.oid = con.confrelid
              WHERE con.contype='f' AND con.confdeltype IN ('r','a')
                AND parent.relname IN (${inList})`,
        );

        // Sanity: el catálogo tiene FKs hacia el núcleo (si da 0, la consulta o la BD están mal).
        expect(filas.length, "el catálogo debería tener FKs RESTRICT hacia el núcleo purgable").toBeGreaterThan(0);

        // (1) FK nueva sin cobertura declarada → la cuarta rotura, cazada en CI y no en prod.
        const sinCubrir = filas.filter((f) => !(f.conname in COBERTURA_FK));
        expect(
            sinCubrir.map((f) => `${f.child}→${f.parent} (${f.conname})`),
            "FK RESTRICT hacia el núcleo SIN cobertura: bórrala en la purga (si es hija de Expediente, en borrarSubarbolExpediente) y declárala en COBERTURA_FK",
        ).toEqual([]);

        // (2) Entrada declarada que ya no existe en el catálogo → mantener el mapa honesto.
        const actuales = new Set(filas.map((f) => f.conname));
        const obsoletas = Object.keys(COBERTURA_FK).filter((c) => !actuales.has(c));
        expect(obsoletas, "entradas de COBERTURA_FK que ya no existen en el catálogo (quitalas)").toEqual([]);
    });

    it("HIJAS_RESTRICT_EXPEDIENTE = EXACTAMENTE las hijas RESTRICT de Expediente en el catálogo (origen único, derivado)", async () => {
        // Cierra la segunda mitad del hueco: no basta con que la cobertura DETECTE una FK nueva (arriba);
        // `HIJAS_RESTRICT_EXPEDIENTE` —la constante que el helper borra y que el ensayo de subárbol itera—
        // tiene que SER exactamente las hijas RESTRICT de Expediente según pg_constraint. Se deriva el
        // nombre de tabla de cada modelo por el DMMF de Prisma (respeta `@@map`), sin lista a mano.
        const filas = await prisma.$queryRawUnsafe<Array<{ child: string }>>(
            `SELECT child.relname AS child
               FROM pg_constraint con
               JOIN pg_class child ON child.oid = con.conrelid
               JOIN pg_class parent ON parent.oid = con.confrelid
              WHERE con.contype='f' AND con.confdeltype IN ('r','a') AND parent.relname = 'Expediente'`,
        );
        const catalogo = [...new Set(filas.map((f) => f.child))].sort();
        const tablaDe = (modelo: string) =>
            Prisma.dmmf.datamodel.models.find((m) => m.name === modelo)?.dbName ?? modelo;
        const constante = [...new Set(HIJAS_RESTRICT_EXPEDIENTE.map(tablaDe))].sort();

        expect(catalogo.length, "el catálogo debe tener hijas RESTRICT de Expediente (si da 0, algo está mal)").toBeGreaterThan(0);
        expect(
            constante,
            "HIJAS_RESTRICT_EXPEDIENTE debe ser EXACTAMENTE las hijas RESTRICT de Expediente en pg_constraint: " +
                "si el catálogo gana/pierde una, actualizá la constante Y su deleteMany en _borrar-expediente.ts",
        ).toEqual(catalogo);
    });
});
