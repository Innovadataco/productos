-- 01-pi-db-crear-usuario-replica.sql
-- Ejecutar en pi-db (Jelkin desde su terminal en VPS)
-- Reemplazar <password_bi_replica> con el password real del gestor de contraseñas IDC
-- NUNCA pegar el password real en chat, commits ni documentos

-- Crear usuario de replicación
CREATE USER bi_replica WITH REPLICATION ENCRYPTED PASSWORD '<password_bi_replica>';

-- Permisos de lectura en el schema public
GRANT USAGE ON SCHEMA public TO bi_replica;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO bi_replica;

-- Garantizar permisos en tablas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO bi_replica;

-- Verificar
SELECT usename, userepl FROM pg_user WHERE usename = 'bi_replica';
-- Esperado: bi_replica | t
