import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Compare View Rules and Incompatibility Banner', () => {
  it('CompareView component contains "Not comparable: one site is synthetic" banner logic', () => {
    const compareViewPath = path.resolve(__dirname, '../views/CompareView.tsx');
    const content = fs.readFileSync(compareViewPath, 'utf-8');

    // 1. Banner must exist with exact required text
    expect(content).toContain('Not comparable: one site is synthetic');

    // 2. Terrain check condition
    expect(content).toContain('isDifferentTerrain');
    expect(content).toContain('siteA.terrain_source !== siteB.terrain_source');

    // 3. Advantage column suppression
    expect(content).toContain('!isDifferentTerrain && (');
    expect(content).toContain('Advantage');

    // 4. Analysis window condition for winner sentence
    expect(content).toContain('sameAnalysisWindow');
    expect(content).toContain('showComparativeSummary');
  });

  it('Default comparison pairs the two real test locations', () => {
    const dataLoaderPath = path.resolve(__dirname, '../utils/dataLoader.ts');
    const dataLoaderContent = fs.readFileSync(dataLoaderPath, 'utf-8');

    // Defaults to test-location and test-location-2
    expect(dataLoaderContent).toContain("demoSiteId = demoSite?.id || 'test-location'");
    expect(dataLoaderContent).toContain("secondSiteId = secondSite?.id || 'test-location-2'");

    const demoScriptPath = path.resolve(__dirname, '../data/demoScript.ts');
    const demoScriptContent = fs.readFileSync(demoScriptPath, 'utf-8');
    expect(demoScriptContent).toContain("secondSiteId: string = 'test-location-2'");
  });

  it('Index.json includes both real test locations and synthetic benchmark', () => {
    const indexPath = path.resolve(__dirname, '../../public/data/index.json');
    const indexData = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));

    const testLoc1 = indexData.sites.find((s: any) => s.id === 'test-location');
    const testLoc2 = indexData.sites.find((s: any) => s.id === 'test-location-2');
    const synth = indexData.sites.find((s: any) => s.id === 'synthetic-proving-ground');

    expect(testLoc1).toBeDefined();
    expect(testLoc1.terrain_source).toBe('lola_dem');
    expect(testLoc1.is_synthetic).toBe(false);

    expect(testLoc2).toBeDefined();
    expect(testLoc2.terrain_source).toBe('lola_dem');
    expect(testLoc2.is_synthetic).toBe(false);
    expect(testLoc2.name).toBe('Real terrain test location 2 (not a mission site)');
    expect(testLoc2.lat_deg).toBe(-85.0);
    expect(testLoc2.lon_deg).toBe(30.0);

    expect(synth).toBeDefined();
    expect(synth.terrain_source).toBe('synthetic');
    expect(synth.is_synthetic).toBe(true);
  });
});
