-- SPEC-408 (A-75 · brief §9): rol interno VERIFICADOR.
-- ADD VALUE IF NOT EXISTS por lección I-277: el valor de enum y el código que lo emite viajan en la misma migración.
ALTER TYPE "RolUsuario" ADD VALUE IF NOT EXISTS 'VERIFICADOR';
