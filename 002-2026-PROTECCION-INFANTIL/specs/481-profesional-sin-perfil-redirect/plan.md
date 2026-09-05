# SPEC-481 · Plan
Guard de borde en Server Component. Leer fuente antes (candado 15 v5): `page.tsx`, `panelDelProfesional` (throw NOT_FOUND en :130), `AppError`, ruta `/perfil-profesional/completar` (existe).
1. Rama desde `origin/main`.
2. try/catch en `page.tsx`: NOT_FOUND → redirect a completar; otros → rethrow. Service intacto.
3. Candado de conducta (mock auth/service/redirect) + contraprueba por mutación.
4. Preflight + unit.
Fuera de alcance: cambiar el contrato del service; cualquier otro rol/página.
