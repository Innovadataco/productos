-- SPEC-673 (I-398) · Invariante de ESTADO como IMPOSIBILIDAD ESTRUCTURAL.
--
-- Un PerfilProfesional que NO está en BORRADOR debe tener al menos una modalidad
-- (atiendeVirtual OR atiendePresencial). Sin eso, un perfil aprobado queda inservible:
-- invisible a las búsquedas del directorio filtradas por modalidad y sin poder crear
-- franjas. El guard de código `exigirModalidadParaEstado` cubre los caminos CONOCIDOS
-- (reenviarParaVerificacion + el PUT de edición); este CHECK es el respaldo de fondo para
-- los que no conocemos — la invariante es del ESTADO, no de una transición puntual.
--
-- NOT VALID, SIN VALIDATE (a propósito): la fila `E2E_PROFESIONAL` (EN_REVISION con ambas
-- modalidades en false) es EVIDENCIA de I-398, no basura. Un VALIDATE fallaría sobre ella y
-- obligaría a BORRAR la prueba para poder poner el candado — destruir la evidencia del
-- defecto para protegerse del defecto. NOT VALID enforcea toda fila NUEVA o MODIFICADA y
-- conserva la existente sin tocar; el VALIDATE es un paso APARTE, cuando esa fila se
-- resuelva. BORRADOR se exime: un borrador puede estar incompleto; lo que no puede es SALIR
-- de BORRADOR (o quedarse fuera de él) sin modalidad.
--
-- El cast explícito del literal al enum evita depender de la coerción implícita de Postgres.
ALTER TABLE "PerfilProfesional"
    ADD CONSTRAINT "PerfilProfesional_modalidad_estado_check"
    CHECK (
        "estado" = 'BORRADOR'::"EstadoPerfilProfesional"
        OR "atiendeVirtual"
        OR "atiendePresencial"
    ) NOT VALID;
