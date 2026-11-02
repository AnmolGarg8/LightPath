import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';
import { DataCatalogSchema, validatePayload, DataValidationError } from '../types/schemas';
import { DataView } from '../views/DataView';

describe('Reusable Open Data & Downloads Suite (/data)', () => {
  const catalogPath = path.resolve(__dirname, '../../public/data/data_catalog.json');

  it('validates production data_catalog.json against DataCatalogSchema', () => {
    expect(fs.existsSync(catalogPath)).toBe(true);
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const validated = validatePayload(DataCatalogSchema, raw, 'data_catalog.json');

    expect(validated.version).toBe('1.0.0');
    expect(validated.total_files).toBe(14);
    expect(validated.files.length).toBe(14);
    expect(validated.license_data).toBe('CC-BY-4.0');
    expect(validated.license_code).toBe('MIT');

    // Consolidated files present
    const consolidatedParquet = validated.files.find((f) => f.filename === 'all_sites_windows.parquet');
    const consolidatedCsv = validated.files.find((f) => f.filename === 'all_sites_windows.csv');
    expect(consolidatedParquet).toBeDefined();
    expect(consolidatedCsv).toBeDefined();
    expect(consolidatedParquet?.format).toBe('Parquet');
    expect(consolidatedCsv?.format).toBe('CSV');
    expect(consolidatedParquet?.rows).toBe(25);
  });

  it('rejects invalid data catalog payloads with DataValidationError', () => {
    const invalidCatalog = {
      version: '1.0.0',
      created_utc: '2026-11-02T04:00:00Z',
      total_files: 1,
      license_data: 'CC-BY-4.0',
      license_code: 'MIT',
      suggested_citation: 'Test',
      files: [
        {
          site_id: 'test-site',
          filename: 'test.xyz',
          rel_path: './data/test.xyz',
          format: 'INVALID_FORMAT', // Invalid format enum
          size_bytes: -10, // Invalid negative size
          sha256: 'short', // Invalid sha256 length
          rows: 1,
          license: 'MIT',
          description: 'test',
        },
      ],
    };

    expect(() => validatePayload(DataCatalogSchema, invalidCatalog, 'invalid.json')).toThrow(
      DataValidationError
    );
  });

  it('renders DataView initial SSR state with header and loading message', () => {
    const html = renderToString(React.createElement(DataView));
    expect(html).toContain('Loading reusable data catalog...');
  });

  it('verifies citation template holds strict human placeholders per Rule 2', () => {
    const cffPath = path.resolve(__dirname, '../../../CITATION.cff');
    expect(fs.existsSync(cffPath)).toBe(true);
    const cffContent = fs.readFileSync(cffPath, 'utf-8');

    // Rule 2 check: Agents must never invent author names or real DOIs
    expect(cffContent).toContain('[Human Contributor 1 - Name to be completed by team]');
    expect(cffContent).toContain('[team-to-fill]');
    expect(cffContent).toContain('10.5281/zenodo.XXXXXXX');
  });

  it('verifies all 14 physical export files exist in public directory with matching sizes', () => {
    const raw = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
    const validated = validatePayload(DataCatalogSchema, raw, 'data_catalog.json');

    for (const file of validated.files) {
      const relPath = file.rel_path.replace(/^\.\//, '');
      const fullPath = path.resolve(__dirname, '../../public', relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      const stat = fs.statSync(fullPath);
      expect(stat.size).toBe(file.size_bytes);
    }
  });
});
