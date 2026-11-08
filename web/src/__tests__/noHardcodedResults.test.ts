import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('No typed-in scientific results in web/src', () => {
  const srcDir = path.resolve(__dirname, '..');

  function getFiles(dir: string): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
          files = files.concat(getFiles(fullPath));
        }
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it('ensures no source file under web/src contains hard-coded hours-and-percent result patterns', () => {
    const files = getFiles(srcDir);
    expect(files.length).toBeGreaterThan(5);

    // Forbidden patterns representing typed-in scientific results:
    // e.g. "337.0 h of 360.0 h (94%)" or "Longest Earth outage: 12.0 h"
    const forbiddenPatterns: Array<{ name: string; regex: RegExp }> = [
      {
        name: 'Typed hours-of-hours with percentage (e.g. "337.0 h of 360.0 h (94%)")',
        regex: /\d+(\.\d+)?\s*h\s+of\s+\d+(\.\d+)?\s*h\s*\(\d+%\)/i,
      },
      {
        name: 'Hardcoded longest Earth outage string (e.g. "Longest Earth outage: 0.0 h")',
        regex: /Longest Earth outage:\s*\d+(\.\d+)?\s*h/i,
      },
      {
        name: 'Hardcoded sun and Earth contact string (e.g. "Time with Sun and Earth contact: 337")',
        regex: /Time with Sun and Earth contact:\s*\d+(\.\d+)?\s*h/i,
      },
    ];

    const violations: string[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(srcDir, file).replace(/\\/g, '/');

      for (const pattern of forbiddenPatterns) {
        if (pattern.regex.test(content)) {
          violations.push(`${relPath}: matches forbidden pattern [${pattern.name}]`);
        }
      }
    }

    expect(
      violations,
      `Found hardcoded scientific results in web/src:\n${violations.join('\n')}\nRule: All headline results must be dynamically computed from site stats.json.`
    ).toEqual([]);
  });
});
