-- SPEC-330 (002-PI-230 · I-221 parte padre): alinear el rol de las reglas de
-- notificación del padre al enum RolUsuario. El seed sembraba rol='PADRE'
-- (vocabulario de dominio que NO existe en el enum); la pantalla de preferencias
-- filtra por el rol enum del usuario ('PARENT'), así que las filas 'PADRE' nunca
-- matcheaban y el padre veía menos toggles. La identidad de la regla
-- (@@unique(evento,canal,plantillaClave)) NO incluye rol, por eso el re-seed por
-- sí solo no corrige de forma fiable las filas existentes: se entrega esta
-- migración de datos.
--
-- Idempotente (2a corrida = 0 filas). Aditiva, sin borrar.
-- FUERA DE ALCANCE (hallazgo diferido): 'RECTOR_COLEGIO' y la colisión multi-rol
-- por la identidad de regla sin rol NO se tocan aquí.

UPDATE "notificacion_reglas" SET rol = 'PARENT' WHERE rol = 'PADRE';
