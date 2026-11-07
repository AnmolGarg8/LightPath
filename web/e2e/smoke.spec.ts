import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('LightPath End-to-End Production Smoke Suite', () => {
  const screenshotsDir = path.resolve(__dirname, '..', 'e2e-screenshots');

  test.beforeAll(() => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('Subfolder static hosting, navigation, demo path & contract verification', async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    const failedResponses: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    page.on('requestfailed', (req) => {
      // Ignore aborts caused by navigation
      if (req.failure()?.errorText !== 'net::ERR_ABORTED') {
        failedRequests.push(`${req.url()} (${req.failure()?.errorText})`);
      }
    });

    page.on('response', (res) => {
      if (res.status() >= 400) {
        failedResponses.push(`${res.url()} [HTTP ${res.status()}]`);
      }
    });

    const verifyPageState = async (pageName: string) => {
      const bodyText = (await page.textContent('body')) || '';
      expect(bodyText, `Data Contract Failure detected on page: ${pageName}`).not.toContain('Data Contract Failure');
      expect(pageErrors, `Page errors on ${pageName}`).toEqual([]);
      expect(failedRequests, `Failed requests on ${pageName}`).toEqual([]);
      expect(failedResponses, `Failed HTTP responses (>=400) on ${pageName}`).toEqual([]);
    };

    // 1. Load Home Screen in Subfolder
    console.log('Visiting Home screen at /LightPath/ ...');
    await page.goto('./');
    await page.waitForLoadState('networkidle');
    await verifyPageState('Home');
    await page.screenshot({ path: path.join(screenshotsDir, '01_home_screen.png'), fullPage: true });

    // Verify one-sentence purpose
    await expect(page.locator('text=Every tool tells you when a lunar site has light')).toBeVisible();

    // Verify Mission Cards do NOT link to uncomputed sites
    const unavailCards = page.locator('[data-testid="site-data-unavailable"]');
    await expect(unavailCards.first()).toBeVisible();

    // Verify Candidate Sites section is present
    await expect(page.locator('[data-testid="candidate-sites-section"]')).toBeVisible();

    // 2. Click "Try the demo" button (< 10 seconds meaningful result)
    console.log('Clicking "Try the demo" button...');
    const demoBtn = page.locator('[data-testid="try-the-demo-btn"]');
    await expect(demoBtn).toBeVisible();
    await demoBtn.click();

    // Wait for Route Planner to load
    await page.waitForSelector('.planner-workspace-grid, canvas', { timeout: 10000 });
    await verifyPageState('Route Planner (Demo)');

    // Capture first 10 seconds progression screenshots
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, '02_demo_t2s_infeasible_start.png') });

    // Verify Infeasible at T=0 and Suggested Relaxation banner are rendered
    const banner = page.locator('[data-testid="departure-relaxation-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Departure at T=0');
    await expect(banner).toContainText('is Infeasible');
    await expect(banner).toContainText('Suggested Relaxation');

    // Verify Departure Window Map is visible
    await expect(page.locator('h3:has-text("Departure Window Map")')).toBeVisible();

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(screenshotsDir, '03_demo_t5s_relaxation_banner.png') });

    // Click "Apply Suggested Relaxation" (wait until feasible departure)
    console.log('Applying relaxation to depart at feasible step...');
    const relaxBtn = page.locator('[data-testid="apply-relaxation-btn"]');
    if (await relaxBtn.isVisible()) {
      await relaxBtn.click();
      await page.waitForTimeout(1000);
    }

    // Press Solve Traverse (A*)
    console.log('Pressing Solve Traverse button...');
    const solveBtn = page.locator('[data-testid="solve-traverse-btn"]');
    await expect(solveBtn).toBeVisible();
    await solveBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(screenshotsDir, '04_demo_t8s_feasible_route.png') });
    await verifyPageState('Route Planner (Solved)');

    // 3. Click every Header navigation link
    const headerLinks = [
      { name: 'Mission Browser', selector: 'header a:has-text("Mission Browser")' },
      { name: 'Compare Sites', selector: 'header a:has-text("Compare Sites")' },
      { name: 'Area Scan', selector: 'header a:has-text("Area Scan")' },
      { name: 'Route Planner', selector: 'header a:has-text("Route Planner")' },
      { name: 'Compare Scenarios', selector: 'header a:has-text("Compare Scenarios")' },
      { name: 'How It Works', selector: 'header a:has-text("How It Works")' },
      { name: 'Mission Replay', selector: 'header a:has-text("Mission Replay")' },
      { name: 'Trust & Benchmarks', selector: 'header a:has-text("Trust & Benchmarks")' },
      { name: 'Data & Downloads', selector: 'header a:has-text("Data & Downloads")' },
    ];

    for (const link of headerLinks) {
      console.log(`Navigating to header link: ${link.name}...`);
      const linkEl = page.locator(link.selector).first();
      await expect(linkEl).toBeVisible();
      await linkEl.click();
      await page.waitForTimeout(1000);
      await verifyPageState(link.name);
    }

    // 4. Return to Home and click every "Analyze Site" link for computed sites
    console.log('Testing Analyze Site links on computed sites...');
    await page.goto('./#/');
    await page.waitForLoadState('networkidle');

    // Find all "Analyze Site" links
    const analyzeButtons = page.locator('a:has-text("Analyze Site")');
    const count = await analyzeButtons.count();
    console.log(`Found ${count} Analyze Site links.`);
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await page.goto('./#/');
      await page.waitForLoadState('networkidle');
      const btn = page.locator('a:has-text("Analyze Site")').nth(i);
      await btn.click();
      await page.waitForTimeout(1000);
      await verifyPageState(`Site Detail (${i})`);
    }

    // 5. Open Evidence View
    console.log('Navigating to Evidence view...');
    await page.goto('./#/evidence/synthetic-proving-ground');
    await page.waitForTimeout(1500);
    await verifyPageState('Evidence View');
    await page.screenshot({ path: path.join(screenshotsDir, '05_evidence_card.png') });

    // 6. Check console errors (ignoring benign worker termination or favicon warnings)
    const seriousConsoleErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('net::ERR_ABORTED')
    );
    expect(seriousConsoleErrors, 'Console errors encountered').toEqual([]);

    console.log('Smoke test passed with 0 contract failures, 0 page errors, and 0 failed requests!');
  });
});
