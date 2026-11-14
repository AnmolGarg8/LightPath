import datetime
import math
import os

import pyproj
import rasterio
import requests

os.makedirs('logs', exist_ok=True)
os.makedirs('docs', exist_ok=True)

sites = [
    ('Site01', 'Connecting ridge'),
    ('Site04', 'Shackleton rim'),
    ('Site07', 'Peak near Shackleton'),
    ('Site11', 'de Gerlache rim'),
    ('Site20', 'Leibnitz beta plateau'),
    ('Site23', 'Malapert massif'),
]

base_url = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp'
source_page = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/'
system_date = datetime.date.today().isoformat()

# Target projection: longlat on R=1737400
tgt_crs = pyproj.CRS('+proj=longlat +R=1737400 +no_defs')

results = []
raw_log_lines = []

raw_log_lines.append('=== NASA LOLA 5mpp Sites Sourced Analysis ===')
raw_log_lines.append(f'Run date: {system_date}')
raw_log_lines.append(f'Source page: {source_page}\n')

# 20m and 80m layers bounds
r_circ = 304000.0  # 80 deg S radius in polar stereographic projection

for site_id, name_page in sites:
    fn = f'{site_id}_final_adj_5mpp_surf.tif'
    url = f'{base_url}/{site_id}/{fn}'
    vsi_url = f'/vsicurl/{url}'

    raw_log_lines.append('--------------------------------------------------')
    raw_log_lines.append(f'Site: {site_id} ({name_page})')
    raw_log_lines.append(f'URL: {url}')

    # 1. HTTP HEAD
    head_resp = requests.head(url, timeout=20)
    http_status = head_resp.status_code
    http_size = int(head_resp.headers.get('Content-Length', 0))
    raw_log_lines.append(f'HTTP HEAD status: {http_status}, size: {http_size} bytes')

    # 2. Rasterio Header Read
    with rasterio.open(vsi_url) as src:
        crs_wkt = src.crs.to_wkt()
        src_crs = src.crs
        width, height = src.width, src.height
        bounds = src.bounds
        res = src.res
        dtype = src.dtypes[0]
        nodata = src.nodata
        scales = src.scales
        offsets = src.offsets

        # Center coordinates in projected meters
        cx_m = (bounds.left + bounds.right) / 2.0
        cy_m = (bounds.bottom + bounds.top) / 2.0
        tile_w_m = bounds.right - bounds.left
        tile_h_m = bounds.top - bounds.bottom

        # Read 3x3 at center
        col_idx = width // 2
        row_idx = height // 2
        win = rasterio.windows.Window(col_idx - 1, row_idx - 1, 3, 3)
        center_block = src.read(1, window=win)
        center_val = float(center_block[1, 1])

        raw_log_lines.append(f'CRS: {src.crs.to_string()}')
        raw_log_lines.append(f'Dimensions: {width} x {height} pixels')
        raw_log_lines.append(f'Pixel size: {res[0]} m x {res[1]} m')
        raw_log_lines.append(f'Bounds (m): left={bounds.left}, bottom={bounds.bottom}, right={bounds.right}, top={bounds.top}')
        raw_log_lines.append(f'Data type: {dtype}, Nodata: {nodata}, Scale: {scales[0]}, Offset: {offsets[0]}')
        raw_log_lines.append(f'Tile size (m): {tile_w_m:.1f} m wide x {tile_h_m:.1f} m high')
        raw_log_lines.append(f'Center projected (m): x={cx_m:.1f}, y={cy_m:.1f}')
        raw_log_lines.append(f'Center 3x3 pixel surface heights (m):\n{center_block}')
        raw_log_lines.append(f'Center pixel height: {center_val:.4f} m')

        # 3. Coordinate conversion with pyproj
        transformer = pyproj.Transformer.from_crs(src_crs, tgt_crs, always_xy=True)
        center_lon, center_lat = transformer.transform(cx_m, cy_m)

        corners_m = [
            ('bottom-left', bounds.left, bounds.bottom),
            ('bottom-right', bounds.right, bounds.bottom),
            ('top-right', bounds.right, bounds.top),
            ('top-left', bounds.left, bounds.top),
        ]
        corners_geo = []
        for cname, cmx, cmy in corners_m:
            clon, clat = transformer.transform(cmx, cmy)
            corners_geo.append((cname, clon, clat))
            raw_log_lines.append(f'Corner {cname}: ({cmx:.1f}, {cmy:.1f}) m -> lon={clon:.6f}°, lat={clat:.6f}°')

        raw_log_lines.append(f'Center geographic: lon={center_lon:.6f}°, lat={center_lat:.6f}°')

        # 4. Distance to edge of 20m/80m layer
        center_r_m = math.hypot(cx_m, cy_m)
        dist_to_circle_edge_m = r_circ - center_r_m
        dist_to_circle_edge_km = dist_to_circle_edge_m / 1000.0

        dist_to_box_edge_m = min(r_circ - abs(cx_m), r_circ - abs(cy_m))
        dist_to_box_edge_km = dist_to_box_edge_m / 1000.0

        raw_log_lines.append(f'Distance from center to 80°S circular edge: {dist_to_circle_edge_km:.2f} km')
        raw_log_lines.append(f'Distance from center to 80S square raster edge: {dist_to_box_edge_km:.2f} km')

        warning_circ = dist_to_circle_edge_km < 150.0
        warning_box = dist_to_box_edge_km < 150.0

        if warning_circ or warning_box:
            raw_log_lines.append(f'WARNING: Margin for 150 km horizon range is UNDER 150 km! (circle: {dist_to_circle_edge_km:.2f} km, box: {dist_to_box_edge_km:.2f} km)')
            horizon_margin_status = f'WARNING: {dist_to_circle_edge_km:.1f} km (< 150 km)'
        else:
            raw_log_lines.append(f'Horizon margin check PASSED (>= 150 km): {dist_to_circle_edge_km:.2f} km')
            horizon_margin_status = f'PASS: {dist_to_circle_edge_km:.1f} km (>= 150 km)'

        results.append({
            'site_id': site_id,
            'name': name_page,
            'center_lat': center_lat,
            'center_lon': center_lon,
            'tile_w_m': tile_w_m,
            'tile_h_m': tile_h_m,
            'center_val': center_val,
            'url': url,
            'http_size': http_size,
            'margin_km': dist_to_circle_edge_km,
            'margin_status': horizon_margin_status,
        })

# Section: Things I could not determine
raw_log_lines.append('\n==================================================')
raw_log_lines.append('Things I could not determine:')
raw_log_lines.append('- None: All 6 remote GeoTIFF headers were successfully read via /vsicurl/ and HTTP HEAD.')
raw_log_lines.append('- Note: Pixel data outside the 3x3 center window was not downloaded, following protocol.')

with open('logs/sites_sourced.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(raw_log_lines) + '\n')

print('Processed all 6 sites successfully.')
for r in results:
    print(r['site_id'], r['name'], f"lat={r['center_lat']:.4f}", f"lon={r['center_lon']:.4f}", f"h={r['center_val']:.2f}m", r['margin_status'])
