-- SPEC-753 (D-121 de Datos) · EncuestaCita.duracion pasa a NULABLE + CHECK VALIDADO espejo.
--
-- Sigue a 20260929220000 (que creó EncuestaCita). Se agrega como migración NUEVA, no
-- modificando 220000: esa ya está en la rama (rebasada por Dev-3) y reescribir el historial
-- de una rama compartida huérfana el ledger (protocolo del testigo). Aditiva.
--
-- POR QUÉ NULABLE: DuracionSesion {MENOS_15, ENTRE_15_30, ENTRE_30_45, MAS_45} no tiene un
-- miembro que diga «no hubo sesión» (todos son duraciones positivas), a diferencia de
-- operador/inicio/enlace (NO_HUBO_OPERADOR/NO_COMENZO/NO_FUNCIONO, que aportan una RAZÓN).
-- Con seRealizo=false forzaba un valor falso — el poblador ya sembraba MENOS_15 en filas sin
-- sesión: el dato afirmaba que algo que no ocurrió duró <15 min. Se descartó un miembro
-- «NO_HUBO_SESION»: no aportaría lo que seRealizo=false ya dice (un enum no lleva un miembro
-- sin información nueva).
--
-- BARRIDO DE DEPENDIENTES DE BASE de EncuestaCita.duracion (regla post-fallo de SPEC-766, donde
-- una PUBLICACIÓN dependía de Plan.creadoEn y ningún grep del repo la veía). Medido contra la BD
-- viva de test, NO supuesto:
--   · pg_publication_rel: 0 — EncuestaCita no está en ninguna publicación.
--   · pg_depend (columna duracion): 0 dependientes.
--   · pg_constraint (columna duracion): 0.
--   · pg_trigger (EncuestaCita): 0.
--   · pg_index: 3 índices en la tabla (pkey id, origen+respondidaEn, solicitudId+origen);
--     NINGUNO incluye duracion.
--   Caveat honesto: la base de test no tiene publicaciones definidas; la bi_replica de prod es
--   una lista EXPLÍCITA (45 tablas, columnas nombradas) creada ANTES de que EncuestaCita
--   existiera, así que una tabla nueva no puede estar adentro. → 0 dependientes: seguro relajar.
--
-- CHECK VALIDADO, espejo del razón-IFF: la duración está presente si y SÓLO si hubo sesión.
-- seRealizo es boolean NOT NULL → el predicado nunca es NULL, el IFF se enforce estricto. Prisma
-- es ciego al CHECK: lo prueba el candado de inserción real (las 4 esquinas).

ALTER TABLE "EncuestaCita" ALTER COLUMN "duracion" DROP NOT NULL;

ALTER TABLE "EncuestaCita"
  ADD CONSTRAINT "EncuestaCita_duracion_sii_realizo_check"
  CHECK (("duracion" IS NOT NULL) = "seRealizo");
