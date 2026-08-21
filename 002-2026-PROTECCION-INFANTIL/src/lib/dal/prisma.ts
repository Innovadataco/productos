/**
 * Re-export del singleton Prisma para la capa DAL.
 *
 * Los repositorios bajo src/lib/dal/** importan desde aquí con ruta relativa
 * (../prisma), evitando depender del alias "@/lib/prisma" que los scripts de
 * worker corridos con `node --import tsx` no resuelven.
 */
export { prisma } from "../prisma";
