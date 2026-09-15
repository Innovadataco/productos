-- Elimina preguntas viejas marcadas para reemplazo por los agentes de enriquecimiento
-- Perfil 273
DELETE FROM preguntas WHERE id IN (
  -- planeacion-273 (13 preguntas mal categorizadas o sin soporte)
  183, 184, 185, 186, 188, 191, 192, 194, 195, 196, 197, 198, 200,
  -- presupuesto-273 (7 preguntas marcadas PENDIENTE REEMPLAZO)
  201, 205, 208, 211, 212, 214, 219,
  -- contratacion-273 (1 pregunta fuera de tema)
  67,
  -- proyectos-273 (2 preguntas inválidas)
  231, 234,
  -- ti-estado-273 (2 preguntas OWASP fuera del temario oficial)
  268, 275
);
