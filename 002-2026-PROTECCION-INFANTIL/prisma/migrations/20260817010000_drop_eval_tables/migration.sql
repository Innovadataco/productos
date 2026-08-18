-- Fase 2 de SPEC-170 / 002-PI-068: retiro del sistema de Experimentos.
-- El banco curado se preserva en fixtures/banco-curado-v2.jsonl.
-- El orden respeta las FK: primero la tabla hija, luego las padres.
DROP TABLE IF EXISTS "EvalResultado";
DROP TABLE IF EXISTS "EvalRun";
DROP TABLE IF EXISTS "CasoEval";
DROP TYPE IF EXISTS "EvalRunEstado";
DROP TYPE IF EXISTS "CasoEvalFuente";
