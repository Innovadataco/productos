-- SPEC-339 (A-67 · punto 4 de Calidad) · el cruce identificador-de-hijo → aviso.
-- ADITIVA. Interruptor y enfriamiento PROPIOS: reusar los del círculo habría
-- hecho que un aviso de contacto silenciara 24h el aviso del hijo, y que apagar
-- el círculo apagara también al hijo — contra la regla de Jelkin.
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "notificacionesHijos" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Usuario" ADD COLUMN IF NOT EXISTS "ultimaNotificacionHijosEn" TIMESTAMP(3);
