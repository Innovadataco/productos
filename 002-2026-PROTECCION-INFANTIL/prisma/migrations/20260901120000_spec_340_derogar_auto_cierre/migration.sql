-- SPEC-340 (A-68 · D-1) · derogar el auto-cierre del expediente del padre.
-- Regla de Jelkin (01-09-2026): "nada se cierra nunca" — el expediente es la
-- carpeta viva del padre, para siempre. 0 = apagado (el motor y el guard de la
-- transición lo tratan como derogado — doble valla con el corte en código).
-- Respeta al admin: solo si sigue en el valor sembrado original (6).
UPDATE "ParametroSistema"
SET "valor" = '0',
    "descripcion" = 'DEROGADO (SPEC-340): 0 = los expedientes no se cierran nunca. Regla de Jelkin 01-09-2026.'
WHERE "clave" = 'padre.expediente.auto_cierre_meses'
  AND "valor" = '6';
