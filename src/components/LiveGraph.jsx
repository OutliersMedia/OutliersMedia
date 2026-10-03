import { useEffect, useRef } from 'react';

export default function LiveGraph() {
  const pathRef = useRef(null);
  const heartContainerRef = useRef(null);
  const chipTextRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);
  const gridLinesRef = useRef(null);

  useEffect(() => {
    let animationFrameId;
    let lastTime = performance.now();
    let phase = 'intro'; 
    let introStartTime = performance.now();
    const introDuration = 4500;
    
    let isTabVisible = true;
    const handleVisibility = () => { isTabVisible = document.visibilityState === 'visible'; };
    document.addEventListener('visibilitychange', handleVisibility);

    const W = 1000;
    const H = 500;
    const padL = 70;
    const padB = 60;
    const padT = 70;
    const padR = 40;
    const graphW = W - padL - padR;
    const graphH = H - padT - padB;
    const numPoints = 12;
    const stepX = graphW / (numPoints - 2); 

    let week = 1;
    let baseVal = 1000;
    let points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push({ w: week++, v: baseVal });
      let stepPercent = Math.random() < 0.7 
          ? (Math.random() * 0.06 + 0.04) 
          : -(Math.random() * 0.04 + 0.03);
      baseVal = baseVal * (1 + stepPercent);
    }
    
    let liveTimer = 0;
    const liveInterval = 2500;
    let transitionProgress = 0;

    let heartScale = 1;
    let pulseTime = 0;

    const draw = (currentTime) => {
      animationFrameId = requestAnimationFrame(draw);
      
      if (!isTabVisible) {
        lastTime = currentTime;
        return;
      }
      
      const dt = currentTime - lastTime;
      lastTime = currentTime;
      pulseTime += dt;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion && phase !== 'static') phase = 'static';

      let renderPoints = [];
      let renderMax = 100;
      let renderMin = 0;
      let currentReach = 0;

      // Helper to calculate min/max for dynamic zooming
      const getBounds = (pts) => {
         const vals = pts.map(p => p.v);
         const maxV = Math.max(...vals);
         const minV = Math.min(...vals);
         const padding = Math.max(10, (maxV - minV) * 0.2);
         return { min: Math.max(0, minV - padding), max: maxV + padding };
      };

      if (phase === 'static') {
        const bounds = getBounds(points);
        renderMax = bounds.max;
        renderMin = bounds.min;
        points.forEach((p, i) => {
          renderPoints.push({
            x: padL + Math.min(i, numPoints - 2) * stepX,
            y: H - padB - ((p.v - renderMin) / (renderMax - renderMin)) * graphH,
            w: p.w,
            v: p.v
          });
        });
        currentReach = points[points.length - 1].v;
      } 
      else if (phase === 'intro') {
        const elapsed = currentTime - introStartTime;
        let p = Math.min(1, elapsed / introDuration);
        p = 1 - Math.pow(1 - p, 3); // cubic ease-out
        
        const maxIntroPoints = numPoints - 1; 
        const currentNum = Math.max(1, Math.floor(p * maxIntroPoints));
        
        const activePoints = points.slice(0, currentNum + 1);
        const bounds = getBounds(activePoints);
        
        renderMax = Math.max(100, bounds.max);
        renderMin = bounds.min * p; // animate bottom up
        
        for (let i = 0; i < currentNum; i++) {
          renderPoints.push({
            x: padL + i * stepX,
            y: H - padB - ((points[i].v - renderMin) / (renderMax - renderMin)) * graphH,
            w: points[i].w,
            v: points[i].v
          });
        }
        
        if (currentNum < maxIntroPoints) {
           const lastP = points[currentNum - 1];
           const nextP = points[currentNum];
           const segmentProgress = (p * maxIntroPoints) % 1;
           const interpV = lastP.v + (nextP.v - lastP.v) * segmentProgress;
           renderPoints.push({ 
             x: padL + (currentNum - 1) * stepX + stepX * segmentProgress,
             y: H - padB - ((interpV - renderMin) / (renderMax - renderMin)) * graphH, 
             w: lastP.w,
             v: interpV
           });
        }
        
        currentReach = renderPoints[renderPoints.length - 1].v;
        if (elapsed >= introDuration) {
          phase = 'live';
        }
      } 
      else if (phase === 'live') {
        liveTimer += dt;
        
        if (liveTimer >= liveInterval) {
          liveTimer = 0;
          
          const lastVal = points[points.length - 1].v;
          let stepPercent = Math.random() < 0.7 
              ? (Math.random() * 0.06 + 0.04) 
              : -(Math.random() * 0.04 + 0.03);
          const newVal = Math.max(100, lastVal * (1 + stepPercent));
          
          points.shift();
          points.push({ w: week++, v: newVal });
          
          if (newVal > lastVal) {
            heartScale = 1.4; 
          } else {
            heartScale = 0.8; 
          }
        }
        
        const baseScale = 1 + 0.05 * Math.sin(pulseTime / 150);
        heartScale += (baseScale - heartScale) * 0.1;
        
        transitionProgress = liveTimer / liveInterval;
        const easeSlide = transitionProgress < 0.5 
          ? 2 * transitionProgress * transitionProgress 
          : 1 - Math.pow(-2 * transitionProgress + 2, 2) / 2;

        const oldBounds = getBounds(points.slice(0, numPoints - 1));
        const newBounds = getBounds(points);
        renderMax = oldBounds.max + (newBounds.max - oldBounds.max) * easeSlide;
        renderMin = oldBounds.min + (newBounds.min - oldBounds.min) * easeSlide;

        for (let i = 0; i < numPoints - 1; i++) {
           renderPoints.push({
             x: padL + i * stepX - easeSlide * stepX,
             y: H - padB - ((points[i].v - renderMin) / (renderMax - renderMin)) * graphH,
             w: points[i].w,
             v: points[i].v
           });
        }
        
        const lastPrev = points[numPoints - 2];
        const lastNew = points[numPoints - 1];
        const startY = H - padB - ((lastPrev.v - renderMin) / (renderMax - renderMin)) * graphH;
        const targetY = H - padB - ((lastNew.v - renderMin) / (renderMax - renderMin)) * graphH;
        
        renderPoints.push({
           x: padL + (numPoints - 2) * stepX,
           y: startY + (targetY - startY) * easeSlide,
           w: lastNew.w,
           v: lastPrev.v + (lastNew.v - lastPrev.v) * easeSlide
        });
        
        currentReach = renderPoints[renderPoints.length - 1].v;
      }

      let d = '';
      let lastX = 0, lastY = 0;
      
      renderPoints.forEach((p, i) => {
        if (i === 0) d += `M ${p.x} ${p.y} `;
        else d += `L ${p.x} ${p.y} `;
        
        if (i === renderPoints.length - 1) { 
           lastX = p.x; 
           lastY = p.y; 
        }
      });

      if (pathRef.current) pathRef.current.setAttribute('d', d);
      
      if (heartContainerRef.current) {
        heartContainerRef.current.setAttribute('transform', `translate(${lastX}, ${lastY}) scale(${heartScale || 1})`);
      }

      if (chipTextRef.current) {
        chipTextRef.current.textContent = `+${Math.round(currentReach).toLocaleString()}`;
      }

      if (gridLinesRef.current && yAxisRef.current) {
         let gridHTML = '';
         let yHTML = '';
         const numY = 4;
         for (let i=0; i<=numY; i++) {
           const y = H - padB - (i / numY) * graphH;
           const val = Math.round(renderMin + (i / numY) * (renderMax - renderMin));
           gridHTML += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="var(--border)" stroke-width="1" />`;
           yHTML += `<text x="${padL - 15}" y="${y + 5}" fill="var(--text-primary)" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600" textAnchor="end">${val.toLocaleString()}</text>`;
         }
         gridLinesRef.current.innerHTML = gridHTML;
         yAxisRef.current.innerHTML = yHTML;
      }

      if (xAxisRef.current) {
        let xHTML = '';
        renderPoints.forEach((p, i) => {
          if (phase === 'live' && i === renderPoints.length - 1) return;
          // Only show 5-6 X labels (every 2nd point)
          if (Math.round(p.w) % 2 === 0) {
            if (p.x >= padL - 10 && p.x <= W - padR + 10) {
               xHTML += `<text x="${p.x}" y="${H - 18}" fill="var(--text-primary)" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600" textAnchor="middle">Wk ${Math.round(p.w)}</text>`;
            }
          }
        });
        xAxisRef.current.innerHTML = xHTML;
      }
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animationFrameId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <div className="w-full h-full relative overflow-hidden" aria-label="Live growth graph showing increasing Instagram reach">
      <svg width="100%" height="100%" viewBox="0 0 1000 500" preserveAspectRatio="none" className="block w-full h-full overflow-visible">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        <g ref={gridLinesRef}></g>
        <g ref={yAxisRef}></g>
        
        <clipPath id="graphClip">
          <rect x="90" y="0" width="870" height="500" />
        </clipPath>

        <g clipPath="url(#graphClip)">
          <path 
            ref={pathRef} 
            fill="none" 
            stroke="#3801c9" 
            strokeWidth="4" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            filter="url(#glow)"
          />
          <g ref={xAxisRef}></g>
        </g>
        
        {/* Floating Heart and Chip */}
        <g ref={heartContainerRef} transform="translate(-1000, -1000)">
          {/* Chip */}
          <g transform="translate(0, -50)">
            <rect x="-55" y="-20" width="110" height="40" rx="20" fill="var(--bg-surface)" stroke="var(--border)" strokeWidth="1" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))" />
            <text ref={chipTextRef} x="0" y="7" fill="var(--text-primary)" fontFamily="Inter, sans-serif" fontSize="22" fontWeight="bold" textAnchor="middle">+0</text>
          </g>
          {/* Heart Icon */}
          <circle cx="0" cy="0" r="14" fill="var(--bg-base)" stroke="#3801c9" strokeWidth="3" />
          <path 
            d="M0,3.5 C-4,-1.5 -9,1 -9,6 C-9,10.5 0,16 0,16 C0,16 9,10.5 9,6 C9,1 4,-1.5 0,3.5 Z" 
            fill="#3801c9" 
            transform="translate(0,-7) scale(0.7)"
          />
        </g>
      </svg>
    </div>
  );
}
