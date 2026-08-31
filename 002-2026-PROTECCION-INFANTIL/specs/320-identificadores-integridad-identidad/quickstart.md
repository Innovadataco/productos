# Quickstart / Validación — SPEC-320

Guía de validación end-to-end. Los 5 ejercicios corresponden a la evidencia §6 del instructivo (se ejecutan **en producción**, capturas al PR; Jelkin prueba, Fábrica audita).

## Prerrequisitos
- Deploy limpio con las 3 migraciones aplicadas (`prisma migrate deploy`) y `npm run db:seed` (catálogo sembrado).
- `npm run arch:check` en verde (el schema cambió → regenerar `docs/architecture/`).
- Un colegio con al menos un estudiante, un profesor y un acudiente; un segundo colegio para el caso cross-tenant.

## Gate de calidad local (antes de push)
```
npx tsc --noEmit && npm run lint && npm run test && npm run build
```
> Turno de builds: el motor de PI corre en esta Mac (RAM apretada). Avisar a Fábrica antes de `npm run build`/`npm run test` pesados; esperar si otro Dev compila. Prioridad = motor de producción.

## Ejercicios de evidencia (§6)

1. **Identificador compartido dentro del colegio → el sistema dice a quién pertenece.**
   Registrar el mismo identificador de red social en dos personas del mismo colegio (repetir con estudiante, profesor y acudiente). Esperado: aviso con nombre + rol de a quién pertenece, con opción de continuar (no bloqueo). Al confirmar, queda registrado y auditado.

2. **Mismo identificador en dos colegios distintos → permitido.**
   Registrar el mismo valor en una persona del colegio A y en otra del colegio B. Esperado: sin aviso, ambos se guardan (tenants aislados).

3. **Un reporte contra un identificador compartido → una sola alerta.**
   Con dos personas del colegio compartiendo `+57300…` (vía override), disparar un reporte comunitario contra ese número. Esperado: el colegio recibe **una** alerta institucional, no una por persona (SC-002).

4. **Profesor sin documento → no deja. Documento repetido en el colegio → no deja.**
   Intentar crear un profesor sin tipo/número de documento (u otro campo de identidad): rechazado con el campo faltante. Crear dos profesores con el mismo tipo+número en el mismo colegio: el segundo rechazado (409).

5. **El admin agrega un tipo de documento → aparece en los tres formularios.**
   Desde configuración de admin, agregar un tipo de documento. Esperado: disponible en los formularios de estudiante, profesor e integrante de comité (misma fuente).

## Verificación de datos pre-migración (candado — 3 migraciones)
Antes de cada migración, verificar el estado de los datos y reportar el hallazgo:
- **Migración A (catálogo)**: enumerar valores distintos de tipo de documento presentes en estudiante y comité.
- **Migración B (unicidad)**: SELECT de duplicados de identificador por `(colegioId, valor)` cruzando los tres sujetos (Fábrica corrió: 0; re-verificar al desencolar).
- **Migración C (identidad profesor)**: contar profesores existentes; confirmar que la estrategia de default-temporal no deja residuo tras el reset.

## Referencias
- Modelo y semántica de unicidad: [data-model.md](data-model.md)
- Contratos (catálogo, warn de unicidad, alta de profesor): [contracts/catalogo-tipos-documento.md](contracts/catalogo-tipos-documento.md)
- Decisiones de diseño: [research.md](research.md)
