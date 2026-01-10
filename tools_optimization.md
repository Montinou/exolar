Exolar Dashboard: MCP Optimization Strategy

Applying "Lazy Loading" & Semantic Analysis Principles

1. El Diagnóstico (The Problem)

Los MCPs de Dashboards tradicionales suelen fallar en dos puntos:

Sobrecarga de Contexto: Envían JSONs masivos con todo el historial de ventas/usuarios.

Alucinación de Cálculo: La IA intenta calcular el "promedio de retención" sumando mentalmente filas de un array, y falla.

La Solución: Mover la agregación al Backend (SQL/Database) y usar la IA solo para orquestar la consulta y analizar el resultado.

2. Arquitectura de Tools (The Toolset)

En lugar de herramientas genéricas, dividimos el acceso en Descubrimiento, Consulta y Acción.

Fase 1: Descubrimiento (The Menu)

No le des los datos aún. Dale el "Menú" de qué puede preguntar.

Tool: list_available_metrics

Descripción: Returns a categorization of available metrics (e.g., "Sales", "User Growth", "Server Health") and their granularities.

Input: domain (optional: 'finance', 'tech', 'marketing').

Output:

[
  { "id": "arr", "name": "Annual Recurring Revenue", "type": "currency" },
  { "id": "dau", "name": "Daily Active Users", "type": "count" }
]


Tool: get_metric_definition (The Semantic Layer)

Descripción: Critical for preventing hallucinations. Explains how a metric is calculated.

Input: metric_id (e.g., 'churn_rate').

Output: "Churn is calculated as users who canceled / total users at start of month. Does not include trials."

Fase 2: Consulta Agregada (The Query)

Regla de Oro: Nunca pedir "raw data" (filas crudas) a menos que sean < 50 items. Siempre pedir agregaciones.

Tool: query_aggregated_metric

Descripción: Fetches specific data points processed by the backend.

Input:

metric_id: "revenue"

date_range: "last_30_days" | "ytd" | "custom"

granularity: "day" | "week" | "month"

group_by: "region" | "plan_type" (Optional)

Why this works: The LLM receives 30 datapoints (1 per day) instead of 10,000 transaction rows.

Fase 3: Análisis Comparativo

Tool: compare_periods

Descripción: Automatically calculates delta between two ranges.

Input: metric_id, primary_range, secondary_range.

Output: { "change_percentage": "+15%", "absolute_change": 1200, "trend": "positive" }

3. System Prompts & Personas

Al igual que en Quoth, necesitamos una "Personalidad" que entienda el negocio.

The "Exolar Analyst" Persona

<system_prompt>
    <role>
        You are the Senior Data Analyst for Exolar. Your goal is to extract ACTIONABLE insights, not just report numbers.
    </role>

    <prime_directive>
        NEVER calculate aggregates (averages, sums) yourself from raw lists. ALWAYS use `query_aggregated_metric` to let the database handle the math.
    </prime_directive>

    <workflow>
        <step index="1">
            **Understand the Business Question:** If user asks "Why are sales down?", first identify which metrics represent "sales" using `list_available_metrics`.
        </step>
        <step index="2">
            **Check Definitions:** Use `get_metric_definition` to ensure you understand what the metric means (e.g., does "Sales" include taxes?).
        </step>
        <step index="3">
            **Fetch Context:** Get the trend using `query_aggregated_metric` for the relevant period.
        </step>
        <step index="4">
            **Synthesize:** Present the answer visually or textually. If the data is alarming, suggest a "Drill Down" (e.g., "Sales are down 10%, mostly in the EU region. Shall I verify server health in EU?").
        </step>
    </workflow>
</system_prompt>


4. UX Integration (Frontend)

Para que el MCP brille en tu dashboard (exolar.ai-innovation.site), la respuesta de la IA no debe ser solo texto.

Generative UI Components

Si usas Vercel AI SDK o similar, tu MCP debe devolver "Artifacts" de UI.

Si la IA detecta una serie de tiempo -> Renderiza un componente <LineChart data={...} />.

Si la IA compara dos valores -> Renderiza un componente <StatCard diff={+12} />.

Estrategia de implementación:
La tool query_aggregated_metric debe devolver un JSON estructurado que tu Frontend pueda transformar directamente en un gráfico de Recharts o Tremor, sin que la IA tenga que "dibujar" el gráfico ASCII.

5. Optimización para Claude Code (CLI & NPM)

Dado que usarás esto principalmente con Claude Code (que corre en la terminal) y tu setup actual es npm, aquí está la estrategia de "Token Diet" específica:

5.1 Salidas "Terminal-Friendly"

Claude Code lee texto crudo. Si tus herramientas devuelven JSON muy anidado, malgastas tokens en llaves {} y comillas "".

Mala Práctica (JSON Verboso):

// Consumo: ~50 tokens
[
  { "date": "2024-01-01", "value": 100, "unit": "USD", "status": "verified" },
  { "date": "2024-01-02", "value": 105, "unit": "USD", "status": "verified" }
]


Buena Práctica (CSV/Markdown Compacto):
Configura tus herramientas en el servidor npm para que, si detectan que el cliente es CLI, devuelvan formato tabular simple.

// Consumo: ~15 tokens
Date       | Value (USD)
2024-01-01 | 100
2024-01-02 | 105


5.2 Compresión de Esquemas (Schema Slimming)

En tu archivo index.ts (o donde definas el servidor MCP):

No uses zod schemas gigantes con descripciones de 5 líneas para cada campo.

Sé telegráfico en las descripciones de las tools.

Antes: "This argument represents the date range for the query, it can be..."

Después: "Query period (e.g. 'last_30d', 'ytd')."

5.3 El Patrón "Headless"

Si vas a migrar a Next.js después, mantén tu lógica de negocio (las funciones que hacen las queries SQL/API) en un archivo separado lib/analytics.ts.

Ahora (npm): Tu servidor MCP importa lib/analytics.ts.

Futuro (Next.js): Tus API Routes importan lib/analytics.ts.

Esto te permite optimizar la lógica de datos una sola vez. Si logras que query_aggregated_metric devuelva solo los datos esenciales, ya habrás ganado la batalla de los tokens, sin importar si el servidor corre en tu laptop o en Vercel.