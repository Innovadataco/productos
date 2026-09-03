-- SPEC-391 (L1b · veredicto CEO 08:40): dos columnas aditivas en
-- PerfilProfesional para archivar la autorización firmada del profesional
-- (Ley 2375/2024 · previa, expresa, escrita y archivada). Es del profesional,
-- no de una revisión; cada VerificacionProfesional apunta a la vigente. La
-- fecha permite demostrar que fue PREVIA a la consulta de antecedentes.
-- Aditivo, seguro y reversible por defecto de NULL.

ALTER TABLE "PerfilProfesional" ADD COLUMN "autorizacionArchivoUrl" TEXT;
ALTER TABLE "PerfilProfesional" ADD COLUMN "autorizacionSubidaEn"   TIMESTAMPTZ(6);
