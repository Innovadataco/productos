# Research: Cómo le habla PI al padre (SPEC-326)

Decisiones técnicas resueltas en fuente (candado 15 v5).

## D-1 · §3.1 catálogo curado frase→evento (verificado en el motor)

- **Decisión**: la pantalla NO deriva la lista de las reglas del motor (que traen claves técnicas y eventos sin frase). Se define un **catálogo curado** (constante) que mapea cada frase mostrada a un evento real, con dos grupos: `toggles` (controlables) y `forzados` (mostrados sin interruptor).
- **Mapeo verificado en `prisma/seed.ts`**:
  - Toggle 1: "Cuando alguien reporte a una persona de mi círculo" → `padre.circulo_confianza.reporte_enriquecido` (PARENT, obligatoria:false) ✅
  - Toggle 2: "Cuando se resuelva un reporte que hice" → `reporte.resuelto` (PARENT) ✅ (solo dispara al resolver → texto honesto)
  - Forzado: plan por vencer → `suscripcion.por_vencer` (obligatoria:true) · seguridad → `auth.password_cambiada`, `auth.password_recuperacion`
  - Excluidos (no existen): "identificador de mis hijos" (A-61), "resumen de la semana" (no hay evento PARENT).
- **Persistencia**: el toggle guarda una `NotificacionPreferencia` (evento, habilitado) para el padre — el mecanismo ya existe (`actualizarPreferencia`). No se crea nada nuevo en el motor.
- **Rationale**: cumple las 3 reglas duras (sin clave técnica, forzados visibles, cada frase mapea a evento real). Robusto: si mañana el motor gana el evento de hijos, se agrega una fila al catálogo.

## D-2 · §3.4 cambio de correo con verificación (reuso de CodigoVerificacion)

- **Hallazgo**: existe `CodigoVerificacion` + `/api/auth/verificar/solicitar|validar|completar` (el registro los usa) + envío de email. `Usuario` hoy solo tiene email+nombre.
- **Decisión**: cambio de correo en 2 pasos, sin tocar el email real hasta confirmar:
  1. **Solicitar**: el padre ingresa el correo nuevo → validar que no esté en uso → generar un código de verificación asociado al correo **nuevo** → enviarlo al correo **nuevo** → guardar el correo nuevo como **pendiente** en `Usuario` (`emailNuevoPendiente`).
  2. **Confirmar**: el padre ingresa el código → si válido, se **aplica** el correo (email = emailNuevoPendiente, limpiar pendiente) → **avisar al correo anterior** (patrón A-59: un email "tu correo cambió"). 
- **Campos**: `emailNuevoPendiente String?` en `Usuario`. El código/expiración se apoya en `CodigoVerificacion` (reuso) o, si su esquema no encaja para "cambio de email", se agregan `tokenCambioEmail`/`tokenCambioEmailExpiraEn` — **se confirma leyendo `CodigoVerificacion` en implement**; el default del plan es reusar `CodigoVerificacion`.
- **Rationale**: cero flujo paralelo; el correo viejo siempre avisado (identidad protegida). Rechazo de correo en uso evita colisión.

## D-3 · §3.5 país/ciudad en registro (reuso CiudadSearchSelect permitirOtra=false)

- **Hallazgo**: `CiudadSearchSelect` tiene prop `permitirOtra` (el texto libre "Otra ciudad" del wizard). El registro del padre completa en `/api/auth/verificar/completar` (email/codigo/password/nombre).
- **Decisión**: agregar país/ciudad en el paso completar con `CiudadSearchSelect permitirOtra={false}` (dato estadístico, sin texto libre). El endpoint `completar` suma `paisId`/`ciudadId` y los persiste en `Usuario`.
- **Coordinación A-60 §3.8**: si A-60 SPEC-B ya corrigió el defecto de "Otra ciudad" en el wizard, se reusa su arreglo; acá simplemente se pasa `permitirOtra={false}` — no se replica el bug.

## D-4 · §3.6 menú + verificación del lateral (A-56/A-57)

- **Hallazgo**: `PADRE_NAV_ITEMS` tiene 6 entradas, sin "Mis reportes" (solo header, `NavHeader.tsx:207-211`) y sin "Mi perfil" (retirado SPEC-317).
- **Decisión**: agregar "Mis reportes" y "Mi perfil" a `PADRE_NAV_ITEMS`. El punto (c) "lateral solo al elegir del menú derecho" se **verifica** contra A-56/A-57 (ya en main): si el comportamiento ya es el esperado, se documenta como no-op; si no, se corrige el gate del lateral. Se confirma leyendo el layout del padre en implement.

## D-5 · Migración schema-to-schema (sin migrate dev sobre la compartida)

- Como en SPEC-319: editar `schema.prisma`, generar la migración con `prisma migrate diff --from-schema-datamodel <HEAD> --to-schema-datamodel <nuevo> --script`, `prisma generate` en node_modules propio (ya hecho `npm ci`). CI aplica fresco. Los campos son aditivos/nullable → cero riesgo en filas existentes.
