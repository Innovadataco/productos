-- AlterTable
ALTER TABLE "ContactoConfianza" ADD COLUMN     "nombre" VARCHAR(100),
ADD COLUMN     "parentesco" VARCHAR(60);

-- CreateTable
CREATE TABLE "Hijo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL DEFAULT '',
    "documentoTipo" TEXT NOT NULL,
    "documentoNumero" TEXT NOT NULL,
    "anioNacimiento" INTEGER,
    "sexo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Hijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HijoPadre" (
    "id" TEXT NOT NULL,
    "hijoId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HijoPadre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentificadorHijo" (
    "id" TEXT NOT NULL,
    "hijoId" TEXT NOT NULL,
    "valor" TEXT NOT NULL,
    "tipo" TEXT,
    "plataformaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdentificadorHijo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentificadorHijoDesvinculado" (
    "id" TEXT NOT NULL,
    "identificadorId" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentificadorHijoDesvinculado_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Hijo_documentoTipo_documentoNumero_idx" ON "Hijo"("documentoTipo", "documentoNumero");

-- CreateIndex
CREATE UNIQUE INDEX "Hijo_documentoTipo_documentoNumero_key" ON "Hijo"("documentoTipo", "documentoNumero");

-- CreateIndex
CREATE INDEX "HijoPadre_usuarioId_idx" ON "HijoPadre"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "HijoPadre_hijoId_usuarioId_key" ON "HijoPadre"("hijoId", "usuarioId");

-- CreateIndex
CREATE INDEX "IdentificadorHijo_valor_idx" ON "IdentificadorHijo"("valor");

-- CreateIndex
CREATE INDEX "IdentificadorHijo_hijoId_activo_idx" ON "IdentificadorHijo"("hijoId", "activo");

-- CreateIndex
CREATE INDEX "IdentificadorHijo_plataformaId_idx" ON "IdentificadorHijo"("plataformaId");

-- CreateIndex
CREATE INDEX "IdentificadorHijoDesvinculado_usuarioId_idx" ON "IdentificadorHijoDesvinculado"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "IdentificadorHijoDesvinculado_identificadorId_usuarioId_key" ON "IdentificadorHijoDesvinculado"("identificadorId", "usuarioId");

-- AddForeignKey
ALTER TABLE "HijoPadre" ADD CONSTRAINT "HijoPadre_hijoId_fkey" FOREIGN KEY ("hijoId") REFERENCES "Hijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HijoPadre" ADD CONSTRAINT "HijoPadre_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorHijo" ADD CONSTRAINT "IdentificadorHijo_hijoId_fkey" FOREIGN KEY ("hijoId") REFERENCES "Hijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorHijo" ADD CONSTRAINT "IdentificadorHijo_plataformaId_fkey" FOREIGN KEY ("plataformaId") REFERENCES "Plataforma"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorHijoDesvinculado" ADD CONSTRAINT "IdentificadorHijoDesvinculado_identificadorId_fkey" FOREIGN KEY ("identificadorId") REFERENCES "IdentificadorHijo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentificadorHijoDesvinculado" ADD CONSTRAINT "IdentificadorHijoDesvinculado_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- SPEC-325 (002-PI-225) · BACKFILL del mecanismo compartido (idempotente)
-- El cruce identificador→alerta era case-sensitive: el valor se guardaba crudo
-- y el reporte entraba con otro case → no cruzaba y no avisaba (defecto silencioso).
-- De acá en más la escritura normaliza (normalizarIdentificador = trim+lower);
-- este backfill lleva los datos YA guardados a la misma forma canónica.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1 · Identificadores de contacto vigilado → forma canónica.
UPDATE "IdentificadorContacto"
SET "valor" = lower(btrim("valor"))
WHERE "valor" <> lower(btrim("valor"));

-- 2 · Reporte.identificador por-fila (columna NO única · no colisiona).
UPDATE "Reporte"
SET "identificador" = lower(btrim("identificador"))
WHERE "identificador" <> lower(btrim("identificador"));

-- 3 · IdentificadorReportado (agregado) · MERGE de filas que colapsan al mismo
--     valor normalizado dentro de la misma plataforma. Conteo de colisiones en
--     prod al radicar = 0 (verificado por Fábrica), así que hoy es no-op; la
--     lógica queda correcta para cuando haya volumen.
--     Estrategia: sumar totales, ultimoReporteEn = máx, conservar la fila de menor id.
WITH norm AS (
    SELECT
        "id",
        "plataformaId",
        lower(btrim("identificador")) AS valor_norm,
        "totalReportes",
        "reportesAutenticados",
        "reportesAnonimos",
        "ultimoReporteEn"
    FROM "IdentificadorReportado"
),
grupos AS (
    SELECT
        valor_norm,
        "plataformaId",
        min("id") AS keep_id,
        sum("totalReportes") AS s_total,
        sum("reportesAutenticados") AS s_auth,
        sum("reportesAnonimos") AS s_anon,
        max("ultimoReporteEn") AS s_ultimo,
        count(*) AS n
    FROM norm
    GROUP BY valor_norm, "plataformaId"
)
-- 3a · Consolidar los agregados en la fila que se conserva.
UPDATE "IdentificadorReportado" ir
SET
    "identificador" = g.valor_norm,
    "totalReportes" = g.s_total,
    "reportesAutenticados" = g.s_auth,
    "reportesAnonimos" = g.s_anon,
    "ultimoReporteEn" = g.s_ultimo
FROM grupos g
WHERE ir."id" = g.keep_id;

-- 3b · Borrar las filas duplicadas ya fusionadas (n>1 → solo sobra la keep_id).
DELETE FROM "IdentificadorReportado" ir
USING (
    SELECT
        "id",
        lower(btrim("identificador")) AS valor_norm,
        "plataformaId",
        min("id") OVER (PARTITION BY lower(btrim("identificador")), "plataformaId") AS keep_id
    FROM "IdentificadorReportado"
) d
WHERE ir."id" = d."id" AND d."id" <> d.keep_id;

-- 4 · ContactoConfianza.nombre ← etiqueta (para las filas viejas sin nombre).
--     `etiqueta` queda deprecada pero NO se borra (aditivo · cero pérdida).
UPDATE "ContactoConfianza"
SET "nombre" = COALESCE(NULLIF(btrim("etiqueta"), ''), 'Contacto')
WHERE "nombre" IS NULL;
