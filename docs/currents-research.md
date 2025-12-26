# Investigación: Currents Dashboard para Playwright

> Documento de investigación sobre cómo Currents implementa su dashboard y qué conceptos podemos aplicar a nuestro E2E Test Dashboard.

---

## 1. Resumen Ejecutivo

**Currents** es una plataforma de observabilidad y reporte en la nube para Playwright que ofrece:
- Dashboard de análisis y debugging de tests
- Orquestación inteligente (40% más rápido que sharding nativo)
- Gestión de artefactos en la nube (traces, videos, screenshots)
- Detección automática de flaky tests
- Integraciones con GitHub y Slack

### Conceptos Clave Aplicables a Nuestro Proyecto

| Concepto | Prioridad | Complejidad | Impacto |
|----------|-----------|-------------|---------|
| Detección de Flaky Tests | Alta | Media | Alto |
| Métricas de Volume | Alta | Baja | Alto |
| Timeline Visual de Tests | Media | Media | Medio |
| Comparación entre Runs | Media | Alta | Alto |
| Test Explorer con filtros | Alta | Media | Alto |
| Quarantine de Tests | Baja | Alta | Medio |

---

## 2. Arquitectura de Currents

### 2.1 Modelo de Datos Jerárquico

```
Organization
└── Projects
    └── Test Runs (Executions)
        └── Test Groups (browser/platform)
            └── Spec Files (Instances)
                └── Tests
                    └── Attempts (con retries)
                        └── Steps
                            ├── Status
                            ├── Duration
                            ├── Artifacts
                            └── Errors/Logs
```

**Comparación con nuestro modelo actual:**

| Currents | Nuestro Dashboard | Gap |
|----------|-------------------|-----|
| Organizations | ❌ No existe | Multi-tenancy futuro |
| Projects | ❌ No existe | Agrupación de tests |
| Test Groups | ❌ No existe | Agrupar por browser |
| Attempts/Retries | `retry_count` en test_results | ✅ Parcial |
| Steps | ❌ No existe | Granularidad extra |

### 2.2 Formato de Datos que Reciben

```
fullTestSuite.json    → Tests esperados (sin resultados)
config.json           → Metadata (framework, versión)
instances/            → Carpeta con resultados por spec file
  - spec1.json
  - spec2.json
```

**💡 Recomendación:** Considerar agregar metadata de configuración (browser, viewport, versión de Playwright) a nuestras ejecuciones.

---

## 3. Sistema de Métricas

### 3.1 Las 6 Métricas Principales de Currents

| Métrica | Descripción | ¿La tenemos? |
|---------|-------------|--------------|
| **Overall Executions** | Total de ejecuciones | ✅ `total_executions` |
| **Average Duration** | Tiempo promedio | ✅ `avg_duration_ms` |
| **Passed Duration** | Duración de tests que pasaron | ❌ |
| **Non Flaky Duration** | Duración sin flaky tests | ❌ |
| **Failure Rate** | % de tests fallidos | ✅ Calculable |
| **Flakiness Rate** | % de tests inconsistentes | ❌ |

### 3.2 Métricas de Volume (Concepto Nuevo)

Currents multiplica cada métrica por su frecuencia de ejecución:

```
Duration Volume = Duration × Frecuencia de ejecución
Failure Volume = Failure Rate × Número de muestras
Flakiness Volume = Flakiness Rate × Número de muestras
```

**¿Por qué importa?** Un test que falla 50% del tiempo pero se ejecuta 100 veces al día tiene más impacto que uno que falla 80% pero se ejecuta 1 vez por semana.

**💡 Recomendación:** Implementar métricas de volume para priorizar qué tests arreglar primero.

### 3.3 Métricas que Debemos Agregar

```sql
-- Failure Rate
SELECT
  COUNT(*) FILTER (WHERE status = 'failed') * 100.0 / COUNT(*) as failure_rate
FROM test_results
WHERE execution_id IN (SELECT id FROM test_executions WHERE started_at > NOW() - INTERVAL '7 days');

-- Flakiness Rate (requiere tracking de retries exitosos)
SELECT
  COUNT(*) FILTER (WHERE retry_count > 0 AND status = 'passed') * 100.0 /
  COUNT(*) FILTER (WHERE status = 'passed') as flakiness_rate
FROM test_results;
```

---

## 4. Detección de Flaky Tests

### 4.1 Definición de Currents

Un test es **flaky** cuando:
- No pasa en el primer intento
- Pasa después de uno o más retries
- Sin cambios en el código

### 4.2 Cómo lo Detectan

```typescript
// Test marcado como flaky si:
const isFlaky = retryCount > 0 && finalStatus === 'passed';
```

### 4.3 Métricas de Flakiness

```
Flakiness Rate = (Flaky tests / Passed tests) × 100
Flakiness Volume = Flakiness Rate × Número de muestras
```

### 4.4 Implementación Propuesta para Nuestro Dashboard

**Tabla nueva: `test_flakiness_history`**

```sql
CREATE TABLE test_flakiness_history (
  id SERIAL PRIMARY KEY,
  test_signature TEXT NOT NULL,  -- hash único del test
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  total_runs INT DEFAULT 0,
  flaky_runs INT DEFAULT 0,
  flakiness_rate DECIMAL(5,2) DEFAULT 0,
  last_flaky_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_test_signature ON test_flakiness_history(test_signature);
```

**Función para calcular flakiness:**

```sql
-- Actualizar después de cada ejecución
UPDATE test_flakiness_history
SET
  total_runs = total_runs + 1,
  flaky_runs = flaky_runs + CASE WHEN $is_flaky THEN 1 ELSE 0 END,
  flakiness_rate = (flaky_runs::decimal / total_runs) * 100,
  last_flaky_at = CASE WHEN $is_flaky THEN NOW() ELSE last_flaky_at END,
  updated_at = NOW()
WHERE test_signature = $signature;
```

---

## 5. UI/UX del Dashboard

### 5.1 Estructura de Navegación de Currents

```
Dashboard Overview
├── Runs Section (lista de ejecuciones)
│   ├── Flakiness rates
│   ├── Visualización de errores
│   └── Detalles del runner
├── Spec Files View (agrupa por archivo)
│   ├── Failed test count
│   ├── Duration analysis
│   └── Flakiness tracking
└── Test Details (nivel más profundo)
    ├── DOM explorer vía Traces
    ├── Console inspector
    ├── Network requests replay
    ├── Video recordings
    └── Screenshots con comparación
```

### 5.2 Visualizaciones Clave

#### Timeline View
- Cada barra = una ejecución
- Color indica status (rojo=failed, verde=passed, naranja=flaky)
- Altura relativa = duración

**💡 Recomendación:** Implementar timeline visual en lugar de solo tabla.

#### Test Explorer (8 vistas)
1. Duration analysis
2. Failure rate
3. Flakiness rate
4. Test counts
5. Histogramas por métrica
6. Comparación de períodos
7. Distribución por percentiles
8. Trends over time

### 5.3 Filtros Disponibles en Currents

```
Date Range          → Período a analizar
Tags               → Filtrar por Playwright tags
Author             → Por git author
Branch             → Por git branch
Group              → Por grupo (Firefox, Chromium)
Search by spec     → Búsqueda de archivo
Search by test     → Búsqueda de nombre
```

**Comparación con nuestros filtros:**

| Filtro Currents | Nuestro Dashboard | Prioridad |
|-----------------|-------------------|-----------|
| Date Range | ❌ | Alta |
| Tags | ❌ | Baja |
| Author | ❌ | Media |
| Branch | ✅ | - |
| Group/Browser | ❌ | Media |
| Search by spec | ❌ | Alta |
| Search by test | ❌ | Alta |
| Status | ✅ | - |

---

## 6. Análisis de Errores

### 6.1 Lo que Currents Captura

- Error messages específicos
- Stack traces completos
- Código snippet del test que falló
- Historial de ejecuciones previas
- **Patrones de errores más comunes**
- **Agrupación de errores similares**

### 6.2 Top Errors Report

Currents agrupa errores por mensaje y muestra:
- Frecuencia de cada error
- Tests afectados
- Primera/última ocurrencia

**💡 Recomendación:** Implementar agrupación de errores similares.

```sql
-- Query para agrupar errores similares
SELECT
  SUBSTRING(error_message, 1, 100) as error_pattern,
  COUNT(*) as occurrences,
  array_agg(DISTINCT test_name) as affected_tests,
  MIN(started_at) as first_seen,
  MAX(started_at) as last_seen
FROM test_results
WHERE status = 'failed' AND error_message IS NOT NULL
GROUP BY SUBSTRING(error_message, 1, 100)
ORDER BY occurrences DESC
LIMIT 10;
```

---

## 7. Integraciones

### 7.1 GitHub Integration de Currents

**Features:**
- PR comments con resumen de resultados
- Commit status checks
- Previene merge de runs fallidos
- Link directo al dashboard

**Requisitos de metadata:**
```
COMMIT_INFO_BRANCH
COMMIT_INFO_MESSAGE
COMMIT_INFO_EMAIL
COMMIT_INFO_AUTHOR
COMMIT_INFO_SHA
COMMIT_INFO_TIMESTAMP
COMMIT_INFO_REMOTE
```

**💡 Recomendación:** Agregar campos de git metadata a `test_executions`:

```sql
ALTER TABLE test_executions ADD COLUMN commit_message TEXT;
ALTER TABLE test_executions ADD COLUMN commit_author TEXT;
ALTER TABLE test_executions ADD COLUMN commit_author_email TEXT;
```

### 7.2 Slack Integration

Eventos que notifican:
- Run Started
- Run Finished (con resumen)
- Run Timeout
- Run Canceled

Opciones de configuración:
- Solo notificar failures
- Filtrar por branch
- Single notification para todos los groups

---

## 8. Features Avanzadas

### 8.1 Test Insights

**Reports disponibles:**
- Slowest tests (ordenados por duration)
- Flakiest tests (ordenados por flakiness rate)
- Most failing tests (ordenados por failure rate)
- Filterable by branch o tags

**Query propuesta para "Slowest Tests":**

```sql
SELECT
  test_name,
  test_file,
  AVG(duration_ms) as avg_duration,
  COUNT(*) as executions,
  MAX(duration_ms) as max_duration
FROM test_results
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY test_name, test_file
ORDER BY avg_duration DESC
LIMIT 10;
```

### 8.2 Comparación entre Runs

Currents muestra:
- Línea púrpura: métrica para rango seleccionado
- Línea gris: métrica para período anterior
- Indicador de cambio (mejora/degradación)

**💡 Recomendación:** Agregar comparación de períodos en nuestro trend chart.

### 8.3 Quarantine Workflow

Concepto para manejar flaky tests:
1. Detectar tests con alta flakiness
2. Moverlos a "quarantine" (ejecutar pero no bloquear CI)
3. Mantener pipeline principal verde
4. Trabajar en arreglar los tests en paralelo

**Implementación posible:**

```sql
ALTER TABLE test_results ADD COLUMN is_quarantined BOOLEAN DEFAULT false;

-- Tests quarantined no afectan el status general
SELECT
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'failed' AND NOT is_quarantined) > 0
    THEN 'failure'
    ELSE 'success'
  END as run_status
FROM test_results
WHERE execution_id = $1;
```

---

## 9. REST API de Currents

### 9.1 Endpoints Disponibles

```
/v1/projects          → Manage projects
/v1/runs             → Access test runs
/v1/instances        → Spec file instances
/v1/tests            → Test results
/v1/signature/test   → Test signatures (unique identifiers)
/v1/artifacts        → Manage artifacts
```

### 9.2 Test Signature

Identificador único basado en:
```
Signature = hash(Organization ID + Project ID + Spec File Path + Test Title)
```

Esto permite:
- Tracking histórico de un test específico
- Métricas acumulativas por test
- Comparación cross-run

**💡 Recomendación:** Implementar test signatures en nuestro sistema.

```sql
ALTER TABLE test_results ADD COLUMN test_signature TEXT;
CREATE INDEX idx_test_signature ON test_results(test_signature);

-- Generar signature
UPDATE test_results
SET test_signature = MD5(test_file || '::' || test_name);
```

---

## 10. Recomendaciones de Implementación

### 10.1 Fase 1: Quick Wins (1-2 semanas)

1. **Agregar filtro de fecha**
   - Date picker en la UI
   - Parámetro `startDate`/`endDate` en APIs

2. **Búsqueda por nombre de test**
   - Input de búsqueda en ExecutionsTable
   - ILIKE query en backend

3. **Test Signatures**
   - Generar hash único por test
   - Permite tracking histórico

4. **Métricas de Failure Rate**
   - Agregar a `/api/metrics`
   - Mostrar en StatsCards

### 10.2 Fase 2: Flaky Test Detection (2-3 semanas)

1. **Nueva tabla `test_flakiness_history`**
2. **Calcular flakiness después de cada run**
3. **Vista "Flakiest Tests"** en dashboard
4. **Badge visual de "Flaky"** en resultados

### 10.3 Fase 3: Test Explorer (3-4 semanas)

1. **Nueva página `/explorer`**
2. **8 vistas de análisis:**
   - Slowest tests
   - Most failing
   - Flakiest
   - By browser
   - By file
   - Timeline
   - Duration distribution
   - Trend comparison

### 10.4 Fase 4: Integraciones (2-3 semanas)

1. **GitHub PR comments**
   - GitHub App o Action
   - Post resumen después de run

2. **Slack notifications**
   - Webhook para failures
   - Resumen diario opcional

---

## 11. Schema de Base de Datos Propuesto

### 11.1 Cambios a `test_executions`

```sql
ALTER TABLE test_executions ADD COLUMN commit_message TEXT;
ALTER TABLE test_executions ADD COLUMN commit_author TEXT;
ALTER TABLE test_executions ADD COLUMN commit_author_email TEXT;
ALTER TABLE test_executions ADD COLUMN project_id TEXT;
ALTER TABLE test_executions ADD COLUMN tags TEXT[];
```

### 11.2 Cambios a `test_results`

```sql
ALTER TABLE test_results ADD COLUMN test_signature TEXT;
ALTER TABLE test_results ADD COLUMN is_flaky BOOLEAN DEFAULT false;
ALTER TABLE test_results ADD COLUMN is_quarantined BOOLEAN DEFAULT false;
ALTER TABLE test_results ADD COLUMN attempt_number INT DEFAULT 1;

CREATE INDEX idx_test_signature ON test_results(test_signature);
CREATE INDEX idx_is_flaky ON test_results(is_flaky) WHERE is_flaky = true;
```

### 11.3 Nueva tabla `test_flakiness_history`

```sql
CREATE TABLE test_flakiness_history (
  id SERIAL PRIMARY KEY,
  test_signature TEXT NOT NULL UNIQUE,
  test_name TEXT NOT NULL,
  test_file TEXT NOT NULL,
  total_runs INT DEFAULT 0,
  flaky_runs INT DEFAULT 0,
  failed_runs INT DEFAULT 0,
  flakiness_rate DECIMAL(5,2) DEFAULT 0,
  failure_rate DECIMAL(5,2) DEFAULT 0,
  avg_duration_ms INT,
  last_flaky_at TIMESTAMPTZ,
  last_failed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_flakiness_rate ON test_flakiness_history(flakiness_rate DESC);
CREATE INDEX idx_failure_rate ON test_flakiness_history(failure_rate DESC);
```

### 11.4 Nueva tabla `error_patterns`

```sql
CREATE TABLE error_patterns (
  id SERIAL PRIMARY KEY,
  pattern_hash TEXT NOT NULL UNIQUE,
  error_pattern TEXT NOT NULL,
  first_seen TIMESTAMPTZ NOT NULL,
  last_seen TIMESTAMPTZ NOT NULL,
  occurrence_count INT DEFAULT 1,
  affected_tests TEXT[],
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_occurrence_count ON error_patterns(occurrence_count DESC);
```

---

## 12. APIs Nuevas Propuestas

### 12.1 GET /api/test-explorer

```typescript
// Parámetros
{
  view: 'slowest' | 'failing' | 'flaky' | 'by-file',
  dateFrom?: string,
  dateTo?: string,
  branch?: string,
  limit?: number
}

// Response
{
  tests: [{
    test_signature: string,
    test_name: string,
    test_file: string,
    avg_duration_ms: number,
    failure_rate: number,
    flakiness_rate: number,
    total_runs: number,
    trend: 'improving' | 'degrading' | 'stable'
  }]
}
```

### 12.2 GET /api/error-patterns

```typescript
// Response
{
  patterns: [{
    pattern_hash: string,
    error_pattern: string,
    occurrence_count: number,
    affected_tests: string[],
    first_seen: string,
    last_seen: string
  }]
}
```

### 12.3 GET /api/test-history/:signature

```typescript
// Response
{
  test_signature: string,
  test_name: string,
  test_file: string,
  history: [{
    execution_id: number,
    status: string,
    duration_ms: number,
    is_flaky: boolean,
    started_at: string,
    branch: string
  }],
  metrics: {
    flakiness_rate: number,
    failure_rate: number,
    avg_duration_ms: number
  }
}
```

---

## 13. Componentes UI Nuevos

### 13.1 TestExplorer

```tsx
// components/dashboard/test-explorer.tsx
// Tabla con 8 vistas diferentes
// Filtros: date range, branch, search
// Sorting por cualquier columna
// Export to CSV
```

### 13.2 FlakinessBadge

```tsx
// components/dashboard/flakiness-badge.tsx
// Badge visual que indica si un test es flaky
// Tooltip con estadísticas
```

### 13.3 ErrorPatternsTable

```tsx
// components/dashboard/error-patterns.tsx
// Agrupa errores similares
// Muestra frecuencia y tests afectados
```

### 13.4 TestTimeline

```tsx
// components/dashboard/test-timeline.tsx
// Visualización de barras verticales
// Color = status, altura = duration
// Hover para detalles
```

### 13.5 PeriodComparison

```tsx
// components/dashboard/period-comparison.tsx
// Dos líneas en el gráfico
// Indicador de mejora/degradación
```

---

## 14. Resumen de Prioridades

### Alta Prioridad (Implementar primero)
1. ✅ Test signatures para tracking histórico
2. ✅ Detección de flaky tests
3. ✅ Filtro por fecha
4. ✅ Búsqueda por nombre de test
5. ✅ Métricas de failure rate

### Media Prioridad
1. Test Explorer con múltiples vistas
2. Agrupación de errores similares
3. Comparación entre períodos
4. Timeline visual de tests
5. Git metadata en ejecuciones

### Baja Prioridad (Nice to have)
1. Quarantine workflow
2. Slack integration
3. GitHub PR comments
4. Export to CSV
5. MCP Server para AI

---

## 15. Referencias

- [Currents Documentation](https://docs.currents.dev/)
- [Currents Playwright Setup](https://docs.currents.dev/resources/reporters/currents-playwright)
- [Test Explorer](https://docs.currents.dev/dashboard/test-suite-performance-explorer/tests-explorer)
- [Insights and Analytics](https://docs.currents.dev/insights/insights-and-analytics)
- [Flaky Tests Detection](https://docs.currents.dev/dashboard/tests/flaky-tests)
- [GitHub Integration](https://docs.currents.dev/resources/integrations/github)
- [Playwright Orchestration](https://docs.currents.dev/guides/ci-optimization/playwright-orchestration)
- [REST API Documentation](https://docs.currents.dev/resources/api)
- [GitHub Examples](https://github.com/currents-dev/playwright-gh-actions-demo)

---

*Documento generado: Diciembre 2024*
*Proyecto: E2E Test Dashboard*
