import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { BookOpen, ExternalLink, ShieldCheck, Database, Radio, Compass } from 'lucide-react';

export const CreditsView: React.FC = () => {
  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <Badge variant="info">NASA Space Apps Challenge 2026</Badge>
          <Badge variant="success">Rule 11: Third-Party Attribution</Badge>
          <Badge variant="neutral">Open Data & Open Source</Badge>
        </div>
        <h1 style={{ fontSize: '1.85rem', fontWeight: 800, margin: '0 0 0.5rem 0' }}>
          Credits, Citations & Primary Data Sources
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
          In accordance with the NASA Space Apps Challenge Participant Terms (Section 6) and project integrity rules (<code>docs/PROJECT_RULES.md</code>), every external authority, published paper, ephemeris kernel, and altimetry raster is traced below with canonical source links and retrieval dates.
        </p>
      </div>

      {/* 1. Ephemerides */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Compass size={20} style={{ color: 'var(--accent-primary, #38bdf8)' }} />
          1. Ephemerides & Celestial Mechanics
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
          <div style={{ borderLeft: '3px solid var(--accent-primary, #38bdf8)', paddingLeft: '1rem' }}>
            <strong>JPL Planetary and Lunar Ephemeris DE421</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Folkner, W. M., Williams, J. G., &amp; Boggs, D. H. (2009). <em>The Planetary and Lunar Ephemeris DE 421</em>. Interplanetary Network Progress Report (IPN PR), 42-178, pp. 1–34.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Operational ephemeris kernel: <code>kernels/de421.bsp</code> • Retrieved: 2026-10-29 •{' '}
              <a href="https://ipnpr.jpl.nasa.gov/progress_report/42-178/178C.pdf" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                IPN PR 42-178 PDF <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>

          <div style={{ borderLeft: '3px solid var(--accent-primary, #38bdf8)', paddingLeft: '1rem' }}>
            <strong>NASA NAIF SPICE Toolkit</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Acton, C. H. (1996). <em>Ancillary Data Services of NASA's Navigation and Ancillary Information Facility</em>. Planetary and Space Science, 44(1), pp. 65–70. doi:10.1016/0032-0633(95)00107-7.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Navigation and Ancillary Information Facility • Retrieved: 2026-10-29 •{' '}
              <a href="https://naif.jpl.nasa.gov/naif/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                NAIF Portal <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>

          <div style={{ borderLeft: '3px solid var(--accent-primary, #38bdf8)', paddingLeft: '1rem' }}>
            <strong>SpiceyPy Python Wrapper</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Annex, A. M. et al. (2020). <em>SpiceyPy: a Pythonic Wrapper for the SPICE Toolkit</em>. Journal of Open Source Software, 5(46), 2050. doi:10.21105/joss.02050.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              MIT Licence • Retrieved: 2026-10-29 •{' '}
              <a href="https://github.com/AndrewAnnex/SpiceyPy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                GitHub Repository <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>

          <div style={{ borderLeft: '3px solid var(--accent-primary, #38bdf8)', paddingLeft: '1rem' }}>
            <strong>NASA JPL Horizons On-Line Ephemeris System</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Giorgini, J. D. et al. (1996). <em>JPL's On-Line Solar System Data Service</em>. Bulletin of the American Astronomical Society, 28, 1158.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Independent comparison baseline for test location ephemerides (Benchmark V3) • Retrieved: 2026-10-29 •{' '}
              <a href="https://ssd.jpl.nasa.gov/horizons/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                Horizons Interface <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. LOLA Altimetry */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Database size={20} style={{ color: '#10b981' }} />
          2. Lunar Altimetry &amp; Topographic Data Products
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
          <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1rem' }}>
            <strong>LOLA Polar Topography (Barker et al. 2023)</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Barker, M. K., Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Head, J. W., &amp; Sun, X. (2023). <em>A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (LOLA)</em>. The Planetary Science Journal, 4(9), 183. doi:10.3847/PSJ/acf3e1.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Product Page Citation: <code>Barker et al. (2023), Planetary Science Journal 4:183, doi:10.3847/PSJ/acf3e1</code> • Data DOI: 10.60903/gsfcpgda-lola-spole •{' '}
              <a href="https://pgda.gsfc.nasa.gov/products/78" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                GSFC PGDA Product 78 <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>

          <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1rem' }}>
            <strong>High-Resolution Polar Site Analysis (Barker et al. 2021)</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Barker, M. K., Mazarico, E., Neumann, G. A., Zuber, M. T., Haruyama, J., &amp; Smith, D. E. (2021). <em>High-resolution LOLA topography for lunar south pole landing sites</em>. Planetary and Space Science, 203, 105119. doi:10.1016/j.pss.2020.105119.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Product Page Citation: <code>Barker et al. (2021), Planetary and Space Science 203:105119, doi:10.1016/j.pss.2020.105119</code> •{' '}
              <a href="https://doi.org/10.1016/j.pss.2020.105119" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                PSS Journal Link <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>

          <div style={{ borderLeft: '3px solid #10b981', paddingLeft: '1rem' }}>
            <strong>LRO Lunar Orbiter Laser Altimeter Instrument Investigation</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Smith, D. E., Zuber, M. T., Jackson, G. B., et al. (2010). <em>The Lunar Orbiter Laser Altimeter Investigation on the Lunar Reconnaissance Orbiter Mission</em>. Space Science Reviews, 150(1–4), pp. 209–241. doi:10.1007/s11214-009-9512-y.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              NASA PDS Geosciences Node • Retrieved: 2026-10-29 •{' '}
              <a href="https://link.springer.com/article/10.1007/s11214-009-9512-y" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
                Springer Article <ExternalLink size={11} style={{ display: 'inline' }} />
              </a>
            </div>
          </div>
        </div>
      </Card>

      {/* 3. DSN & Ground Stations */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Radio size={20} style={{ color: '#f59e0b' }} />
          3. Telecommunications &amp; Deep Space Network
        </h2>
        <div style={{ borderLeft: '3px solid #f59e0b', paddingLeft: '1rem', fontSize: '0.875rem' }}>
          <strong>NASA Deep Space Network (DSN) Telecommunications Link Design Handbook</strong>
          <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
            Jet Propulsion Laboratory (2019). <em>DSN Telecommunications Link Design Handbook: 810-005, Module 301, Rev. E [verify module and revision: Module 301, Coverage and Antenna Orientation]</em>, Jet Propulsion Laboratory, California Institute of Technology.
          </p>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Goldstone (14/25/26), Madrid (63/65/54), Canberra (43/34/35) geometry with 6.0° elevation horizon mask •{' '}
            <a href="https://deepspace.jpl.nasa.gov/dsndocs/810-005/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-blue)' }}>
              JPL 810-005 Documentation <ExternalLink size={11} style={{ display: 'inline' }} />
            </a>
          </div>
        </div>
      </Card>

      {/* 4. Algorithms & Mathematics */}
      <Card style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <BookOpen size={20} style={{ color: '#a855f7' }} />
          4. Foundational Mathematics &amp; Numerical Algorithms
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
          <div style={{ borderLeft: '3px solid #a855f7', paddingLeft: '1rem' }}>
            <strong>DEM Slope &amp; Gradient (Horn 1981)</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              Horn, B. K. P. (1981). <em>Hill shading and the reflectance map</em>. Proceedings of the IEEE, 69(1), pp. 14–47. doi:10.1109/PROC.1981.11918.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Evaluated on 3×3 grid cell neighbourhood in <code>pipeline/terrain.py</code> and <code>routeWorker.ts</code>
            </div>
          </div>

          <div style={{ borderLeft: '3px solid #a855f7', paddingLeft: '1rem' }}>
            <strong>Fibonacci Uniform Disc Quadrature</strong>
            <p style={{ margin: '0.25rem 0', color: 'var(--text-secondary)' }}>
              González, Á. (2010). <em>Measurement of areas on a sphere using Fibonacci and latitude–longitude lattices</em>. Mathematical Geosciences, 42(1), pp. 49–64. doi:10.1007/s11004-009-9257-x.
            </p>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Used for 37-point and 256-point celestial disc quadrant sampling (Sun and Earth visible fraction)
            </div>
          </div>
        </div>
      </Card>

      {/* 5. Quick Links */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
        <a href="#/licenses" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <ShieldCheck size={16} />
          View Third-Party Licences (336 packages)
        </a>
        <a href="#/data" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
          <Database size={16} />
          View Reusable Open Data Catalog
        </a>
      </div>
    </div>
  );
};
