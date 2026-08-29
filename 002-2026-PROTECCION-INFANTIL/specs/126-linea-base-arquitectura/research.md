# Research: SPEC-126 — Línea base de arquitectura

## D1 · Cómo leer el schema de datos

- **Decision**: parseo textual de `prisma/schema.prisma` (bloques `model X { }`, campos y
  `@relation` por línea), sin conexión a la BD.
- **Rationale**: el schema ES la fuente de verdad; la BD puede diferir (migraciones pendientes
  en dev) y exigiría levantar PostgreSQL en CI para generar documentación. El parseo textual
  es determinista, rápido y suficiente para conteo, dominios, ER y huérfanos.
- **Alternatives considered**: `prisma introspect` (requiere BD viva, no determinista entre
  entornos); parser oficial de Prisma SDK (dependencia nueva pesada para un regex de 40 líneas).

## D2 · Cómo obtener veredictos de acceso fieles

- **Decision**: IMPORTAR `src/lib/proxy.ts` y ejecutar `proxy()` (con `NextRequest` en memoria)
  y `esDestinoPermitidoPorRol` para cada (rol, ruta). Los JWT de prueba se firman con el
  `JWT_SECRET` del entorno de test, igual que hacen los journeys de SPEC-114.
- **Rationale**: cualquier reimplementación de la lógica del proxy sería una segunda fuente de
  verdad — exactamente la enfermedad que esta spec cierra (D-37). Ejecutar el código real hace
  que la aserción A mida la realidad.
- **Alternatives considered**: reimplementar el árbol de decisión del proxy en el generador
  (rechazada: divergiría); parsear el texto de proxy.ts (rechazada: frágil y no ejecuta).

## D3 · Determinismo de la salida

- **Decision**: la salida NO incluye timestamps, rutas absolutas ni conteos de máquina; el
  encabezado de cada artefacto dice "GENERADO por scripts/arch/ — no editar a mano" y la
  fuente de cada sección. Orden estable (alfabético o por `orden` del catálogo) en todas las tablas.
- **Rationale**: el gate (a) es un `diff`; cualquier marca variable lo vuelve ruido.
- **Alternatives considered**: incluir fecha y excluirla del diff con `grep -v` (rechazada:
  frágil, y la fecha se puede consultar en git).

## D4 · Dónde vive la compuerta

- **Decision**: `npm run arch:check` en el producto + paso en
  `productos/.github/workflows/ci.yml` (workflow ya filtrado por paths del producto, movido a
  la raíz en I-34). Los tests de oráculo/aserciones también corren como tests Vitest junto a
  `scripts/arch/` para cubrirlos en local con `npm run test`.
- **Rationale**: una sola vía de ejecución (local == CI) y herencia del filtro de paths.
- **Alternatives considered**: workflow separado (rechazada: otro sitio que mirar; el existente
  ya acota por producto); pre-commit hook (rechazada: no todo el mundo lo instala; CI es el
  punto único de verdad).

## D5 · Alineación de veredictos (aserción A)

- **Decision**: `permitir` ≡ `esDestinoPermitidoPorRol() === true`; cualquier otra respuesta
  del proxy (401, 403, redirect a login/home) ≡ `false`. Redirect a home cuenta como NO permitir
  (el usuario no llega a donde pidió).
- **Rationale**: coincide con la semántica que ya prueba `esDestinoPermitidoPorRol` en el menú
  (el menú ofrece un destino solo si el proxy lo deja pasar).
- **Alternatives considered**: tratar redirect-to-home como "permitir degradado" (rechazada:
  ocultaría exactamente los clics muertos que B4/SPEC-118 cerró).

## D6 · Qué cuenta como "href del menú" (aserción B)

- **Decision**: los arrays de `nav-items.ts` (fuente estructurada) + los hrefs literales del
  JSX de `NavHeader.tsx` (logo, botón dashboard, menú de usuario, menú móvil), evaluados por
  rol contra el proxy. La función `esEnlaceNavegable` del header se importa si es exportable;
  si no, se replica mínimamente documentando la divergencia potencial.
- **Rationale**: nav-items es declarativo (fácil); el header tiene hrefs sueltos que también
  pueden morir (logo, dashboard).
- **Alternatives considered**: render jsdom del header por rol y extraer hrefs (rechazada como
  vía principal por frágil; queda como red opcional si el parseo estático se queda corto).

## D7 · Agrupación por dominio de los 47 modelos

- **Decision**: por convención de secciones del schema si existen comentarios de sección; si
  no, por prefijo/entidad raíz (Reporte*, Clasificacion*, Embedding*, Colegio/Curso/Alumno,
  Plan/Subscription/Billing*, Eval*/CasoEval, colas/RateLimit/AuditLog, geo Pais/Departamento/
  Ciudad). La regla exacta queda en el generador y se documenta en el artefacto.
- **Rationale**: estable y revisable; el artefacto muestra la regla aplicada.
- **Alternatives considered**: agrupación manual curada (rechazada: prosa a mano, se pudre).

## D8 · Huérfanos: definición operativa

- **Decision**: huérfano = modelo sin `@relation` saliente Y sin ser referenciado por el campo
  de relación de ningún otro modelo. Excepciones declaradas hoy: `Plan`, `Subscription`,
  `BillingCycle` (SaaS aún sin consumidores). `Tenant` no es huérfano (referenciado por
  `Usuario`, `Reporte`, `Colegio` — verificado en el schema).
- **Rationale**: definición mecánica y simétrica (entrante + saliente), fácil de auditar.
- **Alternatives considered**: solo "sin salientes" (rechazada: marcaría huérfanos modelos
  muy referenciados como catálogos).

## Datos verificados hoy (2026-07-29)

- `grep -c "^model " prisma/schema.prisma` = **47** (oráculo del brief confirmado).
- `page.tsx` en `src/app/**` = **47**.
- Workflow CI: `productos/.github/workflows/ci.yml` (`ci-002-proteccion-infantil`), ya con
  `working-directory` y filtro `paths:` del producto.
- Roles del enum: `ADMIN`, `SCHOOL_ADMIN`, `PARENT`, `OPERADOR`, `COMITE_VALIDACION` (+ anónimo).
