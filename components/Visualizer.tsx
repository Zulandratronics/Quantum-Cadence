import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { VisualizerPoint } from '../types';

interface VisualizerProps {
  data: VisualizerPoint[];
}

export const Visualizer: React.FC<VisualizerProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 320 });
  const [hoveredPoint, setHoveredPoint] = useState<VisualizerPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Handle resizing of the container to keep SVG responsive
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width } = entries[0].contentRect;
      // Maintain aspect ratio or bound height
      const height = Math.max(260, Math.min(360, window.innerHeight * 0.35));
      setDimensions({ width, height });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Render/Update D3 visualizer
  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;

    const { width, height } = dimensions;
    const margin = { top: 30, right: 30, bottom: 50, left: 50 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Clear previous elements
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Setup chart canvas group
    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Define Scales
    // X scale - Ordinal / Band or Point since we have custom sections and time strings
    const xScale = d3.scalePoint()
      .domain(data.map(d => d.time))
      .range([0, chartWidth]);

    // Y scale
    const yScale = d3.scaleLinear()
      .domain([0, 100])
      .range([chartHeight, 0]);

    // Gridlines (Horizontal)
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
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale).ticks(5).tickFormat(d => `${d}%`);

    // Draw X Axis
    const xAxisG = g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(xAxis)
      .attr('class', 'text-gray-400 font-mono text-xs');
    
    xAxisG.select('.domain').remove();
    xAxisG.selectAll('line').remove();
    
    // Rotate x-axis labels if too tight
    if (width < 500) {
      xAxisG.selectAll('text')
        .attr('transform', 'rotate(-30)')
        .attr('text-anchor', 'end')
        .attr('dx', '-0.5em')
        .attr('dy', '0.2em');
    }

    // Draw Y Axis
    const yAxisG = g.append('g')
      .call(yAxis)
      .attr('class', 'text-gray-400 font-mono text-xs');
      
    yAxisG.select('.domain').remove();
    yAxisG.selectAll('line').remove();

    // Define Curved Area Generators for styling (Neon gradient glow)
    const areaLyrical = d3.area<VisualizerPoint>()
      .x(d => xScale(d.time) || 0)
      .y0(chartHeight)
      .y1(d => yScale(d.lyricalDensity))
      .curve(d3.curveMonotoneX);

    const areaVocal = d3.area<VisualizerPoint>()
      .x(d => xScale(d.time) || 0)
      .y0(chartHeight)
      .y1(d => yScale(d.vocalIntensity))
      .curve(d3.curveMonotoneX);

    // Define Curved Line Generators
    const lineLyrical = d3.line<VisualizerPoint>()
      .x(d => xScale(d.time) || 0)
      .y(d => yScale(d.lyricalDensity))
      .curve(d3.curveMonotoneX);

    const lineVocal = d3.line<VisualizerPoint>()
      .x(d => xScale(d.time) || 0)
      .y(d => yScale(d.vocalIntensity))
      .curve(d3.curveMonotoneX);

    // Setup gradients for area glow fills
    const defs = svg.append('defs');

    // Lyrical Gradient
    const gradLyrical = defs.append('linearGradient')
      .attr('id', 'grad-lyrical')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradLyrical.append('stop').attr('offset', '0%').attr('stop-color', '#22d3ee').attr('stop-opacity', '0.35');
    gradLyrical.append('stop').attr('offset', '100%').attr('stop-color', '#22d3ee').attr('stop-opacity', '0.0');

    // Vocal Gradient
    const gradVocal = defs.append('linearGradient')
      .attr('id', 'grad-vocal')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '0%').attr('y2', '100%');
    gradVocal.append('stop').attr('offset', '0%').attr('stop-color', '#a855f7').attr('stop-opacity', '0.35');
    gradVocal.append('stop').attr('offset', '100%').attr('stop-color', '#a855f7').attr('stop-opacity', '0.0');

    // Render Area Fills
    g.append('path')
      .datum(data)
      .attr('fill', 'url(#grad-lyrical)')
      .attr('d', areaLyrical);

    g.append('path')
      .datum(data)
      .attr('fill', 'url(#grad-vocal)')
      .attr('d', areaVocal);

    // Render Clean lines with transition effects
    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('d', lineLyrical);

    g.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#a855f7')
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('d', lineVocal);

    // Interactive Hover Markers / Dots
    const markers = g.selectAll('.marker-group')
      .data(data)
      .enter()
      .append('g')
      .attr('class', 'marker-group')
      .attr('transform', (d: any) => `translate(${xScale(d.time) || 0}, 0)`);

    // Vocal marker dots
    markers.append('circle')
      .attr('cy', (d: any) => yScale(d.vocalIntensity))
      .attr('r', 5)
      .attr('fill', '#111827')
      .attr('stroke', '#a855f7')
      .attr('stroke-width', 3.5)
      .attr('class', 'cursor-pointer hover:scale-125 transition-transform duration-100');

    // Lyrical marker dots
    markers.append('circle')
      .attr('cy', (d: any) => yScale(d.lyricalDensity))
      .attr('r', 5)
      .attr('fill', '#111827')
      .attr('stroke', '#22d3ee')
      .attr('stroke-width', 3.5)
      .attr('class', 'cursor-pointer hover:scale-125 transition-transform duration-100');

    // Vertical hover line
    const hoverLine = g.append('line')
      .attr('y1', 0)
      .attr('y2', chartHeight)
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '2,2')
      .style('opacity', 0);

    // Invisible larger interaction overlay for easier hover tracking
    g.selectAll('.hover-bar')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'hover-bar cursor-pointer')
      .attr('x', (d: any) => (xScale(d.time) || 0) - (chartWidth / data.length) / 2)
      .attr('y', 0)
      .attr('width', chartWidth / data.length)
      .attr('height', chartHeight)
      .attr('fill', 'transparent')
      .on('mouseenter', (event: any, d: any) => {
        setHoveredPoint(d);
        hoverLine
          .attr('x1', xScale(d.time) || 0)
          .attr('x2', xScale(d.time) || 0)
          .style('opacity', 1);

        // Position tooltip
        const xPos = (xScale(d.time) || 0) + margin.left;
        const yPos = Math.min(yScale(d.vocalIntensity), yScale(d.lyricalDensity)) + margin.top - 15;
        setTooltipPos({ x: xPos, y: yPos });
      })
      .on('mousemove', (event: any, d: any) => {
        const xPos = (xScale(d.time) || 0) + margin.left;
        const yPos = Math.min(yScale(d.vocalIntensity), yScale(d.lyricalDensity)) + margin.top - 15;
        setTooltipPos({ x: xPos, y: yPos });
      })
      .on('mouseleave', () => {
        setHoveredPoint(null);
        hoverLine.style('opacity', 0);
      });

  }, [dimensions, data]);

  return (
    <div className="bg-gray-800/40 p-5 rounded-xl border border-gray-700/60 backdrop-blur-md space-y-4" id="composition-visualizer">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
            <span className="text-cyan-400">⚡</span> Composition Peaks & Intensity
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">D3 Visualizer representing intensity peaks and vocal metrics over time</p>
        </div>
        
        {/* Dynamic Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-cyan-400 rounded-full inline-block" />
            <span className="text-cyan-300">Lyrical Density</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 bg-purple-500 rounded-full inline-block" />
            <span className="text-purple-400">Vocal Intensity</span>
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

        {/* Floating Cyberpunk Tooltip */}
        {hoveredPoint && (
          <div
            className="absolute z-20 pointer-events-none bg-gray-900/95 border border-purple-500/50 p-3 rounded-lg shadow-2xl backdrop-blur-md text-xs space-y-1.5 transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y}px`,
              transform: 'translate(-50%, -100%)',
              marginTop: '-8px'
            }}
          >
            <div className="flex items-center justify-between gap-3 border-b border-gray-700/60 pb-1.5">
              <span className="font-mono font-black text-purple-400 uppercase tracking-wider">{hoveredPoint.section}</span>
              <span className="bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded font-mono font-bold text-[10px]">{hoveredPoint.time}</span>
            </div>
            <div className="flex flex-col gap-1 font-mono">
              <div className="flex justify-between gap-5 text-cyan-300">
                <span>Lyrical Density:</span>
                <span className="font-bold">{hoveredPoint.lyricalDensity}%</span>
              </div>
              <div className="flex justify-between gap-5 text-purple-400">
                <span>Vocal Intensity:</span>
                <span className="font-bold">{hoveredPoint.vocalIntensity}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
