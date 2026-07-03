import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const APIS = [
  // Configuración / Modelos IA
  {
    key: "list_models",
    name: "Listar modelos IA",
    description: "Devuelve todos los modelos de IA configurados.",
    module: "configuracion",
    submodule: "modelos_ia",
    category: "internal",
    method: "GET",
    path: "/api/config/models",
    authType: "none",
  },
  {
    key: "create_model",
    name: "Crear modelo IA",
    description: "Registra una nueva configuración de modelo IA.",
    module: "configuracion",
    submodule: "modelos_ia",
    category: "internal",
    method: "POST",
    path: "/api/config/models",
    authType: "none",
  },
  {
    key: "update_model",
    name: "Actualizar modelo IA",
    description: "Modifica una configuración de modelo IA existente.",
    module: "configuracion",
    submodule: "modelos_ia",
    category: "internal",
    method: "PUT",
    path: "/api/config/models/{id}",
    authType: "none",
  },
  {
    key: "delete_model",
    name: "Eliminar modelo IA",
    description: "Elimina una configuración de modelo IA.",
    module: "configuracion",
    submodule: "modelos_ia",
    category: "internal",
    method: "DELETE",
    path: "/api/config/models/{id}",
    authType: "none",
  },
  {
    key: "test_model",
    name: "Testear modelo IA",
    description: "Envía un prompt de prueba a un modelo IA.",
    module: "configuracion",
    submodule: "modelos_ia",
    category: "internal",
    method: "POST",
    path: "/api/config/models/test",
    authType: "none",
  },
  {
    key: "discover_models",
    name: "Descubrir modelos locales",
    description: "Lista modelos disponibles en una instancia Ollama.",
    module: "configuracion",
    submodule: "modelos_ia",
    category: "internal",
    method: "GET",
    path: "/api/config/models/discover?baseUrl={baseUrl}",
    authType: "none",
  },
  // Configuración / APIs
  {
    key: "list_apis",
    name: "Listar APIs",
    description: "Devuelve el catálogo de APIs disponibles para el agente.",
    module: "configuracion",
    submodule: "apis",
    category: "internal",
    method: "GET",
    path: "/api/config/apis",
    authType: "none",
  },
  {
    key: "toggle_api",
    name: "Activar/inhabilitar API",
    description: "Cambia el estado activo/inactivo de una API.",
    module: "configuracion",
    submodule: "apis",
    category: "internal",
    method: "PATCH",
    path: "/api/config/apis/{id}/toggle",
    authType: "none",
  },
  // Configuración / Auditoría
  {
    key: "list_audit",
    name: "Listar auditoría",
    description: "Devuelve los eventos de auditoría recientes.",
    module: "configuracion",
    submodule: "auditoria",
    category: "internal",
    method: "GET",
    path: "/api/config/audit?limit={limit}",
    authType: "none",
  },
  // Base Oficial / Carga Documental
  {
    key: "upload_document",
    name: "Subir documento oficial",
    description: "Sube un PDF, extrae texto y genera metadatos con IA.",
    module: "base_oficial",
    submodule: "carga_documental",
    category: "internal",
    method: "POST",
    path: "/api/documents",
    authType: "none",
  },
  // Base Oficial / Búsqueda RAG
  {
    key: "search_documents",
    name: "Buscar documentos",
    description: "Realiza búsqueda semántica por texto en la base oficial.",
    module: "base_oficial",
    submodule: "busqueda_rag",
    category: "internal",
    method: "POST",
    path: "/api/documents/search",
    authType: "none",
  },
  // Base Oficial / Repositorio
  {
    key: "list_documents",
    name: "Listar documentos",
    description: "Devuelve todos los documentos oficiales indexados.",
    module: "base_oficial",
    submodule: "repositorio",
    category: "internal",
    method: "GET",
    path: "/api/documents",
    authType: "none",
  },
  // Investigación IA / Odin Analysis
  {
    key: "analyze_document",
    name: "Analizar documento",
    description: "Ejecuta análisis inteligente sobre un documento de la base oficial.",
    module: "investigacion",
    submodule: "odin_analysis",
    category: "internal",
    method: "POST",
    path: "/api/research/analyze",
    authType: "none",
  },
  // Infraestructura / Modelos locales
  {
    key: "ollama_local",
    name: "Ollama local",
    description: "API de modelos locales via Ollama.",
    module: "infraestructura",
    submodule: "modelos_locales",
    category: "external",
    method: "POST",
    path: "{baseUrl}/api/generate",
    authType: "none",
    config: JSON.stringify({ baseUrl: "http://localhost:11434" }),
  },
  // Infraestructura / Modelos cloud
  {
    key: "openai_api",
    name: "OpenAI API",
    description: "API de modelos cloud de OpenAI.",
    module: "infraestructura",
    submodule: "modelos_cloud",
    category: "external",
    method: "POST",
    path: "https://api.openai.com/v1/chat/completions",
    authType: "apiKey",
  },
];

async function main() {
  for (const api of APIS) {
    await prisma.agentApi.upsert({
      where: { key: api.key },
      update: {},
      create: api,
    });
  }
  console.log(`Sembradas ${APIS.length} APIs.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
