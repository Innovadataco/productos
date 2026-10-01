# Modelo de datos — SPEC-751 · `AudienciaMenor` (artefacto de esquema para D-121)

> **Para Datos.** Este es el CONTRATO de la tabla; la implementación en `schema.prisma` +
> la migración las hace Datos por el carril normal (la tabla está en SPEC-765). Dev-2 no
> toca `schema.prisma`. Aquí van enum/campos, FK Cascade, índices y la clasificación D-121.

## Cambio de schema

Migración **aditiva** (nada destructivo). **NO** se agrega ningún campo a `Hijo` (decisión
D-6, veredicto CEO): el estado «oído» se deriva por consulta a `AudienciaMenor` — sin segundo
origen de verdad que pueda divergir. Solo se crea la tabla nueva.

## Modelo nuevo: `AudienciaMenor`

Espeja `AuditConsentimiento` (registro inmutable, probatorio) pero **por MENOR** en vez de por
usuario. Guarda el acto de audiencia del art. 12 (Decreto 1377/2013): el representante declara
haber oído al menor, bajo la versión de consentimiento vigente.

```prisma
/// SPEC-751 · registro inmutable de la AUDIENCIA del menor (Decreto 1377/2013 art. 12).
/// Espejo de AuditConsentimiento, pero por MENOR. Es PII (cuelga de un menor): su retención
/// queda atada a la del menor y entra en el alcance NO eliminable de SPEC-772.
model AudienciaMenor {
  id          String   @id @default(cuid())
  hijoId      String
  usuarioId   String   // el REPRESENTANTE que declara haber oído al menor (no verificable → se guarda como declaración)
  version     String   // versión de consentimiento vigente al declarar (= consentimiento.version_actual de ese momento)
  declaradoEn DateTime @default(now())
  ip          String
  userAgent   String?
  declaracion String   // texto/digest del enunciado legal declarado — el TEXTO es [ABOGADO] (FR-007)

  hijo    Hijo    @relation(fields: [hijoId], references: [id], onDelete: Cascade)
  usuario Usuario @relation(fields: [usuarioId], references: [id], onDelete: Cascade)

  @@index([hijoId, version])     // GATE: ¿existe fila del menor con la versión vigente? (consulta por entrada al dashboard)
  @@index([hijoId, declaradoEn]) // historial por menor
  @@index([version])             // barrido por versión (auditoría)
  @@map("audiencias_menor")
}
```

Back-relations a agregar:
- `Hijo`   → `audiencias AudienciaMenor[]`
- `Usuario`→ `audienciasMenor AudienciaMenor[]`

**No hay enum nuevo** (a diferencia de otros modelos): `version` es `String` (igual que
`AuditConsentimiento.version`), no un enum. **No hay CHECK** (no hay rango numérico que validar,
a diferencia de `EncuestaPrimeraCita.puntaje`); si Datos decide un CHECK, que sea VALIDADO, nunca
`NOT VALID`.

## FK y borrado (D-121)

- **`hijoId` → `Hijo` · `onDelete: Cascade`.** La audiencia es del menor; no sobrevive a la ficha.
  Igual que `Hijo` cascada desde `Usuario`, esto mantiene `scripts/limpieza/borrar-padre.ts`
  (borra tabla por tabla) sin FK colgada — **Datos: agregar `audiencias_menor` al orden de borrado**
  de ese script, ANTES de `Hijo`, o confiar en la cascada declarada (verificar cuál usa el script).
- **`usuarioId` → `Usuario` · `onDelete: Cascade`.** Igual que `AuditConsentimiento.usuarioId`.
- **NO es tabla puente** (es un log de evidencia, no une dos entidades para navegar): por eso
  Cascade en ambos, no Restrict. La FK de puente = Restrict aplica a tablas de unión, no a esta.

## Clasificación D-121 (retención / purga)

- **Es PII** (D-8): la fila, junto a su FK, dice «el hogar X declaró, desde esta IP, haber oído al
  menor Y». **NO** es log operativo anónimo.
- **Retención atada a la del MENOR**: vive exactamente mientras vive la ficha del menor (Cascade).
  Mientras el menor exista, la audiencia **no se elimina** independientemente — entra en el alcance
  de lo NO eliminable de **SPEC-772**. (No contradice la Cascade: al borrar la ficha completa del
  menor, su evidencia se va con ella; lo que no se hace es borrar la audiencia sola.)
- **Purga de datos de prueba (SPEC-679)**: como cuelga de `Hijo` (demo), la cascada la cubre; si
  Datos la marca aparte, cubrirla en el orden de borrado.

## Seed

- **`audiencia_menor.reoir_en_cambio_de_version`** (BOOLEAN, default `true`) — política de re-oír
  al cambiar la versión (FR-008/D-4). Se siembra en `prisma/seed.ts` con el porqué documentado
  (Dev-2 lo agrega; no necesita la tabla). La decisión FINAL de la política es [ABOGADO].
- **Texto de la declaración** (`declaracion`) — [ABOGADO], en el paquete de Jelkin. No se siembra
  copy inventado.

## Notas

- Sin denormalizar en `Hijo` (D-6): el candado estructural exige que `Hijo` no gane campo de audiencia.
- El gate consulta esta tabla como fuente única; índice `(hijoId, version)` lo hace barato (≤ tope de
  menores ACTIVOS por titular = `padre.hijos.maximo`, default **5** — SPEC-339/363).
