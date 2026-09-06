-- SPEC-544 (I-332): el cooldown de la alerta del Círculo de Confianza se mide POR
-- CONTACTO vigilado, no por usuario. Antes vivía en `Usuario.ultimaNotificacionCirculoEn`
-- (una sola marca por padre), así que un padre que vigila a varias personas recibía
-- UNA alerta al día en total: si atacaban a la 2.ª y la 3.ª, nunca se enteraba.
--
-- Columna aditiva y NULLABLE: las filas existentes quedan sin marca (nunca notificadas
-- por este eje), lo cual es correcto. `Usuario.ultimaNotificacionCirculoEn` se deja en
-- su lugar (deprecada, aditivo) — no se borra en una migración.
ALTER TABLE "ContactoConfianza" ADD COLUMN "ultimaNotificacionEmailEn" TIMESTAMP(3);
