# Spec 018 — Operadores de casos (revisión humana)

> Estado: **CERRADA**.
> Fecha de cierre: 2026-07-18.
> Ver [`reporte-cierre.md`](reporte-cierre.md) para evidencia.

## Alcance

Definir y construir el rol de **OPERADOR**: empleados de la empresa que atienden la cola de reportes clasificados como `REVISION_MANUAL` y las apelaciones (Fase C).

## Decisiones del owner

1. Los operadores son empleados de la empresa; el admin los crea uno a uno.
2. La asignación de casos es aleatoria por integridad (ningún operador elige).
3. La asignación es instantánea cuando un reporte entra a `REVISION_MANUAL`.
4. El operador que no atiende mantiene el caso trabado hasta que vuelva o un admin reasigne.
5. Va después del despliegue actual.

## Requisitos

- Rol `OPERADOR` en `RolUsuario` con modelo `PerfilOperador` (cupo, revisor de apelaciones, notas).
- CRUD de operadores desde el panel admin con contraseña temporal y email de bienvenida.
- Motor de asignación aleatorio ponderado por carga inversa.
- Integración en `/api/reportes/procesar` para asignar al entrar a `REVISION_MANUAL`.
- Reasignación manual por admin.
- Trazabilidad: `OPERADOR_ASIGNADO`, `OPERADOR_REASIGNADO`, `CASO_CONFIRMADO`, `CASO_CORREGIDO`, `CASO_DADO_DE_BAJA`.
- Integración con apelaciones: pool de revisores marcados.
- Tests de integración para reparto ponderado, caso trabado y reasignación.

## Riesgos mitigados

- Operador malicioso: solo ve sus casos asignados; admin puede desactivar/reasignar.
- Colusión: asignación aleatoria dificulta elegir casos.
- Caso sin atender: queda trabado con el operador hasta intervención manual.
- Fuga de datos: sin PII adicional en el modelo de operador.

## R7

No toca el pipeline de clasificación. Solo asigna reportes que el sistema ya clasificó como `REVISION_MANUAL`.
