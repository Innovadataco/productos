-- SPEC-702 (I-422 · parte 1) · La copia de entrenamiento se borra con su corrección/reporte.
--
-- Antes: `DatasetEntrenamiento.correccionId` era una relación OPCIONAL sin `onDelete`, así que
-- Prisma la creó con ON DELETE SET NULL. Al borrar la corrección —o el reporte, por la cadena
-- Reporte→ClasificacionIA(Cascade)→CorreccionAdmin(Cascade)— la copia NO se borraba: quedaba
-- HUÉRFANA con el relato guardado. Un dato del niño sin dueño, fuera del alcance del borrado.
--
-- Ahora: ON DELETE CASCADE. La copia se va con su corrección (y con su reporte por la cadena).
-- EmbeddingDataset ya cascada desde DatasetEntrenamiento, así que el embedding también se va.
--
-- `correccionId` sigue siendo NULLABLE a propósito: el huérfano histórico (1 fila, decisión de
-- Jelkin) NO se toca. Un valor NULL no se ve afectado por ON DELETE, así que esta migración no
-- altera esa fila ni ninguna otra: solo cambia la regla de borrado a futuro.
ALTER TABLE "DatasetEntrenamiento" DROP CONSTRAINT "DatasetEntrenamiento_correccionId_fkey";

ALTER TABLE "DatasetEntrenamiento" ADD CONSTRAINT "DatasetEntrenamiento_correccionId_fkey"
    FOREIGN KEY ("correccionId") REFERENCES "CorreccionAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
