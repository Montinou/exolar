# Exolar QA Reliability Dashboard - Comprehensive Test Plan

## Application Overview

The Exolar QA Reliability Dashboard is a Next.js-based application that provides comprehensive test suite health monitoring. The Reliability page (`/dashboard/reliability`) is a critical feature that displays a 0-100 reliability score calculated from pass rates, flakiness metrics, and duration stability.

### Key Features Tested:
- **Reliability Score Visualization**: Radial gauge chart displaying overall test suite health
- **Dynamic Filtering**: Branch, suite, date range, and historic summary filters
- **Score Breakdown**: Detailed contribution analysis from pass rate, flakiness, and stability
- **Raw Metrics Display**: Pass rate, flaky rate, duration coefficient of variation, and trends
- **Flakiest Tests**: Top failing/unstable tests identification
- **Multi-tenancy**: Organization-based data filtering
- **Real-time Updates**: Dynamic data fetching based on filter selections

### Technical Architecture:
- **Framework**: Next.js 16 with React Server Components
- **Database**: Neon PostgreSQL with organization-level Row-Level Security (RLS)
- **URL Parameters**: `branch`, `suite`, `from`, `to`, `historic`
- **API Endpoint**: `/api/reliability-score`
- **Authentication**: Neon Auth with session-based access control

---

## Test Scenarios

### 1. Page Load and Initial Rendering

**Objective**: Verify the reliability dashboard loads correctly without filters

#### 1.1 Successful Page Load - No Filters
**Preconditions:**
- User is authenticated
- User has access to at least one organization
- Database contains test execution data

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`
2. Wait for page to fully load

**Expected Results:**
- Page loads without errors (no 500/404 status codes)
- Browser console shows no JavaScript errors
- Page header displays "Reliability" title
- Page description shows "Overall health of your test suite"
- BrandLogo icon is visible
- User menu is accessible in top-right corner
- Dashboard navigation tabs are visible
- Loading skeleton appears briefly before content loads
- Reliability score card displays with radial chart
- Score value (0-100) is shown in center of chart
- Status label (healthy/warning/critical) appears below score
- Three metric cards display: Pass Rate, Flaky Rate, Stability
- Week-over-week trend indicator shows with appropriate icon (up/down/neutral)

#### 1.2 Page Load - Unauthenticated User
**Preconditions:**
- User is not logged in

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`

**Expected Results:**
- Page redirects to `/auth/signin`
- No dashboard data is exposed
- Redirect occurs before any database queries execute

#### 1.3 Page Load - No Data Available
**Preconditions:**
- User is authenticated
- Organization has no test execution data

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`

**Expected Results:**
- Page loads successfully
- Reliability score card shows "No data available" message
- Score breakdown cards display zero or N/A values
- No JavaScript errors in console
- Appropriate empty state messaging is displayed

---

### 2. Filter Operations

**Objective**: Verify all filtering mechanisms work correctly

#### 2.1 Branch Filter - Single Selection
**Preconditions:**
- Multiple branches exist in the database (e.g., `main`, `develop`, `feature/auth`)
- User is authenticated

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`
2. Click the "Branch" dropdown filter
3. Select "main" from the dropdown
4. Observe URL and page updates

**Expected Results:**
- URL updates to include `?branch=main` parameter
- Page data refreshes to show only "main" branch data
- Reliability score recalculates based on main branch only
- "Historic Summary" switch appears next to filters
- By default, only the last run from main branch is shown
- "Clear" button appears to reset filters
- No server-side exceptions logged
- Response time is reasonable (< 3 seconds)

#### 2.2 Suite Filter - Single Selection
**Preconditions:**
- Multiple test suites exist (e.g., `e2e`, `integration`, `unit`)
- User is authenticated

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`
2. Click the "Suite" dropdown filter
3. Select "e2e" from the dropdown

**Expected Results:**
- URL updates to include `?suite=e2e` parameter
- Reliability score reflects only "e2e" suite data
- "Historic Summary" switch becomes visible
- Last run only behavior applies by default
- Filter state persists on page refresh

#### 2.3 Combined Branch and Suite Filter
**Preconditions:**
- Test data exists for multiple branch/suite combinations

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`
2. Select "main" from Branch dropdown
3. Select "e2e" from Suite dropdown

**Expected Results:**
- URL contains `?branch=main&suite=e2e`
- Reliability score shows data for main branch + e2e suite only
- Historic Summary toggle is visible
- Data correctly filters to intersection of both filters
- Score updates reflect filtered dataset

#### 2.4 Date Range Filter
**Preconditions:**
- Test executions span multiple days/weeks

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`
2. Click the date range picker
3. Select a 7-day date range (e.g., last week)
4. Click Apply/OK

**Expected Results:**
- URL includes `?from=YYYY-MM-DD&to=YYYY-MM-DD` parameters
- Reliability score recalculates using only data within date range
- Trend comparison (week-over-week) adjusts to selected range
- Date range display shows selected dates in filter bar

#### 2.5 Historic Summary Toggle - OFF (Default)
**Preconditions:**
- Branch or suite filter is applied (e.g., `?branch=main`)

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability?branch=main`
2. Verify "Historic Summary" switch is visible
3. Verify switch is in OFF position by default

**Expected Results:**
- "Historic Summary" switch is visible and unchecked
- URL contains `branch=main` but NO `historic=true` parameter
- Dashboard displays data from LAST RUN ONLY for main branch
- Reliability score reflects single execution metrics
- Flakiness data may be limited due to single-run scope

#### 2.6 Historic Summary Toggle - ON
**Preconditions:**
- Branch filter is applied: `?branch=main`

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability?branch=main`
2. Click "Historic Summary" switch to enable it

**Expected Results:**
- Switch toggles to ON state
- URL updates to `?branch=main&historic=true`
- Dashboard recalculates to show ALL runs for main branch
- Reliability score now aggregates multiple executions
- Flakiness detection becomes more accurate with historical data
- Score and metrics may differ significantly from last-run-only view

#### 2.7 Historic Summary Toggle - Not Visible Without Filter
**Preconditions:**
- No branch or suite filter applied

**Steps:**
1. Navigate to `https://exolar.vercel.app/dashboard/reliability`
2. Observe filter bar

**Expected Results:**
- "Historic Summary" switch is NOT visible
- Switch only appears when `branch` or `suite` parameter exists
- Dashboard shows all data by default (no last-run-only constraint)

#### 2.8 Clear Filters
**Preconditions:**
- Multiple filters are active: `?branch=main&suite=e2e&from=2024-01-01`

**Steps:**
1. Navigate to filtered URL
2. Click the "Clear" button with X icon

**Expected Results:**
- All URL parameters are removed
- URL returns to base `/dashboard/reliability`
- Dashboard resets to show all branches, all suites, all dates
- "Historic Summary" toggle disappears
- "Clear" button disappears
- Reliability score recalculates for full dataset

#### 2.9 Filter Persistence on Refresh
**Preconditions:**
- Filters are applied: `?branch=main&suite=e2e&historic=true`

**Steps:**
1. Apply branch, suite, and historic filters
2. Press F5 or click browser refresh

**Expected Results:**
- Page reloads with same URL parameters
- Filters remain selected in dropdowns
- Historic Summary switch remains checked
- Dashboard data matches pre-refresh state
- No filter reset occurs

---

### 3. Reliability Score Calculations

**Objective**: Verify score computation and display accuracy

#### 3.1 Score Formula Verification
**Preconditions:**
- Known test data with specific metrics (e.g., 80% pass rate, 5% flaky rate, 0.2 CV)

**Steps:**
1. Navigate to reliability page
2. Record displayed Pass Rate, Flaky Rate, and Duration CV
3. Scroll to "How the Score is Calculated" section
4. Manually calculate: `(Pass Rate × 0.4) + ((100 - Flaky Rate) × 0.3) + ((1 - min(CV, 1)) × 100 × 0.3)`

**Expected Results:**
- Formula card displays: `Pass Rate × 0.4 + (100 - Flaky Rate) × 0.3 + Duration Stability × 0.3`
- Score breakdown cards show:
  - Pass Rate Contribution (weighted by 0.4)
  - Flakiness Contribution (weighted by 0.3)
  - Stability Contribution (weighted by 0.3)
- Manual calculation matches displayed score (±1 point for rounding)
- Total contributions sum to displayed score

#### 3.2 Score Status Thresholds
**Preconditions:**
- Ability to view/create test data with varying quality levels

**Steps:**
1. View dashboard with score >= 80
2. View dashboard with score 60-79
3. View dashboard with score < 60

**Expected Results:**
- Score >= 80: Status shows "healthy", color is green (var(--status-success))
- Score 60-79: Status shows "warning", color is yellow (var(--status-warning))
- Score < 60: Status shows "critical", color is red (var(--status-error))
- Radial chart fill color matches status color
- Score value text color matches status color

#### 3.3 Trend Calculation
**Preconditions:**
- Historical data exists for trend comparison

**Steps:**
1. Navigate to reliability page
2. Observe "Week-over-Week" card

**Expected Results:**
- Trend value shows numeric change (e.g., +5, -3, 0)
- Positive trend displays green color with TrendingUp icon
- Negative trend displays red color with TrendingDown icon
- Zero trend displays muted color with Minus icon
- Trend calculation compares current period to previous equivalent period
- Trend appears in both raw metrics section and score card

---

### 4. Score Breakdown Components

**Objective**: Verify detailed metric breakdowns display correctly

#### 4.1 Pass Rate Impact Card
**Steps:**
1. Navigate to reliability page
2. Locate "Pass Rate Impact" card under "Score Breakdown"

**Expected Results:**
- Card displays green CheckCircle2 icon
- Contribution value shown (e.g., "+32")
- Formula displayed: "{passRate}% pass rate × 40% weight"
- Value matches calculation: passRate × 0.4
- Card uses glass-card styling with glow effect

#### 4.2 Flakiness Impact Card
**Steps:**
1. Locate "Flakiness Impact" card

**Expected Results:**
- Card displays yellow AlertTriangle icon
- Contribution value shown (e.g., "+28.5")
- Formula: "{100 - flakyRate}% stable × 30% weight"
- Value matches: (100 - flakyRate) × 0.3
- Displays flakiness as inverse (stability)

#### 4.3 Duration Stability Card
**Steps:**
1. Locate "Duration Stability" card

**Expected Results:**
- Card displays cyan Timer icon
- Contribution value shown (e.g., "+27")
- Formula: "{stability}% consistent × 30% weight"
- Stability calculated as: (1 - min(durationCV, 1)) × 100
- CV (coefficient of variation) is capped at 1.0 for extreme variance

---

### 5. Raw Metrics Display

**Objective**: Verify individual metric cards show correct data

#### 5.1 Overall Score Card
**Steps:**
1. Locate "Overall Score" card in Raw Metrics section

**Expected Results:**
- Score value displayed (0-100)
- Status label shown (healthy/warning/critical)
- Text color matches status threshold
- Value is integer (no decimals)

#### 5.2 Pass Rate Card
**Steps:**
1. Locate "Pass Rate" card

**Expected Results:**
- Percentage value shown (e.g., "85%")
- Subtitle: "Tests passing"
- Green color styling (var(--status-success))
- Value calculated as: (passed tests / total tests) × 100

#### 5.3 Flaky Rate Card
**Steps:**
1. Locate "Flaky Rate" card

**Expected Results:**
- Percentage value shown (e.g., "5%")
- Subtitle: "Tests flaky"
- Yellow/warning color styling
- Flakiness determined by test signature history

#### 5.4 Week-over-Week Trend Card
**Steps:**
1. Locate trend card in Raw Metrics

**Expected Results:**
- Numeric value with +/- prefix (e.g., "+3" or "-2")
- Appropriate trend icon (up/down/neutral)
- Color coding matches trend direction
- Subtitle: "vs previous period"

---

### 6. Flakiest Tests Section

**Objective**: Verify flaky test identification and display

#### 6.1 Flakiest Tests Card Display
**Preconditions:**
- Flaky tests exist in the dataset

**Steps:**
1. Scroll to "Flakiest Tests and Analysis" section
2. Observe FlakiestTestsCard component

**Expected Results:**
- Card displays top flaky tests (typically top 5)
- Each test shows:
  - Test name
  - Flakiness rate (e.g., "60% flaky")
  - Recent failure count
- Tests sorted by flakiness rate (highest first)
- Card respects branch/suite filters if applied

#### 6.2 No Flaky Tests State
**Preconditions:**
- No flaky tests in current filter scope

**Steps:**
1. Apply filters that exclude flaky tests
2. Observe flakiest tests section

**Expected Results:**
- Card displays empty state message
- Message indicates "No flaky tests detected"
- No errors in console
- Card remains visible with appropriate messaging

---

### 7. Responsive Design and Layout

**Objective**: Verify page adapts to different screen sizes

#### 7.1 Desktop View (1920x1080)
**Steps:**
1. Set browser viewport to 1920x1080
2. Navigate to reliability page

**Expected Results:**
- Score breakdown displays in 3-column grid
- Raw metrics display in 4-column grid
- All cards visible without horizontal scroll
- Filters display in single horizontal row
- Chart displays at full size (max-w-md constrained)

#### 7.2 Tablet View (768x1024)
**Steps:**
1. Set viewport to 768x1024
2. Navigate to reliability page

**Expected Results:**
- Score breakdown may wrap to 2 columns
- Raw metrics adjust to 2 columns
- Filters may wrap to multiple rows
- Content remains readable and properly spaced
- No element overflow

#### 7.3 Mobile View (375x667)
**Steps:**
1. Set viewport to 375x667 (iPhone SE)
2. Navigate to reliability page

**Expected Results:**
- Score breakdown displays in single column
- Raw metrics display in single column
- Filters stack vertically
- Chart remains centered and proportional
- Navigation transforms to mobile-friendly layout
- All interactive elements remain accessible
- Text does not truncate inappropriately

---

### 8. API Integration and Error Handling

**Objective**: Verify proper API communication and error states

#### 8.1 Successful API Call
**Preconditions:**
- Valid authentication
- Network connectivity

**Steps:**
1. Open browser DevTools Network tab
2. Navigate to reliability page
3. Observe API requests

**Expected Results:**
- GET request to `/api/reliability-score` returns 200 OK
- Response contains valid JSON with ReliabilityScore structure
- Response includes:
  - `score` (number)
  - `breakdown` object with three contributions
  - `rawMetrics` object with passRate, flakyRate, durationCV
  - `trend` (number)
  - `status` (string)
- Response time < 2 seconds under normal load

#### 8.2 API Error Handling - 500 Server Error
**Preconditions:**
- Simulate database connection failure or query error

**Steps:**
1. Navigate to reliability page while database is unavailable
2. Observe error handling

**Expected Results:**
- ReliabilityScoreCard displays error state
- Error message shows: "Failed to fetch reliability score"
- Activity icon shown with opacity-50
- No uncaught exceptions in console
- Page structure remains intact
- User can retry by refreshing page

#### 8.3 API Error Handling - Timeout
**Preconditions:**
- Simulate slow network or API timeout

**Steps:**
1. Navigate with throttled network
2. Observe loading and timeout behavior

**Expected Results:**
- Loading skeleton displays initially
- If request exceeds reasonable time (30s), error state appears
- User receives feedback about delay
- No infinite loading spinner

#### 8.4 API Call with Filters
**Steps:**
1. Apply filters: `?branch=main&suite=e2e&lastRunOnly=true`
2. Observe API request in Network tab

**Expected Results:**
- API request includes query parameters:
  - `branch=main`
  - `suite=e2e`
  - `lastRunOnly=true`
- Server correctly filters data based on parameters
- Response matches filter scope

---

### 9. Security and Access Control

**Objective**: Verify proper authentication and authorization

#### 9.1 Organization-Level Data Isolation
**Preconditions:**
- Two users in different organizations
- Each org has distinct test data

**Steps:**
1. Log in as User A (Org 1)
2. Note reliability score and test data
3. Log out
4. Log in as User B (Org 2)
5. View reliability page

**Expected Results:**
- User B sees only Org 2 data
- User B cannot see Org 1 data
- Reliability scores differ based on org-specific data
- No data leakage between organizations
- RLS policies enforced at database level

#### 9.2 Session Expiration
**Preconditions:**
- Valid session that can be expired

**Steps:**
1. Log in and view reliability page
2. Invalidate session (e.g., clear cookies or wait for expiration)
3. Refresh page

**Expected Results:**
- Page redirects to `/auth/signin`
- No dashboard data exposed after session expires
- Graceful redirect without errors

#### 9.3 API Key vs Session Auth
**Preconditions:**
- Both session-based and API key auth mechanisms exist

**Steps:**
1. View reliability page via browser (session auth)
2. Attempt direct API call with API key

**Expected Results:**
- Browser access uses session context
- API key access uses service account context with org_id
- Both auth methods respect organization boundaries
- No privilege escalation possible

---

### 10. Performance and Load Testing

**Objective**: Verify page performance under various data volumes

#### 10.1 Large Dataset Performance
**Preconditions:**
- Database contains 10,000+ test executions

**Steps:**
1. Navigate to reliability page without filters
2. Measure page load time

**Expected Results:**
- Initial page load < 3 seconds
- Reliability score API response < 2 seconds
- Database query uses proper indexes
- Pagination or aggregation limits prevent full table scans
- Browser remains responsive during data fetch

#### 10.2 Concurrent User Load
**Preconditions:**
- Multiple users access dashboard simultaneously

**Steps:**
1. Simulate 10+ concurrent users viewing reliability page
2. Monitor server response times

**Expected Results:**
- All users receive data within acceptable time (< 5s)
- No database connection pool exhaustion
- No server errors under normal load
- Cached queries reused where appropriate

#### 10.3 Filter Performance
**Preconditions:**
- Large dataset with multiple branches and suites

**Steps:**
1. Apply branch filter
2. Measure time to data refresh

**Expected Results:**
- Filter application response < 1 second
- API call with filters returns quickly
- Database query optimized with proper WHERE clauses
- UI updates smoothly without janky transitions

---

### 11. Edge Cases and Boundary Conditions

**Objective**: Verify system handles unusual data conditions

#### 11.1 Zero Test Executions
**Preconditions:**
- New organization with no test data

**Steps:**
1. Navigate to reliability page

**Expected Results:**
- No JavaScript errors
- Score card shows "No data available"
- Empty state messaging displayed
- No division by zero errors
- Page structure intact

#### 11.2 All Tests Passing (100% Pass Rate)
**Preconditions:**
- Dataset where all tests pass

**Steps:**
1. View reliability page

**Expected Results:**
- Score approaches maximum (considering flakiness and stability)
- Pass rate contribution = 40 (max)
- Status likely "healthy"
- No calculation errors

#### 11.3 All Tests Failing (0% Pass Rate)
**Preconditions:**
- Dataset where all tests fail

**Steps:**
1. View reliability page

**Expected Results:**
- Score is very low (approaching 0)
- Pass rate contribution = 0
- Status = "critical"
- Red color coding throughout
- No UI breakdown

#### 11.4 Extremely High Flakiness (>50%)
**Preconditions:**
- Majority of tests are flaky

**Steps:**
1. View reliability page

**Expected Results:**
- High flaky rate displayed (e.g., "60%")
- Flakiness contribution is low (negative impact)
- Overall score significantly reduced
- Warning/critical status likely

#### 11.5 Single Test Execution
**Preconditions:**
- Only one test execution exists (lastRunOnly scenario)

**Steps:**
1. Apply branch filter with one execution
2. Disable historic summary

**Expected Results:**
- Reliability score calculates from single run
- Flakiness may not be detectable (insufficient history)
- Duration stability may be N/A or 100%
- Trend data unavailable or shows 0

#### 11.6 Missing Trend Data
**Preconditions:**
- No historical data for previous period comparison

**Steps:**
1. View reliability page for new branch

**Expected Results:**
- Trend shows 0 or N/A
- Minus icon displayed
- Muted color used
- No errors from undefined previous period data

#### 11.7 Extreme Date Range (1 year+)
**Steps:**
1. Select date range from 1 year ago to today
2. Apply filter

**Expected Results:**
- Query executes successfully (may be slower)
- Reliability score aggregates entire year
- API response time remains acceptable (< 5s)
- No timeout errors
- Data visualization remains meaningful

#### 11.8 Invalid URL Parameters
**Steps:**
1. Navigate to: `/dashboard/reliability?branch=nonexistent&suite=invalid`

**Expected Results:**
- Page loads without crashing
- Empty state or zero data displayed
- No 500 errors
- Appropriate "no data" messaging
- Filters show selected values even if no results

#### 11.9 Special Characters in Branch/Suite Names
**Preconditions:**
- Branch named `feature/fix-#123` or suite with spaces `E2E Tests`

**Steps:**
1. Select branch/suite with special characters
2. Observe URL encoding and data fetch

**Expected Results:**
- URL parameters properly encoded (e.g., `%2F` for `/`)
- API correctly decodes parameters
- Data fetches successfully
- No SQL injection vulnerabilities

---

### 12. Accessibility Testing

**Objective**: Verify page meets accessibility standards (WCAG 2.1 AA)

#### 12.1 Keyboard Navigation
**Steps:**
1. Navigate to reliability page
2. Use Tab key to navigate through interactive elements
3. Use Enter/Space to activate controls

**Expected Results:**
- All interactive elements reachable via keyboard
- Focus indicators visible on all focusable elements
- Dropdowns operable with keyboard
- Switch toggles work with Space/Enter
- Clear button accessible via keyboard
- Logical tab order maintained

#### 12.2 Screen Reader Compatibility
**Preconditions:**
- Screen reader software available (NVDA, JAWS, VoiceOver)

**Steps:**
1. Enable screen reader
2. Navigate through reliability page

**Expected Results:**
- Page title announced: "Reliability - Exolar QA"
- Headings properly announced (h1, h2)
- Score value and status read aloud
- Metric cards have descriptive labels
- Chart data accessible via text alternatives
- Filter controls properly labeled
- ARIA attributes used correctly

#### 12.3 Color Contrast
**Steps:**
1. Use browser DevTools or contrast checker
2. Verify text/background color ratios

**Expected Results:**
- All text meets 4.5:1 contrast ratio (AA standard)
- Status colors (green/yellow/red) distinguishable
- Chart elements have sufficient contrast
- Focus indicators visible against backgrounds
- Glass card text readable

#### 12.4 Zoom and Text Scaling
**Steps:**
1. Set browser zoom to 200%
2. Navigate page

**Expected Results:**
- Content reflows appropriately
- No horizontal scrolling required
- Text remains readable
- Interactive elements remain clickable
- Layout does not break

---

### 13. State Management and Synchronization

**Objective**: Verify proper state handling across components

#### 13.1 Filter State Sync
**Steps:**
1. Apply branch filter
2. Apply suite filter
3. Toggle historic summary
4. Observe all components update

**Expected Results:**
- ReliabilityScoreCard receives updated props
- API call includes all active filters
- FlakiestTestsCard filters match
- URL parameters sync with component state
- No stale data displayed

#### 13.2 Concurrent Filter Changes
**Steps:**
1. Rapidly change branch dropdown
2. Immediately change suite dropdown
3. Quickly toggle historic summary

**Expected Results:**
- Only final filter state persists
- No race conditions between API calls
- Latest request supersedes previous requests
- UI updates reflect final filter state
- No duplicate API calls

#### 13.3 Back/Forward Browser Navigation
**Steps:**
1. Apply filters: `?branch=main`
2. Change to: `?branch=develop`
3. Click browser Back button
4. Click Forward button

**Expected Results:**
- Browser history maintains filter states
- Back returns to `?branch=main` view
- Forward returns to `?branch=develop` view
- Data refreshes correctly for each history state
- No stale data from previous states

---

### 14. Integration with Dashboard Navigation

**Objective**: Verify reliability page integrates with broader dashboard

#### 14.1 Navigation to Other Dashboard Pages
**Steps:**
1. From reliability page, click "Performance" in nav
2. Return to reliability page

**Expected Results:**
- Navigation smooth without errors
- Reliability page filters preserved in URL
- Returning to reliability restores previous filter state
- No data loss during navigation

#### 14.2 Search Tests Feature
**Steps:**
1. Click "Search Tests" button in header
2. Search for a test name
3. Return to main view

**Expected Results:**
- Search modal opens
- Search functionality works
- Returning to reliability page maintains state
- No conflicts between search and reliability filters

#### 14.3 Admin Link Visibility
**Preconditions:**
- User has admin role

**Steps:**
1. View reliability page as admin
2. Observe admin link in header

**Expected Results:**
- Admin link visible for authorized users
- Link functions correctly
- Non-admin users do not see link

---

### 15. Formula Explanation Card

**Objective**: Verify educational content displays correctly

#### 15.1 Formula Display
**Steps:**
1. Scroll to "How the Score is Calculated" card

**Expected Results:**
- Card shows Activity icon (cyan)
- Formula displayed in monospace font:
  - "Pass Rate × 0.4" in green
  - "(100 - Flaky Rate) × 0.3" in yellow
  - "Duration Stability × 0.3" in cyan
- Background styled as `bg-muted/20`
- Rounded corners applied

#### 15.2 Explanation Text
**Steps:**
1. Read explanation paragraph

**Expected Results:**
- Text explains:
  - Pass rate weighted at 40%
  - Flakiness and stability each at 30%
  - Score thresholds: 80+ healthy, 60-79 warning, <60 critical
- Text uses muted-foreground color
- Font size appropriate (text-sm)

---

### 16. Visual Polish and Styling

**Objective**: Verify visual consistency with design system

#### 16.1 Glass Card Effect
**Steps:**
1. Observe all metric cards

**Expected Results:**
- Cards use `glass-card` and `glass-card-glow` classes
- Backdrop blur effect visible
- Subtle glow on hover (if applicable)
- Semi-transparent background
- Consistent across all cards

#### 16.2 Color Theming
**Steps:**
1. Check color usage throughout page

**Expected Results:**
- Status colors use CSS variables:
  - `--status-success` for green
  - `--status-warning` for yellow
  - `--status-error` for red
  - `--exolar-cyan` for brand color
- Dark/light mode compatible (if theme toggle exists)
- Colors consistent with overall dashboard

#### 16.3 Icon Consistency
**Steps:**
1. Observe all icons (lucide-react)

**Expected Results:**
- CheckCircle2 for pass rate (green)
- AlertTriangle for flakiness (yellow)
- Timer for duration (cyan)
- Activity for score/formula (cyan)
- TrendingUp/Down/Minus for trends
- Icons sized appropriately (h-4 w-4, h-5 w-5)

---

### 17. Server-Side Rendering (SSR) Verification

**Objective**: Verify Next.js SSR behavior

#### 17.1 Initial HTML Response
**Steps:**
1. View page source (Ctrl+U)
2. Check for pre-rendered content

**Expected Results:**
- HTML contains page structure before JS loads
- Headers and navigation present in initial HTML
- Loading skeletons may be in initial HTML
- JavaScript hydrates existing content
- No flash of unstyled content (FOUC)

#### 17.2 Dynamic Directive
**Steps:**
1. Check page implementation

**Expected Results:**
- `export const dynamic = "force-dynamic"` set
- Page always renders on server (no static generation)
- Fresh data on every request
- No stale cached data served

---

### 18. Suspense Boundaries

**Objective**: Verify React Suspense error boundaries work

#### 18.1 Loading State During Data Fetch
**Steps:**
1. Throttle network to Slow 3G
2. Navigate to reliability page
3. Observe loading state

**Expected Results:**
- `ReliabilitySkeleton` component displays
- Skeleton shows structure of final content
- Multiple skeleton cards animate (pulse effect)
- No layout shift when real data loads
- Smooth transition from skeleton to data

#### 18.2 Error Boundary on Component Failure
**Preconditions:**
- Simulate component error (e.g., corrupt data response)

**Steps:**
1. Trigger component error
2. Observe error handling

**Expected Results:**
- Error boundary catches exception
- User-friendly error message displayed
- Page structure remains intact
- No white screen of death
- Error logged to console for debugging

---

## Test Data Requirements

To execute this test plan comprehensively, the following test data is required:

### Minimum Dataset:
- **Organizations**: At least 2 organizations with distinct data
- **Branches**: Minimum 3 branches (e.g., `main`, `develop`, `feature/test`)
- **Suites**: Minimum 2 suites (e.g., `e2e`, `integration`)
- **Test Executions**:
  - At least 10 executions per branch/suite combination
  - Mix of success/failure statuses
  - Spanning at least 30 days for trend analysis
- **Test Results**:
  - At least 50 individual test results
  - Mix of passed, failed, skipped statuses
  - At least 5 tests with flaky behavior (multiple status changes)
  - Variety of durations (fast: <1s, medium: 1-10s, slow: >10s)

### Edge Case Data:
- One organization with zero executions (empty state)
- One branch with 100% pass rate
- One branch with 0% pass rate
- One suite with >50% flaky rate
- Branch/suite names with special characters (`feature/fix-#123`, `E2E Tests`)

---

## Environment Requirements

### Browser Support:
- **Primary**: Chrome/Chromium (latest)
- **Secondary**: Firefox (latest), Safari (latest), Edge (latest)
- **Mobile**: Safari iOS, Chrome Android

### Network Conditions:
- Fast 3G (for performance baseline)
- Slow 3G (for loading state testing)
- Offline (for error handling)

### Authentication:
- Valid Neon Auth session
- Test users with different roles (viewer, admin)
- Users in multiple organizations

### Database:
- Neon PostgreSQL instance
- RLS policies enabled
- Test data seeded as per requirements above

---

## Test Execution Strategy

### Priority Levels:
1. **P0 (Critical)**: Page load, authentication, data accuracy
2. **P1 (High)**: Filtering, API integration, error handling
3. **P2 (Medium)**: Responsive design, accessibility, visual polish
4. **P3 (Low)**: Edge cases, extreme data volumes

### Automation Approach:
- **E2E Tests (Playwright)**: Core user flows (page load, filters, navigation)
- **Integration Tests**: API endpoint testing
- **Unit Tests**: Score calculation logic
- **Manual Testing**: Visual QA, accessibility, cross-browser

### Smoke Test Suite (10 scenarios):
1. Successful page load
2. Branch filter application
3. Historic summary toggle
4. Reliability score display
5. API error handling
6. Mobile responsive view
7. Clear filters
8. Filter persistence on refresh
9. Organization data isolation
10. Unauthenticated redirect

---

## Success Criteria

A test scenario passes if:
1. All expected results are met
2. No JavaScript errors in console
3. No server-side exceptions logged
4. Response times meet performance targets
5. Data accuracy verified against database queries
6. Visual appearance matches design specifications
7. Accessibility standards met (WCAG 2.1 AA)

## Failure Classification

### Severity Levels:
- **Critical (S1)**: Page crash, data leakage, authentication bypass
- **High (S2)**: Incorrect calculations, broken filters, API failures
- **Medium (S3)**: UI glitches, slow performance, accessibility issues
- **Low (S4)**: Minor visual inconsistencies, edge case handling

---

## Test Environment Setup

### Prerequisites:
1. Deploy application to `https://exolar.vercel.app`
2. Ensure `DATABASE_URL` points to test Neon instance
3. Seed test data as per requirements
4. Configure authentication with test users
5. Enable browser DevTools for network/console monitoring

### Test Accounts:
- **Admin User**: admin@exolar-qa.test (Org: Exolar QA)
- **Viewer User**: viewer@exolar-qa.test (Org: Exolar QA)
- **External User**: external@company.test (Org: Company X)

---

## Reporting

### Bug Report Template:
```
**Title**: [Component] Brief description
**Severity**: S1/S2/S3/S4
**Scenario**: Test scenario number and name
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3
**Expected Result**: What should happen
**Actual Result**: What actually happened
**Environment**: Browser, OS, viewport size
**Screenshots/Logs**: Attach relevant media
**Additional Context**: Any other relevant info
```

### Test Execution Report:
- Total scenarios executed
- Pass/Fail/Blocked count
- Critical bugs found
- Performance metrics
- Recommendations for improvements

---

## Notes for Testers

1. **Always clear browser cache** before starting a new test session to ensure fresh state
2. **Monitor browser console** for warnings/errors even when tests appear to pass
3. **Use DevTools Network tab** to verify API calls and responses
4. **Take screenshots** of any unexpected behavior for bug reports
5. **Test with real data volumes** when possible (not just minimal test data)
6. **Verify database queries** match expected filters (check query logs if available)
7. **Test auth edge cases**: expired sessions, invalid tokens, missing org membership
8. **Pay attention to loading states**: ensure they appear appropriately, not too briefly or too long
9. **Validate URL parameter handling**: ensure no XSS vulnerabilities via query params
10. **Check mobile gestures**: swipe, pinch-to-zoom (if applicable)

---

## Appendix: API Contract

### GET `/api/reliability-score`

**Query Parameters:**
- `branch` (string, optional): Filter by branch name
- `suite` (string, optional): Filter by test suite
- `from` (string, optional): Start date (ISO 8601: YYYY-MM-DD)
- `to` (string, optional): End date (ISO 8601: YYYY-MM-DD)
- `lastRunOnly` (boolean, optional): Show only last run when branch/suite filtered

**Response (200 OK):**
```json
{
  "score": 85,
  "breakdown": {
    "passRateContribution": 34,
    "flakinessContribution": 28.5,
    "stabilityContribution": 22.5
  },
  "rawMetrics": {
    "passRate": 85,
    "flakyRate": 5,
    "durationCV": 0.25
  },
  "trend": 3,
  "status": "healthy"
}
```

**Error Responses:**
- `401 Unauthorized`: No valid session
- `403 Forbidden`: User lacks org access
- `500 Internal Server Error`: Database/calculation failure

---

## Document Metadata

- **Version**: 1.0
- **Created**: 2026-01-08
- **Author**: QA Test Planning Agent
- **Target Application**: Exolar QA Reliability Dashboard
- **Target URL**: https://exolar.vercel.app/dashboard/reliability
- **Framework**: Next.js 16, React 19, Neon PostgreSQL
- **Total Scenarios**: 68 detailed test cases across 18 categories
- **Estimated Execution Time**: 8-12 hours (full manual execution)
- **Automation Potential**: ~60% (core flows and API tests)

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-08 | QA Agent | Initial comprehensive test plan created |

---

**End of Test Plan**
