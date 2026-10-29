/**
 * LightPath Binary Visibility Cube Decoder (LPVC)
 * 
 * Unpacks and decompresses gzip-compressed LPVC binary cubes:
 * - 4 bytes: Magic ASCII "LPVC"
 * - 2 bytes: Version (uint16 LE, value 1)
 * - 2 bytes: nx (uint16 LE)
 * - 2 bytes: ny (uint16 LE)
 * - 2 bytes: nt (uint16 LE)
 * - Followed by raw uint8 arrays:
 *   - sun_frac: (nt * ny * nx) bytes
 *   - earth_frac: (nt * ny * nx) bytes
 *   - slope_deg: (ny * nx) bytes
 *   - traversable: (ny * nx) bytes
 */

export interface DecodedVisibilityCube {
  version: number;
  nx: number;
  ny: number;
  nt: number;
  sunFrac: Uint8Array;
  earthFrac: Uint8Array;
  slopeDeg: Uint8Array;
  traversable: Uint8Array;
  getSunFrac: (t: number, y: number, x: number) => number;
  getEarthFrac: (t: number, y: number, x: number) => number;
  getSlopeDeg: (y: number, x: number) => number;
  isTraversable: (y: number, x: number) => boolean;
}

/**
 * Decompress gzipped ArrayBuffer using standard web DecompressionStream.
 */
export async function decompressGzip(buffer: ArrayBuffer): Promise<Uint8Array> {
  if (typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const blob = new Blob([buffer]);
    const decompressedStream = blob.stream().pipeThrough(ds);
    const res = await new Response(decompressedStream).arrayBuffer();
    return new Uint8Array(res);
  }

  throw new Error('DecompressionStream is not supported in this runtime environment.');
}

/**
 * Decode uncompressed LPVC byte buffer into structured typed arrays.
 */
export function decodeLPVCBuffer(uncompressedBytes: Uint8Array): DecodedVisibilityCube {
  if (uncompressedBytes.length < 12) {
    throw new Error(`Invalid LPVC binary: buffer length ${uncompressedBytes.length} < 12 header bytes.`);
  }

  // Read Magic bytes "LPVC"
  const magic = String.fromCharCode(
    uncompressedBytes[0],
    uncompressedBytes[1],
    uncompressedBytes[2],
    uncompressedBytes[3]
  );
  if (magic !== 'LPVC') {
    throw new Error(`Invalid magic header '${magic}'. Expected 'LPVC'.`);
  }

  const view = new DataView(uncompressedBytes.buffer, uncompressedBytes.byteOffset, uncompressedBytes.byteLength);
  const version = view.getUint16(4, true);
  const nx = view.getUint16(6, true);
  const ny = view.getUint16(8, true);
  const nt = view.getUint16(10, true);

  if (version !== 1) {
    throw new Error(`Unsupported LPVC format version ${version}. Only version 1 is supported.`);
  }

  const cellsTotal = nx * ny;
  const timeCellsTotal = nt * cellsTotal;
  const expectedPayloadLength = 12 + 2 * timeCellsTotal + 2 * cellsTotal;

  if (uncompressedBytes.length !== expectedPayloadLength) {
    throw new Error(
      `LPVC byte size mismatch: expected ${expectedPayloadLength} bytes (nx=${nx}, ny=${ny}, nt=${nt}), got ${uncompressedBytes.length} bytes.`
    );
  }

  let offset = 12;

  // 1. sun_frac (nt * ny * nx bytes)
  const sunFrac = uncompressedBytes.subarray(offset, offset + timeCellsTotal);
  offset += timeCellsTotal;

  // 2. earth_frac (nt * ny * nx bytes)
  const earthFrac = uncompressedBytes.subarray(offset, offset + timeCellsTotal);
  offset += timeCellsTotal;

  // 3. slope_deg (ny * nx bytes)
  const slopeDeg = uncompressedBytes.subarray(offset, offset + cellsTotal);
  offset += cellsTotal;

  // 4. traversable (ny * nx bytes)
  const traversable = uncompressedBytes.subarray(offset, offset + cellsTotal);

  return {
    version,
    nx,
    ny,
    nt,
    sunFrac,
    earthFrac,
    slopeDeg,
    traversable,
    getSunFrac: (t: number, y: number, x: number) => {
      if (t < 0 || t >= nt || y < 0 || y >= ny || x < 0 || x >= nx) return 0;
      return sunFrac[t * cellsTotal + y * nx + x];
    },
    getEarthFrac: (t: number, y: number, x: number) => {
      if (t < 0 || t >= nt || y < 0 || y >= ny || x < 0 || x >= nx) return 0;
      return earthFrac[t * cellsTotal + y * nx + x];
    },
    getSlopeDeg: (y: number, x: number) => {
      if (y < 0 || y >= ny || x < 0 || x >= nx) return 0;
      return slopeDeg[y * nx + x];
    },
    isTraversable: (y: number, x: number) => {
      if (y < 0 || y >= ny || x < 0 || x >= nx) return false;
      return traversable[y * nx + x] === 1;
    },
  };
}

/**
 * High-level loader: Decompresses and decodes LPVC binary ArrayBuffer.
 */
export async function decodeVisibilityCube(buffer: ArrayBuffer): Promise<DecodedVisibilityCube> {
  const decompressed = await decompressGzip(buffer);
  return decodeLPVCBuffer(decompressed);
}
