-- Elimina resúmenes y flashcards duplicados, conservando el registro con el id más bajo
DELETE FROM resumenes WHERE id NOT IN (
  SELECT MIN(id) FROM resumenes GROUP BY tema_id, lower(titulo)
);

DELETE FROM flashcards WHERE id NOT IN (
  SELECT MIN(id) FROM flashcards GROUP BY tema_id, lower(frente)
);

-- Previene futuros duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_resumenes_unico ON resumenes(tema_id, lower(titulo));
CREATE UNIQUE INDEX IF NOT EXISTS idx_flashcards_unico ON flashcards(tema_id, lower(frente));
