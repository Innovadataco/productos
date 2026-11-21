-- Endurecimiento de la base (database-reviewer, bajos): las 39 llaves foráneas de la migración inicial
-- pasan a ON DELETE RESTRICT ON UPDATE RESTRICT (antes ON UPDATE CASCADE, y 9 con ON DELETE SET NULL),
-- como ya son las de plan, login y TOTP; y las 18 FK que no tenían índice que empiece por sus columnas
-- reciben el suyo. El guardián (scripts/verificar-esquema.sql) exige la definición exacta de cada FK.
--
-- Segura sobre datos existentes: ninguna FK cambia de columnas ni de tabla destino, así que las filas que
-- ya hay cumplen (se cargaron con las FK activas). Cada FK se quita y se vuelve a poner NOT VALID + VALIDATE
-- dentro de esta misma transacción (Prisma corre el archivo entero en una): si una fila huérfana hiciera
-- fallar el VALIDATE, se deshace todo y el despliegue se detiene sin cambios (queda P3009: ver
-- docs/despliegue/produccion.md, «Si una migración falla»). Ningún código borra filas padre ni cambia ids
-- (verificado en src/ y scripts/: el único borrado es asignacion_venta, que nadie referencia).
--
-- Bloqueos: quitar una FK toma ACCESS EXCLUSIVE en la tabla hija y en la referenciada hasta el COMMIT, y la
-- app vieja sigue viva mientras corre el migrador. Por eso, primero un tope de espera y luego todas las
-- tablas tomadas de una vez, en orden fijo. Los CREATE INDEX van sin CONCURRENTLY (no cabe en una
-- transacción): las tablas son pequeñas y ya están tomadas.
SET LOCAL lock_timeout = '5s';
LOCK TABLE "ajuste_caja", "asignacion_venta", "carga_archivo", "certificacion", "certificacion_fondo", "certificacion_posicion",
  "conciliacion", "control_conciliacion", "decision", "dividendo", "dividendo_decretado", "enlace_decision_orden",
  "evento_corporativo", "fila_de_carga", "fila_fuente", "fila_lote_av", "instrumento", "lote", "movimiento_caja",
  "movimiento_fondo", "orden", "plan_version", "precio_cierre", "simbolo_precio", "usuario", "valor_unidad_fondo"
  IN ACCESS EXCLUSIVE MODE;

-- carga_archivo_cargadoPorId_fkey
ALTER TABLE "carga_archivo" DROP CONSTRAINT "carga_archivo_cargadoPorId_fkey";
ALTER TABLE "carga_archivo" ADD CONSTRAINT "carga_archivo_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "carga_archivo" VALIDATE CONSTRAINT "carga_archivo_cargadoPorId_fkey";

-- fila_fuente_primeraCargaId_fkey
ALTER TABLE "fila_fuente" DROP CONSTRAINT "fila_fuente_primeraCargaId_fkey";
ALTER TABLE "fila_fuente" ADD CONSTRAINT "fila_fuente_primeraCargaId_fkey" FOREIGN KEY ("primeraCargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_fuente" VALIDATE CONSTRAINT "fila_fuente_primeraCargaId_fkey";

-- fila_de_carga_cargaId_fkey
ALTER TABLE "fila_de_carga" DROP CONSTRAINT "fila_de_carga_cargaId_fkey";
ALTER TABLE "fila_de_carga" ADD CONSTRAINT "fila_de_carga_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_de_carga" VALIDATE CONSTRAINT "fila_de_carga_cargaId_fkey";

-- fila_de_carga_filaFuenteId_fkey
ALTER TABLE "fila_de_carga" DROP CONSTRAINT "fila_de_carga_filaFuenteId_fkey";
ALTER TABLE "fila_de_carga" ADD CONSTRAINT "fila_de_carga_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_de_carga" VALIDATE CONSTRAINT "fila_de_carga_filaFuenteId_fkey";

-- simbolo_precio_instrumentoId_fkey
ALTER TABLE "simbolo_precio" DROP CONSTRAINT "simbolo_precio_instrumentoId_fkey";
ALTER TABLE "simbolo_precio" ADD CONSTRAINT "simbolo_precio_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "simbolo_precio" VALIDATE CONSTRAINT "simbolo_precio_instrumentoId_fkey";

-- movimiento_caja_filaFuenteId_fkey
ALTER TABLE "movimiento_caja" DROP CONSTRAINT "movimiento_caja_filaFuenteId_fkey";
ALTER TABLE "movimiento_caja" ADD CONSTRAINT "movimiento_caja_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "movimiento_caja" VALIDATE CONSTRAINT "movimiento_caja_filaFuenteId_fkey";

-- orden_filaFuenteId_fkey
ALTER TABLE "orden" DROP CONSTRAINT "orden_filaFuenteId_fkey";
ALTER TABLE "orden" ADD CONSTRAINT "orden_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "orden" VALIDATE CONSTRAINT "orden_filaFuenteId_fkey";

-- orden_instrumentoId_fkey
ALTER TABLE "orden" DROP CONSTRAINT "orden_instrumentoId_fkey";
ALTER TABLE "orden" ADD CONSTRAINT "orden_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "orden" VALIDATE CONSTRAINT "orden_instrumentoId_fkey";

-- dividendo_filaFuenteId_fkey
ALTER TABLE "dividendo" DROP CONSTRAINT "dividendo_filaFuenteId_fkey";
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "dividendo" VALIDATE CONSTRAINT "dividendo_filaFuenteId_fkey";

-- dividendo_instrumentoId_fkey
ALTER TABLE "dividendo" DROP CONSTRAINT "dividendo_instrumentoId_fkey";
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "dividendo" VALIDATE CONSTRAINT "dividendo_instrumentoId_fkey";

-- dividendo_decretadoId_fkey
ALTER TABLE "dividendo" DROP CONSTRAINT "dividendo_decretadoId_fkey";
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_decretadoId_fkey" FOREIGN KEY ("decretadoId") REFERENCES "dividendo_decretado"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "dividendo" VALIDATE CONSTRAINT "dividendo_decretadoId_fkey";

-- dividendo_eventoId_fkey
ALTER TABLE "dividendo" DROP CONSTRAINT "dividendo_eventoId_fkey";
ALTER TABLE "dividendo" ADD CONSTRAINT "dividendo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento_corporativo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "dividendo" VALIDATE CONSTRAINT "dividendo_eventoId_fkey";

-- dividendo_decretado_instrumentoId_fkey
ALTER TABLE "dividendo_decretado" DROP CONSTRAINT "dividendo_decretado_instrumentoId_fkey";
ALTER TABLE "dividendo_decretado" ADD CONSTRAINT "dividendo_decretado_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "dividendo_decretado" VALIDATE CONSTRAINT "dividendo_decretado_instrumentoId_fkey";

-- ajuste_caja_creadoPorId_fkey
ALTER TABLE "ajuste_caja" DROP CONSTRAINT "ajuste_caja_creadoPorId_fkey";
ALTER TABLE "ajuste_caja" ADD CONSTRAINT "ajuste_caja_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "ajuste_caja" VALIDATE CONSTRAINT "ajuste_caja_creadoPorId_fkey";

-- ajuste_caja_eventoId_fkey
ALTER TABLE "ajuste_caja" DROP CONSTRAINT "ajuste_caja_eventoId_fkey";
ALTER TABLE "ajuste_caja" ADD CONSTRAINT "ajuste_caja_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento_corporativo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "ajuste_caja" VALIDATE CONSTRAINT "ajuste_caja_eventoId_fkey";

-- evento_corporativo_origenId_fkey
ALTER TABLE "evento_corporativo" DROP CONSTRAINT "evento_corporativo_origenId_fkey";
ALTER TABLE "evento_corporativo" ADD CONSTRAINT "evento_corporativo_origenId_fkey" FOREIGN KEY ("origenId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "evento_corporativo" VALIDATE CONSTRAINT "evento_corporativo_origenId_fkey";

-- evento_corporativo_destinoId_fkey
ALTER TABLE "evento_corporativo" DROP CONSTRAINT "evento_corporativo_destinoId_fkey";
ALTER TABLE "evento_corporativo" ADD CONSTRAINT "evento_corporativo_destinoId_fkey" FOREIGN KEY ("destinoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "evento_corporativo" VALIDATE CONSTRAINT "evento_corporativo_destinoId_fkey";

-- lote_instrumentoId_fkey
ALTER TABLE "lote" DROP CONSTRAINT "lote_instrumentoId_fkey";
ALTER TABLE "lote" ADD CONSTRAINT "lote_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "lote" VALIDATE CONSTRAINT "lote_instrumentoId_fkey";

-- lote_ordenId_fkey
ALTER TABLE "lote" DROP CONSTRAINT "lote_ordenId_fkey";
ALTER TABLE "lote" ADD CONSTRAINT "lote_ordenId_fkey" FOREIGN KEY ("ordenId") REFERENCES "orden"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "lote" VALIDATE CONSTRAINT "lote_ordenId_fkey";

-- lote_eventoId_fkey
ALTER TABLE "lote" DROP CONSTRAINT "lote_eventoId_fkey";
ALTER TABLE "lote" ADD CONSTRAINT "lote_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "evento_corporativo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "lote" VALIDATE CONSTRAINT "lote_eventoId_fkey";

-- lote_loteOrigenId_fkey
ALTER TABLE "lote" DROP CONSTRAINT "lote_loteOrigenId_fkey";
ALTER TABLE "lote" ADD CONSTRAINT "lote_loteOrigenId_fkey" FOREIGN KEY ("loteOrigenId") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "lote" VALIDATE CONSTRAINT "lote_loteOrigenId_fkey";

-- asignacion_venta_ordenVentaId_fkey
ALTER TABLE "asignacion_venta" DROP CONSTRAINT "asignacion_venta_ordenVentaId_fkey";
ALTER TABLE "asignacion_venta" ADD CONSTRAINT "asignacion_venta_ordenVentaId_fkey" FOREIGN KEY ("ordenVentaId") REFERENCES "orden"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "asignacion_venta" VALIDATE CONSTRAINT "asignacion_venta_ordenVentaId_fkey";

-- asignacion_venta_loteId_fkey
ALTER TABLE "asignacion_venta" DROP CONSTRAINT "asignacion_venta_loteId_fkey";
ALTER TABLE "asignacion_venta" ADD CONSTRAINT "asignacion_venta_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "asignacion_venta" VALIDATE CONSTRAINT "asignacion_venta_loteId_fkey";

-- fila_lote_av_cargaId_fkey
ALTER TABLE "fila_lote_av" DROP CONSTRAINT "fila_lote_av_cargaId_fkey";
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_lote_av" VALIDATE CONSTRAINT "fila_lote_av_cargaId_fkey";

-- fila_lote_av_filaFuenteId_fkey
ALTER TABLE "fila_lote_av" DROP CONSTRAINT "fila_lote_av_filaFuenteId_fkey";
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_filaFuenteId_fkey" FOREIGN KEY ("filaFuenteId") REFERENCES "fila_fuente"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_lote_av" VALIDATE CONSTRAINT "fila_lote_av_filaFuenteId_fkey";

-- fila_lote_av_instrumentoId_fkey
ALTER TABLE "fila_lote_av" DROP CONSTRAINT "fila_lote_av_instrumentoId_fkey";
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_lote_av" VALIDATE CONSTRAINT "fila_lote_av_instrumentoId_fkey";

-- fila_lote_av_loteId_fkey
ALTER TABLE "fila_lote_av" DROP CONSTRAINT "fila_lote_av_loteId_fkey";
ALTER TABLE "fila_lote_av" ADD CONSTRAINT "fila_lote_av_loteId_fkey" FOREIGN KEY ("loteId") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "fila_lote_av" VALIDATE CONSTRAINT "fila_lote_av_loteId_fkey";

-- certificacion_cargaId_fkey
ALTER TABLE "certificacion" DROP CONSTRAINT "certificacion_cargaId_fkey";
ALTER TABLE "certificacion" ADD CONSTRAINT "certificacion_cargaId_fkey" FOREIGN KEY ("cargaId") REFERENCES "carga_archivo"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "certificacion" VALIDATE CONSTRAINT "certificacion_cargaId_fkey";

-- certificacion_posicion_certificacionId_fkey
ALTER TABLE "certificacion_posicion" DROP CONSTRAINT "certificacion_posicion_certificacionId_fkey";
ALTER TABLE "certificacion_posicion" ADD CONSTRAINT "certificacion_posicion_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "certificacion_posicion" VALIDATE CONSTRAINT "certificacion_posicion_certificacionId_fkey";

-- certificacion_posicion_instrumentoId_fkey
ALTER TABLE "certificacion_posicion" DROP CONSTRAINT "certificacion_posicion_instrumentoId_fkey";
ALTER TABLE "certificacion_posicion" ADD CONSTRAINT "certificacion_posicion_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "certificacion_posicion" VALIDATE CONSTRAINT "certificacion_posicion_instrumentoId_fkey";

-- certificacion_fondo_certificacionId_fkey
ALTER TABLE "certificacion_fondo" DROP CONSTRAINT "certificacion_fondo_certificacionId_fkey";
ALTER TABLE "certificacion_fondo" ADD CONSTRAINT "certificacion_fondo_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "certificacion_fondo" VALIDATE CONSTRAINT "certificacion_fondo_certificacionId_fkey";

-- certificacion_fondo_instrumentoId_fkey
ALTER TABLE "certificacion_fondo" DROP CONSTRAINT "certificacion_fondo_instrumentoId_fkey";
ALTER TABLE "certificacion_fondo" ADD CONSTRAINT "certificacion_fondo_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "certificacion_fondo" VALIDATE CONSTRAINT "certificacion_fondo_instrumentoId_fkey";

-- movimiento_fondo_fondoId_fkey
ALTER TABLE "movimiento_fondo" DROP CONSTRAINT "movimiento_fondo_fondoId_fkey";
ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_fondoId_fkey" FOREIGN KEY ("fondoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "movimiento_fondo" VALIDATE CONSTRAINT "movimiento_fondo_fondoId_fkey";

-- movimiento_fondo_ajusteCajaId_fkey
ALTER TABLE "movimiento_fondo" DROP CONSTRAINT "movimiento_fondo_ajusteCajaId_fkey";
ALTER TABLE "movimiento_fondo" ADD CONSTRAINT "movimiento_fondo_ajusteCajaId_fkey" FOREIGN KEY ("ajusteCajaId") REFERENCES "ajuste_caja"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "movimiento_fondo" VALIDATE CONSTRAINT "movimiento_fondo_ajusteCajaId_fkey";

-- valor_unidad_fondo_fondoId_fkey
ALTER TABLE "valor_unidad_fondo" DROP CONSTRAINT "valor_unidad_fondo_fondoId_fkey";
ALTER TABLE "valor_unidad_fondo" ADD CONSTRAINT "valor_unidad_fondo_fondoId_fkey" FOREIGN KEY ("fondoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "valor_unidad_fondo" VALIDATE CONSTRAINT "valor_unidad_fondo_fondoId_fkey";

-- precio_cierre_instrumentoId_fkey
ALTER TABLE "precio_cierre" DROP CONSTRAINT "precio_cierre_instrumentoId_fkey";
ALTER TABLE "precio_cierre" ADD CONSTRAINT "precio_cierre_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "precio_cierre" VALIDATE CONSTRAINT "precio_cierre_instrumentoId_fkey";

-- conciliacion_certificacionId_fkey
ALTER TABLE "conciliacion" DROP CONSTRAINT "conciliacion_certificacionId_fkey";
ALTER TABLE "conciliacion" ADD CONSTRAINT "conciliacion_certificacionId_fkey" FOREIGN KEY ("certificacionId") REFERENCES "certificacion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "conciliacion" VALIDATE CONSTRAINT "conciliacion_certificacionId_fkey";

-- control_conciliacion_conciliacionId_fkey
ALTER TABLE "control_conciliacion" DROP CONSTRAINT "control_conciliacion_conciliacionId_fkey";
ALTER TABLE "control_conciliacion" ADD CONSTRAINT "control_conciliacion_conciliacionId_fkey" FOREIGN KEY ("conciliacionId") REFERENCES "conciliacion"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "control_conciliacion" VALIDATE CONSTRAINT "control_conciliacion_conciliacionId_fkey";

-- control_conciliacion_instrumentoId_fkey
ALTER TABLE "control_conciliacion" DROP CONSTRAINT "control_conciliacion_instrumentoId_fkey";
ALTER TABLE "control_conciliacion" ADD CONSTRAINT "control_conciliacion_instrumentoId_fkey" FOREIGN KEY ("instrumentoId") REFERENCES "instrumento"("id") ON DELETE RESTRICT ON UPDATE RESTRICT NOT VALID;
ALTER TABLE "control_conciliacion" VALIDATE CONSTRAINT "control_conciliacion_instrumentoId_fkey";

-- Índices de las FK que no tenían (nombres de Prisma, @@index en schema.prisma).
CREATE INDEX "ajuste_caja_creadoPorId_idx" ON "ajuste_caja"("creadoPorId");
CREATE INDEX "ajuste_caja_eventoId_idx" ON "ajuste_caja"("eventoId");
CREATE INDEX "carga_archivo_cargadoPorId_idx" ON "carga_archivo"("cargadoPorId");
CREATE INDEX "certificacion_fondo_instrumentoId_idx" ON "certificacion_fondo"("instrumentoId");
CREATE INDEX "certificacion_posicion_instrumentoId_idx" ON "certificacion_posicion"("instrumentoId");
CREATE INDEX "conciliacion_certificacionId_idx" ON "conciliacion"("certificacionId");
CREATE INDEX "control_conciliacion_instrumentoId_idx" ON "control_conciliacion"("instrumentoId");
CREATE INDEX "decision_decididaPorId_idx" ON "decision"("decididaPorId");
CREATE INDEX "dividendo_decretadoId_idx" ON "dividendo"("decretadoId");
CREATE INDEX "dividendo_eventoId_idx" ON "dividendo"("eventoId");
CREATE INDEX "enlace_decision_orden_creadoPorId_idx" ON "enlace_decision_orden"("creadoPorId");
CREATE INDEX "evento_corporativo_origenId_idx" ON "evento_corporativo"("origenId");
CREATE INDEX "fila_fuente_primeraCargaId_idx" ON "fila_fuente"("primeraCargaId");
CREATE INDEX "fila_lote_av_cargaId_idx" ON "fila_lote_av"("cargaId");
CREATE INDEX "fila_lote_av_instrumentoId_idx" ON "fila_lote_av"("instrumentoId");
CREATE INDEX "fila_lote_av_loteId_idx" ON "fila_lote_av"("loteId");
CREATE INDEX "lote_loteOrigenId_idx" ON "lote"("loteOrigenId");
CREATE INDEX "plan_version_aprobadaPorId_idx" ON "plan_version"("aprobadaPorId");
