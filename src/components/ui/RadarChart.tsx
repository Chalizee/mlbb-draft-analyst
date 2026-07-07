'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface RadarChartProps {
  data: {
    farm: number;
    damage: number;
    survival: number;
    teamFight: number;
    push: number;
    versatility: number;
  };
  size?: number;
}

export default function RadarChart({ data, size = 320 }: RadarChartProps) {
  const padding = 60;
  const center = size / 2;
  const radius = center - padding;

  // 6 attributes in order (clockwise starting from top)
  const axes = [
    { key: 'farm', label: 'FARM', fullName: 'GPM & Gold Share', color: '#eab308' }, // yellow
    { key: 'damage', label: 'DAMAGE', fullName: 'DPM & Dmg Share', color: '#ef4444' }, // red
    { key: 'survival', label: 'SURVIVAL', fullName: 'KDA & Survival', color: '#22c55e' }, // green
    { key: 'teamFight', label: 'TEAM FIGHT', fullName: 'KP & Assists', color: '#a855f7' }, // purple
    { key: 'push', label: 'PUSH', fullName: 'Tower DPM', color: '#f97316' }, // orange
    { key: 'versatility', label: 'VERSATILITY', fullName: 'Hero Pool Versatility', color: '#06b6d4' } // cyan
  ] as const;

  const totalAxes = axes.length;

  // Calculate coordinates for a given value (0-100) on a specific axis index
  const getCoordinates = (index: number, value: number) => {
    // 0 is top (12 o'clock position), so we subtract Math.PI / 2
    const angle = (index * 2 * Math.PI) / totalAxes - Math.PI / 2;
    const distance = (value / 100) * radius;
    const x = center + distance * Math.cos(angle);
    const y = center + distance * Math.sin(angle);
    return { x, y };
  };

  // Concentric levels (rings) at 20%, 40%, 60%, 80%, 100%
  const levels = [20, 40, 60, 80, 100];

  // Draw concentric level polygons
  const renderLevelRings = () => {
    return levels.map((level) => {
      const points = Array.from({ length: totalAxes }, (_, i) => {
        const { x, y } = getCoordinates(i, level);
        return `${x},${y}`;
      }).join(' ');

      return (
        <polygon
          key={level}
          points={points}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth="1"
          strokeDasharray={level === 100 ? 'none' : '4, 4'}
          className="opacity-40"
        />
      );
    });
  };

  // Draw axis lines from center to outer ring
  const renderAxisLines = () => {
    return axes.map((_, i) => {
      const outer = getCoordinates(i, 100);
      return (
        <line
          key={i}
          x1={center}
          y1={center}
          x2={outer.x}
          y2={outer.y}
          stroke="var(--color-border)"
          strokeWidth="1.2"
          className="opacity-40"
        />
      );
    });
  };

  // Calculate points for the player data polygon
  const dataPoints = axes.map((axis, i) => {
    const val = data[axis.key] || 0;
    const { x, y } = getCoordinates(i, val);
    return { x, y, val, label: axis.label, color: axis.color };
  });

  const polygonPointsString = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Position labels at each vertex (with offsetting outside the graph bounds)
  const renderLabels = () => {
    return axes.map((axis, i) => {
      const outer = getCoordinates(i, 100);
      const angle = (i * 2 * Math.PI) / totalAxes - Math.PI / 2;

      // Extend label position outward
      const labelDistance = radius + 22;
      const lx = center + labelDistance * Math.cos(angle);
      const ly = center + labelDistance * Math.sin(angle);

      // Label alignments based on angle position
      let textAnchor: 'start' | 'middle' | 'end' = 'middle';
      if (Math.cos(angle) > 0.1) textAnchor = 'start';
      else if (Math.cos(angle) < -0.1) textAnchor = 'end';

      let dy = '0.35em';
      if (Math.sin(angle) > 0.8) dy = '1em';
      else if (Math.sin(angle) < -0.8) dy = '-0.2em';

      const playerVal = data[axis.key] || 0;

      return (
        <g key={axis.key} className="select-none">
          {/* Main Title Badge */}
          <text
            x={lx}
            y={ly}
            textAnchor={textAnchor}
            dy={dy}
            className="font-heading font-black text-[10px] tracking-wider fill-text-primary"
          >
            {axis.label}
          </text>
          
          {/* Subtext description below or above title */}
          <text
            x={lx}
            y={ly}
            textAnchor={textAnchor}
            dy={Math.sin(angle) < -0.8 ? '-1.3em' : '1.5em'}
            className="font-mono text-[8px] fill-text-muted opacity-80"
          >
            {axis.fullName}
          </text>

          {/* Actual score badge directly under title */}
          <text
            x={lx}
            y={ly}
            textAnchor={textAnchor}
            dy={Math.sin(angle) < -0.8 ? '-2.3em' : '2.5em'}
            fill={axis.color}
            className="font-heading font-extrabold text-[9px] tracking-wide"
          >
            {playerVal.toFixed(1)}
          </text>
        </g>
      );
    });
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 bg-bg-surface border border-border/40 rounded-xl relative overflow-hidden group shadow-inner">
      {/* Glow highlight in center background */}
      <div className="absolute w-44 h-44 rounded-full bg-accent/5 filter blur-3xl opacity-60 pointer-events-none transition-all group-hover:scale-110 duration-700" />
      
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="relative z-10">
        {/* Background Concentric Rings */}
        {renderLevelRings()}

        {/* Outer Level Labels (100, 80, 60, 40, 20) */}
        {levels.map((level) => {
          // Place grid level values slightly offset along the top axis
          const { x, y } = getCoordinates(0, level);
          return (
            <text
              key={level}
              x={x + 6}
              y={y + 3}
              className="font-mono text-[7px] fill-text-muted opacity-40 select-none"
            >
              {level}
            </text>
          );
        })}

        {/* Axis line connecting center to vertices */}
        {renderAxisLines()}

        {/* Player Data Polygon Area with framer-motion transition animation */}
        <motion.polygon
          points={polygonPointsString}
          fill="url(#radarGradient)"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          className="glow-accent filter drop-shadow-[0_0_4px_rgba(99,102,241,0.3)]"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        />

        {/* Decorative Grid Center Circle */}
        <circle cx={center} cy={center} r="3" fill="var(--color-border)" />

        {/* Data Vertices Markers */}
        {dataPoints.map((pt, i) => (
          <g key={i}>
            {/* Pulsing ring under dot */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r="6"
              fill={pt.color}
              className="opacity-20 animate-pulse"
            />
            {/* Primary marker dot */}
            <circle
              cx={pt.x}
              cy={pt.y}
              r="3.5"
              fill={pt.color}
              stroke="var(--color-bg-surface)"
              strokeWidth="1.2"
              className="cursor-pointer"
            />
          </g>
        ))}

        {/* Axes Titles & Labels */}
        {renderLabels()}

        {/* Defs for futuristic gradient fill */}
        <defs>
          <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.08" />
            <stop offset="60%" stopColor="var(--color-accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.45" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
}
