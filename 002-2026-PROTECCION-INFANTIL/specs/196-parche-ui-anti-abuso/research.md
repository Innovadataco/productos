# Research — SPEC-196

## Fuentes consultadas

- `src/components/modules/AdminAntiAbusoSimulador.tsx` — estado actual del formulario y función `iniciar()`.
- `src/components/modules/AdminAntiAbusoSimuladorHistorial.tsx` — estructura de tabla y columnas.
- `src/components/modules/AdminAntiAbusoOperativo.tsx` — formulario de bloqueo y botón de desbloqueo.
- `src/app/api/admin/anti-abuso/bloquear/route.ts` — endpoint actual (acepta `ipHash`).
- `src/app/api/admin/anti-abuso/desbloquear/route.ts` — endpoint actual (solo `id`).
- `src/lib/anti-abuso/block-list.ts` — servicio de bloqueo/desbloqueo y auditoría.
- `src/lib/schemas/index.ts` — schemas `bloquearIpBodySchema` y `desbloquearIpBodySchema`.
- `prisma/schema.prisma` — enum `AccionAudit`.

## Hallazgos

- F1 requiere solo añadir `setNota('')` en el `onChange` del Select de escenario.
- F2 requiere añadir `<th>`/`<td>` al inicio de la tabla y un handler de copiar al portapapeles.
- F3: la lógica actual ya prioriza arrays para `ips` pero el instructivo indica que para `identificadores` hay regresión. Revisión del código confirma que la priorización de arrays para identificadores SÍ existe; sin embargo, el instructivo pide verificar/corregir. Se implementará test explícito para garantizarlo.
- F4a: cambiar schema de `ipHash` a `ip` y calcular hash en backend con `crypto.createHash`.
- F4b: `desbloquearIp` actualmente registra `IP_DESBLOQUEADA`. Se añade `IP_DESBLOQUEADA_MANUAL` para desbloqueos manuales con motivo.

## Dependencias

- Componente `Textarea` de `@/components/ui/Textarea`.
- Función `logAudit` ya importada en `block-list.ts`.
