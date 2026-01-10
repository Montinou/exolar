Exolar Dashboard: Estrategia de Consolidación de MCP

De "Tool Sprawl" (24 Herramientas) al Patrón "Router & Search" (4 Herramientas)

1. El Problema: Ruido Semántico

Actualmente, el servidor MCP expone 24 puntos de entrada distintos. Esto obliga a Claude a leer y entender 24 definiciones de esquemas JSON antes de procesar el primer mensaje del usuario.

Estado Actual (24 Tools - Ineficiente):

get_executions, get_details, get_failed, get_trends, get_flaky, list_branches... (y 18 más).

Costo de Contexto: ~3,000 tokens solo en definiciones de herramientas.

Riesgo: Solapamiento semántico (dos herramientas hacen cosas parecidas) y alucinaciones.

Estado Deseado (4 Tools - Eficiente):

explore_exolar_index (Mapa)

query_exolar_data (Lectura Universal)

perform_exolar_action (Escritura/Acción)

get_semantic_definition (Diccionario)

Costo de Contexto: ~500 tokens.

2. La Nueva Arquitectura: "The Router Pattern"

En lugar de tener una función para cada tipo de dato, creamos una "Super Tool" que actúa como un enrutador (Router). Internamente en tu código (lib/analytics.ts), mapeas los parámetros a las funciones viejas.

Tool 1: explore_exolar_index (Descubrimiento)

Esta herramienta reemplaza la necesidad de que la IA sepa de memoria qué branches, suites o métricas existen.

Descripción: "Search the index of available datasets, branches, test suites, or metric types."

Input:

category: "datasets" | "branches" | "suites" | "metrics"

query: (Opcional, búsqueda de texto)

Output (Markdown Table):

| Dataset ID | Description |
| :--- | :--- |
| `executions` | Historial de ejecuciones de CI/CD |
| `flaky_tests` | Tests inestables detectados |
| `performance` | Métricas de regresión de tiempo |


Tool 2: query_exolar_data (El Router Universal)

Esta es la herramienta clave. Consolida 15 tools de lectura en una sola.

Descripción: "Retrieve data from Exolar. Use 'dataset' to specify the source (executions, flaky_tests, trends, etc.). Returns data in Markdown format optimized for analysis."

Input:

dataset: "executions" | "flaky_tests" | "trends" | "failures" | "metrics" (Enum estricto)

filters: (Object/JSON String) { branch: "main", limit: 10, status: "failed" }

view_mode: "list" | "summary" | "detailed"

Mapeo Interno (Tu código en Node.js):

// Pseudo-código del Dispatcher
switch (args.dataset) {
  case 'executions': return legacy.getExecutions(args.filters);
  case 'flaky_tests': return legacy.getFlakyTests(args.filters);
  case 'trends': return legacy.getTrends(args.filters);
  // ... etc
}


Tool 3: perform_exolar_action (Escritura/Mutación)

Consolida todas las acciones que cambian el estado o generan reportes pesados.

Descripción: "Perform actions like retrying tests, comparing executions, or generating PDF reports."

Input:

action: "compare_executions" | "retry_job" | "generate_report"

params: (Object) Parámetros específicos de la acción.

Tool 4: get_semantic_definition (Contexto)

Mantenemos esta (que ya creamos) para evitar alucinaciones sobre qué significa una métrica.

3. Matriz de Migración (Mapping)

Aquí ves cómo tus 24 tools actuales se "comprimen" en las nuevas 4.

Tool Antigua (Legacy)

Nueva Tool (Consolidada)

Parámetro dataset / action

list_available_metrics

explore_exolar_index

category="metrics"

list_branches

explore_exolar_index

category="branches"

list_suites

explore_exolar_index

category="suites"

get_executions

query_exolar_data

dataset="executions"

get_execution_details

query_exolar_data

dataset="executions", view_mode="detailed"

get_failed_tests

query_exolar_data

dataset="failures"

get_flaky_tests

query_exolar_data

dataset="flaky_tests"

get_trends

query_exolar_data

dataset="trends"

get_dashboard_metrics

query_exolar_data

dataset="dashboard_stats"

compare_executions

perform_exolar_action

action="compare"

generate_failure_report

perform_exolar_action

action="generate_report"

4. Prompting System (Cómo enseñarle a Claude)

Ahora que las tools son genéricas, el System Prompt debe enseñarle a usarlas.

<system_prompt>
  <role>You are the Exolar Intelligence Analyst.</role>
  
  <tool_usage_policy>
    We have consolidated data access into a 'Router Pattern'.
    
    1. **Explore First:** If you don't know what datasets exist, use `explore_exolar_index`.
    2. **Query Specifics:** Use `query_exolar_data` with the correct `dataset` ID. Do NOT guess specific function names like 'get_my_data'.
    3. **Filters:** Pass filters as a JSON object inside the tool call.
  </tool_usage_policy>
  
  <example>
    User: "Show me the flaky tests on main branch."
    Assistant Thinking: "I need to query data. Dataset is 'flaky_tests'. Filter is branch='main'."
    Tool Call: query_exolar_data(dataset="flaky_tests", filters={ "branch": "main" })
  </example>
</system_prompt>


5. Beneficios Inmediatos

Ahorro de Tokens: Pasas de enviar 24 esquemas JSON (muchos repetidos) a enviar solo 4 esquemas bien definidos.

Mantenibilidad: Si mañana agregas un nuevo reporte (get_security_alerts), no necesitas crear una nueva Tool. Solo agregas security_alerts al enum dataset y actualizas el switch en tu código. El "contrato" con la IA no cambia.

Flexibilidad de Filtros: Al unificar los filtros en un objeto JSON, la IA puede combinar filtros (branch + status + date) más fácilmente que si tuviera parámetros rígidos en cada función.