-- INV-SPEC-12: un solo lote de escisión por evento (dos registros simultáneos duplicarían la posición).
CREATE UNIQUE INDEX "lote_escision_evento_key" ON "lote" ("eventoId") WHERE "origen" = 'ESCISION';
