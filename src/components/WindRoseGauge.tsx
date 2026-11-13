import React from 'react';
import { TelemetrySnapshot } from '../sim/types';

interface WindRoseGaugeProps {
  telemetry: TelemetrySnapshot;
}

/**
 * Bespoke SVG Marine Wind Rose & Sail Trim Instrument.
 * Displays rotating compass rose, No-Go Zone arc (+/-32°),
 * Apparent Wind vector, True Wind marker, and live Boom angle.
 */
export const WindRoseGauge: React.FC<WindRoseGaugeProps> = ({ telemetry }) => {
  const cx = 76;
  const cy = 76;
  const rOuter = 60;
  const rInner = 46;

  // Apparent wind relative angle (-180..+180 deg, 0 = bow)
  const appDeg = telemetry.apparentWindRelDeg;
  const appRad = ((appDeg - 90) * Math.PI) / 180;
  const appX = cx + Math.cos(appRad) * (rOuter - 6);
  const appY = cy + Math.sin(appRad) * (rOuter - 6);

  // True wind relative to heading
  let trueRelDeg = telemetry.trueWindDirDeg - telemetry.headingDeg;
  if (trueRelDeg > 180) trueRelDeg -= 360;
  if (trueRelDeg < -180) trueRelDeg += 360;
  const trueRad = ((trueRelDeg - 90) * Math.PI) / 180;
  const trueX = cx + Math.cos(trueRad) * (rOuter + 2);
  const trueY = cy + Math.sin(trueRad) * (rOuter + 2);

  // Boom angle relative to centerline aft (+Y in SVG = aft)
  const boomRad = ((telemetry.boomAngleDeg + 90) * Math.PI) / 180;
  const boomX = cx - Math.cos(boomRad) * 28;
  const boomY = cy + Math.sin(boomRad) * 28;

  // No-go zone sector path centered on apparent wind? No, around bow (-32..+32 deg)
  // Actually no-go zone is +/-32 deg around TRUE/APPARENT wind relative to bow:
  // If apparent wind angle lies within +/-32 deg of bow, vessel is in irons!
  const noGoStart = ((-32 - 90) * Math.PI) / 180;
  const noGoEnd = ((32 - 90) * Math.PI) / 180;
  const ngX1 = cx + Math.cos(noGoStart) * rOuter;
  const ngY1 = cy + Math.sin(noGoStart) * rOuter;
  const ngX2 = cx + Math.cos(noGoEnd) * rOuter;
  const ngY2 = cy + Math.sin(noGoEnd) * rOuter;

  return (
    <div className="pointer-events-none bg-[#071520]/88 border border-slate-700/60 rounded-lg p-3 w-[238px] text-slate-100 shadow-lg">
      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
        <span>Rosa dos Ventos</span>
        <span className="font-mono-tabular text-amber-400">
          {telemetry.inNoGoZone ? 'ZONA MORTA' : `Vela ${telemetry.sailAreaPct}%`}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <svg width="152" height="152" viewBox="0 0 152 152" className="shrink-0">
          {/* Outer bezel */}
          <circle cx={cx} cy={cy} r={rOuter} fill="#051018" stroke="#1e3a4c" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={rInner} fill="none" stroke="#132a38" strokeWidth="1" strokeDasharray="3 4" />

          {/* No-Go Zone (+/- 32 deg ahead of bow) */}
          <path
            d={`M ${cx} ${cy} L ${ngX1} ${ngY1} A ${rOuter} ${rOuter} 0 0 1 ${ngX2} ${ngY2} Z`}
            fill={telemetry.inNoGoZone ? 'rgba(239, 68, 68, 0.28)' : 'rgba(239, 68, 68, 0.10)'}
            stroke="rgba(239, 68, 68, 0.45)"
            strokeWidth="1"
          />

          {/* Rotating Compass Cardinal Ring */}
          <g transform={`rotate(${-telemetry.headingDeg} ${cx} ${cy})`}>
            <text x={cx} y={cy - rOuter + 11} textAnchor="middle" fill="#d99b26" fontSize="9" fontWeight="700">
              N
            </text>
            <text x={cx + rOuter - 9} y={cy + 3} textAnchor="middle" fill="#64748b" fontSize="8">
              E
            </text>
            <text x={cx} y={cy + rOuter - 5} textAnchor="middle" fill="#64748b" fontSize="8">
              S
            </text>
            <text x={cx - rOuter + 9} y={cy + 3} textAnchor="middle" fill="#64748b" fontSize="8">
              W
            </text>
          </g>

          {/* Hull centerline silhouette */}
          <path
            d={`M ${cx} ${cy - 22} C ${cx + 9} ${cy - 6}, ${cx + 8} ${cy + 16}, ${cx + 5} ${cy + 22} L ${cx - 5} ${cy + 22} C ${cx - 8} ${cy + 16}, ${cx - 9} ${cy - 6}, ${cx} ${cy - 22} Z`}
            fill="#0f3447"
            stroke="#476c80"
            strokeWidth="1"
          />

          {/* Boom & Sail chord */}
          <line
            x1={cx}
            y1={cy - 2}
            x2={boomX}
            y2={boomY}
            stroke="#f8fafc"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* True Wind Marker (Amber triangle on outer rim) */}
          <circle cx={trueX} cy={trueY} r="3.5" fill="#d99b26" />

          {/* Apparent Wind Vector (Cyan line from center toward wind source) */}
          <line
            x1={cx}
            y1={cy}
            x2={appX}
            y2={appY}
            stroke="#38bdf8"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx={appX} cy={appY} r="3" fill="#38bdf8" />
        </svg>

        <div className="flex flex-col gap-1.5 text-[11px] min-w-0">
          <div>
            <div className="text-slate-400">Vento Aparente</div>
            <div className="font-mono-tabular text-sky-300 font-semibold">
              {telemetry.apparentWindKnots.toFixed(1)} kts
            </div>
            <div className="font-mono-tabular text-slate-400 text-[10px]">
              {Math.round(telemetry.apparentWindRelDeg)}° rel
            </div>
          </div>
          <div>
            <div className="text-slate-400">Vento Real</div>
            <div className="font-mono-tabular text-amber-300 font-semibold">
              {telemetry.trueWindKnots.toFixed(1)} kts
            </div>
            <div className="font-mono-tabular text-slate-400 text-[10px]">
              {Math.round(telemetry.trueWindDirDeg)}°
            </div>
          </div>
          <div>
            <div className="text-slate-400">Regulagem</div>
            <div className="font-mono-tabular text-slate-200">
              {telemetry.sailTrimPct}% · {Math.round(telemetry.boomAngleDeg)}°
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
