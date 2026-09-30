"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { GraphData } from "@/types";
import { useAppStore } from "@/store/useAppStore";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Navigation,
  Layers,
  Truck,
  Sparkles,
  Zap,
  Clock,
  Compass,
} from "lucide-react";

interface NetworkMapProps {
  graphData: GraphData;
  /** Highlight these node IDs as vehicle route stops (list per vehicle) */
  activeRoutes?: string[][];
  depotNodeId?: string;
  className?: string;
  selectedVehicleIndex?: number | null;
  onSelectVehicle?: (index: number | null) => void;
}

// Congestion factor → Color
function congestionToColor(factor: number): string {
  if (factor <= 1.25) return "#10b981"; // Low (emerald)
  if (factor <= 1.75) return "#f59e0b"; // Moderate (amber)
  return "#f43f5e"; // Heavy (rose)
}

const ROUTE_COLORS = [
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#a855f7", // Purple
  "#38bdf8", // Sky
  "#ec4899", // Pink
];

export function NetworkMap({
  graphData,
  activeRoutes = [],
  depotNodeId = "depot",
  className = "",
  selectedVehicleIndex: externalSelectedVeh = null,
  onSelectVehicle,
}: NetworkMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { timeOfDaySeconds } = useAppStore();

  // Selected route state (controlled or uncontrolled)
  const [internalSelectedVeh, setInternalSelectedVeh] = useState<number | null>(null);
  const selectedVehicleIndex = externalSelectedVeh !== undefined ? externalSelectedVeh : internalSelectedVeh;

  const handleSelectVeh = (idx: number | null) => {
    setInternalSelectedVeh(idx);
    if (onSelectVehicle) onSelectVehicle(idx);
  };

  // Step-by-Step Path Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [stepProgress, setStepProgress] = useState<number>(1.0); // 0..totalSegments
  const [playSpeed, setPlaySpeed] = useState<number>(1); // 1x, 2x, 4x

  // Compute total path segments for one-by-one drawing
  const targetRoutes = useMemo(() => {
    if (selectedVehicleIndex !== null && activeRoutes[selectedVehicleIndex]) {
      return [{ index: selectedVehicleIndex, stops: activeRoutes[selectedVehicleIndex] }];
    }
    return activeRoutes.map((stops, idx) => ({ index: idx, stops }));
  }, [activeRoutes, selectedVehicleIndex]);

  // Total stops across target route(s)
  const totalSegments = useMemo(() => {
    let segs = 0;
    targetRoutes.forEach((r) => {
      if (r.stops.length > 1) {
        segs += r.stops.length - 1;
      }
    });
    return Math.max(1, segs);
  }, [targetRoutes]);

  // Reset or adjust progress when route changes
  useEffect(() => {
    setStepProgress(totalSegments);
  }, [totalSegments, selectedVehicleIndex]);

  // Step Playback Loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setStepProgress((prev) => {
        if (prev >= totalSegments) {
          setIsPlaying(false);
          return totalSegments;
        }
        return Math.min(totalSegments, prev + 0.15 * playSpeed);
      });
    }, 45);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, totalSegments]);

  // Canvas Grid Rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graphData) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodes = graphData.nodes || [];
    const edges = graphData.edges || [];

    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;

    const hasGeo = nodes.some((n) => n.lat !== undefined && n.lon !== undefined);
    const PADDING = 54;

    const xs = nodes.map((n) => (hasGeo ? (n.lon ?? 0) : (n.x ?? 0)));
    const ys = nodes.map((n) => (hasGeo ? (n.lat ?? 0) : (n.y ?? 0)));
    const minX = Math.min(...xs, 0), maxX = Math.max(...xs, 1);
    const minY = Math.min(...ys, 0), maxY = Math.max(...ys, 1);
    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const proj = (lon: number, lat: number) => ({
      x: PADDING + ((lon - minX) / rangeX) * (W - PADDING * 2),
      y: H - PADDING - ((lat - minY) / rangeY) * (H - PADDING * 2),
    });

    const nodeMap: Record<string, { x: number; y: number; label?: string; demand?: number }> = {};
    nodes.forEach((n) => {
      const lon = hasGeo ? (n.lon ?? 0) : (n.x ?? 0);
      const lat = hasGeo ? (n.lat ?? 0) : (n.y ?? 0);
      nodeMap[n.id] = {
        ...proj(lon, lat),
        label: (n.label as string) || n.id,
        demand: (n.demand as number) ?? 10,
      };
    });

    // Clear Canvas
    ctx.clearRect(0, 0, W, H);

    // ── 1. Draw Real City Grid Blueprint Background ───────────────────────────
    const GRID_SIZE = 36;
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(30, 41, 59, 0.45)"; // Slate-800 grid lines

    // Vertical street grid lines & avenue labels
    for (let x = 0; x <= W; x += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();

      // Subtle City Block fills
      if ((x / GRID_SIZE) % 2 === 0) {
        ctx.fillStyle = "rgba(15, 23, 42, 0.3)";
        ctx.fillRect(x + 2, 2, GRID_SIZE - 4, H - 4);
      }
    }

    // Horizontal street grid lines
    for (let y = 0; y <= H; y += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Street Name Watermarks for real city look
    ctx.font = "9px system-ui";
    ctx.fillStyle = "rgba(71, 85, 105, 0.35)";
    const streetNames = ["Grand Ave", "Central Blvd", "4th Street", "Broadway", "Metro Line", "Commerce Rd", "Parkway"];
    streetNames.forEach((st, i) => {
      const sx = 20 + i * 90;
      const sy = 24 + ((i * 35) % (H - 40));
      if (sx < W - 60 && sy < H - 20) {
        ctx.fillText(st, sx, sy);
      }
    });

    // ── 2. Draw Road Network Graph Edges ─────────────────────────────────────
    const hour = (timeOfDaySeconds % 86400) / 3600;
    const timeFactor =
      1.0 +
      0.45 * Math.pow(Math.sin((Math.PI * (hour - 8.0)) / 4.5), 2) +
      0.35 * Math.pow(Math.sin((Math.PI * (hour - 17.0)) / 3.0), 2);

    edges.forEach((e) => {
      const from = nodeMap[e.src];
      const to = nodeMap[e.dst];
      if (!from || !to) return;

      const baseCongestion = (e.congestion as number) ?? 1.0;
      const congestion = Math.min(baseCongestion * timeFactor, 2.5);

      // Road background lane
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
      ctx.lineWidth = 5;
      ctx.stroke();

      // Colored Traffic Lane
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = congestionToColor(congestion);
      ctx.lineWidth = congestion > 1.8 ? 2.5 : 1.5;
      ctx.globalAlpha = 0.45;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw Edge Distance & Weight Badge at Midpoint
      const edgeDist = typeof e.distance === "number" ? e.distance : typeof e.weight === "number" ? e.weight : Math.round(Math.hypot(to.x - from.x, to.y - from.y) * 0.08 * 10) / 10;
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      const badgeText = `${typeof edgeDist === "number" ? edgeDist.toFixed(1) : edgeDist}km · ${congestion.toFixed(1)}x`;

      ctx.save();
      ctx.font = "9px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
      const textWidth = ctx.measureText(badgeText).width;
      ctx.fillStyle = "rgba(10, 15, 30, 0.75)";
      ctx.fillRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 12);
      ctx.strokeStyle = "rgba(51, 65, 85, 0.6)";
      ctx.lineWidth = 0.75;
      ctx.strokeRect(midX - textWidth / 2 - 3, midY - 6, textWidth + 6, 12);
      ctx.fillStyle = "#94a3b8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(badgeText, midX, midY);
      ctx.restore();
    });

    // ── 3. Draw Vehicle Routes with One-by-One Progressive Drawing ───────────
    let currentSegmentCounter = 0;
    let vehicleHeadPos: { x: number; y: number; angle: number; color: string; label: string } | null = null;

    for (let vi = 0; vi < activeRoutes.length; vi++) {
      const stops = activeRoutes[vi];
      if (stops.length < 2) continue;
      const isSelected = selectedVehicleIndex === null || selectedVehicleIndex === vi;
      const color = ROUTE_COLORS[vi % ROUTE_COLORS.length];

      const opacity = isSelected ? 0.95 : 0.12;
      const lineWidth = isSelected ? 4.5 : 2;

      for (let i = 0; i < stops.length - 1; i++) {
        const from = nodeMap[stops[i]];
        const to = nodeMap[stops[i + 1]];
        if (!from || !to) continue;

        currentSegmentCounter++;

        // In one-by-one animation mode, calculate partial segment draw
        const segProgress = Math.max(0, Math.min(1, stepProgress - (currentSegmentCounter - 1)));
        if (segProgress <= 0 && selectedVehicleIndex === vi) continue;

        const endX = from.x + (to.x - from.x) * (isSelected ? segProgress : 1);
        const endY = from.y + (to.y - from.y) * (isSelected ? segProgress : 1);

        // Draw Outer Route Glow for selected route
        if (isSelected) {
          ctx.beginPath();
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(endX, endY);
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth + 5;
          ctx.globalAlpha = 0.22;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Main Route Path
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = opacity;
        ctx.stroke();
        ctx.globalAlpha = 1;

        // Draw Direction Arrow
        if (segProgress > 0.5) {
          const angle = Math.atan2(to.y - from.y, to.x - from.x);
          const mx = (from.x + endX) / 2;
          const my = (from.y + endY) / 2;
          const AL = isSelected ? 10 : 7, AW = isSelected ? 5 : 3.5;

          ctx.beginPath();
          ctx.moveTo(mx - AL * Math.cos(angle) + AW * Math.sin(angle), my - AL * Math.sin(angle) - AW * Math.cos(angle));
          ctx.lineTo(mx + AL * Math.cos(angle), my + AL * Math.sin(angle));
          ctx.lineTo(mx - AL * Math.cos(angle) - AW * Math.sin(angle), my - AL * Math.sin(angle) + AW * Math.cos(angle));
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.globalAlpha = opacity;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        // Track Vehicle Head for the active animating vehicle
        if (isSelected && segProgress > 0 && segProgress < 1) {
          const angle = Math.atan2(to.y - from.y, to.x - from.x);
          vehicleHeadPos = {
            x: endX,
            y: endY,
            angle,
            color,
            label: `Vehicle ${vi + 1}`,
          };
        }
      }
    }

    // Draw Animating Vehicle Marker
    if (vehicleHeadPos) {
      const vHead = vehicleHeadPos;
      ctx.save();
      ctx.translate(vHead.x, vHead.y);
      ctx.rotate(vHead.angle);

      // Vehicle Pulse Halo
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(6, 182, 212, 0.35)";
      ctx.fill();

      // Vehicle Body Icon
      ctx.fillStyle = vHead.color;
      ctx.fillRect(-8, -5, 16, 10);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(4, -4, 3, 8); // windshield
      ctx.restore();
    }

    // ── 4. Draw City Network Nodes & Depot ───────────────────────────────────
    nodes.forEach((n) => {
      const p = nodeMap[n.id];
      if (!p) return;
      const isDepot = n.id === depotNodeId;
      const demand = (n.demand as number) ?? 0;

      // Find if this node is on the currently selected route
      let selectedStopOrder: number | null = null;
      if (selectedVehicleIndex !== null && activeRoutes[selectedVehicleIndex]) {
        const order = activeRoutes[selectedVehicleIndex].indexOf(n.id);
        if (order !== -1) selectedStopOrder = order;
      }

      if (isDepot) {
        // Depot Master Icon
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6, 182, 212, 0.3)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fillStyle = "#06b6d4";
        ctx.strokeStyle = "#020617";
        ctx.lineWidth = 2.5;
        ctx.fill();
        ctx.stroke();

        ctx.font = "bold 10px system-ui";
        ctx.fillStyle = "#020617";
        ctx.fillText("D", p.x - 4, p.y + 3.5);

        ctx.font = "bold 10px system-ui";
        ctx.fillStyle = "#38bdf8";
        ctx.fillText("Central Depot", p.x + 14, p.y + 3);
      } else {
        // Regular Delivery Node
        const isHighlight = selectedStopOrder !== null;

        ctx.beginPath();
        ctx.arc(p.x, p.y, isHighlight ? 8 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = isHighlight ? "#6366f1" : demand > 30 ? "#f43f5e" : demand > 15 ? "#f59e0b" : "#475569";
        ctx.strokeStyle = isHighlight ? "#ffffff" : "#0f172a";
        ctx.lineWidth = isHighlight ? 2 : 1.5;
        ctx.fill();
        ctx.stroke();

        // Sequential stop number badge if on selected route
        if (isHighlight && selectedStopOrder !== null) {
          ctx.font = "bold 9px system-ui";
          ctx.fillStyle = "#ffffff";
          ctx.fillText(String(selectedStopOrder), p.x - 3, p.y + 3);
        }

        // Node Label
        ctx.font = isHighlight ? "bold 10px system-ui" : "9px system-ui";
        ctx.fillStyle = isHighlight ? "#e2e8f0" : "#64748b";
        ctx.fillText(p.label || n.id, p.x + (isHighlight ? 11 : 8), p.y + 3);
      }
    });

    // ── 5. Traffic Congestion Legend ─────────────────────────────────────────
    const legendItems = [
      { color: "#10b981", label: "Low Traffic" },
      { color: "#f59e0b", label: "Moderate" },
      { color: "#f43f5e", label: "Congested" },
    ];
    ctx.font = "10px system-ui";
    legendItems.forEach((item, i) => {
      const lx = 14, ly = H - 18 - i * 16;
      ctx.fillStyle = item.color;
      ctx.fillRect(lx, ly - 7, 12, 8);
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(item.label, lx + 16, ly);
    });
  }, [graphData, activeRoutes, depotNodeId, timeOfDaySeconds, selectedVehicleIndex, stepProgress]);

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-xl bg-[#080d1a] border border-slate-800 ${className}`}>
      {/* Top Interactive Path Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        {/* Vehicle Route Selectors */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 flex items-center gap-1">
            <Truck className="h-3.5 w-3.5 text-cyan-400" />
            Path:
          </span>
          <button
            onClick={() => handleSelectVeh(null)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
              selectedVehicleIndex === null
                ? "bg-slate-700 text-cyan-300 shadow-sm border border-slate-600"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            All Vehicles ({activeRoutes.length})
          </button>
          {activeRoutes.map((_, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectVeh(idx)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all ${
                selectedVehicleIndex === idx
                  ? "border-cyan-500 bg-cyan-950/80 text-cyan-300 shadow-md shadow-cyan-500/20"
                  : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
              />
              Vehicle {idx + 1}
            </button>
          ))}
        </div>

        {/* Playback Controls (One-by-One Stepper) */}
        <div className="flex items-center gap-1.5 ml-auto">
          <button
            onClick={() => {
              setStepProgress(0);
              setIsPlaying(false);
            }}
            title="Reset to Start"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              setStepProgress((p) => Math.max(0, p - 1));
              setIsPlaying(false);
            }}
            disabled={stepProgress <= 0}
            title="Previous Step"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md hover:from-cyan-400 transition-all"
          >
            {isPlaying ? (
              <>
                <Pause className="h-3.5 w-3.5 fill-white" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-white" /> Play One by One
              </>
            )}
          </button>
          <button
            onClick={() => {
              setStepProgress((p) => Math.min(totalSegments, p + 1));
              setIsPlaying(false);
            }}
            disabled={stepProgress >= totalSegments}
            title="Next Step"
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 text-slate-400 hover:text-white disabled:opacity-40 transition-colors"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 ml-1 border-l border-slate-800 pl-2">
            {[1, 2, 4].map((s) => (
              <button
                key={s}
                onClick={() => setPlaySpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all ${
                  playSpeed === s
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Canvas with City Grid Layout */}
      <div className="relative flex-1 min-h-[360px]">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* Active Step / Vehicle Info Banner */}
        <div className="absolute top-2.5 right-3 flex items-center gap-2 rounded-lg bg-slate-950/85 backdrop-blur-md px-3 py-1.5 border border-slate-800 text-[11px] text-slate-300 font-mono">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>
            {selectedVehicleIndex !== null
              ? `Vehicle ${selectedVehicleIndex + 1} Path Active · Step ${Math.min(totalSegments, Math.ceil(stepProgress))} / ${totalSegments}`
              : `All Fleet Paths · Progress: ${Math.round((stepProgress / totalSegments) * 100)}%`}
          </span>
        </div>
      </div>

      {/* Bottom Timeline Scrubber */}
      <div className="px-4 py-2 border-t border-slate-800/80 bg-slate-950/90 flex items-center gap-3">
        <span className="text-[10px] uppercase font-bold text-slate-400 font-mono shrink-0">
          Path Sequence Scrubber
        </span>
        <input
          type="range"
          min={0}
          max={totalSegments}
          step={0.1}
          value={stepProgress}
          onChange={(e) => {
            setStepProgress(parseFloat(e.target.value));
            setIsPlaying(false);
          }}
          className="flex-1 h-1.5 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
        />
        <span className="text-xs font-mono font-bold text-cyan-400 shrink-0">
          {Math.min(totalSegments, Math.ceil(stepProgress))} / {totalSegments} segs
        </span>
      </div>

      {/* Expressive Depot & Node Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 px-4 py-2 bg-slate-950/95 border-t border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-500 text-slate-950 font-black text-[10px]">
            D
          </span>
          <span>
            <strong className="text-cyan-300">Central Depot:</strong> Fleet dispatch hub where all vehicles start and finish.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-white font-bold text-[10px]">
            N
          </span>
          <span>
            <strong className="text-indigo-300">Delivery Nodes:</strong> Customer stops visited exactly once within capacity limits.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-cyan-300 font-mono text-[10px]">
            km
          </span>
          <span>
            <strong className="text-slate-300">Edge Metrics:</strong> Real segment distance (km) &amp; congestion delay multiplier.
          </span>
        </div>
      </div>
    </div>
  );
}
