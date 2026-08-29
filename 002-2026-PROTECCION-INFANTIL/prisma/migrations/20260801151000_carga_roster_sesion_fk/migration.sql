-- SPEC-132 (S-4): FK de CargaRosterSesion a Colegio (aditiva, cascade al borrar colegio).
ALTER TABLE "CargaRosterSesion"
    ADD CONSTRAINT "CargaRosterSesion_colegioId_fkey"
    FOREIGN KEY ("colegioId") REFERENCES "Colegio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
