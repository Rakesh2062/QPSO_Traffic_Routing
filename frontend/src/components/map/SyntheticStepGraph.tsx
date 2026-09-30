"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Play, Pause, SkipForward, SkipBack, RotateCcw, Cpu,
  Activity, Sliders, Sparkles, Zap, Info, TrendingDown, Plus,
  Trash2, Link as LinkIcon, Settings, CheckCircle2, MousePointer,
  ArrowLeft,
} from "lucide-react";
import {
  generateQPSOStepSequence,
  AlgorithmStepSnapshot,
  SyntheticNode,
  SyntheticEdge,
} from "@/lib/syntheticStepEngine";
import type { BenchmarkConfig } from "@/components/charts/BenchmarkPanel";

const ROUTE_COLORS = ["#06b6d4", "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#a855f7"];

type EditMode = "add_node" | "add_edge" | "select" | "none";

interface PendingEdge { srcId: string }

function congestionColor(c: number): string {
  if (c <= 1.2) return "#10b981";
  if (c <= 1.6) return "#f59e0b";
  return "#f43f5e";
}

export function SyntheticStepGraph({
  className = "",
  onRunQPSO,
}: {
  className?: string;
  onRunQPSO?: (config: BenchmarkConfig) => void;
}) {
  // ── User Graph State ─────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<SyntheticNode[]>([]);
  const [edges, setEdges] = useState<SyntheticEdge[]>([]);
  const [editMode, setEditMode] = useState<EditMode>("add_node");
  const [pendingEdge, setPendingEdge] = useState<PendingEdge | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [edgeDistanceInput, setEdgeDistanceInput] = useState<string>("2.5");
  const [edgeCongestionInput, setEdgeCongestionInput] = useState<string>("1.0");
  const [numVehicles, setNumVehicles] = useState<number>(2);
  const [vehicleCapacity, setVehicleCapacity] = useState<number>(100);
  const [maxWaitDefault, setMaxWaitDefault] = useState<number>(120);
  const [trafficMultiplier, setTrafficMultiplier] = useState<number>(1.0);
  const [iterations, setIterations] = useState<number>(25);
  const [nodeMaxWaitInput, setNodeMaxWaitInput] = useState<string>("120");
  const [demandMode, setDemandMode] = useState<"auto" | "manual">("auto");
  const [nodeDemandInput, setNodeDemandInput] = useState<string>("20");

  const [stepSnapshots, setStepSnapshots] = useState<AlgorithmStepSnapshot[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [animTick, setAnimTick] = useState<number>(0);

  // Animation frame loop for vehicle movement & pulse
  useEffect(() => {
    if (!hasRun) return;
    let rafId: number;
    let lastTime = performance.now();
    const loop = (time: number) => {
      if (time - lastTime >= 25) {
        setAnimTick((t) => (t + 1) % 10000);
        lastTime = time;
      }
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [hasRun]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Canvas Coordinate Utils ───────────────────────────────────────────────
  const toCanvasCoord = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 50, y: 50 };
    return {
      x: Math.round(((clientX - rect.left) / rect.width) * 100),
      y: Math.round(((clientY - rect.top) / rect.height) * 100),
    };
  }, []);

  const toScreenCoord = useCallback((x: number, y: number, W: number, H: number, PAD = 20) => ({
    sx: PAD + (x / 100) * (W - PAD * 2),
    sy: PAD + (y / 100) * (H - PAD * 2),
  }), []);

  // ── Canvas Click Handler ─────────────────────────────────────────────────
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hasRun) return; // locked after QPSO run
    const { x, y } = toCanvasCoord(e.clientX, e.clientY);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;

    if (editMode === "add_node") {
      const isDepot = nodes.length === 0;
      const id = isDepot ? "depot" : `n${Date.now()}`;
      const mw = parseInt(nodeMaxWaitInput) || maxWaitDefault;
      const d = isDepot ? 0 : (demandMode === "manual" ? Math.max(1, parseInt(nodeDemandInput) || 20) : Math.floor(10 + Math.random() * 20));
      setNodes((prev) => [...prev, {
        id, x, y,
        label: isDepot ? "Depot" : `Node ${prev.length}`,
        demand: d,
        maxWaitMinutes: isDepot ? undefined : mw,
        isDepot,
      }]);
    } else if (editMode === "add_edge") {
      // Find which node was clicked
      const PAD = 20;
      const hitNode = nodes.find((n) => {
        const sx = PAD + (n.x / 100) * (W - PAD * 2);
        const sy = PAD + (n.y / 100) * (H - PAD * 2);
        const ex = PAD + (x / 100) * (W - PAD * 2);
        const ey = PAD + (y / 100) * (H - PAD * 2);
        return Math.hypot(sx - ex, sy - ey) < 18;
      });
      if (!hitNode) return;
      if (!pendingEdge) {
        setPendingEdge({ srcId: hitNode.id });
      } else {
        if (pendingEdge.srcId !== hitNode.id) {
          const d = parseFloat(edgeDistanceInput) || 2.5;
          const cong = Math.min(2.5, Math.max(1.0, parseFloat(edgeCongestionInput) || 1.0));
          const eid = `${pendingEdge.srcId}-${hitNode.id}`;
          // Avoid duplicates
          if (!edges.find((e) => e.id === eid || (e.src === hitNode.id && e.dst === pendingEdge.srcId))) {
            setEdges((prev) => [...prev, { id: eid, src: pendingEdge.srcId, dst: hitNode.id, distance: d, weight: d, congestion: cong }]);
          }
        }
        setPendingEdge(null);
      }
    } else if (editMode === "select") {
      const PAD = 20;
      const hit = nodes.find((n) => {
        const sx = PAD + (n.x / 100) * (W - PAD * 2);
        const sy = PAD + (n.y / 100) * (H - PAD * 2);
        const ex = PAD + (x / 100) * (W - PAD * 2);
        const ey = PAD + (y / 100) * (H - PAD * 2);
        return Math.hypot(sx - ex, sy - ey) < 18;
      });
      setSelectedNodeId(hit ? hit.id : null);
    }
  }, [editMode, nodes, edges, pendingEdge, edgeDistanceInput, edgeCongestionInput, nodeMaxWaitInput, maxWaitDefault, demandMode, nodeDemandInput, hasRun, toCanvasCoord]);

  const [legProgress, setLegProgress] = useState<number>(0);

  // ── Playback with Smooth Leg Movement ────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || stepSnapshots.length === 0) return;
    let start = performance.now();
    const duration = 1500 / playSpeed; // 1.5s per delivery leg

    let rafId: number;
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min(1.0, elapsed / duration);
      setLegProgress(p);

      if (p >= 1.0) {
        setCurrentStepIndex((prev) => {
          if (prev >= stepSnapshots.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          start = performance.now();
          setLegProgress(0);
          return prev + 1;
        });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, playSpeed, stepSnapshots.length]);

  const currentSnapshot: AlgorithmStepSnapshot | undefined = stepSnapshots[currentStepIndex];

  // ── Run QPSO ──────────────────────────────────────────────────────────────
  const handleRunQPSOWithFleet = useCallback((fleetCount: number, capacityOverride?: number) => {
    if (nodes.length < 2) return;
    const effCapacity = capacityOverride ?? vehicleCapacity;
    const seq = generateQPSOStepSequence({
      nodes, edges, numVehicles: fleetCount, vehicleCapacity: effCapacity, iterations,
      maxWaitMinutesDefault: maxWaitDefault,
      trafficMultiplier,
      swarmSize: Math.max(10, fleetCount * 5),
    });
    setStepSnapshots(seq);
    setCurrentStepIndex(0);
    setLegProgress(0);
    setIsPlaying(true); // Auto-play delivery dispatch simulation
    setHasRun(true);
    setEditMode("none");
    // Notify parent with benchmark config so it can display the BenchmarkPanel
    onRunQPSO?.({
      nodes,
      edges,
      numVehicles: fleetCount,
      vehicleCapacity: effCapacity,
      maxWaitDefault,
      trafficMultiplier,
      iterations,
    });
  }, [nodes, edges, vehicleCapacity, iterations, maxWaitDefault, trafficMultiplier, onRunQPSO]);

  const handleRunQPSO = useCallback(() => {
    handleRunQPSOWithFleet(numVehicles);
  }, [handleRunQPSOWithFleet, numVehicles]);

  // ── Back to Settings & Edit Mode (Preserves placed nodes, edges & settings) ──
  const handleBackToSettings = useCallback(() => {
    setIsPlaying(false);
    setHasRun(false);
    setStepSnapshots([]);
    setCurrentStepIndex(0);
    setEditMode("add_node");
    setPendingEdge(null);
    setSelectedNodeId(null);
  }, []);

  const handleReset = useCallback(() => {
    setNodes([]);
    setEdges([]);
    setStepSnapshots([]);
    setCurrentStepIndex(0);
    setIsPlaying(false);
    setHasRun(false);
    setEditMode("add_node");
    setPendingEdge(null);
    setSelectedNodeId(null);
  }, []);

  // ── Canvas Draw ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W;
    canvas.height = H;
    ctx.clearRect(0, 0, W, H);

    const PAD = 20;
    const proj = (x: number, y: number) => ({
      sx: PAD + (x / 100) * (W - PAD * 2),
      sy: PAD + (y / 100) * (H - PAD * 2),
    });

    // Which state to render
    const snap = currentSnapshot;
    const displayNodes = snap ? snap.visibleNodes : nodes;
    const displayEdges = snap ? snap.visibleEdges : edges;
    const routes = snap?.currentRoutes ?? [];
    const particles = snap?.activeParticles ?? [];
    const highlighted = new Set(snap?.highlightedEdgeIds ?? []);

    const nodeMap = new Map<string, { sx: number; sy: number }>();
    displayNodes.forEach((n) => nodeMap.set(n.id, proj(n.x, n.y)));

    // Grid background
    ctx.strokeStyle = "rgba(99,102,241,0.07)";
    ctx.lineWidth = 1;
    for (let gx = 0; gx <= 10; gx++) {
      const sx = PAD + (gx / 10) * (W - PAD * 2);
      ctx.beginPath(); ctx.moveTo(sx, PAD); ctx.lineTo(sx, H - PAD); ctx.stroke();
    }
    for (let gy = 0; gy <= 10; gy++) {
      const sy = PAD + (gy / 10) * (H - PAD * 2);
      ctx.beginPath(); ctx.moveTo(PAD, sy); ctx.lineTo(W - PAD, sy); ctx.stroke();
    }

    // Edges
    displayEdges.forEach((edge) => {
      const from = nodeMap.get(edge.src);
      const to = nodeMap.get(edge.dst);
      if (!from || !to) return;
      const isHl = highlighted.has(edge.id);

      ctx.beginPath();
      ctx.moveTo(from.sx, from.sy);
      ctx.lineTo(to.sx, to.sy);
      ctx.strokeStyle = isHl ? "#fbbf24" : congestionColor(edge.congestion);
      ctx.lineWidth = isHl ? 3 : 1.5;
      ctx.globalAlpha = isHl ? 0.9 : 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Distance & Congestion pill label
      const fromNode = displayNodes.find((n) => n.id === edge.src);
      const toNode = displayNodes.find((n) => n.id === edge.dst);
      const autoDist = fromNode && toNode ? +(Math.hypot(fromNode.x - toNode.x, fromNode.y - toNode.y) * 0.08).toFixed(1) : 1.0;
      const edgeDist = edge.distance ?? edge.weight ?? autoDist;
      const labelText = edge.congestion > 1.0 ? `${edgeDist}km · ${edge.congestion.toFixed(1)}x` : `${edgeDist}km`;

      const mx = (from.sx + to.sx) / 2;
      const my = (from.sy + to.sy) / 2;
      
      // Draw background pill for high legibility
      ctx.font = "bold 9px monospace";
      const textMetrics = ctx.measureText(labelText);
      const padX = 5, padY = 2;
      const boxW = textMetrics.width + padX * 2;
      const boxH = 15;

      ctx.fillStyle = isHl ? "rgba(251, 191, 36, 0.25)" : "rgba(15, 23, 42, 0.85)";
      ctx.strokeStyle = isHl ? "#fbbf24" : "rgba(100, 116, 139, 0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(mx - boxW / 2, my - boxH / 2 - 4, boxW, boxH, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = isHl ? "#fbbf24" : "#cbd5e1";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, mx, my - 4);
      ctx.textBaseline = "alphabetic";
    });

    // Route overlays
    routes.forEach((route, vIdx) => {
      if (route.length < 2) return;
      const color = ROUTE_COLORS[vIdx % ROUTE_COLORS.length];
      for (let i = 0; i < route.length - 1; i++) {
        const from = nodeMap.get(route[i]);
        const to = nodeMap.get(route[i + 1]);
        if (!from || !to) continue;
        ctx.beginPath();
        ctx.moveTo(from.sx, from.sy);
        ctx.lineTo(to.sx, to.sy);
        ctx.strokeStyle = color;
        ctx.lineWidth = 3.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.globalAlpha = 0.85;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        // Arrow
        const angle = Math.atan2(to.sy - from.sy, to.sx - from.sx);
        const mx = (from.sx + to.sx) / 2, my = (from.sy + to.sy) / 2;
        const AL = 8, AW = 4;
        ctx.beginPath();
        ctx.moveTo(mx - AL * Math.cos(angle) + AW * Math.sin(angle), my - AL * Math.sin(angle) - AW * Math.cos(angle));
        ctx.lineTo(mx + AL * Math.cos(angle), my + AL * Math.sin(angle));
        ctx.lineTo(mx - AL * Math.cos(angle) - AW * Math.sin(angle), my - AL * Math.sin(angle) + AW * Math.cos(angle));
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
      }
    });

    // Particles
    particles.forEach((p) => {
      const from = nodeMap.get(p.currentStopId);
      const to = nodeMap.get(p.targetStopId);
      if (!from || !to) return;
      const px = from.sx + (to.sx - from.sx) * p.progress;
      const py = from.sy + (to.sy - from.sy) * p.progress;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Pending edge line (while adding edge)
    if (pendingEdge && editMode === "add_edge") {
      const srcPos = nodeMap.get(pendingEdge.srcId);
      if (srcPos) {
        ctx.beginPath();
        ctx.moveTo(srcPos.sx, srcPos.sy);
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = "#06b6d4";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Nodes
    const visitedSet = new Set(snap?.visitedNodeIds ?? []);
    const unservedSet = new Set((snap?.unservedNodes ?? []).map((n) => n.id));

    displayNodes.forEach((node) => {
      const pos = nodeMap.get(node.id);
      if (!pos) return;
      const isDepot = node.isDepot;
      const isSelected = node.id === selectedNodeId;
      const isPendingSrc = pendingEdge?.srcId === node.id;
      const isDelivered = !isDepot && visitedSet.has(node.id);
      const isUnserved = !isDepot && hasRun && unservedSet.has(node.id);

      if (isDepot) {
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, 18, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(6,182,212,0.25)";
        ctx.fill();
      }
      if (isSelected || isPendingSrc) {
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, (isDepot ? 12 : 10) + 4, 0, Math.PI * 2);
        ctx.strokeStyle = isPendingSrc ? "#fbbf24" : "#a78bfa";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      if (isUnserved) {
        // Distinct amber dashed beacon ring around unserved customer node
        ctx.beginPath();
        ctx.arc(pos.sx, pos.sy, 15, 0, Math.PI * 2);
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.beginPath();
      ctx.arc(pos.sx, pos.sy, isDepot ? 12 : 9, 0, Math.PI * 2);
      ctx.fillStyle = isDepot ? "#06b6d4" : isDelivered ? "#10b981" : isUnserved ? "#d97706" : "#6366f1";
      ctx.strokeStyle = isUnserved ? "#f59e0b" : "#0f172a";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();

      // Label inside node
      ctx.font = isDepot ? "bold 11px system-ui" : "bold 9px system-ui";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(isDepot ? "D" : isDelivered ? "✓" : isUnserved ? "!" : node.label.replace("Node ", ""), pos.sx, pos.sy);
      ctx.textBaseline = "alphabetic";

      // Demand + Status badges
      if (!isDepot) {
        // Demand badge (kg)
        ctx.font = "bold 8px monospace";
        ctx.fillStyle = isDelivered ? "#34d399" : isUnserved ? "#fbbf24" : node.demand > 30 ? "#f43f5e" : node.demand > 15 ? "#f59e0b" : "#94a3b8";
        ctx.fillText(isDelivered ? `${node.demand}kg ✓` : isUnserved ? `${node.demand}kg ⚠️` : `${node.demand}kg`, pos.sx, pos.sy - 16);
        
        // MaxWait badge
        if (node.maxWaitMinutes !== undefined) {
          ctx.font = "7px monospace";
          ctx.fillStyle = isDelivered ? "#6ee7b7" : isUnserved ? "#fcd34d" : "#38bdf8";
          ctx.fillText(`⏱${node.maxWaitMinutes}m`, pos.sx, pos.sy - 26);
        }
      }
    });

    // 🚚 Active Step-by-Step Delivery Vehicle Dispatch (Starting from Depot)
    if (hasRun) {
      const activeSeg = snap?.activeSegment;
      const vIdx = activeSeg?.vehicleIndex ?? snap?.activeVehicleIndex ?? 0;
      const vehColor = ROUTE_COLORS[vIdx % ROUTE_COLORS.length];
      const depotPos = displayNodes.find((n) => n.isDepot) ? nodeMap.get(displayNodes.find((n) => n.isDepot)!.id) : undefined;

      let vx = 0;
      let vy = 0;

      if (activeSeg) {
        const fromPos = nodeMap.get(activeSeg.fromId);
        const toPos = nodeMap.get(activeSeg.toId);
        if (fromPos && toPos) {
          const progress = isPlaying ? legProgress : 1.0;
          vx = fromPos.sx + (toPos.sx - fromPos.sx) * progress;
          vy = fromPos.sy + (toPos.sy - fromPos.sy) * progress;
        }
      } else if (depotPos) {
        // At start (Step 0) - stationed at depot
        vx = depotPos.sx;
        vy = depotPos.sy;
      }

      if (vx && vy) {
        // Pulsing beacon ring
        const pulsePhase = (animTick % 30) / 30;
        const pulseRadius = 14 + pulsePhase * 10;
        const pulseAlpha = Math.max(0, 0.55 * (1 - pulsePhase));

        ctx.save();

        // 1. Outer animated beacon aura
        ctx.beginPath();
        ctx.arc(vx, vy, pulseRadius, 0, Math.PI * 2);
        ctx.fillStyle = vehColor;
        ctx.globalAlpha = pulseAlpha;
        ctx.fill();
        ctx.globalAlpha = 1;

        // 2. Center vehicle ground target dot
        ctx.beginPath();
        ctx.arc(vx, vy, 4, 0, Math.PI * 2);
        ctx.fillStyle = vehColor;
        ctx.shadowColor = vehColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;

        // 3. Pointer triangle connecting marker to floating badge
        const badgeW = 60;
        const badgeH = 26;
        const badgeY = vy - 35;

        ctx.beginPath();
        ctx.moveTo(vx - 5, badgeY + badgeH);
        ctx.lineTo(vx + 5, badgeY + badgeH);
        ctx.lineTo(vx, vy - 2);
        ctx.closePath();
        ctx.fillStyle = vehColor;
        ctx.fill();

        // 4. Floating Badge Card
        ctx.fillStyle = "rgba(3, 18, 14, 0.95)";
        ctx.strokeStyle = vehColor;
        ctx.lineWidth = 2;
        ctx.shadowColor = vehColor;
        ctx.shadowBlur = 12;

        ctx.beginPath();
        ctx.roundRect(vx - badgeW / 2, badgeY, badgeW, badgeH, 6);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;

        // 5. Truck Icon + Vehicle Label inside badge
        ctx.font = "13px sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("🚚", vx - badgeW / 2 + 5, badgeY + badgeH / 2);

        ctx.font = "bold 10px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(`Veh #${vIdx + 1}`, vx + badgeW / 2 - 5, badgeY + badgeH / 2);

        // 6. Current load label above badge
        const currentLoad = snap?.vehicleLoads?.[vIdx] ?? 0;
        const loadText = `${currentLoad}/${vehicleCapacity}kg`;
        ctx.font = "bold 8px monospace";
        ctx.fillStyle = currentLoad > vehicleCapacity ? "#f43f5e" : vehColor;
        ctx.textAlign = "center";
        ctx.fillText(loadText, vx, badgeY - 5);

        ctx.restore();
      }
    }
  }, [currentSnapshot, nodes, edges, pendingEdge, editMode, selectedNodeId, animTick, isPlaying, hasRun, vehicleCapacity, legProgress]);

  // ── Resize observer ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      el.width = el.offsetWidth;
      el.height = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const phaseColors: Record<string, string> = {
    initialization: "text-sky-400",
    quantum_exploration: "text-cyan-400",
    "2opt_refinement": "text-indigo-400",
    dispatch_simulation: "text-emerald-400",
    converged: "text-emerald-400",
  };

  return (
    <div className={`relative flex flex-col xl:flex-row gap-4 min-h-[600px] rounded-2xl bg-slate-950/80 border border-slate-800 p-4 ${className}`}>
      {/* ── Canvas Area ── */}
      <div className="relative flex-1 flex flex-col min-h-[480px] rounded-xl overflow-hidden border border-slate-800 bg-[#060c18]">
        {/* Canvas Header */}
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800">
          {hasRun && (
            <button
              onClick={handleBackToSettings}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/90 border border-cyan-700/70 text-[11px] font-bold text-cyan-300 hover:bg-cyan-900 transition-all mr-1 shadow-sm cursor-pointer"
              title="Return to editing nodes, edges, and tuning parameters"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Edit</span>
            </button>
          )}
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          <span className={`text-xs font-bold ${currentSnapshot ? phaseColors[currentSnapshot.phase] ?? "text-slate-200" : "text-slate-400"}`}>
            {currentSnapshot?.phaseTitle ?? (hasRun ? "Ready" : editMode === "add_node" ? "Click to place nodes" : editMode === "add_edge" ? (pendingEdge ? "Click target node" : "Click source node") : "Select node")}
          </span>
        </div>

        {/* Step counter */}
        {hasRun && (
          <div className="absolute top-3 right-3 z-10 font-mono text-xs font-semibold bg-slate-950/85 px-3 py-1.5 rounded-xl border border-slate-800 text-cyan-400">
            Step {currentStepIndex + 1} / {stepSnapshots.length}
          </div>
        )}

        {/* Pending edge hint */}
        {editMode === "add_edge" && pendingEdge && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-amber-950/90 border border-amber-500/40 px-4 py-1.5 text-xs text-amber-300 backdrop-blur-md">
            <LinkIcon className="h-3.5 w-3.5" />
            Source selected: <strong>{nodes.find((n) => n.id === pendingEdge.srcId)?.label}</strong>  -  now click destination
          </div>
        )}

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-full min-h-[480px] block cursor-crosshair"
          onClick={handleCanvasClick}
        />

        {/* Explanation Banner */}
        <div className="absolute bottom-3 left-3 right-3 z-10 rounded-xl bg-slate-950/90 backdrop-blur-md p-3 border border-slate-800/90 flex items-start gap-3">
          <Info className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-300 leading-relaxed">
            {currentSnapshot?.explanation ?? (
              hasRun ? "Optimization complete."
                : nodes.length === 0 ? "Start by clicking the canvas to place your first node  -  it will become the Depot (D)."
                : nodes.length === 1 ? "Place more delivery nodes. Then switch to 'Add Edge' mode to connect them with weights."
                : `${nodes.length} nodes placed, ${edges.length} edges defined. Add more or click 'Run QPSO'.`
            )}
          </p>
        </div>
      </div>

      {/* ── Right Control Panel ── */}
      <div className="w-full xl:w-96 flex flex-col gap-3">

        {/* Edit Mode Selector (shown before run) */}
        {!hasRun && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <MousePointer className="h-4 w-4 text-cyan-400" />
              Build Graph
            </h3>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { mode: "add_node" as EditMode, label: "Add Node", icon: Plus },
                { mode: "add_edge" as EditMode, label: "Add Edge", icon: LinkIcon },
                { mode: "select" as EditMode, label: "Select", icon: MousePointer },
              ] as const).map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => { setEditMode(mode); setPendingEdge(null); }}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                    editMode === mode
                      ? "border-cyan-600 bg-cyan-950/60 text-cyan-300"
                      : "border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            {/* Node settings when adding nodes */}
            {editMode === "add_node" && (
              <div className="space-y-2.5 pt-1 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Max Wait (min)</label>
                    <input
                      type="number" min="10" step="5" value={nodeMaxWaitInput}
                      onChange={(e) => setNodeMaxWaitInput(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-1">Demand (kg)</label>
                    <select
                      value={demandMode}
                      onChange={(e) => setDemandMode(e.target.value as "auto" | "manual")}
                      className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none font-medium cursor-pointer"
                    >
                      <option value="auto">⚡ Auto Assigned</option>
                      <option value="manual">✏️ Manual Input</option>
                    </select>
                  </div>
                </div>

                {demandMode === "manual" && (
                  <div className="rounded-lg bg-cyan-950/30 border border-cyan-800/40 p-2.5 flex items-center justify-between gap-2 animate-in fade-in">
                    <div>
                      <span className="text-[11px] font-semibold text-cyan-300 block">Manual Demand on Click:</span>
                      <span className="text-[10px] text-slate-400">Parcel weight for new nodes</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={nodeDemandInput}
                        onChange={(e) => setNodeDemandInput(e.target.value)}
                        className="w-20 rounded-md border border-cyan-700/60 bg-slate-900 px-2 py-1 text-sm font-bold font-mono text-cyan-300 text-right focus:outline-none"
                      />
                      <span className="text-xs font-mono text-slate-400">kg</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* Edge distance + congestion inputs */}
            {editMode === "add_edge" && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Distance (km)</label>
                  <input
                    type="number" min="0.1" step="0.5" value={edgeDistanceInput}
                    onChange={(e) => setEdgeDistanceInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">Congestion (1 - 2.5)</label>
                  <input
                    type="number" min="1.0" max="2.5" step="0.1" value={edgeCongestionInput}
                    onChange={(e) => setEdgeCongestionInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>
            )}

            {/* Selected node details */}
            {editMode === "select" && selectedNodeId && (() => {
              const n = nodes.find((x) => x.id === selectedNodeId);
              if (!n) return null;
              const isDepot = n.isDepot;
              return (
                <div className="rounded-lg border border-slate-700 bg-slate-800/60 p-3 text-xs space-y-2.5">
                  <div className="flex items-center justify-between border-b border-slate-700/60 pb-1.5">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-cyan-400" />
                      {n.label} {isDepot && "(Depot)"}
                    </span>
                    {!isDepot && (
                      <button
                        onClick={() => {
                          setNodes((p) => p.filter((x) => x.id !== selectedNodeId));
                          setEdges((p) => p.filter((e) => e.src !== selectedNodeId && e.dst !== selectedNodeId));
                          setSelectedNodeId(null);
                        }}
                        className="text-rose-400 hover:text-rose-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Remove
                      </button>
                    )}
                  </div>
                  {!isDepot ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 block mb-1">Demand (kg)</label>
                        <input
                          type="number"
                          min="1"
                          max="1000"
                          value={n.demand}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setNodes((prev) => prev.map((item) => item.id === n.id ? { ...item, demand: val } : item));
                          }}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-slate-400 block mb-1">Max Wait (min)</label>
                        <input
                          type="number"
                          min="10"
                          max="480"
                          value={n.maxWaitMinutes ?? 120}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 120;
                            setNodes((prev) => prev.map((item) => item.id === n.id ? { ...item, maxWaitMinutes: val } : item));
                          }}
                          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400 italic">Depot serves as start & return point for fleet vehicles.</p>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* QPSO Config */}
        {!hasRun && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Settings className="h-4 w-4 text-indigo-400" />
              VRP-TW Configuration
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Vehicles</label>
                <input type="number" min={1} max={10} value={numVehicles}
                  onChange={(e) => setNumVehicles(parseInt(e.target.value) || 2)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Capacity (kg)</label>
                <input type="number" min={10} max={1000} value={vehicleCapacity}
                  onChange={(e) => setVehicleCapacity(parseInt(e.target.value) || 100)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Max Wait (min)</label>
                <input type="number" min={10} max={480} value={maxWaitDefault}
                  onChange={(e) => setMaxWaitDefault(parseInt(e.target.value) || 120)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Iterations</label>
                <input type="number" min={5} max={100} value={iterations}
                  onChange={(e) => setIterations(parseInt(e.target.value) || 25)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:outline-none" />
              </div>
            </div>
            {/* Traffic Multiplier Slider */}
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                Traffic Congestion: <span className={`font-mono font-bold ${
                  trafficMultiplier <= 1.1 ? 'text-emerald-400' :
                  trafficMultiplier <= 1.5 ? 'text-amber-400' : 'text-rose-400'
                }`}>{trafficMultiplier.toFixed(1)}x {trafficMultiplier <= 1.1 ? '🟢 Low' : trafficMultiplier <= 1.5 ? '🟡 Medium' : '🔴 High'}</span>
              </label>
              <input type="range" min="1.0" max="2.5" step="0.1" value={trafficMultiplier}
                onChange={(e) => setTrafficMultiplier(parseFloat(e.target.value))}
                className="w-full h-2 rounded-lg bg-slate-800 accent-amber-400 cursor-pointer" />
              <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                <span>Free flow</span><span>Gridlock</span>
              </div>
            </div>
          </div>
        )}

        {/* Graph Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Nodes", value: nodes.length, color: "text-sky-400" },
            { label: "Edges", value: edges.length, color: "text-indigo-400" },
            { label: "Vehicles", value: numVehicles, color: "text-emerald-400" },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-3 rounded-xl border border-slate-800 bg-slate-900/50 text-center">
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">{label}</span>
              <p className={`text-xl font-mono font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* QPSO Telemetry (shown after run) */}
        {hasRun && currentSnapshot && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Best Fitness</span>
                <p className="text-lg font-mono font-bold text-cyan-400">
                  {currentSnapshot.bestFitness === 9999 ? " - " : currentSnapshot.bestFitness.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Quantum α (Contraction)</span>
                <p className="text-lg font-mono font-bold text-indigo-400">{currentSnapshot.betaContraction.toFixed(2)}</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Cap Utilization</span>
                <p className={`text-lg font-mono font-bold ${
                  (currentSnapshot.stats.capacityUtil ?? 0) > 85 ? 'text-rose-400' :
                  (currentSnapshot.stats.capacityUtil ?? 0) > 60 ? 'text-amber-400' : 'text-emerald-400'
                }`}>{currentSnapshot.stats.capacityUtil ?? 0}%</p>
              </div>
              <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/50">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">TW Violations</span>
                <p className={`text-lg font-mono font-bold ${
                  (currentSnapshot.constraintViolations ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>{currentSnapshot.constraintViolations ?? 0}</p>
              </div>
            </div>
            {/* Per-Vehicle Load Bars */}
            {currentSnapshot.vehicleLoads && currentSnapshot.vehicleLoads.length > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3 space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Vehicle Payload Loads</span>
                {currentSnapshot.vehicleLoads.map((load, vi) => (
                  <div key={vi} className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 w-12 shrink-0">Veh {vi + 1}</span>
                    <div className="flex-1 h-2 rounded bg-slate-800 overflow-hidden">
                      <div
                        className="h-2 rounded transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (load / vehicleCapacity) * 100)}%`,
                          background: load > vehicleCapacity ? '#f43f5e' : load > vehicleCapacity * 0.8 ? '#f59e0b' : '#10b981',
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-300 w-16 text-right">{load.toFixed(0)}/{vehicleCapacity}kg</span>
                  </div>
                ))}
              </div>
            )}

            {/* ⚠️ Fleet Capacity Limit & Unserved Nodes Recommendation Card */}
            {currentSnapshot.unservedNodes && currentSnapshot.unservedNodes.length > 0 && (() => {
              const maxOversizedDemand = Math.max(...currentSnapshot.unservedNodes.map((n) => n.demand || 10));
              const isOversized = maxOversizedDemand > vehicleCapacity;
              const recommendedVehicles = currentSnapshot.recommendedAdditionalVehicles ?? 1;

              return (
                <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-3.5 space-y-2.5 animate-in fade-in shadow-lg shadow-amber-950/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2.5 w-2.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                      </span>
                      <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                        {isOversized ? "Oversized Demand & Fleet Limit" : "Fleet Capacity Limit Reached"}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-amber-900/80 border border-amber-600/60 text-[10px] font-mono font-bold text-amber-200">
                      {currentSnapshot.unservedNodes.length} Unserved
                    </span>
                  </div>

                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    {isOversized ? (
                      <>
                        Node demand up to <strong className="text-white">{maxOversizedDemand}kg</strong> exceeds vehicle capacity (<strong className="text-white">{vehicleCapacity}kg/veh</strong>). The following node(s) could not be fully visited:
                      </>
                    ) : (
                      <>
                        Strict vehicle payload limit of <strong className="text-white">{vehicleCapacity}kg</strong> was strictly enforced. The following node(s) could not be visited with current fleet size:
                      </>
                    )}
                  </p>

                  {/* List of unserved nodes with demand */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {currentSnapshot.unservedNodes.map((un) => (
                      <span
                        key={un.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-900/60 border border-amber-700/70 text-[10px] font-mono font-bold text-amber-200"
                      >
                        <span>📍 {un.label}</span>
                        <span className="text-amber-400 font-extrabold">({un.demand || 10}kg)</span>
                      </span>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-amber-800/60 flex flex-col gap-2">
                    <div className="text-[11px] text-amber-300 font-semibold">
                      <span>Unserved: </span>
                      <strong className="font-mono text-white">{currentSnapshot.unservedDemand ?? 0}kg</strong>
                      <span className="block text-[10px] text-amber-400 font-medium">
                        {isOversized
                          ? `💡 Suggestions: Increase vehicle capacity to ≥${maxOversizedDemand}kg OR add +${recommendedVehicles} vehicle(s):`
                          : `💡 Suggestion: Need +${recommendedVehicles} more vehicle(s)`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isOversized && (
                        <button
                          onClick={() => {
                            setVehicleCapacity(maxOversizedDemand);
                            handleRunQPSOWithFleet(numVehicles, maxOversizedDemand);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        >
                          <Zap className="h-3.5 w-3.5" />
                          <span>Upgrade Capacity to {maxOversizedDemand}kg &amp; Re-run</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          const newTotal = numVehicles + recommendedVehicles;
                          setNumVehicles(newTotal);
                          handleRunQPSOWithFleet(newTotal);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Plus className="h-3.5 w-3.5 stroke-[3]" />
                        <span>Add +{recommendedVehicles} Veh &amp; Re-run</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Playback Controls (shown after run) */}
        {hasRun && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-emerald-400" />
                Multi-Vehicle Dispatch Simulation
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {Math.round(((currentStepIndex + 1) / Math.max(1, stepSnapshots.length)) * 100)}%
              </span>
            </div>
            <input
              type="range" min={0} max={Math.max(0, stepSnapshots.length - 1)}
              value={currentStepIndex}
              onChange={(e) => { setCurrentStepIndex(parseInt(e.target.value)); setIsPlaying(false); }}
              className="w-full h-2 rounded-lg bg-slate-800 accent-emerald-400 cursor-pointer"
            />
            <div className="flex items-center gap-2">
              <button onClick={() => { setCurrentStepIndex(0); setIsPlaying(false); }}
                className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Restart from Depot">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button onClick={() => { setCurrentStepIndex((p) => Math.max(0, p - 1)); setIsPlaying(false); }}
                disabled={currentStepIndex <= 0}
                className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                title="Previous Leg">
                <SkipBack className="h-4 w-4" />
              </button>
              <button onClick={() => setIsPlaying(!isPlaying)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all cursor-pointer">
                {isPlaying ? <><Pause className="h-4 w-4 fill-slate-950 text-slate-950" /> Pause Dispatch</> : <><Play className="h-4 w-4 fill-slate-950 text-slate-950" /> Simulate Delivery Dispatch</>}
              </button>
              <button onClick={() => { setCurrentStepIndex((p) => Math.min(stepSnapshots.length - 1, p + 1)); setIsPlaying(false); }}
                disabled={currentStepIndex >= stepSnapshots.length - 1}
                className="p-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-colors cursor-pointer"
                title="Next Leg">
                <SkipForward className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-xs border-t border-slate-800 pt-2">
              <span className="text-slate-400">Speed</span>
              <div className="flex gap-1">
                {[0.5, 1, 2, 4].map((s) => (
                  <button key={s} onClick={() => setPlaySpeed(s)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${playSpeed === s ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:text-white"}`}>
                    {s}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col gap-2 mt-auto">
          {!hasRun ? (
            <button
              onClick={handleRunQPSO}
              disabled={nodes.length < 2}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Zap className="h-4 w-4 text-slate-950" />
              {nodes.length < 2 ? `Place at least 2 nodes (${nodes.length}/2)` : `Run QPSO on ${nodes.length} Nodes`}
            </button>
          ) : (
            <>
              <button
                onClick={handleBackToSettings}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white px-4 py-2.5 text-sm font-semibold text-slate-200 shadow-md transition-all cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Settings & Edit Graph
              </button>
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/60 transition-all cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Graph & Start Fresh
              </button>
            </>
          )}
          {!hasRun && (
            <button
              onClick={() => { setNodes([]); setEdges([]); setPendingEdge(null); setSelectedNodeId(null); }}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
