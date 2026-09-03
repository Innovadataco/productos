# SPEC-391 · Red de Profesionales · L1b — el profesional se registra

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1) · **Origen**: brief A-75 §2/§5 + veredicto CEO 04:32 y 08:40

## Para qué

L1b es la segunda mitad de «el profesional existe» (L1a trajo el modelo). Este PR entrega el registro extremo a extremo:

1. Tercera tarjeta **«Soy profesional»** en la puerta `/registro/inicio`.
2. `/registro-profesional` (email) y `/registro-profesional/crear-clave/[token]` (contraseña), reusando el mismo `RegistroEnlaceService` del padre — SPEC-344 ya parametrizó el servicio por rol.
3. `/perfil-profesional/completar`: rellenar el `PerfilProfesional` y subir la autorización firmada. Solo cuando el perfil está completo Y la autorización subida, la fila transiciona de `BORRADOR` a `EN_REVISION` — ese es el disparador de la cola de IDC en L2.

Los datos personales heredados de `Usuario` (`fechaNacimiento`, `documentoTipo`, `documentoNumero`) NO se duplican en `PerfilProfesional` (veredicto CEO 04:32). La autorización firmada se archiva en **storage protegido** siguiendo el patrón de apelaciones/comprobantes (no `escudo-storage`, que es público).

## Qué trae

### 1) Almacenamiento protegido de la autorización
`src/lib/profesional/autorizacion-storage.ts` reusa `cifrarBuffer / descifrarBuffer / sha256Hex` de `apelacion-storage.ts` — AES-256-GCM con `PARAM_ENCRYPTION_KEY`, nombre opaco UUID, ubicación `storage/autorizaciones-profesionales/`, tope 5 MB. Validación por **magia de bytes** (no por extensión): PDF (`%PDF-`), PNG y JPG — el CEO 04:32 pidió los tres porque la gente le toma foto al documento con el teléfono.

### 2) DTOs con allowlist explícita
`src/lib/profesional/dto.ts` publica `toPerfilProfesionalPublico` (para el directorio de L3) y `toPerfilProfesionalPropio` (para el propio profesional). Ambos son `select` explícitos con lista blanca. `CAMPOS_INTERNOS_PROFESIONAL` se exporta para que el **test candado** rompa si algún día alguien cuela un interno (`numeroTarjetaProfesional`, `datosFacturacion`, `autorizacionArchivoUrl`, `autorizacionSubidaEn`). El propio profesional solo ve `autorizacionSubida: boolean` — nunca la ruta cifrada ni la fecha exacta.

### 3) Regla de transición `BORRADOR → EN_REVISION`
`perfilCompletoParaRevision(perfil)` en el mismo `dto.ts`: todos los campos obligatorios llenos + al menos una modalidad + `autorizacionArchivoUrl !== null`. Se dispara desde el `PUT /perfil` y desde el `POST /autorizacion` — el orden de eventos no importa, cuando el último requisito llega la fila transiciona. Otros estados (`ACTIVO`, `RECHAZADO`, `VENCIDO`, `SUSPENDIDO`) NO se tocan desde acá — los mueve L2. Editar el perfil de un profesional suspendido no lo reactiva.

### 4) Endpoints
- `POST /api/auth/registro-profesional/solicitar` — email → enlace (anti-enumeración SPEC-338).
- `POST /api/auth/registro-profesional/completar` — crea cuenta con rol `PROFESIONAL`, emite sesión. Candado espejo: un token `PARENT` no se consume por acá (SPEC-344).
- `GET /api/profesional/perfil` — devuelve DTO propio; `null` si aún no existe.
- `PUT /api/profesional/perfil` — crea/actualiza el `PerfilProfesional`. Merge quirúrgico: solo los campos presentes en el body llegan al `update`.
- `POST /api/profesional/autorizacion` — multipart (`archivo`), guarda cifrado, actualiza `autorizacionArchivoUrl` + `autorizacionSubidaEn`, dispara transición.

### 5) Pantallas
- Edit `/registro/inicio/page.tsx` — la 3ª tarjeta «Soy profesional» ámbar apunta a `/registro-profesional`.
- `/registro-profesional/page.tsx` — email + aviso.
- `/registro-profesional/crear-clave/[token]/page.tsx` — dos condiciones visibles (8 caracteres + coincidir) + rebote sereno para enlaces muertos.
- `/perfil-profesional/completar/page.tsx` — formulario + botón para subir la autorización, con estado visible del `PerfilProfesional`.

### 6) Correos
`src/lib/email-profesional.ts` con `enviarEnlaceRegistroProfesional` y `enviarBienvenidaProfesional`; re-exportados desde `email.ts` como los del padre.

### 7) Repositorio DAL
`src/lib/dal/repositories/perfil-profesional.ts` — Q-3 / E-8: los routes no importan `prisma`, todo entra por el repo. Métodos `findConCiudadPorUsuarioId`, `findPorUsuarioId`, `crearBorrador`, `actualizarParcial`, `cambiarEstado`.

### 8) Migración aditiva
`prisma/migrations/20260903050000_spec_391_autorizacion_profesional/migration.sql` — dos columnas nuevas en `PerfilProfesional`: `autorizacionArchivoUrl TEXT NULL` y `autorizacionSubidaEn TIMESTAMPTZ(6) NULL`. Aditivo, seguro y reversible por defecto de NULL.

## Candados

- **Storage protegido, no `escudo-storage`** (público): la autorización lleva PII y la ley la trata como reservada.
- **Magia de bytes, no extensión**: un HTML renombrado `.pdf` no pasa. Test lo afirma.
- **Reserva absoluta**: los cuatro campos internos NUNCA salen por el DTO. Test los enumera y golpea la API real.
- **Transición controlada**: `BORRADOR → EN_REVISION` es el único cambio de estado que el propio profesional puede provocar. Editar el perfil no reactiva una cuenta.
- **Repositorio DAL**: cero import de `prisma` fuera del DAL (Q-3).
- **Candado espejo del token**: un enlace de padre no se consume por la ruta del profesional (SPEC-344 · OBS-1 auditoría #222).
- **`autorizacionSubidaEn`** (aviso CEO 08:40): la fecha permite demostrar que la autorización fue PREVIA a la consulta de antecedentes (Ley 2375/2024).

## Impacto en arquitectura: sí (mínimo)

Migración aditiva de dos columnas. Endpoints y pantallas nuevas. Sin cambios de contrato en rutas existentes. `docs/architecture/{01-modelo-datos,02-roles-capacidades,03-pantallas}.md` regenerados.

## Cómo se probó

- **Unit** (`autorizacion-storage.test.ts`, 6): magic bytes PDF/PNG/JPG, rechazo de HTML renombrado, vacío y >5 MB.
- **Unit** (`dto.test.ts`, 9): allowlist de 14 campos exactos; los cuatro internos NUNCA aparecen; `perfilCompletoParaRevision` cubre los casos frontera.
- **Integration** (`perfil-l1b.test.ts`, 7): anti-enumeración; completar crea cuenta PROFESIONAL; candado espejo con token PARENT; PUT 1er crea BORRADOR y GET/PUT ocultan internos; subir autorización dispara la transición a EN_REVISION; magic bytes inválido no toca BD; padre golpeando /perfil → 403.
- **Local**: `tsc` limpio, `arch/tokens/locks/ratchets` verdes, `lint` 0 errores, `specs-discipline` 8/8. Migración aplicada limpia a BD test (`migrate deploy`).

## Pendiente

- Verificación en vivo del CEO: la tarjeta ámbar en `/registro/inicio`, el flujo completo hasta ver el perfil en `EN_REVISION` y que la fila del admin (cuando arme L2) tenga el `autorizacionArchivoUrl`.
- L2 (Dev Infra) construye la cola de admin sobre este modelo.
- L3 (Dev Producto) construye el directorio del padre — ya confirmó que el schema le alcanza.
