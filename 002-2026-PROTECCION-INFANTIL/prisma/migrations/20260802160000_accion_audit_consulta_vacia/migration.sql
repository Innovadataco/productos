-- AlterEnum (F3/N-5: consulta inteligente vacía — eventos analíticos sin el identificador)
ALTER TYPE "AccionAudit" ADD VALUE 'CONSULTA_SIN_RESULTADOS';
ALTER TYPE "AccionAudit" ADD VALUE 'CONSULTA_VACIA_CTA_REPORTAR';
