-- SPEC-812 (pieza 1) · marca del ESTADO 2 de la derivación del dataset de una corrección.
-- `datasetOmitidoEn` presente = la anonimización CORRIÓ y se negó a guardar copia A PROPÓSITO
-- (AnonimizacionRechazadaError; 807 nunca guarda un relato en claro). NO es una falla. Se setea SOLO
-- en ese rechazo tipado; un fallo de transporte (Ollama caído/timeout) deja la fila SIN marca
-- (reintentable). Aditiva, nulable: las correcciones existentes quedan sin marca (pendientes/derivadas
-- según tengan o no fila de dataset).
ALTER TABLE "CorreccionAdmin" ADD COLUMN "datasetOmitidoEn" TIMESTAMPTZ(6);
