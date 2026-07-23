-- Spec 086: alinear catálogo con la navegación (aditiva, solo datos de catálogo)

-- 1) Módulo nuevo: revision_spam (D-3)
INSERT INTO "ModuloPermisible" (id, clave, nombre, categoria, "esCritico", orden, "creadoEn", "actualizadoEn")
VALUES ('mod_revision_spam', 'revision_spam', 'Revisión de spam', 'operador', false, 35, now(), now())
ON CONFLICT (clave) DO NOTHING;

-- 2) Backfill revision_spam: SOLO copia desde anti_abuso por rol (denegado por defecto, sin inferencia)
INSERT INTO "PermisoModulo" (id, rol, "moduloId", activo, "creadoEn", "actualizadoEn")
SELECT 'pm_rs_' || pm.rol, pm.rol, 'mod_revision_spam', pm.activo, now(), now()
FROM "PermisoModulo" pm
JOIN "ModuloPermisible" m ON m.id = pm."moduloId"
WHERE m.clave = 'anti_abuso'
ON CONFLICT (rol, "moduloId") DO NOTHING;

-- 3) Fusión reportes_revision → bandeja_reportes con semántica AND
--    (ante la duda se restringe; bandeja_reportes protege lista + acciones sensibles)
UPDATE "PermisoModulo" b
SET activo = b.activo AND r.activo, "actualizadoEn" = now()
FROM "PermisoModulo" r, "ModuloPermisible" mb, "ModuloPermisible" mr
WHERE mb.clave = 'bandeja_reportes' AND mr.clave = 'reportes_revision'
  AND b."moduloId" = mb.id AND r."moduloId" = mr.id AND b.rol = r.rol;

-- 4) Borrar la clave fusionada (datos de catálogo; el AuditLog histórico no se toca)
DELETE FROM "PermisoModulo" WHERE "moduloId" IN (SELECT id FROM "ModuloPermisible" WHERE clave = 'reportes_revision');
DELETE FROM "ModuloPermisible" WHERE clave = 'reportes_revision';
