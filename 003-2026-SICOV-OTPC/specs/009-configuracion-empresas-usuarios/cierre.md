# Cierre — 009 Configuración: Empresas y Usuarios en cascada

**Estado**: ✅ IMPLEMENTADO · **Fecha**: 2026-07-23 · **Radicado**: 003-SICOV-007 (auditoría ZEUS aprobada en 006)

## Alcance entregado

- **US1 — Empresas (rol 1)**: CRUD sobre `ProveedorVigilado`⇄`Usuario` rol 2 por join NIT; token de
  empresa modificable (UUID, único server-side G2); NIT inmutable/único (G3); desactivación lógica;
  reenviar credencial. Correo SIEMPRE fuera de la transacción de alta.
- **US2 — Cascada de usuarios**: rol 2 crea rol 2/3 de su empresa con subconjunto de módulos/
  submódulos validado server-side (D-015/D-017); exclusión completo↔submódulo (B2) materializada en
  transacción; guard de submódulo aplicado a preventivo/correctivo (rutas + carga masiva).
- **US3 — Correo (D-048)**: interfaz única `getCorreo()` (stub sin key / Resend por fetch con key);
  `recuperar` refactorizado. Sin secretos en repo/logs.
- **Datos**: columna aditiva `usm_submodulo_id` + **dos índices únicos PARCIALES (B1)** en migración
  revisada a mano; seeds de `configuracion`/submódulos POR NOMBRE.

## Evidencia

- **Tests**: 175/175 (`npm test`), incluye guard de submódulo, B2 (ambos sentidos), G1 anti-Super,
  G2/G3, token UUID, paginación. `tsc`/`lint`/`build` limpios.
- **Verificación EN VIVO** (`scripts/verificar-cascada.sh`, 12/0), con el server reiniciado limpio:
  - admin (rol 1) ve Configuración + consola APIs;
  - admin crea empresa (201, token UUID autogenerado);
  - empresa (rol 2) crea operador solo-preventivos (201);
  - operador → **403 en correctivos**, **201 en preventivos**.
- **ZEUS** (radicado 006) verificó la cascada en vivo de forma independiente.
- Commits: `fd509e9c` (foundational/B1), `8fbfda29` (US1), `c0170dcf` (US2), `3a9a21d0` (US3),
  `1176b57f` (tasks+paginación), + cierre 007 (script + docs).

## Hallazgos del cierre (bugs de runtime que los tests no atraparon — corregidos)

1. **Prisma client cacheado**: un `next dev` vivo tras la migración servía el cliente VIEJO → 500.
   Corrección: `scripts/reiniciar.sh` (`prisma generate` + rebuild) — Regla de Oro 3 / I-16.
2. **Token no-UUID → 500**: `tpv_token @db.Uuid` rechazaba tokens arbitrarios en la validación G2.
   Corrección: validación/generación de UUID en el servicio (400 si inválido, autogenerado si ausente).
3. **Seed gap**: rol 2 no tenía el módulo `usuarios` → no podía crear operadores. Corrección: seed de
   rol 2 con `usuarios`; y `permisosDelOtorgante` hereda módulos del ROL cuando no hay personalización.

## Deuda técnica

- Dominio de correo verificado en Resend (hoy remitente sandbox) — pendiente decisión CEO.
- `route.test.ts` no creados (convención del repo: tests de servicio); cobertura de guard/roles vía
  `guard-modulos.test.ts` y servicios.
- `scripts/_fijar-clave.ts` es solo utilería de humo (fija clave conocida) — no forma parte del producto.

## Fuera de alcance (Fase 2)

Uso del token contra la Super; pantallas/flujos de 006/007/008 (aquí solo su catálogo de submódulos).
