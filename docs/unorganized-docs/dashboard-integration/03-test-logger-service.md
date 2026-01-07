# Phase 03: TestLogger Service

> **Priority:** Critical | **Complexity:** Medium | **Dependencies:** Phase 02 (Playwright Reporter)
>
> Creates a unified logging service with structured format in all environments. Local shows logs in console, CI captures and sends to dashboard.

---

## Objective

1. Create TestLogger service with unified structured format
2. Replace scattered `console.log` with structured logging
3. Display structured logs in console locally (same format as CI)
4. Capture and send logs to dashboard in CI
5. Capture failure context automatically
6. Integrate with page objects and fixtures
7. Pass logs to dashboard reporter via test annotations

---

## Prerequisites

- Phase 02 complete (reporter can read test annotations)
- Understanding of existing console.log usage in page objects

---

## Implementation

### 1. Create Logger Types (`utils/logger-types.ts`)

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'metric';

export interface LogEntry {
  timestamp: number;       // milliseconds since test start
  level: LogLevel;
  source: string;          // e.g., 'page-object:PO_CaseV2'
  message: string;
  data?: Record<string, unknown>;
}

export interface FailureContext {
  errorMessage: string;
  stackTrace: string;
  location: {
    file: string;
    line: number;
    column?: number;
  };
  lastLogs: LogEntry[];    // Final N logs before failure
  pageUrl: string;
  timestamp: string;
  screenshot?: string;     // Base64 or path
}

export interface TestLoggerOptions {
  testName?: string;
  testFile?: string;
  maxLogs?: number;        // Max logs to keep in memory
  consoleInCI?: boolean;   // Also log to console in CI
}
```

### 2. Create TestLogger Service (`utils/test-logger.ts`)

```typescript
import type { Page, TestInfo } from '@playwright/test';
import type { LogEntry, LogLevel, FailureContext, TestLoggerOptions } from './logger-types';

const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

export class TestLogger {
  private logs: LogEntry[] = [];
  private testStart: number;
  private options: Required<TestLoggerOptions>;
  private testInfo?: TestInfo;
  private page?: Page;

  constructor(options: TestLoggerOptions = {}) {
    this.testStart = Date.now();
    this.options = {
      testName: options.testName || 'unknown',
      testFile: options.testFile || 'unknown',
      maxLogs: options.maxLogs || 500,
      consoleInCI: options.consoleInCI || false,
    };
  }

  /**
   * Initialize logger with Playwright test context
   */
  init(testInfo: TestInfo, page?: Page): void {
    this.testInfo = testInfo;
    this.page = page;
    this.testStart = Date.now();
    this.logs = [];
    this.options.testName = testInfo.title;
    this.options.testFile = testInfo.file;
  }

  /**
   * Log informational message
   */
  info(source: string, message: string, data?: Record<string, unknown>): void {
    this.log('info', source, message, data);
  }

  /**
   * Log debug message (only in development)
   */
  debug(source: string, message: string, data?: Record<string, unknown>): void {
    this.log('debug', source, message, data);
  }

  /**
   * Log warning message
   */
  warn(source: string, message: string, data?: Record<string, unknown>): void {
    this.log('warn', source, message, data);
  }

  /**
   * Log error message (always visible)
   */
  error(source: string, message: string, error?: Error, data?: Record<string, unknown>): void {
    const enrichedData = {
      ...data,
      errorMessage: error?.message,
      errorStack: error?.stack,
    };
    this.log('error', source, message, enrichedData);
  }

  /**
   * Log performance metric
   */
  metric(source: string, name: string, value: number, unit: string = 'ms'): void {
    this.log('metric', source, `${name}: ${value}${unit}`, { name, value, unit });
  }

  /**
   * Log API call timing
   */
  api(source: string, endpoint: string, duration: number, status: number): void {
    this.log('metric', source, `API ${endpoint}`, {
      type: 'api',
      endpoint,
      duration,
      status,
    });
  }

  /**
   * Log navigation timing
   */
  navigation(source: string, url: string, duration: number): void {
    this.log('metric', source, `Navigate to ${url}`, {
      type: 'navigation',
      url,
      duration,
    });
  }

  /**
   * Core logging function
   *
   * BEHAVIOR:
   * - Local: Always display structured log in console
   * - CI: Capture log for dashboard, only show errors in console
   */
  private log(
    level: LogLevel,
    source: string,
    message: string,
    data?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      timestamp: Date.now() - this.testStart,
      level,
      source,
      message,
      data,
    };

    // Always capture logs (for both local debugging and CI reporting)
    this.logs.push(entry);

    // Trim if too many logs
    if (this.logs.length > this.options.maxLogs) {
      this.logs = this.logs.slice(-this.options.maxLogs);
    }

    if (isCI) {
      // In CI: Only show errors in console (rest captured silently)
      if (this.options.consoleInCI || level === 'error') {
        this.consoleLog(entry);
      }
    } else {
      // In local: Always display structured log in console
      this.consoleLog(entry);
    }
  }

  /**
   * Output to console with formatting
   */
  private consoleLog(entry: LogEntry): void {
    const prefix = `[${entry.source}]`;
    const timestamp = `+${entry.timestamp}ms`;

    switch (entry.level) {
      case 'error':
        console.error(timestamp, prefix, entry.message, entry.data || '');
        break;
      case 'warn':
        console.warn(timestamp, prefix, entry.message, entry.data || '');
        break;
      case 'debug':
        if (!isCI) {
          console.debug(timestamp, prefix, entry.message, entry.data || '');
        }
        break;
      default:
        console.log(timestamp, prefix, entry.message, entry.data || '');
    }
  }

  /**
   * Get all captured logs
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs as JSON string for test annotation
   */
  getLogsJson(): string {
    return JSON.stringify(this.logs);
  }

  /**
   * Get the last N logs
   */
  getLastLogs(count: number = 10): LogEntry[] {
    return this.logs.slice(-count);
  }

  /**
   * Create failure context for dashboard
   */
  async getFailureContext(error: Error): Promise<FailureContext> {
    let pageUrl = 'unknown';
    let screenshot: string | undefined;

    if (this.page) {
      try {
        pageUrl = this.page.url();
      } catch {
        // Page might be closed
      }

      try {
        const buffer = await this.page.screenshot();
        screenshot = buffer.toString('base64');
      } catch {
        // Screenshot might fail
      }
    }

    // Parse error location from stack
    const location = this.parseErrorLocation(error.stack || '');

    return {
      errorMessage: error.message,
      stackTrace: error.stack || '',
      location,
      lastLogs: this.getLastLogs(10),
      pageUrl,
      timestamp: new Date().toISOString(),
      screenshot,
    };
  }

  /**
   * Parse file:line:column from error stack
   */
  private parseErrorLocation(stack: string): { file: string; line: number; column?: number } {
    // Match patterns like "at Object.<anonymous> (/path/to/file.ts:123:45)"
    const match = stack.match(/at .+ \((.+):(\d+):(\d+)\)/);
    if (match) {
      return {
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
      };
    }

    // Match patterns like "at /path/to/file.ts:123:45"
    const simpleMatch = stack.match(/at (.+):(\d+):(\d+)/);
    if (simpleMatch) {
      return {
        file: simpleMatch[1],
        line: parseInt(simpleMatch[2], 10),
        column: parseInt(simpleMatch[3], 10),
      };
    }

    return { file: 'unknown', line: 0 };
  }

  /**
   * Attach logs to test info as annotation (for reporter)
   */
  attachToTest(): void {
    if (this.testInfo && isCI && this.logs.length > 0) {
      this.testInfo.annotations.push({
        type: 'test-logs',
        description: this.getLogsJson(),
      });
    }
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.testStart = Date.now();
  }
}

// Singleton instance for simple usage
let globalLogger: TestLogger | null = null;

export function getLogger(): TestLogger {
  if (!globalLogger) {
    globalLogger = new TestLogger();
  }
  return globalLogger;
}

export function createLogger(options?: TestLoggerOptions): TestLogger {
  return new TestLogger(options);
}

// Export for convenience
export { isCI };
```

### 3. Create Logger Fixture (`fixtures/logger-fixture.ts`)

```typescript
import { test as base, Page, TestInfo } from '@playwright/test';
import { TestLogger, createLogger } from '../utils/test-logger';

// Extend test with logger
export type TestFixtures = {
  logger: TestLogger;
};

export const test = base.extend<TestFixtures>({
  logger: async ({ page }, use, testInfo) => {
    // Create logger for this test
    const logger = createLogger();
    logger.init(testInfo, page);

    // Log test start
    logger.info('test', `Starting: ${testInfo.title}`);

    // Provide logger to test
    await use(logger);

    // After test: attach logs for reporter
    logger.info('test', `Finished: ${testInfo.title}`, {
      status: testInfo.status,
      duration: testInfo.duration,
    });

    logger.attachToTest();
  },
});

export { expect } from '@playwright/test';
```

### 4. Update Base Fixture (`fixtures/base-fixture.ts`)

If you have an existing base fixture, integrate the logger:

```typescript
import { test as base, expect } from '@playwright/test';
import { TestLogger, createLogger } from '../utils/test-logger';

// ... existing fixture types ...

export type TestFixtures = {
  // ... existing fixtures ...
  logger: TestLogger;
};

export const test = base.extend<TestFixtures>({
  // ... existing fixtures ...

  logger: async ({ page }, use, testInfo) => {
    const logger = createLogger();
    logger.init(testInfo, page);
    logger.info('test', `Starting: ${testInfo.title}`);

    await use(logger);

    logger.info('test', `Finished: ${testInfo.status}`);
    logger.attachToTest();
  },
});

export { expect };
```

---

## Usage in Page Objects

### 5. Update Page Object Base Class

```typescript
import { Page } from '@playwright/test';
import { TestLogger, getLogger } from '../utils/test-logger';

export abstract class BasePage {
  protected page: Page;
  protected logger: TestLogger;
  protected pageName: string;

  constructor(page: Page, logger?: TestLogger) {
    this.page = page;
    this.logger = logger || getLogger();
    this.pageName = this.constructor.name;
  }

  protected get source(): string {
    return `page-object:${this.pageName}`;
  }

  // Logging shortcuts
  protected log(message: string, data?: Record<string, unknown>): void {
    this.logger.info(this.source, message, data);
  }

  protected logWarn(message: string, data?: Record<string, unknown>): void {
    this.logger.warn(this.source, message, data);
  }

  protected logError(message: string, error?: Error, data?: Record<string, unknown>): void {
    this.logger.error(this.source, message, error, data);
  }

  protected logMetric(name: string, value: number, unit: string = 'ms'): void {
    this.logger.metric(this.source, name, value, unit);
  }
}
```

### 6. Example Page Object Usage

```typescript
// Before (current)
export class PO_CaseV2 {
  async createCase(fee: number): Promise<string> {
    console.log('Creating case with fee:', fee);
    // ... implementation
    console.log('Case created:', caseId);
    return caseId;
  }
}

// After (with logger)
import { BasePage } from './base-page';

export class PO_CaseV2 extends BasePage {
  async createCase(fee: number): Promise<string> {
    this.log('Creating case', { fee });

    const startTime = Date.now();
    // ... implementation
    const duration = Date.now() - startTime;

    this.log('Case created', { caseId, fee, duration });
    this.logMetric('case-creation-time', duration);

    return caseId;
  }
}
```

---

## Usage in Tests

### 7. Using Logger in Tests

```typescript
import { test, expect } from '../fixtures/logger-fixture';

test('should create and submit case', async ({ page, logger }) => {
  logger.info('test', 'Starting case creation flow');

  const casePage = new PO_CaseV2(page, logger);
  const caseId = await casePage.createCase(500);

  logger.info('test', 'Verifying case appears in list', { caseId });

  await expect(page.getByText(caseId)).toBeVisible();

  logger.info('test', 'Test completed successfully');
});
```

### 8. Error Handling with Logger

```typescript
test('should handle payment error', async ({ page, logger }) => {
  logger.info('test', 'Testing payment error scenario');

  try {
    await paymentPage.submitPayment({ amount: -100 });
    logger.warn('test', 'Expected error was not thrown');
  } catch (error) {
    logger.info('test', 'Caught expected error', {
      message: error.message,
    });
  }

  // On test failure, logs are automatically attached
});
```

---

## Integración con test.step() para Playwright HTML Reports

> [!TIP]
> Combinar `test.step()` con `TestLogger` proporciona lo mejor de ambos mundos: reportes nativos de Playwright + análisis histórico en el dashboard.

### ¿Por qué combinar test.step() + TestLogger?

| Herramienta | Propósito | Ventaja |
|-------------|-----------|---------|
| `test.step()` | Agrupa acciones en HTML report y trace viewer | Visible en reportes nativos de Playwright |
| `TestLogger.info()` | Captura logs estructurados para dashboard | Enviado a API para análisis histórico |

### Patrón Recomendado

```typescript
import { test, expect } from '../fixtures/logger-fixture';

test('should complete negotiation workflow', async ({ page, logger }) => {
  // Cada step es visible en el HTML report de Playwright
  await test.step('Navigate to case page', async () => {
    logger.info('Navigation', 'Navigating to case page');
    await page.goto('/case/123');
    await page.waitForLoadState('domcontentloaded');
    logger.info('Navigation', 'Case page loaded successfully');
  });

  await test.step('Send proposal', async () => {
    logger.info('Proposal', 'Opening proposal modal');
    const casePage = new PO_CaseV2(page, logger);
    await casePage.sendProposal(500);
    logger.info('Proposal', 'Proposal sent successfully', { fee: 500 });
  });

  await test.step('Verify proposal appears', async () => {
    logger.info('Verification', 'Checking proposal visibility');
    await expect(page.getByText('Proposal Sent')).toBeVisible();
    logger.info('Verification', 'Proposal confirmed visible');
  });
});
```

### Migración desde console.log con Emojis

**Antes (patrón actual en Attorney Share):**

```typescript
test('should sign in with valid credentials', async () => {
  console.log('🔐 Testing sign in with admin role');
  await signInPage.signInWithUser(user);
  console.log('✅ Successfully signed in');
});
```

**Después (patrón recomendado):**

```typescript
test('should sign in with valid credentials', async ({ logger }) => {
  await test.step('Sign in as admin', async () => {
    logger.info('Auth', 'Testing sign in with admin role');
    await signInPage.signInWithUser(user);
    logger.info('Auth', 'Successfully signed in');
  });
});
```

### Beneficios de la Combinación

1. **Trace Viewer**: Los steps aparecen como secciones colapsables
2. **HTML Report**: Cada step tiene timing individual
3. **Dashboard**: Logs estructurados con contexto de falla
4. **Local Development**: Output estructurado en consola

### Ejemplo Real (basado en mynetwork-simple.spec.ts)

```typescript
test('should navigate to My Referral Network page', async ({ page, logger }) => {
  const myReferralNetworkPage = new MyReferralNetworkPage(page, logger);

  await test.step('Navigate to My Referral Network', async () => {
    logger.info('Navigation', 'Navigating to My Referral Network page');
    await page.goto('/myNetwork/my-referral-network');
    await page.waitForLoadState('domcontentloaded');
    logger.info('Navigation', 'Page loaded');
  });

  await test.step('Verify page is loaded', async () => {
    logger.info('Verification', 'Checking page loaded state');
    const isLoaded = await myReferralNetworkPage.isLoaded();
    expect(isLoaded).toBe(true);
    logger.info('Verification', 'Page verified successfully');
  });

  await test.step('Verify Network Settings card is visible', async () => {
    logger.info('Verification', 'Checking Network Settings card');
    await expect(myReferralNetworkPage.networkSettingsCard).toBeVisible();
    logger.info('Verification', 'Network Settings card visible');
  });
});
```

---

## Migration Guide

### Replacing console.log

| Before | After |
|--------|-------|
| `console.log('Message')` | `this.log('Message')` |
| `console.log('Data:', data)` | `this.log('Message', { data })` |
| `console.warn('Warning')` | `this.logWarn('Warning')` |
| `console.error('Error', err)` | `this.logError('Error', err)` |

### Gradual Migration

You don't need to migrate all at once:

1. Start with the most important page objects
2. Migrate tests that frequently fail
3. Keep console.log for quick debugging (they still work!)

---

## Behavior Summary

| Environment | `logger.info()` | `logger.error()` | Console Output | Dashboard Send |
|-------------|-----------------|------------------|----------------|----------------|
| **CI** | Captured silently | Captured + console | Errors only | Yes |
| **Local** | Captured + console | Captured + console | Full (structured) | No |

**Key Point**: Both environments use the **same structured log format**:
```
+1234ms [page-object:PO_CaseV2] Creating case { fee: 500 }
+2345ms [page-object:PO_CaseV2] Case created { caseId: "ABC123", duration: 1111 }
```

The difference is only in **where the output goes**:
- **Local**: Displayed in console for debugging
- **CI**: Captured silently and sent to dashboard on test completion

---

## Testing Checklist

- [ ] Logger initializes correctly in fixtures
- [ ] Local mode shows console output
- [ ] CI mode captures logs silently
- [ ] Errors always show in console
- [ ] Logs attach to test annotations
- [ ] Reporter can read logs from annotations
- [ ] Page objects use logger correctly
- [ ] Failure context includes last 10 logs
- [ ] Screenshot captured in failure context
- [ ] Memory usage stays reasonable (500 log limit)

### Verify Local Behavior

```bash
# Run test locally - should see console output
npx playwright test tests/example.spec.ts --reporter=list
```

### Verify CI Behavior

```bash
# Simulate CI - should capture logs
CI=true npx playwright test tests/example.spec.ts --reporter=list
```

---

## Files to Create/Modify

### Create:
- `automation/playwright/utils/logger-types.ts`
- `automation/playwright/utils/test-logger.ts`
- `automation/playwright/fixtures/logger-fixture.ts`

### Modify:
- `automation/playwright/fixtures/base-fixture.ts` - Add logger
- `automation/playwright/page-objects/base-page.ts` - Add logger support
- Individual page objects - Migrate console.log (gradual)

---

## Performance Considerations

1. **Log Limit**: Default 500 logs per test prevents memory issues
2. **Structured Data**: Keep data objects small
3. **Debug Level**: Debug logs only show locally
4. **Lazy Screenshots**: Only captured on failure

---

## Next Steps

After completing this phase:
1. Update base page object
2. Migrate 2-3 key page objects
3. Run tests in both local and CI mode
4. Verify logs appear in dashboard
5. Proceed to [Phase 04: Test Signatures & Search](./04-test-signatures-search.md)

---

*Phase 03 Complete → Proceed to Phase 04: Test Signatures & Search*
