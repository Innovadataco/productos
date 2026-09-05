# SPEC-452 · Plan
Conceder 2 módulos por rol (fuente única `seed-modulos-grants`) + reescribir los tests que pasaban por el arnés permisivo, afirmando la conducta real. Sin tocar el arnés (SPEC-443).
1. Rama desde origin/main; leer en fuente los endpoints, el seed, el arnés y los 5 tests (candado 15 v5).
2. Seed: OPERADOR + revision_spam; COMITE + ia_rubrica (+ padre centro_control_ia por la jerarquía AND — ruling del CEO).
3. Reescribir los 5 tests al mapa real (deleteMany + syncModulosYGrants), no al arnés.
4. Candado de conducta del comité con token real (lee 200 / no escribe 403).
5. Contraprueba por mutación (quitar del seed → 200 caen). Preflight + integración.
Fuera de alcance: el arnés (SPEC-443); abrir más módulos.
