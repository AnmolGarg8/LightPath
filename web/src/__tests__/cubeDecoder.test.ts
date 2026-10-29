import { describe, it, expect } from 'vitest';
import * as zlib from 'zlib';
import { decodeLPVCBuffer, decodeVisibilityCube } from '../utils/cubeDecoder';

describe('LPVC Binary Visibility Cube Decoder', () => {
  function makeMockLPVC(nx: number, ny: number, nt: number) {
    const header = Buffer.alloc(12);
    header.write('LPVC', 0, 4, 'ascii');
    header.writeUInt16LE(1, 4); // version
    header.writeUInt16LE(nx, 6);
    header.writeUInt16LE(ny, 8);
    header.writeUInt16LE(nt, 10);

    const cells = nx * ny;
    const timeCells = nt * cells;

    const sun = Buffer.alloc(timeCells, 75); // 75%
    const earth = Buffer.alloc(timeCells, 90); // 90%
    const slope = Buffer.alloc(cells, 12); // 12 deg
    const trav = Buffer.alloc(cells, 1); // traversable

    return Buffer.concat([header, sun, earth, slope, trav]);
  }

  it('correctly decodes uncompressed LPVC buffer', () => {
    const raw = makeMockLPVC(4, 4, 3);
    const decoded = decodeLPVCBuffer(new Uint8Array(raw));

    expect(decoded.version).toBe(1);
    expect(decoded.nx).toBe(4);
    expect(decoded.ny).toBe(4);
    expect(decoded.nt).toBe(3);

    expect(decoded.getSunFrac(0, 0, 0)).toBe(75);
    expect(decoded.getEarthFrac(0, 0, 0)).toBe(90);
    expect(decoded.getSlopeDeg(2, 2)).toBe(12);
    expect(decoded.isTraversable(2, 2)).toBe(true);
  });

  it('correctly decompresses and decodes gzipped LPVC buffer', async () => {
    const raw = makeMockLPVC(5, 5, 2);
    const compressed = zlib.gzipSync(raw);

    const arrayBuffer = compressed.buffer.slice(
      compressed.byteOffset,
      compressed.byteOffset + compressed.byteLength
    );

    const decoded = await decodeVisibilityCube(arrayBuffer);

    expect(decoded.nx).toBe(5);
    expect(decoded.ny).toBe(5);
    expect(decoded.nt).toBe(2);
    expect(decoded.getSunFrac(1, 4, 4)).toBe(75);
    expect(decoded.getSlopeDeg(4, 4)).toBe(12);
  });

  it('rejects invalid magic bytes', () => {
    const badBuf = Buffer.alloc(24, 0);
    badBuf.write('FAIL', 0, 4, 'ascii');

    expect(() => decodeLPVCBuffer(new Uint8Array(badBuf))).toThrow(/Invalid magic header/);
  });

  it('rejects length mismatch', () => {
    const truncated = makeMockLPVC(4, 4, 3).subarray(0, 20);
    expect(() => decodeLPVCBuffer(new Uint8Array(truncated))).toThrow(/size mismatch/);
  });

  it('handles out-of-bounds queries safely', () => {
    const raw = makeMockLPVC(3, 3, 2);
    const decoded = decodeLPVCBuffer(new Uint8Array(raw));

    expect(decoded.getSunFrac(99, 0, 0)).toBe(0);
    expect(decoded.getSlopeDeg(10, 10)).toBe(0);
    expect(decoded.isTraversable(-1, 0)).toBe(false);
  });
});
