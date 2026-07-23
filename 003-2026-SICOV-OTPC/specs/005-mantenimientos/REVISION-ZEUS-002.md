# REVISIÓN-ZEUS-002 — Resto del gate del spec 005-mantenimientos

**Fecha:** 2026-07-22 · **Revisor:** ZEUS · **Veredicto:** ⛔ NO PASA — correcciones pendientes

> **Contexto:** el gate `REVISION-ZEUS-001.md` se le envió a ODIN **parcialmente** — solo el
> bloque final (D-022, los 4 puntos de aprobación). ODIN lo aplicó **correctamente y completo**;
> no hay incumplimiento suyo. Este documento contiene **el ~90% restante** del gate.

---

## Verificación del trabajo entregado (D-022) — ✅ conforme

| Punto | Estado |
|---|---|
| `exceljs` + CSV por el mismo lector (un solo pipeline de validación) | ✅ `research.md` R5, `contracts/mantenimientos.md` |
| `src/lib/almacenamiento.ts` + `ALMACENAMIENTO_DIR` fuera de la app + respaldo como requisito de switch-over | ✅ `plan.md:95`, `contracts/archivos-programas.md` |
| `hora varchar(8)` como desviación + regex vinculante en el borde | ✅ `data-model.md`, FR-006, pipeline y edge cases |
| Variante JSON de `bulk/*` cortada | ✅ eliminada de spec, contratos, plan y quickstart |
| Catálogo de 12 tipos de identificación | ✅ constante en `tipos.ts`, validación `1..12` |

Sin objeciones. Se cierra D-022.

---

## Lo que sigue pendiente (nunca le llegó)

BLOQUEANTES 1-4, D-016 (partición), D-017 (guard de módulos), D-021 (envío inmediato +
reintentos parametrizables), reglas del manual §10 y menores. Todo verificado contra los
artefactos **hoy 2026-07-22**, con líneas actualizadas tras los cambios de D-022.

---

## PROMPT PARA ODIN (copiar tal cual)

```
Aclaración previa: el gate anterior te llegó INCOMPLETO — solo el bloque de los 4 puntos
de aprobación (D-022). Lo aplicaste bien y queda cerrado. Esto es el resto del mismo gate.
Aplica los cambios y DETENTE (no generes tasks.md todavía).

LEE ANTES (prevalecen sobre §2-§6): HANDOFF-SICOV.md §9, §9.1, §10 y §11 COMPLETAS.

═══ BLOQUEANTE 1 — id que viaja a la Super ═══
data-model.md:82 sigue con UNA sola columna: "id del base local; tras sincronizar guarda
el id externo". Ese es el bug del legacy (RepositorioMantenimientoDB.ts:1443): al guardar
el id externo se PIERDE el enlace local.
DECISIÓN: a la Super viaja el id EXTERNO, pero id local e id externo van en COLUMNAS
SEPARADAS. Corrige data-model.md:82 y :158, contracts/mantenimientos.md:27,128-130,
quickstart.md:25 y spec.md:106,178.

═══ BLOQUEANTE 2 — variable de entorno (revertir) ═══
El código VIVO usa URL_MATENIMIENTOS (typo heredado): .env.example:52 y
src/lib/integracion/cliente-http.ts:76, que es código del wizard 004 en producción interna.
Introducir URL_MANTENIMIENTOS rompe requireEnv en arranque.
DECISIÓN: conservar URL_MATENIMIENTOS [sic]. Revierte research.md:41-42,134,
plan.md:56,93,153 y contracts/mantenimientos.md:16,136. spec.md:27,366 ya está correcto —
hoy los artefactos se contradicen entre sí.

═══ BLOQUEANTE 3 — alcance de datos por rol (D-015) ═══
research.md R8 solo dice "rol 1 ve todo". Falta lo esencial:
- "Rol 1 ve todas las empresas" NO es paridad: es DESVIACIÓN DELIBERADA aprobada por el
  CEO. Documéntalo así.
- El alcance se impone SERVER-SIDE: roles 2 y 3 atados a su NIT efectivo, IGNORANDO
  cualquier nit que mande el cliente. El legacy lo toma del query string sin validar rol
  (ControladorDashboard.ts:24-26, ObtenerResumenDashboard.ts:33) => fuga de datos entre
  empresas (I-08). Además esa línea interpola el NIT en SQL: usa parámetros.
- Corrige el bug del rol 3: hoy no vería ningún job, porque se filtra por su documento y
  los jobs llevan el NIT del administrador.

═══ BLOQUEANTE 4 — el módulo mantenimientos son DOS cosas (HANDOFF §10.2) ═══
contracts/archivos-programas.md ya acota el PDF a roles 1 y 2: bien. Falta en spec.md:
- Rol CLIENTE (2): carga el PDF del PROGRAMA (máx 4MB, solo PDF, el último queda ACTIVO y
  desactiva los anteriores). NO registra mantenimientos individuales.
- Rol OPERADOR (3): registra los mantenimientos específicos + carga masiva.
spec.md:88 hoy deja que el rol 2 registre individuales. Sepáralo en spec.md y contracts/.

═══ DENTRO DE 005-A: envío inmediato + reintentos parametrizables (D-019, D-021) ═══
CORRECCIÓN DE GOBERNANZA: la nota que registraste en AGENTS.md §8 dice que el envío
inmediato para DESPACHOS y LLEGADAS es "backlog transversal". Es un eco de una instrucción
mía incompleta — no es tu error, pero está mal. D-021 (cerrada por el CEO) lo mete DENTRO
de 005-A, aplicando el patrón a LAS TRES COLAS de una vez, porque las specs 001 y 002 ya
están cerradas y hacerlo después obligaría a reabrirlas por separado.
Reescribe esa entrada de AGENTS.md §8 como decisión cerrada D-021 dentro de 005-A.
Trabajo real:
- src/app/api/integracion/despachos/route.ts:32-39 hoy SOLO encola (estado "pendiente").
  Añade intento síncrono con caída a cola. Idem llegadas.
- src/lib/despachos/cola.ts:8 tiene MAX_REINTENTOS = 3 y BACKOFF_MIN hardcodeados. Pásalos
  a variables de entorno con default 3 y 5 min (D-019b).
- El reenvío manual dispara un ciclo completo nuevo (ya resetea reintentos=0: consérvalo).

═══ DENTRO DE 005-A: guard de permisos por módulo (D-017) ═══
Ya existe src/lib/modulos.ts (cargarModulos), pero solo alimenta el MENÚ: se usa en
api/auth/login, api/me y dashboard/page.tsx, y NINGUNA ruta valida permisos. Es el mismo
estado del legacy, donde VerificarModulo existe y está registrado (start/kernel.ts:48) pero
no se aplica a ninguna ruta (I-09) => hoy el permiso es decorado de menú y un operador puede
llamar por API cualquier módulo que no le habilitaron.
Construye un guard COMPARTIDO server-side sobre esa pieza y aplícalo a cada endpoint de
operación. SICOV maneja 7 módulos asignables: los 5 del legacy (Usuarios, Novedades,
Mantenimientos, Autorizaciones, Alistamientos) MÁS Salidas y Llegadas (D-018).
Se hace ahora para no retrofitear las specs 005-008.

═══ REGLAS DEL MANUAL (HANDOFF §10) que faltan en el spec ═══
- Carga masiva TODO-O-NADA: un registro inválido => Exitosos: 0, falla el lote entero.
  Modal: "Se procesaron N registros. Exitosos: X. Fallidos: Y. Errores a corregir: Z".
- Los errores se DESCARGAN en archivo .txt (botón "Descargar errores",
  ej. errores_cargue_preventivo) — no solo se muestran en pantalla.
- Reintento manual NO es reenviar: abre el registro para CORREGIR los campos con error y
  reenviar (pág. 25). Es distinto del reintento automático.
- Columnas exactas de plantilla preventivo/correctivo (idénticas): vigiladoId, placa,
  fecha (AAAA-MM-DD), hora (HH:mm), nit, razonSocial, tipoIdentificacion,
  numeroIdentificacion, nombresResponsable, detalleActividades.
- La plantilla se descarga desde la app e incluye HOJA AUXILIAR de tipos de identificación
  con código (los 12 que ya incorporaste).
- Formato: CSV (D-019e) + XLSX donde el legacy ya lo tiene. La carga es POR OPERACIÓN
  dentro de su módulo: no hay cargador universal.
- Estados de placa: preventivo tiene 5 (sin reporte, inicio, reportado vigente, próximo a
  vencer, vencido); correctivo solo los 3 primeros.
- Preventivo: cadencia mínima cada 2 MESES — es el origen de "próximo a vencer"/"vencido".
  Correctivo: cada vez que se presente.
- Responsable diferenciado: preventivo = ingeniero mecánico; correctivo = técnico mecánico.
- Solo vehículos ACTIVOS CON PÓLIZA VIGENTE admiten mantenimientos.
- Placa: 3 letras + 3 dígitos.
- Errores de negocio que devuelve la Super (mapéalos): "No tiene autorización, consulte con
  el vigilado", "La placa no pertenece al vigilado", "La placa debe tener 6 caracteres"
  => existe una matriz de autorización placa<->vigilado externa que la Super valida.

═══ PARTICIÓN (D-016) ═══
005-A = datos + integración + envío inmediato (3 colas) + cola + jobs + guard de módulos + XLSX/CSV.
005-B = pantalla, PDF del programa y modales.
Reorganiza spec.md y plan.md con esa partición.
Si la ventana jul 23-29 no alcanza, avísame: el recorte autorizado es sacar XLSX/CSV a
005-B. El envío inmediato y el guard son estructurales y NO se mueven.

═══ MENORES (verificados hoy sobre los artefactos ya corregidos) ═══
- data-model.md:55 y :158: tmt_usuario_id guarda un NIT en Int => usar BigInt.
- luxon no aparece en ningún artefacto: los parsers de fecha/hora del legacy usan luxon con
  14 formatos. Decide añadir la dependencia o reimplementar con tests, y decláralo en plan.md.
- exceljs bajo vitest jsdom puede resolver el browser build. No hay ninguna mención de
  environmentMatchGlobs: verifícalo y mitiga (node para src/lib/mantenimientos/**). Aplica
  también al lector CSV, que va por la misma librería.
- Reusa src/lib/normalizar.ts (ya existe, con normalizar.test.ts) en vez de crear
  extractores nuevos; research.md:65 no deja claro si portas o reusas.
- quickstart.md:14 usa npm run db:migrate:dev = "prisma migrate dev" (package.json:19), sin
  --create-only. La constitución §1.2 exige --create-only.
- checklists/requirements.md:17 dice "quedan 3" [NEEDS CLARIFICATION] pero hoy solo queda 1
  (spec.md:365). Cuadra el conteo.
- plan.md:3 dice feature/001-scaffolding y spec.md:3 dice [005-mantenimientos]. Unifica
  ambos a feature/001-scaffolding (la rama real). La discrepancia con AGENTS.md §4 la
  resuelvo yo, no la toques.
- plan.md:48 dice ~14 endpoints nuevos; son ~18. Cuadra el número.
```

---

## Riesgo de cronograma (sin cambios respecto de REVISION-ZEUS-001)

005-A carga el núcleo de mantenimientos **más** el envío inmediato en las tres colas y el
guard de permisos. Correcto hacerlo ahora (evita tocar tres veces lo mismo), pero la ventana
**jul 23-29** queda ajustada. Recorte autorizado si aprieta: **XLSX/CSV a 005-B**.

---
> **📋 Control del documento** · v1.0 · 2026-07-22 · Autor: ZEUS
> **🔗 Relacionados:** [Gate 001](REVISION-ZEUS-001.md) · [Decisiones D-001…D-022](../../../../Gestion-de-proyectos/01-PROYECTOS/002-2026-SICOV-OTPC/03-EJECUCION/05-DECISIONES.md) · [HANDOFF §9-§11](../../HANDOFF-SICOV.md)
