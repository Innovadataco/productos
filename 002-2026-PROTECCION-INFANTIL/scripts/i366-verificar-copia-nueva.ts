/**
 * I-366 · PRE-FLIGHT OBLIGATORIO — IGUALDAD por fila y por campo. Correr ANTES de la migración de purga.
 *
 * NO basta con que la copia nueva DESCIFRE (legible): hay que confirmar que su texto es EXACTAMENTE el
 * de la copia vieja que vamos a destruir. Si el backfill de 581 selló o enlazó mal una fila
 * (`contenidoId` apuntando a otro contenido, o cifrado del texto equivocado), la copia nueva descifra
 * legible pero INCORRECTA; sin esta comparación el DROP borraría la única copia correcta — corrupción
 * silenciosa e irreversible que nadie notaría después. La copia vieja está AHORA: comparar es casi gratis.
 * (La versión previa solo verificaba `plano && length>0` — «legible», no «correcta». Ese era el hueco.)
 *
 * Por CADA fila con copia vieja (`Reporte.texto`/`textoOriginal`, desmapeadas → SQL crudo) y por CADA
 * campo NO NULO: descifra la vieja (llave global, `descifrarViejo` — misma semántica que produjo la
 * nueva) y la nueva (DEK por fila) y exige IGUALDAD del plano. Un campo viejo NULL no tiene nada que
 * preservar (se anota, no compara). CUALQUIER discrepancia, o cualquier lado que no descifre, o texto
 * viejo sin `contenidoId` → exit 1 y NO se purga.
 *
 * NUNCA imprime el texto en claro (denuncia de un menor): solo longitudes y veredicto por campo.
 *
 * La DECISIÓN por campo (`verificarFilaContraViejo`) recibe inyectado el lector de la copia nueva, así
 * el candado la ejercita sin base ni llaves (unit). Necesita en el entorno la llave global
 * `PARAM_ENCRYPTION_KEY` (descifra la vieja) y la KEK `REPORTE_TEXTO_KEY_V<n>` (descifra la nueva).
 * Solo LEE (+ descifra); no escribe nada.
 * Uso: node --env-file=.env.<entorno> --import tsx scripts/i366-verificar-copia-nueva.ts
 */
import { prisma } from "../src/lib/prisma";
import { descifrarCampo } from "../src/lib/reporte-texto-contenido";
import { decryptParameter, isEncryptedValue } from "../src/lib/param-encryption";

const MARCADOR_D4 = "[contenido purgado]";

/**
 * Réplica EXACTA de la semántica del backfill 581 (`descifrarViejo`): "" o marcador → tal cual;
 * `enc:` → descifra con la llave global (LANZA si la llave no calza); plano legado → tal cual. Es la
 * misma transformación que produjo la copia nueva, así que igualar contra ella es el test correcto.
 */
export function descifrarViejo(valor: string): string {
    if (valor === "" || valor === MARCADOR_D4) return valor;
    if (isEncryptedValue(valor)) return decryptParameter(valor);
    return valor;
}

export type CampoI366 = "texto" | "textoOriginal";

export type EstadoVerificacion =
    | "COINCIDE" //          la copia nueva descifra al MISMO plano que la vieja
    | "NO_COINCIDE" //       descifra distinto: la copia nueva NO es la vieja (backfill mal enlazado/cifrado)
    | "VIEJO_NULL" //        la columna vieja es NULL: nada que preservar (NO es fallo)
    | "SIN_CONTENIDO" //     hay texto viejo pero `contenidoId` NULL: no existe copia nueva (fallo)
    | "VIEJA_NO_DESCIFRA" // la copia vieja no descifra con la llave global: no se puede verificar (fallo)
    | "NUEVA_NO_DESCIFRA"; // la copia nueva no descifra (ContenidoReporte/DEK): fallo

const ESTADOS_FALLO: ReadonlySet<EstadoVerificacion> = new Set<EstadoVerificacion>([
    "NO_COINCIDE",
    "SIN_CONTENIDO",
    "VIEJA_NO_DESCIFRA",
    "NUEVA_NO_DESCIFRA",
]);

/** Un veredicto NO es fallo solo si COINCIDE o el viejo era NULL (nada que perder). Todo lo demás para. */
export function esFallo(estado: EstadoVerificacion): boolean {
    return ESTADOS_FALLO.has(estado);
}

export interface VeredictoCampo {
    campo: CampoI366;
    estado: EstadoVerificacion;
    viejoLen?: number;
    nuevoLen?: number;
    detalle?: string;
}

export interface FilaViejo {
    id: string;
    contenidoId: string | null;
    texto: string | null;
    textoOriginal: string | null;
}

/** Lee el plano de la copia NUEVA de un campo. Inyectado para que el candado no toque la base. */
export type LeerNuevo = (contenidoId: string, campo: CampoI366) => Promise<string>;

/**
 * Compara, campo por campo, la copia VIEJA (valores crudos de la fila) contra la NUEVA (leída por
 * `leerNuevo`). No escribe nada. La lógica de decisión vive acá para que el candado la ejercite.
 */
export async function verificarFilaContraViejo(
    fila: FilaViejo,
    leerNuevo: LeerNuevo,
): Promise<VeredictoCampo[]> {
    const veredictos: VeredictoCampo[] = [];
    for (const campo of ["texto", "textoOriginal"] as const) {
        const viejoRaw = fila[campo];
        if (viejoRaw === null) {
            veredictos.push({ campo, estado: "VIEJO_NULL" });
            continue;
        }
        if (!fila.contenidoId) {
            veredictos.push({ campo, estado: "SIN_CONTENIDO", detalle: "texto viejo con contenidoId NULL" });
            continue;
        }
        let viejoPlano: string;
        try {
            viejoPlano = descifrarViejo(viejoRaw);
        } catch (err) {
            veredictos.push({ campo, estado: "VIEJA_NO_DESCIFRA", detalle: err instanceof Error ? err.message : String(err) });
            continue;
        }
        let nuevoPlano: string;
        try {
            nuevoPlano = await leerNuevo(fila.contenidoId, campo);
        } catch (err) {
            veredictos.push({ campo, estado: "NUEVA_NO_DESCIFRA", detalle: err instanceof Error ? err.message : String(err) });
            continue;
        }
        veredictos.push({
            campo,
            estado: nuevoPlano === viejoPlano ? "COINCIDE" : "NO_COINCIDE",
            viejoLen: viejoPlano.length,
            nuevoLen: nuevoPlano.length,
        });
    }
    return veredictos;
}

async function main(): Promise<void> {
    // Prisma no mapea texto/textoOriginal → SQL crudo trae el VALOR viejo (cifrado global) para comparar.
    const filas = await prisma.$queryRaw<FilaViejo[]>`
        SELECT "id", "contenidoId", "texto", "textoOriginal" FROM "Reporte"
         WHERE "texto" IS NOT NULL OR "textoOriginal" IS NOT NULL
         ORDER BY "id"`;

    if (filas.length === 0) {
        console.log("[I-366] 0 filas con texto viejo — nada que comparar (¿ya purgado?). Seguro purgar (no-op).");
        return;
    }

    // La copia nueva se lee dentro de una transacción (descifrarCampo requiere un client transaccional).
    const leerNuevo: LeerNuevo = (contenidoId, campo) =>
        prisma.$transaction((tx) => descifrarCampo(tx, contenidoId, campo));

    let fallos = 0;
    for (const fila of filas) {
        const veredictos = await verificarFilaContraViejo(fila, leerNuevo);
        for (const v of veredictos) {
            if (v.estado === "COINCIDE") {
                console.log(`[I-366] OK    ${fila.id} / ${v.campo}: COINCIDE (${v.nuevoLen} chars).`);
            } else if (v.estado === "VIEJO_NULL") {
                console.log(`[I-366] --    ${fila.id} / ${v.campo}: viejo NULL — nada que preservar (el DROP no pierde nada).`);
            } else {
                fallos++;
                const lens = v.viejoLen !== undefined ? ` (viejo=${v.viejoLen}, nuevo=${v.nuevoLen} chars)` : "";
                const det = v.detalle ? ` — ${v.detalle}` : "";
                console.error(`[I-366] FALLO ${fila.id} / ${v.campo}: ${v.estado}${lens}${det}. NO PURGAR.`);
            }
        }
    }

    if (fallos > 0) {
        console.error(`\n[I-366] ${fallos} discrepancia(s)/fallo(s) sobre ${filas.length} fila(s) — NO PURGAR. Abortar.`);
        process.exitCode = 1;
        return;
    }
    console.log(`\n[I-366] ${filas.length} fila(s): cada campo no-nulo COINCIDE con la copia nueva. Verificado byte a byte. Seguro purgar.`);
}

// Solo corre como script (no al importarse desde el candado).
if (process.argv[1]?.endsWith("i366-verificar-copia-nueva.ts")) {
    main()
        .catch((err) => {
            console.error("[I-366] error inesperado —", err);
            process.exitCode = 1;
        })
        .finally(() => void prisma.$disconnect());
}
