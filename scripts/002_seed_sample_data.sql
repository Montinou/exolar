-- Seed sample E2E test data for demonstration
INSERT INTO test_executions (
  run_id, branch, commit_sha, commit_message, triggered_by, status, 
  total_tests, passed, failed, skipped, duration_ms, started_at, completed_at
) VALUES 
  ('1234567890', 'main', 'a1b2c3d', 'feat: add new checkout flow', 'github-actions[bot]', 'success', 45, 45, 0, 0, 125000, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 58 minutes'),
  ('1234567891', 'main', 'e4f5g6h', 'fix: resolve payment integration bug', 'github-actions[bot]', 'failure', 45, 42, 3, 0, 132000, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours 58 minutes'),
  ('1234567892', 'develop', 'i7j8k9l', 'test: update e2e suite', 'github-actions[bot]', 'success', 45, 44, 0, 1, 118000, NOW() - INTERVAL '8 hours', NOW() - INTERVAL '7 hours 58 minutes'),
  ('1234567893', 'feature/auth', 'm0n1o2p', 'feat: implement OAuth login', 'github-actions[bot]', 'failure', 45, 40, 5, 0, 140000, NOW() - INTERVAL '12 hours', NOW() - INTERVAL '11 hours 58 minutes'),
  ('1234567894', 'main', 'q3r4s5t', 'chore: update dependencies', 'github-actions[bot]', 'success', 45, 45, 0, 0, 122000, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day' + INTERVAL '2 minutes');

-- Insert test results for the failed execution
INSERT INTO test_results (
  execution_id, test_name, test_file, status, duration_ms, is_critical, 
  error_message, stack_trace, browser, started_at, completed_at
) VALUES
  (2, 'should complete checkout flow', 'tests/checkout.spec.ts', 'failed', 5500, true, 
   'Error: Timeout 5000ms exceeded waiting for element to be visible', 
   'Error: Timeout 5000ms exceeded\n    at Timeout._onTimeout (tests/checkout.spec.ts:42:15)\n    at listOnTimeout (internal/timers.js:549:17)', 
   'chromium', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '5.5 seconds'),
  (2, 'should handle payment processing', 'tests/payment.spec.ts', 'failed', 3200, true,
   'Error: Expected status code 200 but got 500',
   'Error: Expected 200 but got 500\n    at PaymentTest.verify (tests/payment.spec.ts:78:12)\n    at PaymentTest.run (tests/payment.spec.ts:65:8)',
   'chromium', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '3.2 seconds'),
  (2, 'should display order confirmation', 'tests/confirmation.spec.ts', 'failed', 2100, false,
   'Error: Element not found: [data-testid="order-number"]',
   'Error: Element not found\n    at Page.locator (tests/confirmation.spec.ts:23:8)',
   'chromium', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '2.1 seconds');

-- Insert some passing tests for the failed execution
INSERT INTO test_results (
  execution_id, test_name, test_file, status, duration_ms, is_critical, browser, started_at, completed_at
) VALUES
  (2, 'should load homepage', 'tests/home.spec.ts', 'passed', 1200, false, 'chromium', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '1.2 seconds'),
  (2, 'should navigate to products', 'tests/navigation.spec.ts', 'passed', 1800, false, 'chromium', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '1.8 seconds');

-- Insert artifacts for failed tests
INSERT INTO test_artifacts (test_result_id, type, r2_key, r2_url, file_size_bytes, mime_type) VALUES
  (1, 'video', 'videos/1234567891/checkout-failed.webm', 'https://r2.example.com/videos/1234567891/checkout-failed.webm', 2457600, 'video/webm'),
  (1, 'trace', 'traces/1234567891/checkout-failed.zip', 'https://r2.example.com/traces/1234567891/checkout-failed.zip', 524288, 'application/zip'),
  (2, 'video', 'videos/1234567891/payment-failed.webm', 'https://r2.example.com/videos/1234567891/payment-failed.webm', 1843200, 'video/webm'),
  (2, 'trace', 'traces/1234567891/payment-failed.zip', 'https://r2.example.com/traces/1234567891/payment-failed.zip', 458752, 'application/zip');
