import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('web/index.html Metadata Acceptance Tests', () => {
  const htmlPath = path.resolve(__dirname, '..', '..', 'index.html');

  it('verifies meta description requirements strictly', () => {
    expect(fs.existsSync(htmlPath)).toBe(true);
    const html = fs.readFileSync(htmlPath, 'utf8');

    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    expect(descMatch).not.toBeNull();
    const description = descMatch![1].trim();
    const descLower = description.toLowerCase();

    // Requires the word 'Prototype'
    expect(descLower).toContain('prototype');

    // Fails if contains 'continuous'
    expect(descLower).not.toContain('continuous');

    // Fails if contains 'across lunar south-pole clps landing sites'
    expect(descLower).not.toContain('across lunar south-pole clps landing sites');

    // Fails if contains mission names
    const forbiddenMissions = [
      'viper',
      'artemis',
      "chang'e",
      'chandrayaan',
      'apollo',
      'blue ghost',
      'griffin',
      'im-1',
      'im-2',
      'im-3',
    ];
    for (const mission of forbiddenMissions) {
      const regex = new RegExp(`\\b${mission}\\b`, 'i');
      expect(regex.test(description)).toBe(false);
    }

    // Verify Open Graph and Twitter tags
    expect(html).toContain('property="og:title"');
    expect(html).toContain('property="og:description"');
    expect(html).toContain('name="twitter:description"');
  });
});
