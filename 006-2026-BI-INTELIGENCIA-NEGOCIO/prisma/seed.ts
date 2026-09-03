// prisma/seed.ts · Seed idempotente del catálogo BI
// Producto 006 · BI v2 · SPEC-006 · F3C 2026-09-01
// Contenido portado 1:1 de 005 (BI v1 · prisma/seed-catalogo.ts, referencia
// SOLO LECTURA): mismas tablas, columnas, métricas y ejemplos NL→SQL.
// Ejecutar: npm run db:seed  (o `npx prisma db seed`)
// Regla dura S3: upsert({ create, update: {} }) — update VACÍO, NUNCA
// sobreescribir customizaciones del operador. La 2ª pasada crea 0 filas.

import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────────────────────
// 13 tablas del catálogo (subset OPERATIVO de D-20)
// ────────────────────────────────────────────────────────────────────────────
export const TABLAS: Array<{
  nombreFuente: string;
  nombreLegible: string;
  descripcion: string;
  rolesPermitidos: string[];
}> = [
  { nombreFuente: "Reporte", nombreLegible: "Reportes de riesgo", descripcion: "Reportes de conducta potencialmente peligrosa detectados por PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "ClasificacionIA", nombreLegible: "Clasificaciones motor IA", descripcion: "Resultados del clasificador de conducta (categoria · confianza · latencia)", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "clasificacion_rubrica_votos", nombreLegible: "Votos del jurado IA", descripcion: "Votos de la rubrica del jurado de IA por clasificacion (modelo · categoria · cumple). Nombre real en BD (@@map de PI)", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "CorreccionAdmin", nombreLegible: "Correcciones admin", descripcion: "Correcciones manuales de clasificacion IA por admin", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "TransicionReporte", nombreLegible: "Transiciones de estado", descripcion: "Historial de cambios de estado de reportes", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "SolicitudComite", nombreLegible: "Solicitudes de comite", descripcion: "Solicitudes de revision por comite de un reporte", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Colegio", nombreLegible: "Colegios", descripcion: "Instituciones educativas registradas en PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Plan", nombreLegible: "Planes comerciales", descripcion: "Planes de servicio disponibles (precio · nombre)", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Tenant", nombreLegible: "Tenants", descripcion: "Clientes multi-tenant del sistema PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Alumno", nombreLegible: "Alumnos", descripcion: "Estudiantes monitoreados por PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "AuditLog", nombreLegible: "Log de auditoria", descripcion: "Registro de acciones administrativas del sistema", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "FuenteReporte", nombreLegible: "Fuentes de reporte", descripcion: "Origen del reporte (app · extension · API)", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "AlertaColegio", nombreLegible: "Alertas de colegio", descripcion: "Alertas generadas a nivel de colegio", rolesPermitidos: ["ADMIN_BI"] },
];

// ────────────────────────────────────────────────────────────────────────────
// Columnas por tabla (>= 80 total · campos verificados candado 15)
// ────────────────────────────────────────────────────────────────────────────
type Col = { tabla: string; nombreFuente: string; nombreLegible: string; descripcion: string; tipo: string; sinonimos?: string[] };
export const COLUMNAS: Col[] = [
  // Reporte (10)
  { tabla: "Reporte", nombreFuente: "id", nombreLegible: "ID reporte", descripcion: "Identificador unico del reporte", tipo: "String" },
  { tabla: "Reporte", nombreFuente: "pais", nombreLegible: "Pais", descripcion: "Pais del reporte", tipo: "String", sinonimos: ["country", "nacion"] },
  { tabla: "Reporte", nombreFuente: "ciudad", nombreLegible: "Ciudad", descripcion: "Ciudad del reporte", tipo: "String", sinonimos: ["city", "municipio"] },
  { tabla: "Reporte", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado del reporte. Valores reales: CLASIFICADO · REVISION_MANUAL · POSIBLE_SPAM · DUPLICADO", tipo: "EstadoReporte", sinonimos: ["status"] },
  { tabla: "Reporte", nombreFuente: "prioridadAlta", nombreLegible: "Prioridad alta", descripcion: "Marcado como prioridad alta", tipo: "Boolean", sinonimos: ["urgente"] },
  { tabla: "Reporte", nombreFuente: "esRafaga", nombreLegible: "Es rafaga", descripcion: "Parte de una rafaga detectada", tipo: "Boolean" },
  { tabla: "Reporte", nombreFuente: "esAnonimo", nombreLegible: "Es anonimo", descripcion: "Reporte enviado anonimamente", tipo: "Boolean" },
  { tabla: "Reporte", nombreFuente: "eliminado", nombreLegible: "Eliminado", descripcion: "Soft-delete (excluir con eliminado=false)", tipo: "Boolean" },
  { tabla: "Reporte", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de creacion (UTC)", tipo: "DateTime", sinonimos: ["fecha", "created_at"] },
  { tabla: "Reporte", nombreFuente: "tenantId", nombreLegible: "Tenant", descripcion: "FK Tenant · aislamiento multi-tenant", tipo: "String" },

  // ClasificacionIA (7)
  { tabla: "ClasificacionIA", nombreFuente: "id", nombreLegible: "ID clasificacion", descripcion: "ID de la clasificacion IA", tipo: "String" },
  { tabla: "ClasificacionIA", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte clasificado", tipo: "String" },
  { tabla: "ClasificacionIA", nombreFuente: "categoria", nombreLegible: "Categoria conducta", descripcion: "Categoria detectada. Valores reales: CONTACTO_INSISTENTE · SOLICITUD_MATERIAL · OFRECIMIENTO_REGALOS · SUPLANTACION_IDENTIDAD · SOLICITUD_ENCUENTRO · COMPARTIMIENTO_SEXUAL · OTRO · EXTORSION · CONTENIDO_GENERADO_IA · DIFUSION_NO_CONSENTIDA · DOXING · SPAM · CIBERACOSO · HAPPY_SLAPPING · STALKING", tipo: "CategoriaConducta" },
  { tabla: "ClasificacionIA", nombreFuente: "confianza", nombreLegible: "Confianza", descripcion: "Score de confianza 0.0-1.0", tipo: "Float", sinonimos: ["score"] },
  { tabla: "ClasificacionIA", nombreFuente: "latenciaMs", nombreLegible: "Latencia (ms)", descripcion: "Latencia del modelo en milisegundos", tipo: "Int", sinonimos: ["tiempo"] },
  { tabla: "ClasificacionIA", nombreFuente: "modeloUsado", nombreLegible: "Modelo LLM", descripcion: "Nombre del modelo usado (qwen2.5:14b · etc)", tipo: "String", sinonimos: ["modelo"] },
  { tabla: "ClasificacionIA", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de la clasificacion", tipo: "DateTime" },

  // clasificacion_rubrica_votos (6)
  { tabla: "clasificacion_rubrica_votos", nombreFuente: "id", nombreLegible: "ID voto", descripcion: "ID del voto", tipo: "String" },
  { tabla: "clasificacion_rubrica_votos", nombreFuente: "clasificacionIAId", nombreLegible: "Clasificacion", descripcion: "FK a ClasificacionIA votada (nombre real en BD)", tipo: "String" },
  { tabla: "clasificacion_rubrica_votos", nombreFuente: "modelo", nombreLegible: "Modelo jurado", descripcion: "Nombre del modelo del jurado que emitio el voto", tipo: "String" },
  { tabla: "clasificacion_rubrica_votos", nombreFuente: "categoria", nombreLegible: "Categoria votada", descripcion: "Categoria de conducta evaluada por el voto", tipo: "String" },
  { tabla: "clasificacion_rubrica_votos", nombreFuente: "cumple", nombreLegible: "Cumple rubrica", descripcion: "Si el voto marco que la clasificacion cumple la rubrica", tipo: "Boolean" },
  { tabla: "clasificacion_rubrica_votos", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp del voto", tipo: "DateTime" },

  // CorreccionAdmin (5)
  { tabla: "CorreccionAdmin", nombreFuente: "id", nombreLegible: "ID correccion", descripcion: "ID de la correccion", tipo: "String" },
  { tabla: "CorreccionAdmin", nombreFuente: "clasificacionId", nombreLegible: "Clasificacion", descripcion: "FK a ClasificacionIA corregida (el reporte se resuelve via ClasificacionIA.reporteId)", tipo: "String" },
  { tabla: "CorreccionAdmin", nombreFuente: "categoriaCorregida", nombreLegible: "Categoria corregida", descripcion: "Categoria corregida por el admin segun su criterio", tipo: "CategoriaConducta" },
  { tabla: "CorreccionAdmin", nombreFuente: "adminId", nombreLegible: "Admin", descripcion: "ID del admin que corrigio", tipo: "String" },
  { tabla: "CorreccionAdmin", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de la correccion", tipo: "DateTime" },

  // TransicionReporte (6)
  { tabla: "TransicionReporte", nombreFuente: "id", nombreLegible: "ID transicion", descripcion: "ID de la transicion", tipo: "String" },
  { tabla: "TransicionReporte", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte", tipo: "String" },
  { tabla: "TransicionReporte", nombreFuente: "estadoAnterior", nombreLegible: "Estado anterior", descripcion: "Estado antes de la transicion", tipo: "EstadoReporte" },
  { tabla: "TransicionReporte", nombreFuente: "estadoNuevo", nombreLegible: "Estado nuevo", descripcion: "Estado despues de la transicion", tipo: "EstadoReporte" },
  { tabla: "TransicionReporte", nombreFuente: "responsableTipo", nombreLegible: "Responsable", descripcion: "Tipo de responsable (SISTEMA · ADMIN · COMITE)", tipo: "ResponsableTransicion" },
  { tabla: "TransicionReporte", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de la transicion", tipo: "DateTime" },

  // SolicitudComite (5)
  { tabla: "SolicitudComite", nombreFuente: "id", nombreLegible: "ID solicitud", descripcion: "ID de la solicitud a comite", tipo: "String" },
  { tabla: "SolicitudComite", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte solicitado", tipo: "String" },
  { tabla: "SolicitudComite", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado de la solicitud", tipo: "String" },
  { tabla: "SolicitudComite", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de creacion", tipo: "DateTime" },
  { tabla: "SolicitudComite", nombreFuente: "resueltoEn", nombreLegible: "Resuelto en", descripcion: "Timestamp de resolucion (null si pendiente)", tipo: "DateTime" },

  // Colegio (5)
  { tabla: "Colegio", nombreFuente: "id", nombreLegible: "ID colegio", descripcion: "ID del colegio", tipo: "String" },
  { tabla: "Colegio", nombreFuente: "nombre", nombreLegible: "Nombre", descripcion: "Nombre del colegio", tipo: "String" },
  { tabla: "Colegio", nombreFuente: "paisId", nombreLegible: "Pais", descripcion: "FK Pais (id; no texto — sin JOIN la app no resuelve nombres)", tipo: "String" },
  { tabla: "Colegio", nombreFuente: "ciudadId", nombreLegible: "Ciudad", descripcion: "FK Ciudad (id; no texto — sin JOIN la app no resuelve nombres)", tipo: "String" },
  { tabla: "Colegio", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro", tipo: "DateTime" },

  // Plan (4)
  { tabla: "Plan", nombreFuente: "id", nombreLegible: "ID plan", descripcion: "ID del plan", tipo: "String" },
  { tabla: "Plan", nombreFuente: "nombre", nombreLegible: "Nombre", descripcion: "Nombre del plan comercial", tipo: "String" },
  { tabla: "Plan", nombreFuente: "precio", nombreLegible: "Precio", descripcion: "Precio del plan", tipo: "Float" },
  { tabla: "Plan", nombreFuente: "activo", nombreLegible: "Activo", descripcion: "Si el plan esta activo", tipo: "Boolean" },

  // Tenant (4)
  { tabla: "Tenant", nombreFuente: "id", nombreLegible: "ID tenant", descripcion: "ID del tenant", tipo: "String" },
  { tabla: "Tenant", nombreFuente: "nombre", nombreLegible: "Nombre", descripcion: "Nombre del tenant", tipo: "String" },
  { tabla: "Tenant", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica)", tipo: "String" },
  { tabla: "Tenant", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro", tipo: "DateTime" },

  // Alumno (5)
  { tabla: "Alumno", nombreFuente: "id", nombreLegible: "ID alumno", descripcion: "ID del alumno", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "cursoId", nombreLegible: "Curso", descripcion: "FK Curso", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica; filtrar estado='activo')", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },

  // AuditLog (5)
  { tabla: "AuditLog", nombreFuente: "id", nombreLegible: "ID audit", descripcion: "ID del evento auditado", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "accion", nombreLegible: "Accion", descripcion: "Accion realizada (crear · editar · eliminar · etc)", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "usuarioId", nombreLegible: "Usuario", descripcion: "ID del usuario que ejecuto la accion", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "tipoRecurso", nombreLegible: "Recurso", descripcion: "Tipo de recurso afectado (nombre real en BD; recursoId lleva el id)", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp del evento", tipo: "DateTime" },

  // FuenteReporte (3)
  { tabla: "FuenteReporte", nombreFuente: "id", nombreLegible: "ID fuente", descripcion: "ID de la fuente", tipo: "String" },
  { tabla: "FuenteReporte", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte", tipo: "String" },
  { tabla: "FuenteReporte", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp del registro", tipo: "DateTime" },

  // AlertaColegio (5) — corregido 2026-09-01: las columnas fantasma v1
  // (tipo, resuelta) NO existen en la tabla real; las reemplazan tipoSujeto
  // (ESTUDIANTE/ACUDIENTE/PROFESOR) y estado (nueva/vista/gestionada/escalada/cerrada)
  { tabla: "AlertaColegio", nombreFuente: "id", nombreLegible: "ID alerta", descripcion: "ID de la alerta", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "tipoSujeto", nombreLegible: "Tipo de sujeto", descripcion: "Sujeto de la alerta (alumno · acudiente · profesor)", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado de gestion de la alerta. Valores reales: nueva · vista · gestionada · escalada · cerrada", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de la alerta", tipo: "DateTime" },
];

// ────────────────────────────────────────────────────────────────────────────
// 12 metricas de negocio
// ────────────────────────────────────────────────────────────────────────────
export const METRICAS: Array<{ nombre: string; nombreLegible: string; descripcion: string; formulaSQL: string; categoria: string }> = [
  { nombre: "reportes_hoy", nombreLegible: "Reportes hoy", descripcion: "Total de reportes creados hoy", formulaSQL: `SELECT count(*) FROM "Reporte" WHERE date_trunc('day',"creadoEn")=current_date AND "eliminado"=false`, categoria: "operativo" },
  { nombre: "reportes_semana", nombreLegible: "Reportes ultima semana", descripcion: "Reportes creados en los ultimos 7 dias", formulaSQL: `SELECT count(*) FROM "Reporte" WHERE "creadoEn" >= now() - interval '7 days' AND "eliminado"=false`, categoria: "operativo" },
  { nombre: "reportes_prioridad_alta", nombreLegible: "Reportes prioridad alta", descripcion: "Reportes activos con prioridad alta", formulaSQL: `SELECT count(*) FROM "Reporte" WHERE "prioridadAlta"=true AND "eliminado"=false`, categoria: "operativo" },
  { nombre: "tasa_correccion_ia", nombreLegible: "Tasa correccion IA", descripcion: "Proporcion de clasificaciones corregidas por admin (ultimos 30d)", formulaSQL: `SELECT count(ca.id)::float / NULLIF(count(c.id),0) FROM "ClasificacionIA" c LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId"=c.id WHERE c."creadoEn" >= now() - interval '30 days'`, categoria: "motor_ia" },
  { nombre: "confianza_promedio_ia", nombreLegible: "Confianza promedio IA", descripcion: "Confianza promedio del clasificador", formulaSQL: `SELECT avg("confianza") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoria: "motor_ia" },
  { nombre: "latencia_p95_ia", nombreLegible: "Latencia p95 IA", descripcion: "Percentil 95 de latencia del clasificador (ms)", formulaSQL: `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoria: "motor_ia" },
  { nombre: "clasificaciones_por_modelo", nombreLegible: "Clasificaciones por modelo", descripcion: "Total de clasificaciones agrupadas por modelo LLM", formulaSQL: `SELECT "modeloUsado", count(*) FROM "ClasificacionIA" GROUP BY "modeloUsado"`, categoria: "motor_ia" },
  { nombre: "tiempo_medio_resolucion_h", nombreLegible: "Tiempo medio resolucion (h)", descripcion: "Horas promedio entre creacion y cierre de reporte", formulaSQL: `SELECT avg(EXTRACT(EPOCH FROM (tr."creadoEn" - r."creadoEn"))/3600) FROM "Reporte" r JOIN "TransicionReporte" tr ON tr."reporteId"=r.id WHERE tr."estadoNuevo"='CLASIFICADO'`, categoria: "operativo" },
  { nombre: "solicitudes_comite_abiertas", nombreLegible: "Solicitudes comite abiertas", descripcion: "Solicitudes a comite sin resolver", formulaSQL: `SELECT count(*) FROM "SolicitudComite" WHERE "resueltoEn" IS NULL`, categoria: "operativo" },
  { nombre: "audit_events_dia", nombreLegible: "Eventos audit hoy", descripcion: "Eventos registrados hoy en AuditLog", formulaSQL: `SELECT count(*) FROM "AuditLog" WHERE date_trunc('day',"creadoEn")=current_date`, categoria: "salud" },
  { nombre: "alertas_colegio_abiertas", nombreLegible: "Alertas colegio abiertas", descripcion: "Alertas de colegio sin cerrar (nueva · vista · escalada)", formulaSQL: `SELECT count(*) FROM "AlertaColegio" WHERE "estado" IN ('nueva','vista','escalada')`, categoria: "salud" },
  { nombre: "colegios_registrados", nombreLegible: "Colegios registrados", descripcion: "Total de colegios en el sistema", formulaSQL: `SELECT count(*) FROM "Colegio"`, categoria: "general" },
];

// ────────────────────────────────────────────────────────────────────────────
// 25 ejemplos NL→SQL curados
// ────────────────────────────────────────────────────────────────────────────
export const EJEMPLOS: Array<{ preguntaNL: string; sql: string; categoriaConsulta: string }> = [
  { preguntaNL: "Cuantos reportes se crearon hoy?", sql: `SELECT count(*) FROM "Reporte" WHERE date_trunc('day',"creadoEn")=current_date AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Cuantos reportes tuvimos la semana pasada?", sql: `SELECT count(*) FROM "Reporte" WHERE "creadoEn" >= now() - interval '7 days' AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Top 5 paises con mas reportes este mes", sql: `SELECT pais, count(*) as total FROM "Reporte" WHERE date_trunc('month',"creadoEn")=date_trunc('month',now()) AND "eliminado"=false GROUP BY pais ORDER BY total DESC LIMIT 5`, categoriaConsulta: "reportes" },
  { preguntaNL: "Top 10 colegios con mas reportes activos", sql: `SELECT c.nombre, count(r.id) as total FROM "Colegio" c JOIN "Reporte" r ON r."colegioId"=c.id WHERE r."eliminado"=false GROUP BY c.nombre ORDER BY total DESC LIMIT 10`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes por estado actualmente", sql: `SELECT estado, count(*) FROM "Reporte" WHERE "eliminado"=false GROUP BY estado ORDER BY count(*) DESC`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes de prioridad alta abiertos", sql: `SELECT count(*) FROM "Reporte" WHERE "prioridadAlta"=true AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes anonimos vs identificados en el mes", sql: `SELECT "esAnonimo", count(*) FROM "Reporte" WHERE date_trunc('month',"creadoEn")=date_trunc('month',now()) AND "eliminado"=false GROUP BY "esAnonimo"`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes en rafaga esta semana", sql: `SELECT count(*) FROM "Reporte" WHERE "esRafaga"=true AND "creadoEn" >= now() - interval '7 days' AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Cual es la precision del motor IA?", sql: `SELECT 1 - (count(ca.id)::float / NULLIF(count(c.id),0)) FROM "ClasificacionIA" c LEFT JOIN "CorreccionAdmin" ca ON ca."clasificacionId"=c.id WHERE c."creadoEn" >= now() - interval '30 days'`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Latencia promedio del clasificador ultimo mes", sql: `SELECT avg("latenciaMs") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Latencia p95 del clasificador", sql: `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Distribucion de categorias detectadas", sql: `SELECT categoria, count(*) FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days' GROUP BY categoria ORDER BY count(*) DESC`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Cuantas correcciones hicimos hoy?", sql: `SELECT count(*) FROM "CorreccionAdmin" WHERE date_trunc('day',"creadoEn")=current_date`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Clasificaciones agrupadas por modelo LLM", sql: `SELECT "modeloUsado", count(*), avg("confianza") FROM "ClasificacionIA" GROUP BY "modeloUsado" ORDER BY count(*) DESC`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Tiempo medio de resolucion de reportes", sql: `SELECT avg(EXTRACT(EPOCH FROM (tr."creadoEn" - r."creadoEn"))/3600) FROM "Reporte" r JOIN "TransicionReporte" tr ON tr."reporteId"=r.id WHERE tr."estadoNuevo"='CLASIFICADO'`, categoriaConsulta: "operativo" },
  { preguntaNL: "Transiciones por responsable ultima semana", sql: `SELECT "responsableTipo", count(*) FROM "TransicionReporte" WHERE "creadoEn" >= now() - interval '7 days' GROUP BY "responsableTipo"`, categoriaConsulta: "operativo" },
  { preguntaNL: "Solicitudes a comite pendientes", sql: `SELECT count(*) FROM "SolicitudComite" WHERE "resueltoEn" IS NULL`, categoriaConsulta: "operativo" },
  { preguntaNL: "Solicitudes a comite resueltas este mes", sql: `SELECT count(*) FROM "SolicitudComite" WHERE "resueltoEn" IS NOT NULL AND date_trunc('month',"resueltoEn")=date_trunc('month',now())`, categoriaConsulta: "operativo" },
  { preguntaNL: "Eventos de audit por accion hoy", sql: `SELECT accion, count(*) FROM "AuditLog" WHERE date_trunc('day',"creadoEn")=current_date GROUP BY accion ORDER BY count(*) DESC`, categoriaConsulta: "salud" },
  { preguntaNL: "Alertas de colegio no resueltas", sql: `SELECT count(*) FROM "AlertaColegio" WHERE "estado" IN ('nueva','vista','escalada')`, categoriaConsulta: "salud" },
  { preguntaNL: "Colegios con mas alertas este mes", sql: `SELECT c.nombre, count(a.id) FROM "Colegio" c JOIN "AlertaColegio" a ON a."colegioId"=c.id WHERE date_trunc('month',a."creadoEn")=date_trunc('month',now()) GROUP BY c.nombre ORDER BY count(a.id) DESC LIMIT 10`, categoriaConsulta: "salud" },
  { preguntaNL: "Reportes creados por fuente esta semana", sql: `SELECT p."nombre", count(*) FROM "FuenteReporte" fr JOIN "Reporte" r ON r.id=fr."reporteId" JOIN "Plataforma" p ON p."id"=r."plataformaId" WHERE r."creadoEn" >= now() - interval '7 days' AND r."eliminado"=false GROUP BY p."nombre"`, categoriaConsulta: "reportes" },
  { preguntaNL: "Total de colegios registrados", sql: `SELECT count(*) FROM "Colegio"`, categoriaConsulta: "general" },
  { preguntaNL: "Total de reportes en la base", sql: `SELECT count(*) FROM "Reporte" WHERE "eliminado"=false`, categoriaConsulta: "general" },
  { preguntaNL: "Reportes por ciudad top 10 este mes", sql: `SELECT ciudad, count(*) FROM "Reporte" WHERE date_trunc('month',"creadoEn")=date_trunc('month',now()) AND "eliminado"=false GROUP BY ciudad ORDER BY count(*) DESC LIMIT 10`, categoriaConsulta: "reportes" },
];

// ────────────────────────────────────────────────────────────────────────────
// Funciones de seed (idempotentes: update: {})
// Log por modelo: creados (nuevos en esta pasada) · existentes (ya estaban).
// ────────────────────────────────────────────────────────────────────────────

async function seedTablas(): Promise<void> {
  const antes = await prisma.bICatalogoTabla.count();
  for (const t of TABLAS) {
    await prisma.bICatalogoTabla.upsert({
      where: { nombreFuente: t.nombreFuente },
      create: t,
      update: {},
    });
  }
  const creadas = (await prisma.bICatalogoTabla.count()) - antes;
  console.log(`  · BICatalogoTabla: ${creadas} creadas · ${TABLAS.length - creadas} existentes`);
}

async function seedColumnas(): Promise<void> {
  const tablasBD = await prisma.bICatalogoTabla.findMany();
  const idMap = new Map(tablasBD.map((t) => [t.nombreFuente, t.id]));
  const antes = await prisma.bICatalogoColumna.count();
  let omitidas = 0;
  for (const c of COLUMNAS) {
    const tablaId = idMap.get(c.tabla);
    if (!tablaId) {
      omitidas += 1;
      console.warn(`  ! columna ${c.tabla}.${c.nombreFuente} sin tabla padre · omitida`);
      continue;
    }
    await prisma.bICatalogoColumna.upsert({
      where: { tablaId_nombreFuente: { tablaId, nombreFuente: c.nombreFuente } },
      create: {
        tablaId,
        nombreFuente: c.nombreFuente,
        nombreLegible: c.nombreLegible,
        descripcion: c.descripcion,
        tipo: c.tipo,
        sinonimos: c.sinonimos ?? [],
      },
      update: {},
    });
  }
  const creadas = (await prisma.bICatalogoColumna.count()) - antes;
  console.log(`  · BICatalogoColumna: ${creadas} creadas · ${COLUMNAS.length - omitidas - creadas} existentes · ${omitidas} omitidas`);
}

async function seedMetricas(): Promise<void> {
  const antes = await prisma.bICatalogoMetrica.count();
  for (const m of METRICAS) {
    await prisma.bICatalogoMetrica.upsert({
      where: { nombre: m.nombre },
      create: m,
      update: {},
    });
  }
  const creadas = (await prisma.bICatalogoMetrica.count()) - antes;
  console.log(`  · BICatalogoMetrica: ${creadas} creadas · ${METRICAS.length - creadas} existentes`);
}

async function seedEjemplos(): Promise<void> {
  const antes = await prisma.bICatalogoEjemplo.count();
  for (const e of EJEMPLOS) {
    await prisma.bICatalogoEjemplo.upsert({
      where: { preguntaNL: e.preguntaNL },
      create: e,
      update: {},
    });
  }
  const creados = (await prisma.bICatalogoEjemplo.count()) - antes;
  console.log(`  · BICatalogoEjemplo: ${creados} creados · ${EJEMPLOS.length - creados} existentes`);
}

// ────────────────────────────────────────────────────────────────────────────
// Parámetros de configuración IA en BD (B3 · bi_config · Admin IA)
// Editables sin despliegue desde la página Admin IA. update:{} vacío: si el
// operador cambió el modelo o el timeout a mano, el seed NO lo pisa.
// ────────────────────────────────────────────────────────────────────────────
const CONFIGS: Array<{ clave: string; valor: string; descripcion: string }> = [
  {
    clave: "ia.ollama.modelo_sql",
    valor: process.env.LLM_MODEL_SQL || "qwen2.5:14b",
    descripcion: "Modelo Ollama para NL→SQL y chat (Mac Studio via Tailscale)",
  },
  {
    clave: "ia.ollama.timeout_ms",
    valor: "120000",
    descripcion: "Timeout en ms de las llamadas de generacion a Ollama (entero > 0)",
  },
  {
    clave: "bi.motor.limite_default",
    valor: "100",
    descripcion: "LIMIT por defecto de las consultas del motor NL->SQL cuando el plan no pide otro",
  },
  {
    clave: "bi.motor.limite_maximo",
    valor: "500",
    descripcion: "LIMIT maximo permitido en las consultas del motor NL->SQL (techo duro)",
  },
  {
    clave: "bi.insights.subida_semanal_pct",
    valor: "50",
    descripcion: "Umbral % de subida de una categoria (ultimas 2 semanas vs 2 anteriores) para el insight ambar del Pulso",
  },
  {
    clave: "bi.insights.dias_sin_reportes",
    valor: "30",
    descripcion: "Dias sin reportes de un colegio activo para disparar el insight cielo del Pulso",
  },
  {
    clave: "operacion.dias_sin_actividad_bad",
    valor: "30",
    descripcion: "Dias sin reportes para que un colegio pase a semaforo rubi en /operacion",
  },
  {
    clave: "operacion.horas_actividad_warn",
    valor: "6",
    descripcion: "Horas desde el ultimo reporte para semaforo ambar (actividad reciente) en /operacion",
  },
  {
    clave: "operacion.minutos_badge_nuevo",
    valor: "120",
    descripcion: "Minutos de recencia para el badge NUEVO en la tabla de /operacion",
  },
  {
    clave: "operacion.min_repeticion_categoria",
    valor: "3",
    descripcion: "Minimo de reportes del mes en una categoria sensible para semaforo ambar",
  },
  {
    clave: "operacion.categorias_sensibles",
    valor: "SOLICITUD_MATERIAL,COMPARTIMIENTO_SEXUAL,DIFUSION_NO_CONSENTIDA,SOLICITUD_ENCUENTRO,EXTORSION",
    descripcion: "Categorias (enum CategoriaConducta de PI, separadas por coma) que elevan el semaforo si se repiten",
  },
  // NOTA 2026-09-03: `bi.capacidad.casos_max_operario` fue RETIRADO del seed.
  // La tarjeta de capacidad mide la cola de moderación con el cupo REAL de
  // PerfilOperador (replicado desde PI); un cupo local quemado desvirtuaba la
  // cifra frente al panel de PI. La fila muerta en BD se ignora y puede
  // borrarse a mano (el seed nunca borra: update:{} vacío, S3).
  {
    clave: "bi.analitica.sigma",
    valor: "2",
    descripcion: "Umbral de z-score (sigma) sobre la media de 28 dias para declarar anomalia del dia y fenomeno geo en /analitica",
  },
  {
    clave: "bi.analitica.riesgo_minimo",
    valor: "50",
    descripcion: "Total 12m minimo para que una categoria sensible llegue a severidad critica en /analitica",
  },
  {
    clave: "bi.analitica.subida_pct",
    valor: "100",
    descripcion: "Subida % (14 dias vs 14 previos) para el fenomeno plataforma x categoria del detector de /analitica",
  },
  {
    clave: "bi.analitica.rafaga_horas",
    valor: "48",
    descripcion: "Ventana en horas del fenomeno rafaga (esRafaga) del detector de /analitica",
  },
  // ── Marco de vigilancia (src/lib/bi/vigilancia.ts · Lote 1) ──
  // La ventana de rafagas REUSA bi.analitica.rafaga_horas (arriba): no se duplica.
  {
    clave: "bi.vigilancia.atascado_dias",
    valor: "3",
    descripcion: "Dias sin movimiento (TransicionReporte) para declarar atascado un reporte en REVISION_MANUAL",
  },
  {
    clave: "bi.vigilancia.motor_caido_horas",
    valor: "6",
    descripcion: "Horas desde la ultima ClasificacionIA para sospechar motor de clasificacion detenido (sintoma, no certeza)",
  },
  {
    clave: "bi.vigilancia.atascados_alerta",
    valor: "5",
    descripcion: "Minimo de reportes atascados en revision manual para disparar el insight ambar del marco de vigilancia",
  },
];

async function seedConfig(): Promise<void> {
  const antes = await prisma.bIConfig.count();
  for (const c of CONFIGS) {
    await prisma.bIConfig.upsert({
      where: { clave: c.clave },
      create: c,
      update: {},
    });
  }
  const creadas = (await prisma.bIConfig.count()) - antes;
  console.log(`  · BIConfig: ${creadas} creadas · ${CONFIGS.length - creadas} existentes`);
}

// ────────────────────────────────────────────────────────────────────────────
// ── AMPLIACION V2 (2026-09-01 · catálogo sobre la publicación de 40 tablas) ─
// Extiende el catálogo con las 11 tablas de negocio de las "17 nuevas
// autorizadas BI v2" en scripts/replica-setup/02-pi-db-publicacion.sql.
// TODO es ADITIVO: misma regla S3 (upsert update:{} vacio, NUNCA pisar
// customizaciones del operador). No toca ninguna fila de la seccion v1.
//
// Reglas aplicadas:
//   · Columnas = EXACTAMENTE las publicadas por el 02. La PII (nombres,
//     documentos, `valor` de identificadores) ni siquiera existe en bi-db —
//     cortada en origen por column list — y JAMAS se lista aqui.
//   · nombreFuente = nombre REAL en BD (respeta @@map/@map de PI: la FK de
//     IdentificadorAlumno es "alumnoId"; la FK de AlertaColegio al alumno es
//     "identificadorAlumnoId"; el enum de etiqueta es "EtiquetaRelacionAlumno"
//     con valor 'ALUMNO').
//   · excluida=true SOLO en columnas tecnicas internas: FKs a Usuario (tabla
//     jamas publicada: el cuid no resuelve a nada en bi-db) y updatedAt/
//     actualizadoEn (ruido de sync sin valor analitico; los timestamps de
//     creacion SI quedan visibles para cortes temporales).
//   · Tipos = tipos reales del schema de PI; enums PG por su nombre real en
//     BD (en GROUP BY/SELECT conviene ::text, ver descripciones).
//   · AlertaColegio ya existe en la seccion v1 (5 columnas): el upsert no la
//     duplica; aqui solo se AGREGAN sus columnas reales faltantes.
// ────────────────────────────────────────────────────────────────────────────

const TABLAS_V2: Array<{
  nombreFuente: string;
  nombreLegible: string;
  descripcion: string;
  rolesPermitidos: string[];
}> = [
  { nombreFuente: "Profesor", nombreLegible: "Profesores", descripcion: "Docentes registrados por los colegios (sin nombres ni documentos: cortados en origen). Sinonimos: profe · docente · maestro", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "AcudienteEstudiante", nombreLegible: "Acudientes de alumnos", descripcion: "Acudientes de cada alumno (max 2; orden 1=principal 2=secundario; sin nombres ni contactos: cortados en origen). Sinonimos: acudiente · padre de familia", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "IdentificadorAlumno", nombreLegible: "Identificadores de alumnos", descripcion: "Cuentas/nicks/telefonos de alumnos registrados por el colegio (SIN valor: cortado en origen; solo tipo, plataforma y estado). Sinonimos: nick · cuenta · usuario de plataforma", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "IdentificadorAcudiente", nombreLegible: "Identificadores de acudientes", descripcion: "Cuentas/nicks/telefonos de acudientes (SIN valor: cortado en origen). Sinonimos: nick · cuenta · usuario de plataforma", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "IdentificadorProfesor", nombreLegible: "Identificadores de profesores", descripcion: "Cuentas/nicks/telefonos de profesores (SIN valor: cortado en origen). Sinonimos: nick · cuenta · usuario de plataforma", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "IdentificadorHijo", nombreLegible: "Identificadores de hijos", descripcion: "Cuentas/nicks de hijos que los padres vigilan desde la app (SIN valor: cortado en origen). Sinonimos: nick · cuenta · usuario de plataforma · hijo", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "AlertaColegio", nombreLegible: "Alertas de colegio", descripcion: "Alertas generadas al cruzar un reporte con un identificador registrado (tipoSujeto ESTUDIANTE · PROFESOR · ACUDIENTE; estado nueva · vista · gestionada · escalada · cerrada). Sinonimos: alerta · escalada", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Suscripcion", nombreLegible: "Suscripciones SaaS", descripcion: "Suscripciones de colegios y padres al servicio (vigencia, estado, plan, freemium). Sinonimos: suscripcion · plan · vigencia", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "IdentificadorReportado", nombreLegible: "Identificadores reportados", descripcion: "Agregado publico por identificador reportado (SIN el nick en claro: cortado en origen). Contadores, scores y visibilidad. Sinonimos: vigilado · reportado", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Hijo", nombreLegible: "Hijos", descripcion: "Hijos que los padres protegen desde la app (sin nombres ni documentos: cortados en origen). Sinonimos: hijo · menor · circulo", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "ContactoConfianza", nombreLegible: "Contactos de confianza", descripcion: "Personas del circulo de confianza que el padre vigila (sin nombres ni notas: cortados en origen). Sinonimos: contacto de confianza · circulo", rolesPermitidos: ["ADMIN_BI"] },
];

type ColV2 = Col & { excluida?: boolean };
const COLUMNAS_V2: ColV2[] = [
  // Profesor (7 publicadas)
  { tabla: "Profesor", nombreFuente: "id", nombreLegible: "ID profesor", descripcion: "Identificador unico del profesor", tipo: "String", sinonimos: ["profe", "docente", "maestro", "profesor"] },
  { tabla: "Profesor", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio (join por id)", tipo: "String" },
  { tabla: "Profesor", nombreFuente: "anioNacimiento", nombreLegible: "Ano de nacimiento", descripcion: "Ano de nacimiento (la edad se deriva, no se almacena)", tipo: "Int" },
  { tabla: "Profesor", nombreFuente: "sexo", nombreLegible: "Sexo", descripcion: "Set cerrado: M · F · OTRO", tipo: "String" },
  { tabla: "Profesor", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica; filtrar estado='activo')", tipo: "String" },
  { tabla: "Profesor", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime", sinonimos: ["fecha registro", "fecha"] },
  { tabla: "Profesor", nombreFuente: "updatedAt", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // AcudienteEstudiante (7 publicadas)
  { tabla: "AcudienteEstudiante", nombreFuente: "id", nombreLegible: "ID acudiente", descripcion: "Identificador unico del acudiente", tipo: "String", sinonimos: ["acudiente", "padre de familia", "padre", "madre"] },
  { tabla: "AcudienteEstudiante", nombreFuente: "estudianteId", nombreLegible: "Alumno", descripcion: "FK Alumno (tabla fisica \"Alumno\")", tipo: "String" },
  { tabla: "AcudienteEstudiante", nombreFuente: "orden", nombreLegible: "Orden", descripcion: "1 = principal · 2 = secundario (max 2 por alumno)", tipo: "Int" },
  { tabla: "AcudienteEstudiante", nombreFuente: "relacion", nombreLegible: "Relacion", descripcion: "Texto corto libre: madre · padre · tia · abuelo ...", tipo: "String", sinonimos: ["parentesco"] },
  { tabla: "AcudienteEstudiante", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica)", tipo: "String" },
  { tabla: "AcudienteEstudiante", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "AcudienteEstudiante", nombreFuente: "updatedAt", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // IdentificadorAlumno (9 publicadas)
  { tabla: "IdentificadorAlumno", nombreFuente: "id", nombreLegible: "ID identificador", descripcion: "Identificador unico del registro (NO es el nick: el valor esta cortado en origen)", tipo: "String", sinonimos: ["nick", "cuenta", "usuario de plataforma", "identificador"] },
  { tabla: "IdentificadorAlumno", nombreFuente: "alumnoId", nombreLegible: "Alumno", descripcion: "FK Alumno (nombre REAL en BD; el modelo Prisma la llama estudianteId via @map)", tipo: "String" },
  { tabla: "IdentificadorAlumno", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio (denormalizada para acotar por tenant)", tipo: "String" },
  { tabla: "IdentificadorAlumno", nombreFuente: "tipo", nombreLegible: "Tipo", descripcion: "Tipo de identificador (telefono · email · nick · usuario ...)", tipo: "String", sinonimos: ["tipo de cuenta", "medio"] },
  { tabla: "IdentificadorAlumno", nombreFuente: "plataformaId", nombreLegible: "Plataforma", descripcion: "FK Plataforma (null si no aplica)", tipo: "String", sinonimos: ["plataforma", "red social", "app"] },
  { tabla: "IdentificadorAlumno", nombreFuente: "etiquetaRelacion", nombreLegible: "Etiqueta de relacion", descripcion: "Enum PG EtiquetaRelacionAlumno: ALUMNO · MADRE · PADRE · PRIMO · TUTOR · OTRO (usar ::text en GROUP BY)", tipo: "EtiquetaRelacionAlumno" },
  { tabla: "IdentificadorAlumno", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica)", tipo: "String" },
  { tabla: "IdentificadorAlumno", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "IdentificadorAlumno", nombreFuente: "updatedAt", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // IdentificadorAcudiente (8 publicadas)
  { tabla: "IdentificadorAcudiente", nombreFuente: "id", nombreLegible: "ID identificador", descripcion: "Identificador unico del registro (NO es el nick: el valor esta cortado en origen)", tipo: "String", sinonimos: ["nick", "cuenta", "usuario de plataforma"] },
  { tabla: "IdentificadorAcudiente", nombreFuente: "acudienteId", nombreLegible: "Acudiente", descripcion: "FK AcudienteEstudiante", tipo: "String" },
  { tabla: "IdentificadorAcudiente", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio (denormalizada para tenant)", tipo: "String" },
  { tabla: "IdentificadorAcudiente", nombreFuente: "tipo", nombreLegible: "Tipo", descripcion: "Tipo de identificador (telefono · email · nick ...)", tipo: "String", sinonimos: ["tipo de cuenta", "medio"] },
  { tabla: "IdentificadorAcudiente", nombreFuente: "plataformaId", nombreLegible: "Plataforma", descripcion: "FK Plataforma (null si no aplica)", tipo: "String", sinonimos: ["plataforma", "red social", "app"] },
  { tabla: "IdentificadorAcudiente", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica)", tipo: "String" },
  { tabla: "IdentificadorAcudiente", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "IdentificadorAcudiente", nombreFuente: "updatedAt", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // IdentificadorProfesor (8 publicadas)
  { tabla: "IdentificadorProfesor", nombreFuente: "id", nombreLegible: "ID identificador", descripcion: "Identificador unico del registro (NO es el nick: el valor esta cortado en origen)", tipo: "String", sinonimos: ["nick", "cuenta", "usuario de plataforma"] },
  { tabla: "IdentificadorProfesor", nombreFuente: "profesorId", nombreLegible: "Profesor", descripcion: "FK Profesor", tipo: "String", sinonimos: ["profe", "docente"] },
  { tabla: "IdentificadorProfesor", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio (denormalizada para tenant)", tipo: "String" },
  { tabla: "IdentificadorProfesor", nombreFuente: "tipo", nombreLegible: "Tipo", descripcion: "Tipo de identificador (telefono · email · nick ...)", tipo: "String", sinonimos: ["tipo de cuenta", "medio"] },
  { tabla: "IdentificadorProfesor", nombreFuente: "plataformaId", nombreLegible: "Plataforma", descripcion: "FK Plataforma (null si no aplica)", tipo: "String", sinonimos: ["plataforma", "red social", "app"] },
  { tabla: "IdentificadorProfesor", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica)", tipo: "String" },
  { tabla: "IdentificadorProfesor", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "IdentificadorProfesor", nombreFuente: "updatedAt", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // IdentificadorHijo (7 publicadas)
  { tabla: "IdentificadorHijo", nombreFuente: "id", nombreLegible: "ID identificador", descripcion: "Identificador unico del registro (NO es el nick: el valor esta cortado en origen)", tipo: "String", sinonimos: ["nick", "cuenta", "usuario de plataforma", "hijo"] },
  { tabla: "IdentificadorHijo", nombreFuente: "hijoId", nombreLegible: "Hijo", descripcion: "FK Hijo", tipo: "String" },
  { tabla: "IdentificadorHijo", nombreFuente: "tipo", nombreLegible: "Tipo", descripcion: "Tipo de identificador (null si no aplica)", tipo: "String", sinonimos: ["tipo de cuenta", "medio"] },
  { tabla: "IdentificadorHijo", nombreFuente: "plataformaId", nombreLegible: "Plataforma", descripcion: "FK Plataforma (null si no aplica)", tipo: "String", sinonimos: ["plataforma", "red social", "app"] },
  { tabla: "IdentificadorHijo", nombreFuente: "activo", nombreLegible: "Activo", descripcion: "Si esta activo (baja logica con activo=false)", tipo: "Boolean" },
  { tabla: "IdentificadorHijo", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "IdentificadorHijo", nombreFuente: "actualizadoEn", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // AlertaColegio (completa en la publicacion = 14 columnas; id, colegioId y
  // creadoEn ya estan en la seccion v1 — aqui van las 11 faltantes)
  { tabla: "AlertaColegio", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK Reporte que disparo la alerta", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "identificadorAlumnoId", nombreLegible: "Identificador alumno", descripcion: "FK IdentificadorAlumno (nombre REAL en BD via @map; poblada si tipoSujeto=ESTUDIANTE)", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "identificadorProfesorId", nombreLegible: "Identificador profesor", descripcion: "FK IdentificadorProfesor (poblada si tipoSujeto=PROFESOR)", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "identificadorAcudienteId", nombreLegible: "Identificador acudiente", descripcion: "FK IdentificadorAcudiente (poblada si tipoSujeto=ACUDIENTE)", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "tipoSujeto", nombreLegible: "Tipo de sujeto", descripcion: "ESTUDIANTE · PROFESOR · ACUDIENTE", tipo: "String", sinonimos: ["sujeto", "tipo de persona", "quien"] },
  { tabla: "AlertaColegio", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "nueva · vista · gestionada · escalada · cerrada", tipo: "String", sinonimos: ["situacion", "escalada"] },
  { tabla: "AlertaColegio", nombreFuente: "prioridad", nombreLegible: "Prioridad", descripcion: "alta · media · baja", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "vencimientoSla", nombreLegible: "Vencimiento SLA", descripcion: "Limite de gestion de la alerta (timestamptz)", tipo: "DateTime", sinonimos: ["sla", "vencimiento"] },
  { tabla: "AlertaColegio", nombreFuente: "asignadoAId", nombreLegible: "Asignado a", descripcion: "FK Usuario (tabla jamas publicada: el cuid no resuelve en bi-db)", tipo: "String", excluida: true },
  { tabla: "AlertaColegio", nombreFuente: "patronInstitucionalId", nombreLegible: "Patron institucional", descripcion: "FK patrones_institucionales (agregado al que aporta; null en alertas antiguas)", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "actualizadoEn", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // Suscripcion (24 publicadas)
  { tabla: "Suscripcion", nombreFuente: "id", nombreLegible: "ID suscripcion", descripcion: "Identificador unico de la suscripcion", tipo: "String", sinonimos: ["suscripcion", "plan", "vigencia"] },
  { tabla: "Suscripcion", nombreFuente: "tipoTitular", nombreLegible: "Tipo de titular", descripcion: "Enum PG TipoTitular: COLEGIO · PADRE (usar ::text en GROUP BY)", tipo: "TipoTitular", sinonimos: ["titular", "tipo de cliente"] },
  { tabla: "Suscripcion", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio (null si el titular es un padre)", tipo: "String" },
  { tabla: "Suscripcion", nombreFuente: "usuarioId", nombreLegible: "Usuario titular", descripcion: "FK Usuario (tabla jamas publicada: el cuid no resuelve en bi-db)", tipo: "String", excluida: true },
  { tabla: "Suscripcion", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Enum PG EstadoSuscripcion: ACTIVA · EN_GRACIA · SUSPENDIDA · CANCELADA · PENDIENTE_AUTORIZACION", tipo: "EstadoSuscripcion" },
  { tabla: "Suscripcion", nombreFuente: "planActualId", nombreLegible: "Plan actual", descripcion: "FK Plan vigente", tipo: "String", sinonimos: ["plan"] },
  { tabla: "Suscripcion", nombreFuente: "fechaInicio", nombreLegible: "Fecha inicio", descripcion: "Inicio de la vigencia (timestamptz)", tipo: "DateTime" },
  { tabla: "Suscripcion", nombreFuente: "fechaFin", nombreLegible: "Fecha fin", descripcion: "Fin de la vigencia (timestamptz)", tipo: "DateTime", sinonimos: ["vigencia", "vencimiento"] },
  { tabla: "Suscripcion", nombreFuente: "fechaCorteProgramado", nombreLegible: "Corte programado", descripcion: "Fecha de corte programada (null si no aplica)", tipo: "DateTime" },
  { tabla: "Suscripcion", nombreFuente: "esFreemium", nombreLegible: "Es freemium", descripcion: "Si es una suscripcion gratuita promocional", tipo: "Boolean" },
  { tabla: "Suscripcion", nombreFuente: "freemiumFechaFin", nombreLegible: "Fin freemium", descripcion: "Fin del periodo freemium (null si no aplica)", tipo: "DateTime" },
  { tabla: "Suscripcion", nombreFuente: "monedaLocal", nombreLegible: "Moneda", descripcion: "Moneda local del cliente (default COP)", tipo: "String", sinonimos: ["moneda"] },
  { tabla: "Suscripcion", nombreFuente: "paisCliente", nombreLegible: "Pais cliente", descripcion: "Pais del cliente (default CO)", tipo: "String", sinonimos: ["pais"] },
  { tabla: "Suscripcion", nombreFuente: "suspendidaEn", nombreLegible: "Suspendida en", descripcion: "Timestamp de suspension (null si nunca)", tipo: "DateTime" },
  { tabla: "Suscripcion", nombreFuente: "canceladaEn", nombreLegible: "Cancelada en", descripcion: "Timestamp de cancelacion (null si activa)", tipo: "DateTime" },
  { tabla: "Suscripcion", nombreFuente: "canceladaPorUsuario", nombreLegible: "Cancelada por usuario", descripcion: "Si la cancelo el propio titular (null si no aplica)", tipo: "Boolean" },
  { tabla: "Suscripcion", nombreFuente: "createdAt", nombreLegible: "Creado en", descripcion: "Timestamp de creacion (UTC)", tipo: "DateTime", sinonimos: ["fecha creacion"] },
  { tabla: "Suscripcion", nombreFuente: "updatedAt", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },
  { tabla: "Suscripcion", nombreFuente: "origen", nombreLegible: "Origen", descripcion: "Enum PG OrigenSuscripcion: SOLICITADA_CLIENTE · ACTIVADA_MANUAL_ADMIN · FREEMIUM_AUTO · INVITACION_ADMIN", tipo: "OrigenSuscripcion" },
  { tabla: "Suscripcion", nombreFuente: "autorizadoPorAdminId", nombreLegible: "Autorizado por", descripcion: "FK Usuario admin que autorizo (tabla jamas publicada: el cuid no resuelve en bi-db)", tipo: "String", excluida: true },
  { tabla: "Suscripcion", nombreFuente: "autorizadoEn", nombreLegible: "Autorizado en", descripcion: "Timestamp de autorizacion manual (null si no aplica)", tipo: "DateTime" },
  { tabla: "Suscripcion", nombreFuente: "metodoPagoManual", nombreLegible: "Metodo de pago manual", descripcion: "Enum PG MetodoPagoManual: TRANSFERENCIA_BANCARIA · EFECTIVO · CHEQUE · OTRO (null si pago en linea)", tipo: "MetodoPagoManual" },
  { tabla: "Suscripcion", nombreFuente: "montoRealPagado", nombreLegible: "Monto pagado", descripcion: "Monto real pagado en activacion manual (null si no aplica)", tipo: "Float", sinonimos: ["monto", "valor pagado"] },
  { tabla: "Suscripcion", nombreFuente: "fechaPagoReal", nombreLegible: "Fecha de pago", descripcion: "Timestamp del pago real (null si no aplica)", tipo: "DateTime" },

  // IdentificadorReportado (17 publicadas; el nick en claro `identificador`
  // esta VETADO en origen — jamas listarlo)
  { tabla: "IdentificadorReportado", nombreFuente: "id", nombreLegible: "ID identificador", descripcion: "ID del agregado (NO es el nick: cortado en origen)", tipo: "String", sinonimos: ["vigilado", "reportado", "nick reportado"] },
  { tabla: "IdentificadorReportado", nombreFuente: "plataformaId", nombreLegible: "Plataforma", descripcion: "FK Plataforma del identificador", tipo: "String", sinonimos: ["plataforma", "red social", "app"] },
  { tabla: "IdentificadorReportado", nombreFuente: "totalReportes", nombreLegible: "Total reportes", descripcion: "Reportes totales recibidos sobre el identificador", tipo: "Int", sinonimos: ["reportes", "denuncias"] },
  { tabla: "IdentificadorReportado", nombreFuente: "reportesAutenticados", nombreLegible: "Reportes autenticados", descripcion: "Reportes de usuarios autenticados", tipo: "Int" },
  { tabla: "IdentificadorReportado", nombreFuente: "reportesAnonimos", nombreLegible: "Reportes anonimos", descripcion: "Reportes anonimos recibidos", tipo: "Int", sinonimos: ["anonimos"] },
  { tabla: "IdentificadorReportado", nombreFuente: "reportesAprobados", nombreLegible: "Reportes aprobados", descripcion: "Reportes aprobados tras revision (base de la visibilidad publica)", tipo: "Int" },
  { tabla: "IdentificadorReportado", nombreFuente: "autenticadosAprobados", nombreLegible: "Autenticados aprobados", descripcion: "Reportes autenticados y aprobados", tipo: "Int" },
  { tabla: "IdentificadorReportado", nombreFuente: "esVisiblePublicamente", nombreLegible: "Visible publicamente", descripcion: "Si supera el umbral y aparece en la consulta publica", tipo: "Boolean", sinonimos: ["visible", "publico"] },
  { tabla: "IdentificadorReportado", nombreFuente: "ocultoPorComiteEn", nombreLegible: "Oculto por comite en", descripcion: "Timestamp en que el comite lo oculto (null si visible)", tipo: "DateTime" },
  { tabla: "IdentificadorReportado", nombreFuente: "score", nombreLegible: "Score", descripcion: "Score agregado del identificador", tipo: "Int", sinonimos: ["puntaje", "puntuacion"] },
  { tabla: "IdentificadorReportado", nombreFuente: "scoreAnonimo", nombreLegible: "Score anonimo", descripcion: "Componente anonimo del score", tipo: "Int" },
  { tabla: "IdentificadorReportado", nombreFuente: "scoreAutenticado", nombreLegible: "Score autenticado", descripcion: "Componente autenticado del score", tipo: "Int" },
  { tabla: "IdentificadorReportado", nombreFuente: "scoreAjustado", nombreLegible: "Score ajustado", descripcion: "Score tras ajustes del comite", tipo: "Int" },
  { tabla: "IdentificadorReportado", nombreFuente: "nivelRiesgo", nombreLegible: "Nivel de riesgo", descripcion: "Nivel de riesgo derivado (null si no calculado)", tipo: "String", sinonimos: ["riesgo", "nivel"] },
  { tabla: "IdentificadorReportado", nombreFuente: "ultimoReporteEn", nombreLegible: "Ultimo reporte en", descripcion: "Timestamp del ultimo reporte recibido (null si ninguno)", tipo: "DateTime", sinonimos: ["ultimo reporte"] },
  { tabla: "IdentificadorReportado", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de creacion del agregado (UTC)", tipo: "DateTime" },
  { tabla: "IdentificadorReportado", nombreFuente: "actualizadoEn", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // Hijo (6 publicadas)
  { tabla: "Hijo", nombreFuente: "id", nombreLegible: "ID hijo", descripcion: "Identificador unico del hijo", tipo: "String", sinonimos: ["hijo", "menor", "circulo"] },
  { tabla: "Hijo", nombreFuente: "anioNacimiento", nombreLegible: "Ano de nacimiento", descripcion: "Ano de nacimiento (null si no registrado; la edad se deriva)", tipo: "Int" },
  { tabla: "Hijo", nombreFuente: "sexo", nombreLegible: "Sexo", descripcion: "Set cerrado (null si no registrado)", tipo: "String" },
  { tabla: "Hijo", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "activo | inactivo (baja logica)", tipo: "String" },
  { tabla: "Hijo", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "Hijo", nombreFuente: "actualizadoEn", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },

  // ContactoConfianza (6 publicadas)
  { tabla: "ContactoConfianza", nombreFuente: "id", nombreLegible: "ID contacto", descripcion: "Identificador unico del contacto de confianza", tipo: "String", sinonimos: ["contacto de confianza", "circulo"] },
  { tabla: "ContactoConfianza", nombreFuente: "usuarioId", nombreLegible: "Usuario", descripcion: "FK Usuario dueno del circulo (tabla jamas publicada: el cuid no resuelve en bi-db)", tipo: "String", excluida: true },
  { tabla: "ContactoConfianza", nombreFuente: "parentesco", nombreLegible: "Parentesco", descripcion: "Texto corto libre: madre · tio · amigo ... (null si no registrado)", tipo: "String", sinonimos: ["relacion"] },
  { tabla: "ContactoConfianza", nombreFuente: "activo", nombreLegible: "Activo", descripcion: "Si el contacto esta activo", tipo: "Boolean" },
  { tabla: "ContactoConfianza", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro (UTC)", tipo: "DateTime" },
  { tabla: "ContactoConfianza", nombreFuente: "actualizadoEn", nombreLegible: "Actualizado en", descripcion: "Tecnica interna de sync; sin valor analitico", tipo: "DateTime", excluida: true },
];

// 9 metricas nuevas del dominio ampliado (alertas, geo, plataformas,
// anonimato, reincidencia, suscripciones SaaS, cobertura del clasificador).
const METRICAS_V2: Array<{ nombre: string; nombreLegible: string; descripcion: string; formulaSQL: string; categoria: string }> = [
  { nombre: "alertas_por_tipo_sujeto", nombreLegible: "Alertas por tipo de sujeto", descripcion: "Alertas de colegio agrupadas por sujeto (ESTUDIANTE · PROFESOR · ACUDIENTE)", formulaSQL: `SELECT "tipoSujeto", count(*) AS total FROM "AlertaColegio" GROUP BY "tipoSujeto" ORDER BY total DESC`, categoria: "salud" },
  { nombre: "alertas_escaladas_sin_gestionar", nombreLegible: "Alertas escaladas sin gestionar", descripcion: "Alertas en estado escalada pendientes de gestion", formulaSQL: `SELECT count(*) FROM "AlertaColegio" WHERE "estado"='escalada'`, categoria: "salud" },
  { nombre: "reportes_por_ciudad", nombreLegible: "Reportes por ciudad", descripcion: "Reportes activos agrupados por ciudad (texto libre del reportante)", formulaSQL: `SELECT "ciudad", count(*) AS total FROM "Reporte" WHERE "eliminado"=false GROUP BY "ciudad" ORDER BY total DESC`, categoria: "operativo" },
  { nombre: "reportes_por_plataforma", nombreLegible: "Reportes por plataforma", descripcion: "Reportes activos agrupados por plataforma (join Plataforma)", formulaSQL: `SELECT p."nombre", count(*) AS total FROM "Reporte" r JOIN "Plataforma" p ON p."id"=r."plataformaId" WHERE r."eliminado"=false GROUP BY p."nombre" ORDER BY total DESC`, categoria: "operativo" },
  { nombre: "anonimato_pct", nombreLegible: "Anonimato (%)", descripcion: "Porcentaje de reportes activos enviados anonimamente", formulaSQL: `SELECT count(*) FILTER (WHERE "esAnonimo")::float / NULLIF(count(*),0) * 100 AS pct_anonimos FROM "Reporte" WHERE "eliminado"=false`, categoria: "operativo" },
  { nombre: "reincidencia_2mas", nombreLegible: "Identificadores reincidentes (2+)", descripcion: "Identificadores reportados con 2 o mas reportes acumulados", formulaSQL: `SELECT count(*) FROM "IdentificadorReportado" WHERE "totalReportes" >= 2`, categoria: "operativo" },
  { nombre: "suscripciones_activas_por_tipo", nombreLegible: "Suscripciones activas por tipo", descripcion: "Suscripciones ACTIVA agrupadas por tipo de titular (COLEGIO · PADRE)", formulaSQL: `SELECT "tipoTitular"::text, count(*) AS total FROM "Suscripcion" WHERE "estado"='ACTIVA' GROUP BY "tipoTitular" ORDER BY total DESC`, categoria: "comercial" },
  { nombre: "identificadores_vigilados_por_plataforma", nombreLegible: "Identificadores vigilados por plataforma", descripcion: "Agregados de identificadores reportados agrupados por plataforma", formulaSQL: `SELECT p."nombre", count(*) AS total FROM "IdentificadorReportado" ir JOIN "Plataforma" p ON p."id"=ir."plataformaId" GROUP BY p."nombre" ORDER BY total DESC`, categoria: "operativo" },
  { nombre: "clasificacion_cobertura_pct", nombreLegible: "Cobertura clasificacion IA (%)", descripcion: "Porcentaje de reportes activos que ya tienen clasificacion IA", formulaSQL: `SELECT count(c."id")::float / NULLIF(count(r."id"),0) * 100 AS pct_cobertura FROM "Reporte" r LEFT JOIN "ClasificacionIA" c ON c."reporteId"=r."id" WHERE r."eliminado"=false`, categoria: "motor_ia" },
];

// 8 ejemplos NL→SQL nuevos (verificado=true explicito: SQL revisado contra
// el schema real de PI y contra la lista de columnas publicadas del 02).
const EJEMPLOS_V2: Array<{ preguntaNL: string; sql: string; categoriaConsulta: string; verificado: boolean }> = [
  { preguntaNL: "Cuantas alertas escaladas hay sin gestionar?", sql: `SELECT count(*) FROM "AlertaColegio" WHERE "estado"='escalada'`, categoriaConsulta: "salud", verificado: true },
  { preguntaNL: "Que plataforma concentra mas identificadores vigilados?", sql: `SELECT p."nombre", count(*) AS total FROM "IdentificadorReportado" ir JOIN "Plataforma" p ON p."id"=ir."plataformaId" GROUP BY p."nombre" ORDER BY total DESC`, categoriaConsulta: "operativo", verificado: true },
  { preguntaNL: "Cuantos profesores hay por colegio?", sql: `SELECT c."nombre", count(pr."id") AS total FROM "Colegio" c LEFT JOIN "Profesor" pr ON pr."colegioId"=c."id" AND pr."estado"='activo' GROUP BY c."nombre" ORDER BY total DESC`, categoriaConsulta: "operativo", verificado: true },
  { preguntaNL: "Que ciudad tiene mas reportes este mes?", sql: `SELECT "ciudad", count(*) AS total FROM "Reporte" WHERE date_trunc('month',"creadoEn")=date_trunc('month',now()) AND "eliminado"=false GROUP BY "ciudad" ORDER BY total DESC LIMIT 1`, categoriaConsulta: "reportes", verificado: true },
  { preguntaNL: "Cuantos reportes anonimos vs identificados hubo este ano?", sql: `SELECT "esAnonimo", count(*) FROM "Reporte" WHERE date_trunc('year',"creadoEn")=date_trunc('year',now()) AND "eliminado"=false GROUP BY "esAnonimo"`, categoriaConsulta: "reportes", verificado: true },
  { preguntaNL: "Cuantos acudientes tienen cuentas vigiladas?", sql: `SELECT count(DISTINCT "acudienteId") FROM "IdentificadorAcudiente" WHERE "estado"='activo'`, categoriaConsulta: "operativo", verificado: true },
  { preguntaNL: "Cuantos colegios tienen suscripcion activa?", sql: `SELECT count(DISTINCT "colegioId") FROM "Suscripcion" WHERE "estado"='ACTIVA' AND "colegioId" IS NOT NULL`, categoriaConsulta: "comercial", verificado: true },
  { preguntaNL: "Cual es la categoria mas frecuente esta semana?", sql: `SELECT "categoria"::text, count(*) AS total FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '7 days' GROUP BY "categoria" ORDER BY total DESC LIMIT 1`, categoriaConsulta: "motor_ia", verificado: true },
];

async function seedCatalogoV2(): Promise<void> {
  console.log("Seed catalogo BI v2 (ampliacion 2026-09-01 · 11 tablas del dominio)");

  const antesT = await prisma.bICatalogoTabla.count();
  for (const t of TABLAS_V2) {
    await prisma.bICatalogoTabla.upsert({
      where: { nombreFuente: t.nombreFuente },
      create: t,
      update: {},
    });
  }
  const creadasT = (await prisma.bICatalogoTabla.count()) - antesT;
  console.log(`  · BICatalogoTabla v2: ${creadasT} creadas · ${TABLAS_V2.length - creadasT} existentes`);

  const tablasBD = await prisma.bICatalogoTabla.findMany();
  const idMap = new Map(tablasBD.map((t) => [t.nombreFuente, t.id]));
  const antesC = await prisma.bICatalogoColumna.count();
  let omitidas = 0;
  for (const c of COLUMNAS_V2) {
    const tablaId = idMap.get(c.tabla);
    if (!tablaId) {
      omitidas += 1;
      console.warn(`  ! columna ${c.tabla}.${c.nombreFuente} sin tabla padre · omitida`);
      continue;
    }
    await prisma.bICatalogoColumna.upsert({
      where: { tablaId_nombreFuente: { tablaId, nombreFuente: c.nombreFuente } },
      create: {
        tablaId,
        nombreFuente: c.nombreFuente,
        nombreLegible: c.nombreLegible,
        descripcion: c.descripcion,
        tipo: c.tipo,
        sinonimos: c.sinonimos ?? [],
        excluida: c.excluida ?? false,
      },
      update: {},
    });
  }
  const creadasC = (await prisma.bICatalogoColumna.count()) - antesC;
  console.log(`  · BICatalogoColumna v2: ${creadasC} creadas · ${COLUMNAS_V2.length - omitidas - creadasC} existentes · ${omitidas} omitidas`);

  const antesM = await prisma.bICatalogoMetrica.count();
  for (const m of METRICAS_V2) {
    await prisma.bICatalogoMetrica.upsert({
      where: { nombre: m.nombre },
      create: m,
      update: {},
    });
  }
  const creadasM = (await prisma.bICatalogoMetrica.count()) - antesM;
  console.log(`  · BICatalogoMetrica v2: ${creadasM} creadas · ${METRICAS_V2.length - creadasM} existentes`);

  const antesE = await prisma.bICatalogoEjemplo.count();
  for (const e of EJEMPLOS_V2) {
    await prisma.bICatalogoEjemplo.upsert({
      where: { preguntaNL: e.preguntaNL },
      create: e,
      update: {},
    });
  }
  const creadosE = (await prisma.bICatalogoEjemplo.count()) - antesE;
  console.log(`  · BICatalogoEjemplo v2: ${creadosE} creados · ${EJEMPLOS_V2.length - creadosE} existentes`);
}

async function main(): Promise<void> {
  console.log("Seed catalogo BI · Producto 006 · SPEC-006 · F3C 2026-09-01");
  await seedTablas();
  await seedColumnas();
  await seedMetricas();
  await seedEjemplos();
  await seedConfig();
  await seedCatalogoV2();
  console.log("Seed COMPLETO (idempotente: update:{} — la 2ª pasada crea 0 filas)");
}

// Solo ejecuta cuando corre como script (npm run db:seed / prisma db seed /
// CI). Los tests importan los arrays del catálogo sin tocar la base.
const esEntrypoint =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEntrypoint) {
    main()
        .catch((e: unknown) => {
            console.error(e);
            process.exit(1);
        })
        .finally(() => prisma.$disconnect());
}
