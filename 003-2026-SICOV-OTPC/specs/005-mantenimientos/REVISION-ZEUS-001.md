# REVISIÓN-ZEUS-001 — Gate del spec 005-mantenimientos

**Fecha:** 2026-07-22 · **Revisor:** ZEUS · **Veredicto:** ✅ APROBADO CON CORRECCIONES
**Estado:** correcciones **pendientes de enviar a ODIN**.

> Este documento es el registro del gate y contiene el prompt exacto para ODIN.
> Vive en el repo para no depender de la sesión de chat (AGENTS.md §0.2).

---

## Aciertos verificados de ODIN

Contrasté ~20 afirmaciones del spec contra el legacy y casi todas son exactas:

- **Cabeceras de mantenimientos correctas** (no son las 3 de despachos): `Authorization` + `token` siempre; `vigiladoId` solo en POST de detalle; el base lo lleva en el payload.
- **Dualidad síncrono/cola detectada por él mismo (R1):** registro individual reporta síncrono, solo la carga masiva encola. Coincide con lo definido por el CEO (HANDOFF §11).
- **Cola exacta:** lote 20, máx 3, +5 min, `MantenimientoPendienteError` reprograma sin consumir reintento, reintento manual resetea a 0, 409 al máximo.
- **Sin duplicación:** tercera pasada del worker único bajo el mismo advisory lock; reusa `getTokenProveedor()` y la herencia rol 3; un solo factory con doble gate.
- **Migraciones estrictamente aditivas**, guardarraíl de stubs intacto, cero mitos del handoff viejo.
- Más completo que la propia spec 004. Respetó el modo plan (sin `tasks.md`).

---

## PROMPT PARA ODIN (copiar tal cual)

```
Revisión de ZEUS sobre specs/005-mantenimientos: APROBADO CON CORRECCIONES.
Aplica los cambios y DETENTE (no generes tasks.md todavía).

LEE ANTES (son nuevos y prevalecen): HANDOFF-SICOV.md §9, §10 y §11 completos.

═══ BLOQUEANTE 1 — id que viaja a la Super ═══
quickstart.md:31 dice mandar el id LOCAL. El legacy manda el id EXTERNO
(RepositorioMantenimientoDB.ts:1443). DECISIÓN: enviar el id EXTERNO, pero NO
replicar el bug de sobrescribir el enlace local: id local e id externo en COLUMNAS
SEPARADAS. Corrige contracts/mantenimientos.md, data-model.md:82 y quickstart.md.

═══ BLOQUEANTE 2 — variable de entorno ═══
research.md:39-41 afirma que .env.example usa el nombre corregido: es FALSO.
.env.example:52 y cliente-http.ts:76 usan URL_MATENIMIENTOS (typo heredado) y
cliente-http.ts es código vivo del wizard 004. DECISIÓN: conservar URL_MATENIMIENTOS.
NO introducir URL_MANTENIMIENTOS. Corrige R3 y plan.md:41.

═══ BLOQUEANTE 3 — alcance de datos por rol (D-015) ═══
"rol 1 ve todo" NO es paridad. Aprobado como DESVIACIÓN DELIBERADA, documéntalo así.
El alcance se impone SERVER-SIDE: roles 2 y 3 atados a su NIT efectivo, ignorando
cualquier nit del cliente (el legacy lo toma del query string sin validar rol — fuga
de datos entre empresas, I-08). Corrige también el bug del rol 3 (hoy no vería ningún
job porque se filtra por su documento y los jobs llevan el NIT del administrador).

═══ BLOQUEANTE 4 — el módulo mantenimientos son DOS cosas (HANDOFF §10.2) ═══
- Rol CLIENTE: carga el PDF del PROGRAMA (máx 4MB, solo PDF, el último queda ACTIVO
  y desactiva los anteriores). NO registra mantenimientos individuales.
- Rol OPERADOR: registra los mantenimientos específicos + carga masiva.
Sepáralos en spec.md y contracts/.

═══ NUEVO EN 005-A: envío inmediato + reintentos parametrizables (D-019, D-021) ═══
Acertaste en la dualidad síncrono/cola (tu R1). El envío inmediato hay que añadirlo a
DESPACHOS y LLEGADAS (specs 001 y 002), que hoy SOLO ENCOLAN
(src/app/api/integracion/despachos/route.ts:32-39, estado "pendiente").
Implementa el patrón en LAS TRES COLAS a la vez.
Además: MAX_REINTENTOS y BACKOFF están hardcodeados (src/lib/despachos/cola.ts:8).
Pásalos a variables de entorno con default 3 y 5 min. El reenvío manual debe disparar
un ciclo completo nuevo (ya resetea reintentos=0: consérvalo).

═══ NUEVO EN 005-A: guard de permisos por módulo (D-017) ═══
Construye un guard COMPARTIDO que valide el módulo autorizado en cada endpoint de
operación. En el legacy VerificarModulo existe pero NO se aplica a ninguna ruta
(start/kernel.ts:48 y nada más) — hoy el permiso es solo decorado de menú (I-09).
SICOV maneja 7 módulos asignables: los 5 del legacy (Usuarios, Novedades,
Mantenimientos, Autorizaciones, Alistamientos) MÁS Salidas y Llegadas.
Se hace ahora para no retrofitear las specs 005-008.

═══ REGLAS DEL MANUAL (HANDOFF §10) que faltan en el spec ═══
- Carga masiva TODO-O-NADA: un registro inválido => Exitosos: 0, falla el lote entero.
- Errores se descargan en archivo .txt ("Descargar errores").
- Reintento manual NO es reenviar: abre el registro para CORREGIR los campos con error.
- Columnas exactas de plantilla preventivo/correctivo: vigiladoId, placa,
  fecha (AAAA-MM-DD), hora (HH:mm), nit, razonSocial, tipoIdentificacion,
  numeroIdentificacion, nombresResponsable, detalleActividades.
- Formato de carga: CSV (nuevo estándar, D-019e) + XLSX donde el legacy ya lo tiene.
  La carga es POR OPERACIÓN dentro de su módulo, no hay cargador universal.
- Estados de placa: preventivo tiene 5 (sin reporte, inicio, reportado vigente,
  próximo a vencer, vencido); correctivo solo los 3 primeros.
- Preventivo: cadencia mínima cada 2 meses (origen de "próximo a vencer"/"vencido").
- Responsable: preventivo = ingeniero mecánico; correctivo = técnico mecánico.
- Solo placas activas CON PÓLIZA VIGENTE admiten reportes.
- Errores de negocio de la Super: "No tiene autorización, consulte con el vigilado",
  "La placa no pertenece al vigilado", "La placa debe tener 6 caracteres".

═══ PARTICIÓN (D-016) ═══
005-A = datos + integración + envío inmediato + cola + jobs + guard de módulos + XLSX.
005-B = pantalla, PDF del programa y modales.
Reorganiza spec.md y plan.md con esa partición.

═══ RESPUESTA A TUS 4 PUNTOS DE APROBACIÓN (D-022) ═══
1. exceljs: APROBADA. CSV (D-019e) se suma como formato nuevo, no la reemplaza.
2. PDF en filesystem: APROBADO CON CONDICIONES — ruta por variable de entorno, FUERA
   del directorio de la app, y detrás de una interfaz de almacenamiento
   (guardarArchivo/leerArchivo) para poder cambiar a S3/servicio externo sin tocar
   lógica de negocio. El respaldo de esa carpeta es requisito del switch-over.
3. hora varchar(8): APROBADO, pero documéntalo como DESVIACIÓN — el legacy usa
   table.time() (1741738351341_tbl_preventivos.ts:11), no varchar. Racional: Prisma no
   tiene tipo Time limpio, es hora de pared sin zona y viaja como texto a la Super.
   CONDICIÓN: validación ^([01]\d|2[0-3]):[0-5]\d$ en el borde.
4. Variante JSON de bulk/*: SE CORTA. Sin consumidores confirmados.

CATÁLOGO DE TIPOS DE IDENTIFICACIÓN (resuelto, del manual de usuario):
1 Cédula de ciudadanía · 2 Cédula de extranjería · 3 Pasaporte · 4 Cédula de
ciudadanía digital · 5 Tarjeta de identidad · 6 Registro civil · 7 PEP · 8 DIE ·
9 NIT · 10 NN · 11 Carnet Diplomático · 12 Permiso por Protección Temporal.

═══ MENORES ═══
- data-model.md:55: tmt_usuario_id guarda un NIT en Int → usar BigInt.
- Parsers de fecha/hora del legacy usan luxon (14 formatos): decide añadir la
  dependencia o reimplementar con tests, y decláralo en plan.md.
- ExcelJS bajo vitest jsdom puede resolver el browser build: verifícalo y mitiga con
  environmentMatchGlobs (node para src/lib/mantenimientos/**).
- Reusa src/lib/normalizar.ts en vez de crear extractores nuevos.
- quickstart.md:12: usar prisma migrate dev --create-only (constitución §1.2).
- checklists/requirements.md:17 marca sin [NEEDS CLARIFICATION] pero quedan 3.
- plan.md:3 vs spec.md:3: unifica la rama.
- plan.md:33 dice ~14 endpoints; son ~18.
```

---

## Riesgo de cronograma señalado por ZEUS

**005-A creció**: al núcleo de mantenimientos se le sumó el envío inmediato en las tres
colas y el guard de permisos. Ambas cosas son correctas ahora (evitan tocar tres veces
lo mismo), pero la ventana **jul 23-29** queda ajustada.

**Si ODIN reporta que no alcanza:** sacar el **XLSX** de 005-A y llevarlo a 005-B.
El envío inmediato y el guard son estructurales; la carga masiva no.

---
> **📋 Control del documento** · v1.0 · 2026-07-22 · Autor: ZEUS
