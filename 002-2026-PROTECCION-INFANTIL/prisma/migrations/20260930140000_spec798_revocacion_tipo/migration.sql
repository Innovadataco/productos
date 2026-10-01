-- SPEC-798 (paso 2a) · Agrega el TIPO REVOCACION a TipoSolicitudHabeasData.
-- Hoy una revocación de la autorización (Ley 1581 art. 8 lit. e) se archivaría mal como SUPRESION —otro
-- derecho, otra consecuencia—. Con este valor el operador puede REGISTRARLA por lo que es.
-- El ADD VALUE va en SU PROPIA migración (transacción aparte): pg16 no permite USAR un valor de enum nuevo
-- en la misma transacción en que se agrega. El CHECK que lo referencia va en la migración siguiente (2b).
ALTER TYPE "TipoSolicitudHabeasData" ADD VALUE IF NOT EXISTS 'REVOCACION';
