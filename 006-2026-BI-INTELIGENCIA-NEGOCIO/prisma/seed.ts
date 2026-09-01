// prisma/seed.ts · Seed idempotente del catálogo BI
// Producto 006 · BI v2 · SPEC-006 · F3C 2026-09-01
// Contenido portado 1:1 de 005 (BI v1 · prisma/seed-catalogo.ts, referencia
// SOLO LECTURA): mismas tablas, columnas, métricas y ejemplos NL→SQL.
// Ejecutar: npm run db:seed  (o `npx prisma db seed`)
// Regla dura S3: upsert({ create, update: {} }) — update VACÍO, NUNCA
// sobreescribir customizaciones del operador. La 2ª pasada crea 0 filas.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ────────────────────────────────────────────────────────────────────────────
// 15 tablas del catálogo (subset OPERATIVO de D-20)
// ────────────────────────────────────────────────────────────────────────────
const TABLAS: Array<{
  nombreFuente: string;
  nombreLegible: string;
  descripcion: string;
  rolesPermitidos: string[];
}> = [
  { nombreFuente: "Reporte", nombreLegible: "Reportes de riesgo", descripcion: "Reportes de conducta potencialmente peligrosa detectados por PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "ClasificacionIA", nombreLegible: "Clasificaciones motor IA", descripcion: "Resultados del clasificador de conducta (categoria · confianza · latencia)", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "ClasificacionRubricaVoto", nombreLegible: "Votos rubrica humana", descripcion: "Votos de validacion humana sobre clasificaciones IA", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "CorreccionAdmin", nombreLegible: "Correcciones admin", descripcion: "Correcciones manuales de clasificacion IA por admin", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "TransicionReporte", nombreLegible: "Transiciones de estado", descripcion: "Historial de cambios de estado de reportes", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "SolicitudComite", nombreLegible: "Solicitudes de comite", descripcion: "Solicitudes de revision por comite de un reporte", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Colegio", nombreLegible: "Colegios", descripcion: "Instituciones educativas registradas en PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "Subscription", nombreLegible: "Suscripciones", descripcion: "Suscripciones de tenants al plan PI", rolesPermitidos: ["ADMIN_BI"] },
  { nombreFuente: "BillingCycle", nombreLegible: "Ciclos de facturacion", descripcion: "Ciclos de cobro por suscripcion (monto · estado)", rolesPermitidos: ["ADMIN_BI"] },
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
const COLUMNAS: Col[] = [
  // Reporte (10)
  { tabla: "Reporte", nombreFuente: "id", nombreLegible: "ID reporte", descripcion: "Identificador unico del reporte", tipo: "String" },
  { tabla: "Reporte", nombreFuente: "pais", nombreLegible: "Pais", descripcion: "Pais del reporte", tipo: "String", sinonimos: ["country", "nacion"] },
  { tabla: "Reporte", nombreFuente: "ciudad", nombreLegible: "Ciudad", descripcion: "Ciudad del reporte", tipo: "String", sinonimos: ["city", "municipio"] },
  { tabla: "Reporte", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado del reporte (PENDIENTE · REVISION · CERRADO · RECHAZADO · COMITE)", tipo: "EstadoReporte", sinonimos: ["status"] },
  { tabla: "Reporte", nombreFuente: "prioridadAlta", nombreLegible: "Prioridad alta", descripcion: "Marcado como prioridad alta", tipo: "Boolean", sinonimos: ["urgente"] },
  { tabla: "Reporte", nombreFuente: "esRafaga", nombreLegible: "Es rafaga", descripcion: "Parte de una rafaga detectada", tipo: "Boolean" },
  { tabla: "Reporte", nombreFuente: "esAnonimo", nombreLegible: "Es anonimo", descripcion: "Reporte enviado anonimamente", tipo: "Boolean" },
  { tabla: "Reporte", nombreFuente: "eliminado", nombreLegible: "Eliminado", descripcion: "Soft-delete (excluir con eliminado=false)", tipo: "Boolean" },
  { tabla: "Reporte", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de creacion (UTC)", tipo: "DateTime", sinonimos: ["fecha", "created_at"] },
  { tabla: "Reporte", nombreFuente: "tenantId", nombreLegible: "Tenant", descripcion: "FK Tenant · aislamiento multi-tenant", tipo: "String" },

  // ClasificacionIA (7)
  { tabla: "ClasificacionIA", nombreFuente: "id", nombreLegible: "ID clasificacion", descripcion: "ID de la clasificacion IA", tipo: "String" },
  { tabla: "ClasificacionIA", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte clasificado", tipo: "String" },
  { tabla: "ClasificacionIA", nombreFuente: "categoria", nombreLegible: "Categoria conducta", descripcion: "Categoria detectada (BULLYING · CIBERBULLYING · SPAM · OTRO)", tipo: "CategoriaConducta" },
  { tabla: "ClasificacionIA", nombreFuente: "confianza", nombreLegible: "Confianza", descripcion: "Score de confianza 0.0-1.0", tipo: "Float", sinonimos: ["score"] },
  { tabla: "ClasificacionIA", nombreFuente: "latenciaMs", nombreLegible: "Latencia (ms)", descripcion: "Latencia del modelo en milisegundos", tipo: "Int", sinonimos: ["tiempo"] },
  { tabla: "ClasificacionIA", nombreFuente: "modeloUsado", nombreLegible: "Modelo LLM", descripcion: "Nombre del modelo usado (qwen2.5:14b · etc)", tipo: "String", sinonimos: ["modelo"] },
  { tabla: "ClasificacionIA", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de la clasificacion", tipo: "DateTime" },

  // ClasificacionRubricaVoto (4)
  { tabla: "ClasificacionRubricaVoto", nombreFuente: "id", nombreLegible: "ID voto", descripcion: "ID del voto humano", tipo: "String" },
  { tabla: "ClasificacionRubricaVoto", nombreFuente: "clasificacionId", nombreLegible: "Clasificacion", descripcion: "FK a ClasificacionIA votada", tipo: "String" },
  { tabla: "ClasificacionRubricaVoto", nombreFuente: "votanteId", nombreLegible: "Votante", descripcion: "ID del usuario que voto", tipo: "String" },
  { tabla: "ClasificacionRubricaVoto", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp del voto", tipo: "DateTime" },

  // CorreccionAdmin (5)
  { tabla: "CorreccionAdmin", nombreFuente: "id", nombreLegible: "ID correccion", descripcion: "ID de la correccion", tipo: "String" },
  { tabla: "CorreccionAdmin", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte corregido", tipo: "String" },
  { tabla: "CorreccionAdmin", nombreFuente: "categoriaCorrecta", nombreLegible: "Categoria correcta", descripcion: "Categoria correcta segun admin", tipo: "CategoriaConducta" },
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
  { tabla: "Colegio", nombreFuente: "pais", nombreLegible: "Pais", descripcion: "Pais del colegio", tipo: "String" },
  { tabla: "Colegio", nombreFuente: "ciudad", nombreLegible: "Ciudad", descripcion: "Ciudad del colegio", tipo: "String" },
  { tabla: "Colegio", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro", tipo: "DateTime" },

  // Subscription (6)
  { tabla: "Subscription", nombreFuente: "id", nombreLegible: "ID suscripcion", descripcion: "ID de la suscripcion", tipo: "String" },
  { tabla: "Subscription", nombreFuente: "tenantId", nombreLegible: "Tenant", descripcion: "FK Tenant", tipo: "String" },
  { tabla: "Subscription", nombreFuente: "planId", nombreLegible: "Plan", descripcion: "FK Plan", tipo: "String" },
  { tabla: "Subscription", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado (ACTIVA · CANCELADA · SUSPENDIDA)", tipo: "String" },
  { tabla: "Subscription", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de creacion", tipo: "DateTime" },
  { tabla: "Subscription", nombreFuente: "canceladaEn", nombreLegible: "Cancelada en", descripcion: "Timestamp de cancelacion (null si activa)", tipo: "DateTime" },

  // BillingCycle (6)
  { tabla: "BillingCycle", nombreFuente: "id", nombreLegible: "ID ciclo", descripcion: "ID del ciclo de cobro", tipo: "String" },
  { tabla: "BillingCycle", nombreFuente: "tenantId", nombreLegible: "Tenant", descripcion: "FK Tenant", tipo: "String" },
  { tabla: "BillingCycle", nombreFuente: "monto", nombreLegible: "Monto", descripcion: "Monto cobrado", tipo: "Float", sinonimos: ["amount"] },
  { tabla: "BillingCycle", nombreFuente: "estado", nombreLegible: "Estado", descripcion: "Estado del ciclo (PAGADO · PENDIENTE · FALLIDO)", tipo: "String" },
  { tabla: "BillingCycle", nombreFuente: "periodoInicio", nombreLegible: "Periodo inicio", descripcion: "Inicio del periodo facturado", tipo: "DateTime" },
  { tabla: "BillingCycle", nombreFuente: "periodoFin", nombreLegible: "Periodo fin", descripcion: "Fin del periodo facturado", tipo: "DateTime" },

  // Plan (4)
  { tabla: "Plan", nombreFuente: "id", nombreLegible: "ID plan", descripcion: "ID del plan", tipo: "String" },
  { tabla: "Plan", nombreFuente: "nombre", nombreLegible: "Nombre", descripcion: "Nombre del plan comercial", tipo: "String" },
  { tabla: "Plan", nombreFuente: "precio", nombreLegible: "Precio", descripcion: "Precio del plan", tipo: "Float" },
  { tabla: "Plan", nombreFuente: "activo", nombreLegible: "Activo", descripcion: "Si el plan esta activo", tipo: "Boolean" },

  // Tenant (4)
  { tabla: "Tenant", nombreFuente: "id", nombreLegible: "ID tenant", descripcion: "ID del tenant", tipo: "String" },
  { tabla: "Tenant", nombreFuente: "nombre", nombreLegible: "Nombre", descripcion: "Nombre del tenant", tipo: "String" },
  { tabla: "Tenant", nombreFuente: "activo", nombreLegible: "Activo", descripcion: "Si el tenant esta activo", tipo: "Boolean" },
  { tabla: "Tenant", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro", tipo: "DateTime" },

  // Alumno (5)
  { tabla: "Alumno", nombreFuente: "id", nombreLegible: "ID alumno", descripcion: "ID del alumno", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "cursoId", nombreLegible: "Curso", descripcion: "FK Curso", tipo: "String" },
  { tabla: "Alumno", nombreFuente: "activo", nombreLegible: "Activo", descripcion: "Si el alumno esta activo", tipo: "Boolean" },
  { tabla: "Alumno", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de registro", tipo: "DateTime" },

  // AuditLog (5)
  { tabla: "AuditLog", nombreFuente: "id", nombreLegible: "ID audit", descripcion: "ID del evento auditado", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "accion", nombreLegible: "Accion", descripcion: "Accion realizada (crear · editar · eliminar · etc)", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "usuarioId", nombreLegible: "Usuario", descripcion: "ID del usuario que ejecuto la accion", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "recurso", nombreLegible: "Recurso", descripcion: "Recurso afectado", tipo: "String" },
  { tabla: "AuditLog", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp del evento", tipo: "DateTime" },

  // FuenteReporte (4)
  { tabla: "FuenteReporte", nombreFuente: "id", nombreLegible: "ID fuente", descripcion: "ID de la fuente", tipo: "String" },
  { tabla: "FuenteReporte", nombreFuente: "reporteId", nombreLegible: "Reporte", descripcion: "FK al reporte", tipo: "String" },
  { tabla: "FuenteReporte", nombreFuente: "plataforma", nombreLegible: "Plataforma", descripcion: "Plataforma origen (app · extension · web)", tipo: "String" },
  { tabla: "FuenteReporte", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp del registro", tipo: "DateTime" },

  // AlertaColegio (5)
  { tabla: "AlertaColegio", nombreFuente: "id", nombreLegible: "ID alerta", descripcion: "ID de la alerta", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "colegioId", nombreLegible: "Colegio", descripcion: "FK Colegio", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "tipo", nombreLegible: "Tipo", descripcion: "Tipo de alerta", tipo: "String" },
  { tabla: "AlertaColegio", nombreFuente: "resuelta", nombreLegible: "Resuelta", descripcion: "Si fue resuelta", tipo: "Boolean" },
  { tabla: "AlertaColegio", nombreFuente: "creadoEn", nombreLegible: "Creado en", descripcion: "Timestamp de la alerta", tipo: "DateTime" },
];

// ────────────────────────────────────────────────────────────────────────────
// 15 metricas de negocio
// ────────────────────────────────────────────────────────────────────────────
const METRICAS: Array<{ nombre: string; nombreLegible: string; descripcion: string; formulaSQL: string; categoria: string }> = [
  { nombre: "reportes_hoy", nombreLegible: "Reportes hoy", descripcion: "Total de reportes creados hoy", formulaSQL: `SELECT count(*) FROM "Reporte" WHERE date_trunc('day',"creadoEn")=current_date AND "eliminado"=false`, categoria: "operativo" },
  { nombre: "reportes_semana", nombreLegible: "Reportes ultima semana", descripcion: "Reportes creados en los ultimos 7 dias", formulaSQL: `SELECT count(*) FROM "Reporte" WHERE "creadoEn" >= now() - interval '7 days' AND "eliminado"=false`, categoria: "operativo" },
  { nombre: "reportes_prioridad_alta", nombreLegible: "Reportes prioridad alta", descripcion: "Reportes activos con prioridad alta", formulaSQL: `SELECT count(*) FROM "Reporte" WHERE "prioridadAlta"=true AND "eliminado"=false AND "estado"!='CERRADO'`, categoria: "operativo" },
  { nombre: "tasa_correccion_ia", nombreLegible: "Tasa correccion IA", descripcion: "Proporcion de clasificaciones corregidas por admin (ultimos 30d)", formulaSQL: `SELECT count(ca.id)::float / NULLIF(count(c.id),0) FROM "ClasificacionIA" c LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId"=c."reporteId" WHERE c."creadoEn" >= now() - interval '30 days'`, categoria: "motor_ia" },
  { nombre: "confianza_promedio_ia", nombreLegible: "Confianza promedio IA", descripcion: "Confianza promedio del clasificador", formulaSQL: `SELECT avg("confianza") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoria: "motor_ia" },
  { nombre: "latencia_p95_ia", nombreLegible: "Latencia p95 IA", descripcion: "Percentil 95 de latencia del clasificador (ms)", formulaSQL: `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoria: "motor_ia" },
  { nombre: "clasificaciones_por_modelo", nombreLegible: "Clasificaciones por modelo", descripcion: "Total de clasificaciones agrupadas por modelo LLM", formulaSQL: `SELECT "modeloUsado", count(*) FROM "ClasificacionIA" GROUP BY "modeloUsado"`, categoria: "motor_ia" },
  { nombre: "mrr_actual", nombreLegible: "MRR actual", descripcion: "Monthly Recurring Revenue del mes en curso", formulaSQL: `SELECT sum(monto) FROM "BillingCycle" WHERE "estado"='PAGADO' AND date_trunc('month',"periodoInicio")=date_trunc('month',now())`, categoria: "comercial" },
  { nombre: "churn_mes", nombreLegible: "Churn del mes", descripcion: "Suscripciones canceladas en el mes actual", formulaSQL: `SELECT count(*) FROM "Subscription" WHERE "estado"='CANCELADA' AND date_trunc('month',"canceladaEn")=date_trunc('month',now())`, categoria: "comercial" },
  { nombre: "tenants_activos", nombreLegible: "Tenants activos", descripcion: "Tenants con al menos una suscripcion activa", formulaSQL: `SELECT count(DISTINCT s."tenantId") FROM "Subscription" s WHERE s."estado"='ACTIVA'`, categoria: "comercial" },
  { nombre: "tiempo_medio_resolucion_h", nombreLegible: "Tiempo medio resolucion (h)", descripcion: "Horas promedio entre creacion y cierre de reporte", formulaSQL: `SELECT avg(EXTRACT(EPOCH FROM (tr."creadoEn" - r."creadoEn"))/3600) FROM "Reporte" r JOIN "TransicionReporte" tr ON tr."reporteId"=r.id WHERE tr."estadoNuevo"='CERRADO'`, categoria: "operativo" },
  { nombre: "solicitudes_comite_abiertas", nombreLegible: "Solicitudes comite abiertas", descripcion: "Solicitudes a comite sin resolver", formulaSQL: `SELECT count(*) FROM "SolicitudComite" WHERE "resueltoEn" IS NULL`, categoria: "operativo" },
  { nombre: "audit_events_dia", nombreLegible: "Eventos audit hoy", descripcion: "Eventos registrados hoy en AuditLog", formulaSQL: `SELECT count(*) FROM "AuditLog" WHERE date_trunc('day',"creadoEn")=current_date`, categoria: "salud" },
  { nombre: "alertas_colegio_abiertas", nombreLegible: "Alertas colegio abiertas", descripcion: "Alertas de colegio no resueltas", formulaSQL: `SELECT count(*) FROM "AlertaColegio" WHERE "resuelta"=false`, categoria: "salud" },
  { nombre: "colegios_registrados", nombreLegible: "Colegios registrados", descripcion: "Total de colegios en el sistema", formulaSQL: `SELECT count(*) FROM "Colegio"`, categoria: "general" },
];

// ────────────────────────────────────────────────────────────────────────────
// 30 ejemplos NL→SQL curados
// ────────────────────────────────────────────────────────────────────────────
const EJEMPLOS: Array<{ preguntaNL: string; sql: string; categoriaConsulta: string }> = [
  { preguntaNL: "Cuantos reportes se crearon hoy?", sql: `SELECT count(*) FROM "Reporte" WHERE date_trunc('day',"creadoEn")=current_date AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Cuantos reportes tuvimos la semana pasada?", sql: `SELECT count(*) FROM "Reporte" WHERE "creadoEn" >= now() - interval '7 days' AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Top 5 paises con mas reportes este mes", sql: `SELECT pais, count(*) as total FROM "Reporte" WHERE date_trunc('month',"creadoEn")=date_trunc('month',now()) AND "eliminado"=false GROUP BY pais ORDER BY total DESC LIMIT 5`, categoriaConsulta: "reportes" },
  { preguntaNL: "Top 10 colegios con mas reportes activos", sql: `SELECT c.nombre, count(r.id) as total FROM "Colegio" c JOIN "Reporte" r ON r."colegioId"=c.id WHERE r."eliminado"=false GROUP BY c.nombre ORDER BY total DESC LIMIT 10`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes por estado actualmente", sql: `SELECT estado, count(*) FROM "Reporte" WHERE "eliminado"=false GROUP BY estado ORDER BY count(*) DESC`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes de prioridad alta abiertos", sql: `SELECT count(*) FROM "Reporte" WHERE "prioridadAlta"=true AND "eliminado"=false AND "estado"!='CERRADO'`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes anonimos vs identificados en el mes", sql: `SELECT "esAnonimo", count(*) FROM "Reporte" WHERE date_trunc('month',"creadoEn")=date_trunc('month',now()) AND "eliminado"=false GROUP BY "esAnonimo"`, categoriaConsulta: "reportes" },
  { preguntaNL: "Reportes en rafaga esta semana", sql: `SELECT count(*) FROM "Reporte" WHERE "esRafaga"=true AND "creadoEn" >= now() - interval '7 days' AND "eliminado"=false`, categoriaConsulta: "reportes" },
  { preguntaNL: "Cual es la precision del motor IA?", sql: `SELECT 1 - (count(ca.id)::float / NULLIF(count(c.id),0)) FROM "ClasificacionIA" c LEFT JOIN "CorreccionAdmin" ca ON ca."reporteId"=c."reporteId" WHERE c."creadoEn" >= now() - interval '30 days'`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Latencia promedio del clasificador ultimo mes", sql: `SELECT avg("latenciaMs") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Latencia p95 del clasificador", sql: `SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "latenciaMs") FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days'`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Distribucion de categorias detectadas", sql: `SELECT categoria, count(*) FROM "ClasificacionIA" WHERE "creadoEn" >= now() - interval '30 days' GROUP BY categoria ORDER BY count(*) DESC`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Cuantas correcciones hicimos hoy?", sql: `SELECT count(*) FROM "CorreccionAdmin" WHERE date_trunc('day',"creadoEn")=current_date`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "Clasificaciones agrupadas por modelo LLM", sql: `SELECT "modeloUsado", count(*), avg("confianza") FROM "ClasificacionIA" GROUP BY "modeloUsado" ORDER BY count(*) DESC`, categoriaConsulta: "motor_ia" },
  { preguntaNL: "MRR del mes actual", sql: `SELECT sum(monto) FROM "BillingCycle" WHERE "estado"='PAGADO' AND date_trunc('month',"periodoInicio")=date_trunc('month',now())`, categoriaConsulta: "comercial" },
  { preguntaNL: "Cuanto facturamos el mes pasado?", sql: `SELECT sum(monto) FROM "BillingCycle" WHERE "estado"='PAGADO' AND date_trunc('month',"periodoInicio")=date_trunc('month',now() - interval '1 month')`, categoriaConsulta: "comercial" },
  { preguntaNL: "Cuantas suscripciones canceladas este mes?", sql: `SELECT count(*) FROM "Subscription" WHERE "estado"='CANCELADA' AND date_trunc('month',"canceladaEn")=date_trunc('month',now())`, categoriaConsulta: "comercial" },
  { preguntaNL: "Suscripciones activas por plan", sql: `SELECT p.nombre, count(s.id) FROM "Subscription" s JOIN "Plan" p ON p.id=s."planId" WHERE s."estado"='ACTIVA' GROUP BY p.nombre ORDER BY count(s.id) DESC`, categoriaConsulta: "comercial" },
  { preguntaNL: "Tenants activos totales", sql: `SELECT count(DISTINCT "tenantId") FROM "Subscription" WHERE "estado"='ACTIVA'`, categoriaConsulta: "comercial" },
  { preguntaNL: "Tiempo medio de resolucion de reportes", sql: `SELECT avg(EXTRACT(EPOCH FROM (tr."creadoEn" - r."creadoEn"))/3600) FROM "Reporte" r JOIN "TransicionReporte" tr ON tr."reporteId"=r.id WHERE tr."estadoNuevo"='CERRADO'`, categoriaConsulta: "operativo" },
  { preguntaNL: "Transiciones por responsable ultima semana", sql: `SELECT "responsableTipo", count(*) FROM "TransicionReporte" WHERE "creadoEn" >= now() - interval '7 days' GROUP BY "responsableTipo"`, categoriaConsulta: "operativo" },
  { preguntaNL: "Solicitudes a comite pendientes", sql: `SELECT count(*) FROM "SolicitudComite" WHERE "resueltoEn" IS NULL`, categoriaConsulta: "operativo" },
  { preguntaNL: "Solicitudes a comite resueltas este mes", sql: `SELECT count(*) FROM "SolicitudComite" WHERE "resueltoEn" IS NOT NULL AND date_trunc('month',"resueltoEn")=date_trunc('month',now())`, categoriaConsulta: "operativo" },
  { preguntaNL: "Eventos de audit por accion hoy", sql: `SELECT accion, count(*) FROM "AuditLog" WHERE date_trunc('day',"creadoEn")=current_date GROUP BY accion ORDER BY count(*) DESC`, categoriaConsulta: "salud" },
  { preguntaNL: "Alertas de colegio no resueltas", sql: `SELECT count(*) FROM "AlertaColegio" WHERE "resuelta"=false`, categoriaConsulta: "salud" },
  { preguntaNL: "Colegios con mas alertas este mes", sql: `SELECT c.nombre, count(a.id) FROM "Colegio" c JOIN "AlertaColegio" a ON a."colegioId"=c.id WHERE date_trunc('month',a."creadoEn")=date_trunc('month',now()) GROUP BY c.nombre ORDER BY count(a.id) DESC LIMIT 10`, categoriaConsulta: "salud" },
  { preguntaNL: "Reportes creados por fuente esta semana", sql: `SELECT fr.plataforma, count(*) FROM "FuenteReporte" fr JOIN "Reporte" r ON r.id=fr."reporteId" WHERE r."creadoEn" >= now() - interval '7 days' AND r."eliminado"=false GROUP BY fr.plataforma`, categoriaConsulta: "reportes" },
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

async function main(): Promise<void> {
  console.log("Seed catalogo BI · Producto 006 · SPEC-006 · F3C 2026-09-01");
  await seedTablas();
  await seedColumnas();
  await seedMetricas();
  await seedEjemplos();
  await seedConfig();
  console.log("Seed COMPLETO (idempotente: update:{} — la 2ª pasada crea 0 filas)");
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
