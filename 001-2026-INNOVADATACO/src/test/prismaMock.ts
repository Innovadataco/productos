import { vi } from "vitest";

/**
 * Mock reutilizable del singleton de Prisma (spec 002, FR-002).
 *
 * La suite unitaria NUNCA abre conexión a PostgreSQL: cada test mockea
 * `@/lib/prisma` con esta factory y programa las respuestas que necesita.
 *
 * Uso en un archivo de test:
 *
 * ```ts
 * vi.mock("@/lib/prisma", async () => {
 *   const { createPrismaMock } = await import("@/test/prismaMock");
 *   return { prisma: createPrismaMock() };
 * });
 *
 * import { prisma } from "@/lib/prisma";
 * vi.mocked(prisma.user.findUnique).mockResolvedValue(userFixture);
 * ```
 */

/** Operaciones de Prisma que usan las rutas de este proyecto. */
const OPERACIONES = [
  "findUnique",
  "findFirst",
  "findMany",
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
  "delete",
  "deleteMany",
  "count",
  "aggregate",
] as const;

/** Modelos declarados en prisma/schema.prisma (camelCase, como los expone el cliente). */
const MODELOS = [
  "documentoOficial",
  "aiModel",
  "auditLog",
  "user",
  "agentApi",
  "licitacion",
  "licitacionDocumento",
  "entidadLicitacion",
  "licitacionStatus",
  "tipoOportunidad",
  "partidaPresupuesto",
  "proyecto",
  "entregable",
  "hitoProyecto",
  "partidaProyecto",
  "recursoProyecto",
  "leccionAprendida",
  "riesgoProyecto",
  "documentoChunk",
  "moduleSetting",
] as const;

type Operacion = (typeof OPERACIONES)[number];
type Modelo = (typeof MODELOS)[number];

type ModeloMock = Record<Operacion, ReturnType<typeof vi.fn>>;

export type PrismaMock = Record<Modelo, ModeloMock> & {
  $connect: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $executeRaw: ReturnType<typeof vi.fn>;
};

function crearModeloMock(): ModeloMock {
  return OPERACIONES.reduce((acc, op) => {
    acc[op] = vi.fn();
    return acc;
  }, {} as ModeloMock);
}

export function createPrismaMock(): PrismaMock {
  const mock = MODELOS.reduce((acc, modelo) => {
    acc[modelo] = crearModeloMock();
    return acc;
  }, {} as Record<Modelo, ModeloMock>) as PrismaMock;

  mock.$connect = vi.fn();
  mock.$disconnect = vi.fn();
  // Por defecto, $transaction ejecuta el callback con el propio mock.
  mock.$transaction = vi.fn(async (arg: unknown) =>
    typeof arg === "function"
      ? await (arg as (tx: PrismaMock) => unknown)(mock)
      : arg,
  );
  mock.$queryRaw = vi.fn();
  mock.$executeRaw = vi.fn();

  return mock;
}
