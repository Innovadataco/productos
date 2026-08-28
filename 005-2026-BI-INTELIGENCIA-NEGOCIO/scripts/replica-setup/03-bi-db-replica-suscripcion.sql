-- 03-bi-db-replica-suscripcion.sql
-- Ejecutar en bi-db-replica (Jelkin desde su terminal en VPS) · Fase C
-- Pre-requisito: Fase A completa + bi-db-replica corriendo (docker compose up bi-db-replica)
-- Reemplazar <password_bi_replica> y <host_pi_db> con valores reales del VPS

-- Crear usuario de solo lectura para la app BI (bi-next, bi-vanna, bi-superset)
-- bi_reader NO tiene permisos de escritura · Test 8 verifica esto
CREATE USER bi_reader WITH ENCRYPTED PASSWORD '<password_bi_reader>';
GRANT CONNECT ON DATABASE proteccion_infantil TO bi_reader;

-- pg_read_all_data es rol nativo de Postgres 14+ · otorga SELECT en todo
GRANT pg_read_all_data TO bi_reader;

-- Crear suscripción que conecta esta réplica a pi-db
-- <host_pi_db> es el hostname de pi-db accesible desde bi-db-replica (via red pi-net)
-- Típicamente: el nombre del contenedor pi-db en la red de Docker PI
CREATE SUBSCRIPTION bi_replica_sub
  CONNECTION 'host=<host_pi_db> port=5432 dbname=proteccion_infantil user=bi_replica password=<password_bi_replica>'
  PUBLICATION bi_replica;

-- Verificar suscripción activa (esperar ~30 seg para que sincronice)
SELECT subname, subenabled FROM pg_subscription WHERE subname = 'bi_replica_sub';
-- Esperado: bi_replica_sub | t
