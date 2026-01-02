/**
 * Centralized color utilities for consistent theming across the application.
 * These use CSS custom properties defined in globals.css for easy theme switching.
 */

export const chartColors = {
  passed: "var(--chart-passed)",
  failed: "var(--chart-failed)",
  flaky: "var(--chart-flaky)",
} as const;

export const statusColors = {
  success: "var(--status-success)",
  error: "var(--status-error)",
  warning: "var(--status-warning)",
  info: "var(--status-info)",
} as const;

// Type exports for type-safe color usage
export type ChartColorKey = keyof typeof chartColors;
export type StatusColorKey = keyof typeof statusColors;
