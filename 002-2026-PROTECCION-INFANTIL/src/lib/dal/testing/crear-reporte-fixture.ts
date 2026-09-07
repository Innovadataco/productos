import { PrismaClient, type Prisma, type Reporte } from "@prisma/client";
import { crearReporteConTexto } from "@/lib/dal/services/crear-reporte-con-texto";

/**
 * S-C · helper ÚNICO de tests para crear un Reporte con su texto cifrado.
 *
 * `Reporte.texto`/`textoOriginal` ya NO existen como columnas (S-D · D-117): el relato vive
 * cifrado en `ContenidoReporte` (DEK por denuncia). Este helper reemplaza mecánicamente el
 * viejo alta directa de Reporte en los fixtures — misma forma de `data` — extrayendo
 * `texto`/`textoOriginal`/`origenEvidencia` hacia el factory (`crearReporteConTexto`, la única
 * vía de escritura, arch:check) y creando el Reporte con `contenidoId`.
 *
 * Nombre deliberadamente único (`crearReporteFixture`) para no chocar con los helpers locales
 * `crearReporteDePrueba` que ya viven en ~11 tests: esos delegan en este por el codemod.
 *
 * Acepta un `PrismaClient` (abre su propia `$transaction`) o un `TransactionClient` (usa esa).
 */
type DatosReporteFixture = Omit<Prisma.ReporteUncheckedCreateInput, "contenidoId"> & {
    texto: string;
    textoOriginal?: string;
    origenEvidencia?: Prisma.ContenidoReporteUncheckedCreateInput["origenEvidencia"];
};

export function crearReporteFixture(
    db: PrismaClient | Prisma.TransactionClient,
    args: { data: DatosReporteFixture }
): Promise<Reporte> {
    const { texto, textoOriginal, origenEvidencia, ...reporte } = args.data;
    // exactOptionalPropertyTypes: no pasar `undefined` explícito a los opcionales.
    const sellar = (tx: Prisma.TransactionClient) =>
        crearReporteConTexto(tx, {
            texto,
            ...(textoOriginal !== undefined ? { textoOriginal } : {}),
            ...(origenEvidencia !== undefined ? { origenEvidencia } : {}),
            reporte,
        });
    // Un PrismaClient trae `$transaction`; un TransactionClient no.
    return db instanceof PrismaClient ? db.$transaction(sellar) : sellar(db);
}
