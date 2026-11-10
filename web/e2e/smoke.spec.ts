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

    // Verify one-sentence purpose and honest status
    await expect(page.locator('text=Every tool tells you when a lunar site has light')).toBeVisible();
    const honestStatus = page.locator('[data-testid="first-screen-honest-status"]');
    await expect(honestStatus).toBeVisible();
    await expect(honestStatus).toContainText(/Demo uses (synthetic|LOLA DEM) terrain/);

    // Verify "What is verified" live panel on home page
    const verifiedPanel = page.locator('[data-testid="what-is-verified-panel"]');
    await expect(verifiedPanel).toBeVisible();
    await expect(page.locator('[data-testid="live-count-passed"]')).toContainText('Passed');
    await expect(page.locator('[data-testid="live-count-not-run"]')).toContainText('2 Not Run');
    await expect(verifiedPanel).toContainText('V3');
    await expect(verifiedPanel).toContainText('V4');
    await expect(verifiedPanel).toContainText('V7');
    await expect(verifiedPanel).toContainText('NOT RUN');
    await expect(page.locator('[data-testid="view-trust-page-link"]')).toBeVisible();

    // Verify separate labelled mission headline values with units
    await expect(page.locator('[data-testid="mission-headline-outage"]').first()).toContainText('Longest Earth outage:');
    await expect(page.locator('[data-testid="mission-headline-contact"]').first()).toContainText('Time with Sun and Earth contact:');

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
    await page.waitForSelector('.planner-workspace-grid', { timeout: 15000 });
    await verifyPageState('Route Planner (Demo)');

    // Capture first 10 seconds progression screenshots
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, '02_demo_t2s_infeasible_start.png') });

    // Verify Infeasible at T=0 and Suggested Relaxation banner if initial departure is blocked
    const banner = page.locator('[data-testid="departure-relaxation-banner"]');
    if (await banner.isVisible()) {
      await expect(banner).toContainText('Departure at T=0');
      await expect(banner).toContainText(/is infeasible/i);
      await expect(banner).toContainText('Suggested Relaxation');

      // Click "Apply Suggested Relaxation" (wait until feasible departure)
      console.log('Applying relaxation to depart at feasible step...');
      const relaxBtn = page.locator('[data-testid="apply-relaxation-btn"]');
      if (await relaxBtn.isVisible()) {
        await relaxBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // Press Solve Traverse (A*)
    console.log('Pressing Solve Traverse button...');
    const solveBtn = page.locator('[data-testid="solve-traverse-btn"]');
    await expect(solveBtn).toBeVisible();
    await solveBtn.click();
    await page.waitForTimeout(2000);

    await page.screenshot({ path: path.join(screenshotsDir, '04_demo_t8s_feasible_route.png') });
    await verifyPageState('Route Planner (Solved)');

    // Verify Story Caption & "Explain this route" button with solver numbers
    const storyCaption = page.locator('[data-testid="route-story-caption"]');
    await expect(storyCaption).toBeVisible();
    await expect(storyCaption).toContainText('Scenario Story:');

    const explainBtn = page.locator('[data-testid="explain-route-btn"]');
    await expect(explainBtn).toBeVisible();
    await explainBtn.click();
    await page.waitForTimeout(500);

    const explanationPanel = page.locator('[data-testid="route-explanation-panel"]');
    await expect(explanationPanel).toBeVisible();
    await expect(explanationPanel).toContainText('Distance:');
    await expect(explanationPanel).toContainText('Duration:');
    await expect(explanationPanel).toContainText('Max Slope:');
    await expect(explanationPanel).toContainText('Dark Exposure:');
    await page.screenshot({ path: path.join(screenshotsDir, '08_route_explanation_panel.png') });

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

      const isDisabled = await linkEl.getAttribute('aria-disabled');
      if (isDisabled === 'true') {
        console.log(`Header link ${link.name} is disabled as expected (< 2 analysed sites).`);
        await expect(linkEl).toHaveAttribute('aria-disabled', 'true');
        continue;
      }

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

      // Verify Disc Lens buttons and scale caption in Panorama
      const sunLensBtn = page.locator('[data-testid="lens-sun-btn"]');
      const earthLensBtn = page.locator('[data-testid="lens-earth-btn"]');
      if (await sunLensBtn.isVisible()) {
        await expect(earthLensBtn).toBeVisible();
        await earthLensBtn.click();
        await page.waitForTimeout(500);
        const scaleCaption = page.locator('[data-testid="panorama-scale-caption"]');
        await expect(scaleCaption).toBeVisible();
        await expect(scaleCaption).toContainText('1° horizontally');
        await expect(scaleCaption).toContainText('1° vertically');
        await page.screenshot({ path: path.join(screenshotsDir, '07_disc_lens_panorama.png') });
      }
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

  test('Mobile layout verification at 360px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    // Visit Home screen on 360px mobile
    console.log('Visiting Home screen at 360px mobile viewport...');
    await page.goto('./');
    await page.waitForLoadState('networkidle');

    // Verify no unexpected horizontal page overflow
    const homeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(homeScrollWidth, 'Horizontal scroll overflow on Home at 360px').toBeLessThanOrEqual(365);

    await page.screenshot({ path: path.join(screenshotsDir, '06_mobile_360px_home.png') });

    // Visit Route Planner on 360px mobile
    console.log('Visiting Route Planner at 360px mobile viewport...');
    await page.goto('./#/route/synthetic-proving-ground');
    await page.waitForSelector('.planner-workspace-grid', { timeout: 15000 });
    await page.waitForTimeout(1000);

    const routeScrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(routeScrollWidth, 'Horizontal scroll overflow on Route Planner at 360px').toBeLessThanOrEqual(365);

    await page.screenshot({ path: path.join(screenshotsDir, '09_mobile_360px_route.png') });
  });
});
