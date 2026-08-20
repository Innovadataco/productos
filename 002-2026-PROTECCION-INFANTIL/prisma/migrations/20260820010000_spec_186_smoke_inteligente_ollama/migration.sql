-- SPEC-186 (002-PI-081): smoke inteligente del monitor Ollama.
-- ADITIVA: solo ADD COLUMN con default. Sin DROP, sin tocar índices existentes (I-53).

-- Añade el método del probe para distinguir PING / PIGGYBACK / SMOKE en el historial.
ALTER TABLE "HealthProbe" ADD COLUMN "metodo" TEXT DEFAULT 'SMOKE';
