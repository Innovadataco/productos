/**
 * SPEC-655 / SPEC-414 · Predicado canónico «PerfilProfesional SEMBRADO (demo)» — UNA fuente.
 *
 * Un perfil sembrado está marcado en `demo_marcado` con `entidad = "PerfilProfesional"`
 * (para esta entidad ese es el predicado COMPLETO: `simulacion_reportes` guarda `reporteId`,
 * nunca un profesional — igual que `inicio-admin.ts` omite ese join). `demo_marcado` es
 * polimórfica y sin relación Prisma → se traen los ids y se excluyen con `NOT id in`, que
 * conserva el `select` con allowlist H-2 (un raw SQL lo saltaría).
 *
 * Vive acá y no duplicado porque lo consumen DOS carriles que no pueden divergir: el
 * directorio público / agendamiento (`perfil-profesional.ts`, SPEC-655) y la cola del
 * Verificador (`verificador-repository.ts`, I-419). Si el marcado cambia, cambia una vez.
 *
 * LÍMITE (SPEC-420): `NOT id in <ids>` gasta un bind por id; Postgres corta en 32.767. Con
 * ~decenas de sembrados sobra; para una entidad de VOLUMEN, pasar a anti-join antes de ese piso.
 */
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./unit-of-work";

/** ids de los `PerfilProfesional` sembrados (marca en `demo_marcado`). */
export async function idsPerfilesProfesionalesSembrados(db: DbClient): Promise<string[]> {
    const marcas = await db.demoMarcado.findMany({
        where: { entidad: "PerfilProfesional" },
        select: { entidadId: true },
    });
    return marcas.map((m) => m.entidadId);
}

/**
 * Fragmento WHERE que EXCLUYE los perfiles sembrados — incondicional (para superficies cuyo
 * visor es un operador real: la cola del Verificador). El directorio del padre usa su propia
 * versión CONDICIONADA al visor (un padre demo sí ve los demo); no confundir.
 */
export async function whereExcluirPerfilesSembrados(db: DbClient): Promise<Prisma.PerfilProfesionalWhereInput> {
    return { NOT: { id: { in: await idsPerfilesProfesionalesSembrados(db) } } };
}
