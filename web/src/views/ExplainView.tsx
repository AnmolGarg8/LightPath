import React from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

export const ExplainView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.4rem' }}>
          <Badge variant="joint" label="SCIENTIFIC DOCUMENTATION" />
          <Badge variant="marginal" label="OPERATIONAL BOUNDARIES" />
        </div>
        <h1>Scientific Foundations & Operational Limitations</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-base)' }}>
          Detailed principles governing LightPath ephemerides, coordinate frames, uncertainty classification, and engineering disclaimers.
        </p>
      </div>

      {/* Two Essential Disclaimers */}
      <div id="limitations" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        <Card
          title="1. Sunlight Visibility ≠ Electrical Power"
          variant="alert"
          subtitle="Sun disc elevation above the terrain does not guarantee usable solar array energy generation."
        >
          <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <li>
              <strong>Incidence Angle & Cosine Losses:</strong> At polar latitudes, the Sun skims within 1.5° of the horizon. Solar panel orientation relative to the solar vector dictates actual flux (effective flux decreases with cos &theta;).
            </li>
            <li>
              <strong>Lunar Regolith Dust:</strong> Dust kicked up by landing thrusters, rover wheels, or electrostatic levitation coats photovoltaic covers, diminishing conversion efficiency.
            </li>
            <li>
              <strong>Cryogenic Thermal Degradation:</strong> Solar cells transitioning in and out of deep shadows undergo extreme thermal cycling (40 K to 300 K), causing electrical interconnect stress.
            </li>
          </ul>
        </Card>

        <Card
          title="2. Earth Visibility ≠ Communication Link Budget"
          variant="alert"
          subtitle="Direct line-of-sight to the Earth does not certify telemetry or command closure."
        >
          <ul style={{ listStyle: 'disc', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            <li>
              <strong>Antenna Gain & Pointing Error:</strong> Directional high-gain antennas (HGA) must continuously steer to counteract lunar librations (~8° longitude, ~7° latitude).
            </li>
            <li>
              <strong>Free-Space Path Loss:</strong> At 384,400 km mean distance, path loss in X-band or Ka-band exceeds 200 dB, requiring adequate transmitter wattage and ground aperture.
            </li>
            <li>
              <strong>Terrain Multipath & Thermal Noise:</strong> Grazing angles over rough lunar regolith can cause destructive RF interference and high receiver system noise temperatures.
            </li>
          </ul>
        </Card>
      </div>

      {/* Coordinate Frames */}
      <Card
        title="Coordinate Frame Architecture: Why MOON_ME?"
        subtitle="Adherence to standard NASA LOLA and PDS cartographic references."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <p>
            LightPath exclusively uses the <strong>Moon Mean-Earth / Polar-Axis frame (MOON_ME)</strong> for all topocentric
            calculations, site positions, and horizon profiles.
          </p>
          <p>
            <strong>The Rationale:</strong> The Lunar Reconnaissance Orbiter (LRO) Lunar Orbiter Laser Altimeter (LOLA)
            polar elevation products (such as the 20m and 5m digital elevation models) are defined in the MOON_ME frame.
            Mixing the Principal Axis frame (<code className="mono">MOON_PA</code>) with LOLA products without careful
            Euler angle rotations introduces up to hundreds of meters of horizontal positioning error near the lunar poles.
          </p>
          <div style={{ backgroundColor: 'var(--bg-surface)', padding: '0.75rem 1rem', borderRadius: '6px', fontSize: 'var(--text-xs)' }}>
            <strong>Rule 5:</strong> Use the Moon mean-Earth/polar-axis frame MOON_ME everywhere. No MOON_PA without an explicit converted and tested path.
          </div>
        </div>
      </Card>

      {/* 3-State Uncertainty Classification */}
      <Card
        title="Three-State Uncertainty Classification: Margin-Protected Planning"
        subtitle="Addressing DEM vertical noise and finite grid resolution."
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginTop: '0.5rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-visible-bg)', border: '1px solid var(--color-visible-border)', borderRadius: '6px' }}>
            <Badge variant="visible" label="ROBUST VISIBLE" />
            <p style={{ fontSize: 'var(--text-xs)', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              Target disc fraction &ge; 50% even if the terrain horizon is artificially raised by the uncertainty margin (&plusmn;0.1°). High operational confidence.
            </p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-marginal-bg)', border: '1px solid var(--color-marginal-border)', borderRadius: '6px' }}>
            <Badge variant="marginal" label="MARGINAL (±0.1°)" />
            <p style={{ fontSize: 'var(--text-xs)', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              Horizon intersection falls within the margin band. Visibility depends on exact sub-pixel local boulder height or mast deflection. Requires conservative operational reserve.
            </p>
          </div>

          <div style={{ padding: '1rem', backgroundColor: 'var(--color-blocked-bg)', border: '1px solid var(--color-blocked-border)', borderRadius: '6px' }}>
            <Badge variant="blocked" label="ROBUST BLOCKED" />
            <p style={{ fontSize: 'var(--text-xs)', marginTop: '0.5rem', color: 'var(--text-secondary)' }}>
              Target disc fraction remains below the threshold even if the horizon is lowered by the margin. Total terrain occultation.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
