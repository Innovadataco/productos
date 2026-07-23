# Research — 009 Configuración: Empresas y Usuarios en cascada

**Nota**: el racional completo vive en [plan.md](./plan.md) y [REVISION-ZEUS-003.md](./REVISION-ZEUS-003.md).
Este documento registra solo las **decisiones cerradas** (mínimo por ZEUS-006).

| # | Decisión | Alternativas descartadas | Razón |
|---|---|---|---|
| D-1 | Cero tablas nuevas: empresa+token = `ProveedorVigilado`⇄`Usuario` por join NIT; permisos con UNA columna aditiva (`usm_submodulo_id`) | Tabla puente nueva `usuario_submodulo` | Prohibido por el encargo; redundante — el esquema ya modela `Submodulo` |
| D-2 (B1) | Unicidad del "módulo completo" por **dos índices únicos PARCIALES** en SQL manual | `@@unique([usuarioId,moduloId,submoduloId])` de Prisma; `UNIQUE NULLS NOT DISTINCT` | En PG los `NULL` son distintos entre sí → el unique de 3 columnas admite duplicados de "completo". `NULLS NOT DISTINCT` depende de versión (PG16+); los parciales son seguros |
| D-3 (B2) | Exclusión completo↔submódulo materializada **server-side** en la transacción | Solo por índice | Los índices parciales no impiden la coexistencia; la semántica del guard exige regla explícita |
| D-4 (I1) | Módulo `configuracion` sembrado y resuelto por **NOMBRE** | Hardcodear id 9 | Los ids son `serial`; el id 9 no está garantizado |
| D-5 (G2) | Token de empresa único **validado server-side**, sin índice único en BD | Índice único en `tpv_token` | La columna es `nullable`; podría colisionar con filas legacy sin token |
| D-6 (D-048) | Correo por interfaz única + adaptador Resend (API HTTP, `fetch`); sin key → stub | SDK de Resend; SMTP crudo | Cero deps; sin key los flujos siempre completan |
| D-7 | Envío de correo **FUERA** de la transacción de alta | Correo dentro de la tx | Un fallo de Resend nunca debe revertir empresa/usuario |
| D-8 (Fase 1) | El token solo se persiste/modifica; **cero llamadas a la Super** (D-044) | Usar el token contra la Super | Regla CEO AGENTS §6; verificado por test anti-red (G1) |

**Pendiente de cierre (no bloquea implementación)**: dominio verificado de Resend (usa remitente
sandbox hasta decisión del CEO).
