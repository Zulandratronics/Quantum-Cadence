import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { AlbumArcPoint } from '../utils/visualizerParser';

interface AlbumArcVisualizerProps {
  data: AlbumArcPoint[];
  onSelectTrack?: (trackNumber: number) => void;
}

export const AlbumArcVisualizer: React.FC<AlbumArcVisualizerProps> = ({ data, onSelectTrack }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 700, height: 320 });
  const [hoveredPoint, setHoveredPoint] = useState<AlbumArcPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      const height = Math.max(260, Math.min(360, window.innerHeight * 0.35));
      setDimensions({ width, height });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 35, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale: Track 1 to Track N
    const xScale = d3.scalePoint<number>()
      .domain(data.map((_, i) => i + 1))
      .range([0, chartWidth])
      .padding(0.2);

    // Y Scale: 0 to 100%
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([chartHeight, 0]);

    // Gridlines
    const yGrid = d3.axisLeft(yScale)
      .tickSize(-chartWidth)
      .tickFormat(() => '')
      .ticks(5);

    g.append('g')
      .attr('class', 'grid-lines text-gray-700 opacity-20')
      .call(yGrid)
      .selectAll('.tick line')
      .attr('stroke', 'currentColor')
      .attr('stroke-dasharray', '3,3');

    // Axes
    const xAxis = d3.axisBottom(xScale).tickFormat((d) => {
      const pt = data[d - 1];
      if (!pt) return `T${d}`;
      const titleTruncated = pt.title.length > 12 ? pt.title.substring(0, 10) + '..' : pt.title;
      return width < 600 ? `T${d}` : `T${d}: ${titleTruncated}`;
    });

    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`);

    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis)
      .attr('class', 'text-gray-400 font-mono text-xs');
    
    xAxisG.select('.domain').remove();
    xAxisG.selectAll('line').remove();

    if (width < 650) {
      xAxisG.selectAll('text')
        .attr('transform', 'rotate(-30)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.2em');
    }

    const yAxisG = g.append('g')
      .call(yAxis)
      .attr('class', 'text-gray-400 font-mono text-xs');
      
    yAxisG.select('.domain').remove();
    yAxisG.selectAll('line').remove();

    // Curved Area & Line Generators
    const areaEnergy = d3.area<AlbumArcPoint>()
      .x((_, i) => xScale(i + 1) || 0)
      .y0(chartHeight)
      .y1(d => yScale(d.energy))
      .curve(d3.curveMonotoneX);

    const lineEnergy = d3.line<AlbumArcPoint>()
      .x((_, i) => xScale(i + 1) || 0)
      .y(d => yScale(d.energy))
      .curve(d3.curveMonotoneX);

    const lineDensity = d3.line<AlbumArcPoint>()
      .x((_, i) => xScale(i + 1) || 0)
      .y(d => yScale(d.density))
      .curve(d3.curveMonotoneX);

    const lineIntensity = d3.line<AlbumArcPoint>()
      .x((_, i) => xScale(i + 1) || 0)
      .y(d => yScale(d.intensity))
      .curve(d3.curveMonotoneX);

    // Gradients
    const defs = svg.append('defs');
    const gradEnergy = defs.append('linearGradient')
      .attr('id', 'grad-album-energy')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradEnergy.append('stop').attr('offset', '0%').attr('stop-color', '#ec4899').attr('stop-opacity', '0.35');
    gradEnergy.append('stop').attr('offset', '100%').attr('stop-color', '#ec4899').attr('stop-opacity', '0.0');

    // Draw Energy Area Glow
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#grad-album-energy)')
      .attr('d', areaEnergy);

    // Draw Density Line (Cyan)
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4,4')
      .attr('d', lineDensity);

    // Draw Intensity Line (Purple)
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#a855f7')
      .attr('stroke-width', 2)
      .attr('d', lineIntensity);

    // Draw Master Energy Arc (Pink/Rose)
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#ec4899')
      .attr('stroke-width', 3.5)
      .attr('stroke-linecap', 'round')
      .attr('d', lineEnergy);

    // Markers
    const markers = g.selectAll('.album-marker')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'album-marker')
      .attr('transform', (_, i) => `translate(${xScale(i + 1) || 0}, 0)`);

    // Energy Dots
    markers.append('circle')
      .attr('cy', (d: any) => yScale(d.energy))
      .attr('r', 6)
      .attr('fill', '#111827')
      .attr('stroke', '#ec4899')
      .attr('stroke-width', 3)
      .attr('class', 'cursor-pointer hover:scale-125 transition-transform duration-100');

    // Vertical hover line
    const hoverLine = g.append('line')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#ec4899')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .style('opacity', 0);

    // Hover bars
    const stepWidth = chartWidth / (data.length || 1);
    g.selectAll('.hover-bar-album')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'hover-bar-album cursor-pointer')
      .attr('x', (_, i) => (xScale(i + 1) || 0) - stepWidth / 2)
      .attr('y', 0)
      .attr('width', stepWidth)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .on('mouseenter', (event: any, d: any) => {
        setHoveredPoint(d);
        const idx = data.indexOf(d);
        const xPos = (xScale(idx + 1) || 0);
        hoverLine
          .attr('x1', xPos)
          .attr('x2', xPos)
          .style('opacity', 1);

        const yPos = yScale(d.energy) + margin.top - 15;
        setTooltipPos({ x: xPos + margin.left, y: yPos });
      })
      .on('mousemove', (event: any, d: any) => {
        const idx = data.indexOf(d);
        const xPos = (xScale(idx + 1) || 0);
        const yPos = yScale(d.energy) + margin.top - 15;
        setTooltipPos({ x: xPos + margin.left, y: yPos });
      })
      .on('mouseleave', () => {
        setHoveredPoint(null);
        hoverLine.style('opacity', 0);
      })
      .on('click', (event: any, d: any) => {
        if (onSelectTrack) {
          onSelectTrack(d.trackNumber);
        }
      });

  }, [dimensions, data, onSelectTrack]);

  return (
    <div className="bg-gray-800/40 p-5 rounded-xl border border-pink-500/20 backdrop-blur-md space-y-4" id="album-arc-visualizer">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
            <span className="text-pink-400">⚡</span> Macro Album Energy & Dynamic Trajectory
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Sequential pacing, emotional tension, and track progression across the full LP/EP</p>
        </div>
        
        {/* Dynamic Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-pink-500 rounded-full inline-block" />
            <span className="text-pink-300">Composite Energy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-purple-400 rounded-full inline-block" />
            <span className="text-purple-300">Intensity</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-cyan-400 rounded-full inline-block" />
            <span className="text-cyan-300">Lyrical Density</span>
          </div>
        </div>
      </div>

      <div ref={containerRef} className="relative w-full overflow-visible">
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible select-none"
        />

        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-gray-900/95 border border-pink-500/50 p-3 rounded-lg shadow-2xl backdrop-blur-md text-xs space-y-1.5 transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-8px'
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-700/60 pb-1.5">
              <span className="font-mono font-black text-pink-400 uppercase tracking-wider">
                Track {hoveredPoint.trackNumber}: {hoveredPoint.title}
              </span>
              {hoveredPoint.flow && (
                <span className="bg-pink-950/60 text-pink-300 border border-pink-700/40 px-1.5 py-0.5 rounded font-mono font-semibold text-[10px]">
                  {hoveredPoint.flow}
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono pt-1 text-center">
              <div className="bg-gray-800/80 p-1.5 rounded">
                <div className="text-[10px] text-pink-300">Energy</div>
                <div className="font-bold text-pink-400">{hoveredPoint.energy}%</div>
              </div>
              <div className="bg-gray-800/80 p-1.5 rounded">
                <div className="text-[10px] text-purple-300">Intensity</div>
                <div className="font-bold text-purple-400">{hoveredPoint.intensity}%</div>
              </div>
              <div className="bg-gray-800/80 p-1.5 rounded">
                <div className="text-[10px] text-cyan-300">Density</div>
                <div className="font-bold text-cyan-400">{hoveredPoint.density}%</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
