'use client';

import { useRef, useEffect } from 'react';
import rough from 'roughjs';

interface IllustrationElement {
  type: 'circle' | 'rectangle' | 'line' | 'ellipse' | 'path' | 'text';
  x?: number;
  y?: number;
  diameter?: number;
  width?: number;
  height?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  d?: string;
  content?: string;
  fontSize?: number;
  fill?: string;
  stroke?: string;
}

interface IllustrationSpec {
  background: string;
  elements: IllustrationElement[];
}

export default function Illustration({ spec }: { spec: IllustrationSpec | null }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || !spec) return;
    const rc = rough.svg(svgRef.current);
    svgRef.current.innerHTML = '';

    for (const el of spec.elements) {
      let node: SVGElement | null = null;
      switch (el.type) {
        case 'circle':
          if (el.x !== undefined && el.y !== undefined && el.diameter !== undefined) {
            node = rc.circle(el.x, el.y, el.diameter, { fill: el.fill, stroke: el.stroke });
          }
          break;
        case 'rectangle':
          if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
            node = rc.rectangle(el.x, el.y, el.width, el.height, { fill: el.fill, stroke: el.stroke });
          }
          break;
        case 'line':
          if (el.x1 !== undefined && el.y1 !== undefined && el.x2 !== undefined && el.y2 !== undefined) {
            node = rc.line(el.x1, el.y1, el.x2, el.y2, { stroke: el.stroke });
          }
          break;
        case 'ellipse':
          if (el.x !== undefined && el.y !== undefined && el.width !== undefined && el.height !== undefined) {
            node = rc.ellipse(el.x, el.y, el.width, el.height, { fill: el.fill, stroke: el.stroke });
          }
          break;
        case 'path':
          if (el.d) {
            node = rc.path(el.d, { fill: el.fill, stroke: el.stroke });
          }
          break;
        case 'text':
          if (el.x !== undefined && el.y !== undefined && el.content) {
            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textNode.setAttribute('x', String(el.x));
            textNode.setAttribute('y', String(el.y));
            textNode.setAttribute('font-size', String(el.fontSize ?? 12));
            textNode.setAttribute('fill', el.fill ?? '#2c1810');
            textNode.setAttribute('font-family', 'cursive');
            textNode.textContent = el.content;
            node = textNode;
          }
          break;
      }
      if (node) {
        svgRef.current.appendChild(node);
      }
    }
  }, [spec]);

  if (!spec) return null;

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 200 140"
      className="w-full h-auto"
      style={{ background: spec.background }}
    />
  );
}
