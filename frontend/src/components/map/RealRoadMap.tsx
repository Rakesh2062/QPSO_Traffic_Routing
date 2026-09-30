"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  RotateCcw,
  Navigation,
  Truck,
  Sparkles,
  Zap,
  MapPin,
  Trash2,
  Building2,
  Sliders,
  CheckCircle2,
  Info,
  Layers,
  Clock,
  Gauge,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Users,
  Car,
  TrendingUp,
  BarChart2,
  Plus,
} from "lucide-react";
import {
  RoadPoint,
  RoadOptimizationResult,
  RoadRouteSegment,
  solveRealMapQPSO,
  snapToNearestRoad,
  TrafficCondition,
  TRAFFIC_PRESETS,
} from "@/lib/roadRouter";
import { RoadBenchmarkPanel, RoadBenchmarkConfig } from "@/components/charts/RoadBenchmarkPanel";

interface CityPreset {
  name: string;
  country: string;
  center: [number, number];
  zoom: number;
  depot: { lat: number; lon: number; name: string };
  sampleStops: { lat: number; lon: number; name: string; demand: number; maxWaitMinutes?: number; timeWindowStart?: string; timeWindowEnd?: string }[];
}

const CITY_PRESETS: CityPreset[] = [
  {
    name: "Bengaluru",
    country: "India",
    center: [12.9716, 77.5946],
    zoom: 13,
    depot: { lat: 12.9716, lon: 77.5946, name: "Cubbon Park Central Dispatch" },
    sampleStops: [
      { lat: 12.9784, lon: 77.5726, name: "Majestic Transport Hub", demand: 25, maxWaitMinutes: 45, timeWindowStart: "08:30", timeWindowEnd: "09:30" },
      { lat: 12.9602, lon: 77.6095, name: "MG Road Commercial Corridor", demand: 35, maxWaitMinutes: 60, timeWindowStart: "09:00", timeWindowEnd: "10:00" },
      { lat: 12.9352, lon: 77.6245, name: "Koramangala Tech Park", demand: 20, maxWaitMinutes: 50, timeWindowStart: "09:30", timeWindowEnd: "10:30" },
      { lat: 12.9165, lon: 77.6101, name: "BTM Layout Distribution Center", demand: 30, maxWaitMinutes: 90, timeWindowStart: "10:00", timeWindowEnd: "11:30" },
      { lat: 12.9250, lon: 77.5938, name: "Jayanagar Residential Hub", demand: 15, maxWaitMinutes: 70, timeWindowStart: "08:30", timeWindowEnd: "10:30" },
      { lat: 12.9856, lon: 77.5533, name: "Rajajinagar Industrial Estate", demand: 40, maxWaitMinutes: 80, timeWindowStart: "09:00", timeWindowEnd: "11:00" },
      { lat: 13.0033, lon: 77.5645, name: "Malleswaram Market", demand: 22, maxWaitMinutes: 55, timeWindowStart: "09:15", timeWindowEnd: "10:15" },
      { lat: 12.9569, lon: 77.7011, name: "Marathahalli Logistics Zone", demand: 28, maxWaitMinutes: 110, timeWindowStart: "10:30", timeWindowEnd: "12:00" },
    ],
  },
  {
    name: "New York City",
    country: "USA",
    center: [40.7589, -73.9851],
    zoom: 13,
    depot: { lat: 40.7589, lon: -73.9851, name: "Times Square Dispatch Hub" },
    sampleStops: [
      { lat: 40.7484, lon: -73.9857, name: "Empire State Commerce", demand: 30, maxWaitMinutes: 45, timeWindowStart: "08:30", timeWindowEnd: "09:30" },
      { lat: 40.7829, lon: -73.9654, name: "Upper East Side Depot", demand: 20, maxWaitMinutes: 60, timeWindowStart: "09:00", timeWindowEnd: "10:30" },
      { lat: 40.7128, lon: -74.006, name: "Financial District Station", demand: 45, maxWaitMinutes: 75, timeWindowStart: "09:30", timeWindowEnd: "11:00" },
      { lat: 40.7282, lon: -73.9942, name: "Greenwich Village Logistics", demand: 25, maxWaitMinutes: 50, timeWindowStart: "10:00", timeWindowEnd: "11:00" },
      { lat: 40.7061, lon: -73.9969, name: "DUMBO Waterfront Hub", demand: 35, maxWaitMinutes: 90, timeWindowStart: "10:30", timeWindowEnd: "12:00" },
    ],
  },
  {
    name: "London",
    country: "UK",
    center: [51.5074, -0.1278],
    zoom: 13,
    depot: { lat: 51.5074, lon: -0.1278, name: "Trafalgar Square Central Depot" },
    sampleStops: [
      { lat: 51.5155, lon: -0.0922, name: "City of London Financial", demand: 30, maxWaitMinutes: 45, timeWindowStart: "09:00", timeWindowEnd: "10:00" },
      { lat: 51.5033, lon: -0.1195, name: "Southbank Promenade", demand: 20, maxWaitMinutes: 60, timeWindowStart: "09:30", timeWindowEnd: "10:45" },
      { lat: 51.5194, lon: -0.127, name: "Bloomsbury Academic Hub", demand: 15, maxWaitMinutes: 50, timeWindowStart: "10:00", timeWindowEnd: "11:00" },
      { lat: 51.4994, lon: -0.1747, name: "South Kensington Museum", demand: 25, maxWaitMinutes: 75, timeWindowStart: "10:30", timeWindowEnd: "12:00" },
      { lat: 51.5045, lon: -0.0195, name: "Canary Wharf Docklands", demand: 38, maxWaitMinutes: 100, timeWindowStart: "11:00", timeWindowEnd: "13:00" },
    ],
  },
  {
    name: "San Francisco",
    country: "USA",
    center: [37.7749, -122.4194],
    zoom: 13,
    depot: { lat: 37.7749, lon: -122.4194, name: "Market Street Central Depot" },
    sampleStops: [
      { lat: 37.7937, lon: -122.3965, name: "Embarcadero Ferry Building", demand: 25, maxWaitMinutes: 45, timeWindowStart: "09:00", timeWindowEnd: "10:00" },
      { lat: 37.7699, lon: -122.4469, name: "Haight-Ashbury Retail", demand: 18, maxWaitMinutes: 60, timeWindowStart: "09:30", timeWindowEnd: "10:45" },
      { lat: 37.7599, lon: -122.4148, name: "Mission District Commerce", demand: 28, maxWaitMinutes: 50, timeWindowStart: "10:00", timeWindowEnd: "11:15" },
      { lat: 37.8080, lon: -122.4177, name: "Fisherman's Wharf Port", demand: 32, maxWaitMinutes: 80, timeWindowStart: "10:30", timeWindowEnd: "12:00" },
      { lat: 37.7879, lon: -122.4074, name: "Union Square Shopping", demand: 24, maxWaitMinutes: 55, timeWindowStart: "11:00", timeWindowEnd: "12:00" },
    ],
  },
];

const ROUTE_COLORS = [
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#f43f5e", // Rose
  "#a855f7", // Purple
  "#38bdf8", // Sky
  "#ec4899", // Pink
  "#84cc16", // Lime
  "#fb923c", // Orange
  "#14b8a6", // Teal
  "#e879f9", // Fuchsia
  "#facc15", // Yellow
  "#4ade80", // Green
  "#60a5fa", // Blue
  "#f87171", // Red
  "#c084fc", // Violet
  "#34d399", // Emerald-light
  "#fbbf24", // Amber-light
  "#67e8f9", // Cyan-light
];

// ── Progressive Log Entry Type ──────────────────────────────────────────────
type LogLevel = "info" | "progress" | "success" | "warn" | "phase";
interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
  detail?: string;
}

export function RealRoadMap({ className = "" }: { className?: string }) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const routesGroupRef = useRef<any>(null);
  const distanceLabelsGroupRef = useRef<any>(null);
  const vehicleGroupRef = useRef<any>(null);
  const logCounterRef = useRef<number>(0);
  const logEndRef = useRef<HTMLDivElement>(null);

  const [selectedCity, setSelectedCity] = useState<CityPreset>(CITY_PRESETS[0]);
  const [clickMode, setClickMode] = useState<"delivery" | "depot">("delivery");
  const [points, setPoints] = useState<RoadPoint[]>([]);
  const [numVehicles, setNumVehicles] = useState<number>(3);
  const [vehicleCapacity, setVehicleCapacity] = useState<number>(100);
  const [trafficCondition, setTrafficCondition] = useState<TrafficCondition>("moderate");
  const [weights, setWeights] = useState({ distance: 0.4, time: 0.4, congestion: 0.2 });

  const [isSolving, setIsSolving] = useState<boolean>(false);
  const [optimizationResult, setOptimizationResult] = useState<RoadOptimizationResult | null>(null);
  const [snappedNotification, setSnappedNotification] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"fleet" | "stops" | "results">("fleet");
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [showMathModal, setShowMathModal] = useState<boolean>(false);
  const [qpsoLog, setQpsoLog] = useState<LogEntry[]>([]);

  // ── Step-by-Step Simulated Dispatch State ──────────────────────────────────
  const [simStepIndex, setSimStepIndex] = useState<number>(0);
  const [isSimPlaying, setIsSimPlaying] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(1); // 1x, 2x, 4x

  const pushLog = (level: LogLevel, message: string, detail?: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
    const entry: LogEntry = { id: ++logCounterRef.current, time, level, message, detail };
    setQpsoLog((prev) => [...prev, entry]);
    // Auto-scroll to bottom after state updates
    setTimeout(() => logEndRef.current?.scrollIntoView({ behavior: "smooth" }), 60);
  };

  // Load sample points for the initial city
  useEffect(() => {
    loadCityPreset(selectedCity);
  }, [selectedCity]);

  const loadCityPreset = (city: CityPreset) => {
    const pts: RoadPoint[] = [
      {
        id: "depot",
        lat: city.depot.lat,
        lon: city.depot.lon,
        name: city.depot.name,
        demand: 0,
        isDepot: true,
      },
      ...city.sampleStops.map((s, idx) => ({
        id: `stop_${idx + 1}`,
        lat: s.lat,
        lon: s.lon,
        name: s.name,
        demand: s.demand,
        maxWaitMinutes: s.maxWaitMinutes ?? 60,
        timeWindowStart: s.timeWindowStart,
        timeWindowEnd: s.timeWindowEnd,
      })),
    ];
    setPoints(pts);
    setOptimizationResult(null);
    setSimStepIndex(0);
    setIsSimPlaying(false);

    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(city.center, city.zoom);
    }
  };

  // Flattened ordered segments across all vehicle routes for step-by-step playback
  const allOrderedSegments = useMemo(() => {
    if (!optimizationResult || !optimizationResult.routes) return [];
    const list: (RoadRouteSegment & {
      vehicleIndex: number;
      cumulativeLoad: number;
      fromName: string;
      toName: string;
      isToDepot: boolean;
      toDemand: number;
    })[] = [];

    optimizationResult.routes.forEach((route, vIdx) => {
      let currentLoad = 0;
      route.segments.forEach((seg) => {
        const fromPt = points.find((p) => p.id === seg.fromId);
        const toPt = points.find((p) => p.id === seg.toId);
        const toDemand = toPt?.isDepot ? 0 : (toPt?.demand || 10);
        currentLoad += toDemand;

        list.push({
          ...seg,
          vehicleIndex: vIdx,
          cumulativeLoad: currentLoad,
          fromName: fromPt?.name || (seg.fromId === "depot" ? "Central Depot" : seg.fromId),
          toName: toPt?.name || (seg.toId === "depot" ? "Central Depot" : seg.toId),
          isToDepot: !!toPt?.isDepot || seg.toId === "depot",
          toDemand,
        });
      });
    });

    return list;
  }, [optimizationResult, points]);

  // Set sim step to all steps once converged
  useEffect(() => {
    if (allOrderedSegments.length > 0) {
      setSimStepIndex(allOrderedSegments.length);
    }
  }, [allOrderedSegments.length]);

  // Simulation Playback Timer
  useEffect(() => {
    if (!isSimPlaying || allOrderedSegments.length === 0) return;
    const interval = setInterval(() => {
      setSimStepIndex((prev) => {
        if (prev >= allOrderedSegments.length) {
          setIsSimPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1800 / simSpeed);

    return () => clearInterval(interval);
  }, [isSimPlaying, simSpeed, allOrderedSegments.length]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || typeof window === "undefined") return;

    let L: any = null;
    let isCancelled = false;

    import("leaflet").then((leaflet) => {
      if (isCancelled || !mapContainerRef.current) return;
      L = leaflet.default || leaflet;

      // Clean up previous map instance if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Initialize map
      const map = L.map(mapContainerRef.current, {
        center: selectedCity.center,
        zoom: selectedCity.zoom,
        zoomControl: false,
      });

      // Custom Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map);

      // OpenStreetMap tiles  -  completely free, no API key required.
      // Dark aesthetic applied via CSS filter on the tile pane (invert + hue-rotate).
      L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
          subdomains: ["a", "b", "c"],
        }
      ).addTo(map);

      // Apply dark filter to tile pane only (preserves marker/overlay colours)
      const tilePane = map.getPane("tilePane") as HTMLElement | null;
      if (tilePane) {
        tilePane.style.filter = "invert(1) hue-rotate(197deg) brightness(0.85) saturate(0.9) contrast(0.95)";
      }

      markersGroupRef.current = L.layerGroup().addTo(map);
      routesGroupRef.current = L.layerGroup().addTo(map);
      distanceLabelsGroupRef.current = L.layerGroup().addTo(map);
      vehicleGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Handle Map Click: Snap to real road and add stop/depot
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        setSnappedNotification("Snapping to nearest drivable road...");

        try {
          const snapped = await snapToNearestRoad(lat, lng);

          setPoints((prev) => {
            if (clickMode === "depot") {
              const updated = prev.filter((p) => !p.isDepot);
              return [
                {
                  id: "depot",
                  lat: snapped.lat,
                  lon: snapped.lon,
                  name: snapped.name || "Central Dispatch Depot",
                  demand: 0,
                  isDepot: true,
                  snappedDistance: snapped.distance,
                },
                ...updated,
              ];
            } else {
              const newStop: RoadPoint = {
                id: `stop_${Date.now()}`,
                lat: snapped.lat,
                lon: snapped.lon,
                name: snapped.name || `Delivery Stop #${prev.length}`,
                demand: Math.floor(15 + Math.random() * 25),
                maxWaitMinutes: [45, 60, 75, 90][Math.floor(Math.random() * 4)],
                snappedDistance: snapped.distance,
              };
              return [...prev, newStop];
            }
          });

          setOptimizationResult(null);

          setSnappedNotification(
            `Snapped: ${snapped.name || "Road Segment"} (${snapped.distance > 0 ? `${snapped.distance}m from click` : "Exact Road Match"})`
          );
          setTimeout(() => setSnappedNotification(null), 3500);
        } catch (err) {
          console.error("Road snap error:", err);
          setSnappedNotification(null);
        }
      });
    });

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers when points change or simulation step changes
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current || typeof window === "undefined") return;

    import("leaflet").then((leaflet) => {
      const L = leaflet.default || leaflet;
      const markersGroup = markersGroupRef.current;
      markersGroup.clearLayers();

      // Find which stops have already been reached in the current simulation step
      const visitedStopIds = new Set<string>();
      if (allOrderedSegments.length > 0) {
        for (let s = 0; s < Math.min(simStepIndex, allOrderedSegments.length); s++) {
          visitedStopIds.add(allOrderedSegments[s].toId);
        }
      }

      points.forEach((point, idx) => {
        const isDepot = point.isDepot;
        const isVisited = !isDepot && visitedStopIds.has(point.id);
        const waitLimit = point.maxWaitMinutes ?? 60;

        // Find which vehicle is assigned to this stop and arrival time
        let assignedInfo = "";
        if (optimizationResult && !isDepot) {
          for (const r of optimizationResult.routes) {
            const seg = r.segments.find((s) => s.toId === point.id);
            if (seg) {
              const isLate = seg.timeWindowStatus === "late";
              assignedInfo = `
                <div style="margin-top: 6px; padding: 5px 8px; border-radius: 8px; background: rgba(15, 23, 42, 0.95); border: 1px solid ${isLate ? '#f43f5e' : '#10b981'}; font-size: 11px;">
                  <div style="color: #38bdf8; font-weight: 700;">🚚 Dispatched via Vehicle #${seg.vehicleIndex + 1}</div>
                  <div style="color: ${isLate ? '#fb7171' : '#4ade80'}; margin-top: 2px;">⏱️ Arrival ETA: ${seg.arrivalTimeMinutes} min (${isLate ? `⚠️ Late by ${seg.arrivalTimeMinutes - waitLimit}m` : '✅ Within Wait Limit'})</div>
                </div>
              `;
              break;
            }
          }
        }

        const iconHtml = isDepot
          ? `<div class="relative flex items-center justify-center">
              <div class="absolute -inset-1.5 bg-cyan-400 rounded-full animate-ping opacity-75"></div>
              <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-cyan-500 text-slate-950 font-black shadow-lg shadow-cyan-500/50 border-2 border-white text-xs">
                D
              </div>
            </div>`
          : `<div class="group relative flex items-center justify-center">
              <div class="flex h-7 w-7 items-center justify-center rounded-full ${
                isVisited
                  ? "bg-emerald-500 text-slate-950 shadow-emerald-500/50"
                  : "bg-indigo-600 text-white"
              } font-bold shadow-md border-2 border-slate-900 text-xs hover:scale-110 transition-transform">
                ${isVisited ? "✓" : idx}
              </div>
              <div class="absolute -top-7 whitespace-nowrap rounded bg-slate-900/95 px-2 py-0.5 text-[9px] ${
                isVisited ? "text-emerald-300" : "text-cyan-300"
              } opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-cyan-800/80 shadow-xl z-50">
                ${point.demand}kg · ⏱${waitLimit}m max wait ${isVisited ? "· Delivered" : ""}
              </div>
            </div>`;

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "custom-road-marker",
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([point.lat, point.lon], { icon: customIcon }).addTo(markersGroup);

        const popupContent = `
          <div style="font-family: system-ui; min-width: 220px; padding: 4px;">
            <div style="font-weight: 700; color: ${isDepot ? "#06b6d4" : "#818cf8"}; font-size: 13px; margin-bottom: 4px;">
              ${isDepot ? "📍 Central Depot (D)" : `📦 Delivery Stop #${idx}: ${point.name}`}
            </div>
            <div style="font-size: 11px; color: #cbd5e1; line-height: 1.5;">
              ${
                isDepot
                  ? "Origin and return terminal for all fleet vehicles."
                  : `• Parcel Weight: <b>${point.demand} kg</b><br>
                     • Time Constraint: <b>⏱️ Max Wait ≤ ${waitLimit} mins</b><br>
                     • Status: <b>${isVisited ? "Delivered (Completed)" : "Awaiting Dispatch"}</b>
                     ${assignedInfo}`
              }
            </div>
            <div style="font-size: 10px; color: #64748b; margin-top: 6px; font-family: monospace;">
              ${point.lat.toFixed(5)}, ${point.lon.toFixed(5)}
            </div>
          </div>
        `;
        marker.bindPopup(popupContent);
      });
    });
  }, [points, simStepIndex, allOrderedSegments, optimizationResult]);

  // Update Routes Polyline Geometry & Distance Badges on Map (Simulated One-by-One)
  useEffect(() => {
    if (
      !mapInstanceRef.current ||
      !routesGroupRef.current ||
      !distanceLabelsGroupRef.current ||
      !vehicleGroupRef.current ||
      typeof window === "undefined"
    )
      return;

    import("leaflet").then((leaflet) => {
      const L = leaflet.default || leaflet;
      const routesGroup = routesGroupRef.current;
      const distanceLabelsGroup = distanceLabelsGroupRef.current;
      const vehicleGroup = vehicleGroupRef.current;

      routesGroup.clearLayers();
      distanceLabelsGroup.clearLayers();
      vehicleGroup.clearLayers();

      if (!optimizationResult || !optimizationResult.routes) return;

      // Draw segments one-by-one up to simStepIndex
      const visibleSegments = allOrderedSegments.slice(0, simStepIndex);

      visibleSegments.forEach((seg, sIdx) => {
        const isCurrentActive = sIdx === simStepIndex - 1;
        const color = ROUTE_COLORS[seg.vehicleIndex % ROUTE_COLORS.length];

        if (seg.coordinates && seg.coordinates.length > 1) {
          // High-precision road line strictly following the road geometry
          L.polyline(seg.coordinates, {
            color: isCurrentActive ? "#38bdf8" : color,
            weight: isCurrentActive ? 5 : 4,
            opacity: isCurrentActive ? 1.0 : 0.85,
            smoothFactor: 1,
          }).addTo(routesGroup);

          // Glow underline
          L.polyline(seg.coordinates, {
            color: isCurrentActive ? "#06b6d4" : color,
            weight: isCurrentActive ? 12 : 7,
            opacity: isCurrentActive ? 0.45 : 0.2,
          }).addTo(routesGroup);

          // Distance & Time badge at the midpoint of the road segment
          const midIndex = Math.floor(seg.coordinates.length / 2);
          const midCoord = seg.coordinates[midIndex];
          const distKm = (seg.distanceMeters / 1000).toFixed(1);
          const durMin = Math.round(seg.durationSeconds / 60);

          const badgeHtml = `
            <div class="px-2 py-0.5 rounded-full ${
              isCurrentActive
                ? "bg-cyan-950 text-cyan-300 border border-cyan-400 font-bold shadow-lg shadow-cyan-500/50 scale-105"
                : "bg-slate-950/90 text-slate-300 border border-slate-700/80"
            } text-[10px] font-mono whitespace-nowrap pointer-events-none transition-all duration-200">
              ${distKm} km · ${durMin} min
            </div>
          `;

          const distanceIcon = L.divIcon({
            html: badgeHtml,
            className: "road-dist-badge",
            iconSize: [80, 20],
            iconAnchor: [40, 10],
          });

          L.marker(midCoord, { icon: distanceIcon, interactive: false }).addTo(distanceLabelsGroup);
        }
      });

      // Render Active Delivery Vehicle at the current segment tip
      if (simStepIndex > 0 && simStepIndex <= allOrderedSegments.length) {
        const activeSeg = allOrderedSegments[simStepIndex - 1];
        if (activeSeg && activeSeg.coordinates && activeSeg.coordinates.length > 0) {
          const lastCoord = activeSeg.coordinates[activeSeg.coordinates.length - 1];
          const vehColor = ROUTE_COLORS[activeSeg.vehicleIndex % ROUTE_COLORS.length];

          const vehicleIconHtml = `
            <div class="relative flex items-center justify-center animate-bounce">
              <div class="absolute -inset-2 bg-cyan-400 rounded-full animate-ping opacity-60"></div>
              <div class="relative flex h-8 w-8 items-center justify-center rounded-xl bg-slate-950 border-2 text-white shadow-2xl text-xs font-black" style="border-color: ${vehColor}">
                🚚
              </div>
            </div>
          `;

          const vehicleDivIcon = L.divIcon({
            html: vehicleIconHtml,
            className: "active-vehicle-marker",
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          L.marker(lastCoord, { icon: vehicleDivIcon, interactive: false }).addTo(vehicleGroup);
        }
      }
    });
  }, [optimizationResult, simStepIndex, allOrderedSegments]);

  // Run Real Map QPSO Optimization
  const handleRunOptimization = async (overrideVehicles?: number, overrideCapacity?: number) => {
    if (points.length < 2) return;
    const effectiveVehicles = overrideVehicles ?? numVehicles;
    const effectiveCapacity = overrideCapacity ?? vehicleCapacity;

    setIsSolving(true);
    setOptimizationResult(null);
    setQpsoLog([]);
    logCounterRef.current = 0;

    const depot = points.find((p) => p.isDepot);
    const customers = points.filter((p) => !p.isDepot);
    const trafficPreset = TRAFFIC_PRESETS[trafficCondition];

    pushLog("phase", "▶ QPSO Initialization", `Setting up problem with ${customers.length} delivery nodes, ${effectiveVehicles} vehicles, capacity ${effectiveCapacity} kg`);
    await new Promise((r) => setTimeout(r, 50));
    pushLog("info", `📍 Depot: ${depot?.name || "Central Depot"}`, `Lat ${depot?.lat.toFixed(4)}, Lon ${depot?.lon.toFixed(4)}`);
    await new Promise((r) => setTimeout(r, 40));
    pushLog("info", `🚚 Fleet: ${effectiveVehicles} vehicle${effectiveVehicles > 1 ? "s" : ""}, each carrying ≤ ${effectiveCapacity} kg`);
    await new Promise((r) => setTimeout(r, 40));
    pushLog("info", `🚦 Traffic condition: ${trafficPreset.icon} ${trafficPreset.label} (×${trafficPreset.multiplier} delay factor)`);
    await new Promise((r) => setTimeout(r, 40));
    pushLog("info", `⚖️  Objective weights  -  Distance: ${(weights.distance*100).toFixed(0)}%  Time: ${(weights.time*100).toFixed(0)}%  Congestion: ${(weights.congestion*100).toFixed(0)}%`);
    await new Promise((r) => setTimeout(r, 40));
    pushLog("phase", "🗺️ Computing real-road distance matrix via OSRM...", `Fetching ${customers.length * (customers.length + 1)} pairwise road routes`);

    let lastReportedIter = 0;

    try {
      const result = await solveRealMapQPSO({
        points,
        numVehicles: effectiveVehicles,
        vehicleCapacity: effectiveCapacity,
        trafficCondition,
        objectiveWeights: weights,
        swarmSize: 45,
        iterations: 60,
        onProgress: (iter, bestFitness, current) => {
          setOptimizationResult(current);
          if (iter === 5 && lastReportedIter < 5) {
            lastReportedIter = 5;
            pushLog("phase", "⚛️ QPSO Swarm running  -  45 quantum particles initialized", `Iteration 5/60  -  Global best fitness: ${bestFitness.toFixed(2)}`);
          }
          if (iter === 10 && lastReportedIter < 10) {
            lastReportedIter = 10;
            const active = current.routes.filter((r) => r.segments.length > 0);
            pushLog("progress", `Iter 10/60  -  ${active.length} active route${active.length !== 1 ? "s" : ""} emerging, fitness: ${bestFitness.toFixed(2)}`,
              active.map((r, i) => `Veh ${i+1}: ${r.stops.length - 2} stop${r.stops.length-2 !== 1 ? "s" : ""}, ${r.load} kg, ${(r.distanceMeters/1000).toFixed(1)} km`).join(" | "));
          }
          if (iter === 20 && lastReportedIter < 20) {
            lastReportedIter = 20;
            pushLog("progress", `Iter 20/60  -  Quantum tunnelling converging particle positions, fitness: ${bestFitness.toFixed(2)}`);
            // Log per-vehicle snapshot
            current.routes.forEach((r, i) => {
              const twOk = r.timeWindowViolations === 0;
              pushLog(twOk ? "info" : "warn",
                `  └ Vehicle #${i+1}: ${r.stops.length-2} stops · ${r.load}/${effectiveCapacity} kg · ${(r.distanceMeters/1000).toFixed(1)} km`,
                twOk ? "✅ All time windows satisfied" : `⚠️ ${r.timeWindowViolations} late arrival${r.timeWindowViolations > 1 ? "s" : ""}`);
            });
          }
          if (iter === 35 && lastReportedIter < 35) {
            lastReportedIter = 35;
            pushLog("progress", `Iter 35/60  -  2-Opt local search refinements applied, fitness: ${bestFitness.toFixed(2)}`);
          }
          if (iter === 50 && lastReportedIter < 50) {
            lastReportedIter = 50;
            pushLog("progress", `Iter 50/60  -  Approaching convergence, fitness: ${bestFitness.toFixed(2)}`);
          }
          if (iter === 60 && lastReportedIter < 60) {
            lastReportedIter = 60;
            pushLog("phase", `✅ QPSO converged after 60 iterations`, `Final global best fitness score: ${bestFitness.toFixed(4)}`);
          }
        },
      });

      setOptimizationResult(result);
      setActiveTab("results");

      // ── Persist this run to localStorage history ──────────────────────────
      try {
        const historyKey = "qpso_road_history";
        const existing: unknown[] = JSON.parse(localStorage.getItem(historyKey) || "[]");
        const newEntry = {
          id: `road-${Date.now()}`,
          name: `${selectedCity.name}  -  ${effectiveVehicles} vehicle${effectiveVehicles > 1 ? "s" : ""}, ${customers.length} stops`,
          graph: `${selectedCity.name} Real Road Map (OSM)`,
          city: selectedCity.name,
          status: "completed",
          created_at: new Date().toISOString(),
          fitness: +result.fitness.toFixed(3),
          totalDistanceKm: +result.totalDistanceKm.toFixed(2),
          totalTimeMinutes: +result.totalTimeMinutes.toFixed(1),
          numVehicles: effectiveVehicles,
          vehicleCapacity: effectiveCapacity,
          numStops: customers.length,
          trafficCondition,
          twViolations: result.totalTimeWindowViolations,
          routeCount: result.routes.length,
          runtime_ms: Math.round(result.iterations * 16), // approximate ms
        };
        const updated = [newEntry, ...existing].slice(0, 50); // keep last 50
        localStorage.setItem(historyKey, JSON.stringify(updated));
      } catch (e) {
        console.warn("Could not save history to localStorage:", e);
      }

      // Final summary log
      pushLog("phase", `🏁 Optimization Complete  -  ${result.routes.length} vehicle route${result.routes.length !== 1 ? "s" : ""} assigned`);
      pushLog("success", `📏 Total road distance: ${result.totalDistanceKm.toFixed(2)} km`);
      pushLog("success", `⏱️  Total estimated drive time: ${result.totalTimeMinutes.toFixed(1)} min (under ${trafficPreset.icon} ${trafficPreset.label})`);
      if (result.totalTimeWindowViolations > 0) {
        pushLog("warn", `⚠️  ${result.totalTimeWindowViolations} time window violation${result.totalTimeWindowViolations > 1 ? "s" : ""} detected  -  consider fewer stops or less congestion`);
      } else {
        pushLog("success", "✅ All deliveries within time windows  -  no violations");
      }
      result.routes.forEach((r, i) => {
        const stopNames = r.stops
          .filter((s) => s !== "depot")
          .map((sid) => points.find((p) => p.id === sid)?.name || sid);
        pushLog("info",
          `  🚚 Vehicle #${i+1}: ${r.stops.length-2} stops · ${r.load} kg · ${(r.distanceMeters/1000).toFixed(1)} km`,
          stopNames.slice(0, 5).join(" → ") + (stopNames.length > 5 ? ` (+${stopNames.length-5} more)` : ""));
      });
    } catch (err) {
      console.error("Optimization failed:", err);
      pushLog("warn", "❌ Optimization encountered an error  -  check console for details");
    } finally {
      setIsSolving(false);
    }
  };

  const handleClearStops = () => {
    const depot = points.find((p) => p.isDepot);
    setPoints(depot ? [depot] : []);
    setOptimizationResult(null);
    setSimStepIndex(0);
    setIsSimPlaying(false);
  };

  const handleRemovePoint = (id: string) => {
    setPoints((prev) => prev.filter((p) => p.id !== id));
    setOptimizationResult(null);
    setSimStepIndex(0);
  };

  const handleUpdatePoint = (id: string, updates: Partial<RoadPoint>) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
    setOptimizationResult(null);
    setSimStepIndex(0);
  };

  // Active step metadata
  const currentActiveSegment =
    simStepIndex > 0 && simStepIndex <= allOrderedSegments.length
      ? allOrderedSegments[simStepIndex - 1]
      : null;

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* ── Main Map + Sidebar Row ─────────────────────────────────────────── */}
      <div className="relative flex flex-col xl:flex-row gap-4 rounded-2xl bg-slate-950/80 border border-slate-800 p-4 min-h-[620px]">
      {/* Left / Main Map Section */}
      <div className="relative flex-1 flex flex-col min-h-[500px] rounded-xl overflow-hidden border border-slate-800 bg-[#0b1120]">
        {/* Map Header Toolbar */}
        <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* City Presets */}
          <div className="flex items-center gap-2 pointer-events-auto bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 shadow-xl">
            <Building2 className="h-4 w-4 text-cyan-400" />
            <select
              value={selectedCity.name}
              onChange={(e) => {
                const found = CITY_PRESETS.find((c) => c.name === e.target.value);
                if (found) setSelectedCity(found);
              }}
              className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-2"
            >
              {CITY_PRESETS.map((city) => (
                <option key={city.name} value={city.name} className="bg-slate-900 text-slate-200">
                  {city.name}, {city.country}
                </option>
              ))}
            </select>
          </div>

          {/* VRP Objective Guide & Math Model Buttons */}
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setShowMathModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950/90 backdrop-blur-md border border-indigo-500/40 text-indigo-300 hover:text-white shadow-xl transition-all hover:border-indigo-400"
            >
              <Zap className="h-3.5 w-3.5 text-indigo-400" />
              <span>📐 VRP Math Model</span>
            </button>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-950/90 backdrop-blur-md border border-slate-800 text-cyan-400 hover:text-cyan-300 shadow-xl transition-all"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Depot & Node Objective</span>
              {showGuide ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            <div className="flex items-center gap-1 bg-slate-950/90 backdrop-blur-md p-1 rounded-xl border border-slate-800 shadow-xl">
              <button
                onClick={() => setClickMode("delivery")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  clickMode === "delivery"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                Add Delivery Stop
              </button>
              <button
                onClick={() => setClickMode("depot")}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  clickMode === "depot"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Navigation className="h-3.5 w-3.5" />
                Set Depot
              </button>
            </div>
          </div>
        </div>

        {/* Objective Explanation Modal/Banner */}
        {showGuide && (
          <div className="absolute top-16 left-3 right-3 z-[410] rounded-xl bg-slate-950/95 backdrop-blur-md border border-cyan-500/40 p-3.5 shadow-2xl text-xs space-y-2">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
              <span className="font-bold text-cyan-300 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-cyan-400" />
                Vehicle Routing Problem (VRP) & Node Roles
              </span>
              <button
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-white text-xs font-mono"
              >
                ✕ Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-slate-300">
              <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-800/40">
                <p className="font-bold text-cyan-400 mb-1 flex items-center gap-1">
                  <span className="h-4 w-4 rounded-full bg-cyan-500 text-slate-950 font-black text-[10px] inline-flex items-center justify-center">
                    D
                  </span>
                  Central Depot (Depot Node)
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  The central warehouse/distribution hub. <strong>All fleet vehicles depart from here</strong> with loaded packages and <strong>must return here</strong> after visiting their assigned stops.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-800/40">
                <p className="font-bold text-indigo-400 mb-1 flex items-center gap-1">
                  <span className="h-4 w-4 rounded-full bg-indigo-600 text-white font-bold text-[10px] inline-flex items-center justify-center">
                    1
                  </span>
                  Delivery Nodes (Customer Stops)
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Each stop represents a customer destination with a package demand (e.g. <strong>25 kg</strong>) that must be delivered exactly once along authentic street paths.
                </p>
              </div>

              <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                <p className="font-bold text-emerald-400 mb-1 flex items-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-emerald-400" />
                  QPSO Objective
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Optimizes vehicle clusters and sequence order to minimize total travel distance, drive time, and congestion while never exceeding each vehicle's payload capacity limit.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Snapped Notification Toast */}
        {snappedNotification && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-2 rounded-full bg-cyan-950/95 border border-cyan-500/40 px-4 py-1.5 text-xs text-cyan-300 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
            <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="font-medium">{snappedNotification}</span>
          </div>
        )}

        {/* Leaflet Canvas Container */}
        <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />

        {/* Simulated Step-by-Step Vision Control Overlay (When Converged) */}
        {allOrderedSegments.length > 0 && (
          <div className="absolute bottom-3 left-3 right-3 z-[400] flex flex-col md:flex-row items-center justify-between gap-2.5 rounded-xl bg-slate-950/95 backdrop-blur-md p-3 border border-slate-800 shadow-2xl">
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSimStepIndex(0);
                  setIsSimPlaying(true);
                }}
                title="Restart from Depot"
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => {
                  setSimStepIndex((prev) => Math.max(0, prev - 1));
                  setIsSimPlaying(false);
                }}
                disabled={simStepIndex === 0}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-all"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsSimPlaying(!isSimPlaying)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 text-xs shadow-md shadow-cyan-500/20 transition-all"
              >
                {isSimPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5 fill-slate-950" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-slate-950" />
                    <span>{simStepIndex >= allOrderedSegments.length ? "Replay Dispatch" : "Simulate Vision"}</span>
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setSimStepIndex((prev) => Math.min(allOrderedSegments.length, prev + 1));
                  setIsSimPlaying(false);
                }}
                disabled={simStepIndex >= allOrderedSegments.length}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition-all"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>

              {/* Speed Multiplier */}
              <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5 text-[10px] font-mono">
                {[1, 2, 4].map((spd) => (
                  <button
                    key={spd}
                    onClick={() => setSimSpeed(spd)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      simSpeed === spd ? "bg-slate-800 text-cyan-400 font-bold" : "text-slate-400"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>

            {/* Current Step Scrubber */}
            <div className="flex-1 flex items-center gap-3 w-full md:w-auto px-2">
              <input
                type="range"
                min={0}
                max={allOrderedSegments.length}
                value={simStepIndex}
                onChange={(e) => {
                  setSimStepIndex(parseInt(e.target.value));
                  setIsSimPlaying(false);
                }}
                className="w-full h-1.5 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
              />
              <span className="font-mono text-xs font-semibold text-cyan-400 shrink-0">
                {simStepIndex} / {allOrderedSegments.length} Legs
              </span>
            </div>

            {/* Live Step Status Summary */}
            {currentActiveSegment && (
              <div className="text-right hidden lg:block shrink-0">
                <p className="text-[11px] font-semibold text-slate-200">
                  <span
                    className="inline-block h-2 w-2 rounded-full mr-1"
                    style={{
                      backgroundColor:
                        ROUTE_COLORS[currentActiveSegment.vehicleIndex % ROUTE_COLORS.length],
                    }}
                  />
                  Veh #{currentActiveSegment.vehicleIndex + 1} ➔ {currentActiveSegment.toName}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  {(currentActiveSegment.distanceMeters / 1000).toFixed(1)} km · {" "}
                  {Math.round(currentActiveSegment.durationSeconds / 60)} min · {" "}
                  {currentActiveSegment.cumulativeLoad} kg load
                </p>
              </div>
            )}
          </div>
        )}

        {/* Road Snapping Guide Overlay Badge */}
        {allOrderedSegments.length === 0 && (
          <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2 rounded-lg bg-slate-950/85 backdrop-blur-md px-3 py-1.5 border border-slate-800 text-[11px] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
            <span>Click map to place stops. All points & routes strictly snap to real roads.</span>
          </div>
        )}
      </div>

      {/* Right Interactive Sidebar & Control Panel */}
      <div className="w-full xl:w-96 flex flex-col gap-3">
        {/* Navigation Tabs */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-900/80 p-1 border border-slate-800">
          <button
            onClick={() => setActiveTab("fleet")}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "fleet" ? "bg-slate-800 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Fleet
          </button>
          <button
            onClick={() => setActiveTab("stops")}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1 ${
              activeTab === "stops" ? "bg-slate-800 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Stops
            <span className="px-1.5 rounded-full bg-slate-700 text-[10px] text-slate-300">
              {points.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("results")}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === "results" ? "bg-slate-800 text-cyan-400 shadow-sm" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Results
          </button>
        </div>

        {/* Tab 1: Fleet & Objectives */}
        {activeTab === "fleet" && (
          <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">Vehicle Fleet</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Vehicles (max 20)</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={numVehicles}
                  onChange={(e) => setNumVehicles(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 block mb-1">Capacity (kg/veh)</label>
                <input
                  type="number"
                  min={10}
                  max={1000}
                  value={vehicleCapacity}
                  onChange={(e) => setVehicleCapacity(parseInt(e.target.value) || 50)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Traffic Condition Preset Selector */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 mb-2">
                <Gauge className="h-3.5 w-3.5 text-amber-400" />
                <h4 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
                  Live Traffic Condition Preset
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(TRAFFIC_PRESETS) as TrafficCondition[]).map((condKey) => {
                  const preset = TRAFFIC_PRESETS[condKey];
                  const isSelected = trafficCondition === condKey;
                  return (
                    <button
                      key={condKey}
                      type="button"
                      onClick={() => setTrafficCondition(condKey)}
                      className={`flex flex-col items-start p-2 rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-amber-500/80 bg-amber-950/30 text-amber-300 shadow-sm"
                          : "border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200 hover:border-slate-700"
                      }`}
                    >
                      <span className="text-[11px] font-bold flex items-center gap-1">
                        <span>{preset.icon}</span>
                        {preset.label.split("/")[0]}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {preset.multiplier}x delay multiplier
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Objective Sliders */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center gap-2 mb-2">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                <h4 className="text-[11px] font-semibold text-slate-300 uppercase tracking-wide">
                  Multi-Objective Tradeoffs
                </h4>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Distance Weight</span>
                    <span className="text-cyan-400 font-mono">{(weights.distance * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights.distance}
                    onChange={(e) => setWeights({ ...weights, distance: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-lg bg-slate-800 accent-cyan-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Travel Time Weight</span>
                    <span className="text-indigo-400 font-mono">{(weights.time * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights.time}
                    onChange={(e) => setWeights({ ...weights, time: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-lg bg-slate-800 accent-indigo-400 cursor-pointer"
                  />
                </div>
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-400">Congestion Avoidance</span>
                    <span className="text-amber-400 font-mono">{(weights.congestion * 100).toFixed(0)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights.congestion}
                    onChange={(e) => setWeights({ ...weights, congestion: parseFloat(e.target.value) })}
                    className="w-full h-1.5 rounded-lg bg-slate-800 accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Stops List */}
        {activeTab === "stops" && (
          <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/50 p-3 max-h-[340px]">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Stops ({points.length})
              </span>
              <button
                onClick={handleClearStops}
                className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear Non-Depot
              </button>
            </div>
            <div className="overflow-y-auto space-y-1.5 pr-1 max-h-[260px]">
              {points.map((p, idx) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
                    p.isDepot
                      ? "border-cyan-800/60 bg-cyan-950/30 text-cyan-300"
                      : "border-slate-800 bg-slate-900/80 text-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ${
                        p.isDepot ? "bg-cyan-500 text-slate-950" : "bg-indigo-600 text-white"
                      }`}
                    >
                      {p.isDepot ? "D" : idx}
                    </span>
                    <div className="truncate">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-slate-500">
                        {p.isDepot
                          ? "Master Dispatch Hub (Origin & Return)"
                          : `${p.demand} kg demand ${p.timeWindowEnd ? `• TW: ${p.timeWindowStart || "08:00"} - ${p.timeWindowEnd}` : ""}`}
                      </p>
                    </div>
                  </div>
                  {!p.isDepot && (
                    <button
                      onClick={() => handleRemovePoint(p.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 transition-colors shrink-0"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Optimization Results & Simulated Vision Dispatch */}
        {activeTab === "results" && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-cyan-400" />
                Quantum Route Solution
              </span>
              {optimizationResult && (
                <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded-full">
                  Converged
                </span>
              )}
            </div>

            {optimizationResult ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Total Road Dist.</p>
                    <p className="text-base font-mono font-bold text-cyan-400">
                      {optimizationResult.totalDistanceKm.toFixed(2)} km
                    </p>
                  </div>
                  <div className="rounded-lg bg-slate-900 p-2.5 border border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase">Est. Drive Time</p>
                    <p className="text-base font-mono font-bold text-indigo-400">
                      {optimizationResult.totalTimeMinutes.toFixed(1)} min
                    </p>
                  </div>
                </div>

                {/* ⚠️ Fleet Capacity Limit & Unserved Nodes Recommendation Card */}
                {optimizationResult.unservedNodes && optimizationResult.unservedNodes.length > 0 && (() => {
                  const maxOversizedDemand = Math.max(...optimizationResult.unservedNodes.map((n) => n.demand || 10));
                  const isOversized = maxOversizedDemand > vehicleCapacity;
                  const recommendedVehicles = optimizationResult.recommendedAdditionalVehicles ?? 1;

                  return (
                    <div className="rounded-xl border border-amber-500/50 bg-amber-950/40 p-3 space-y-2 animate-in fade-in shadow-lg shadow-amber-950/40">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                          <h4 className="text-[11px] font-bold text-amber-300 uppercase tracking-wide">
                            {isOversized ? "Oversized Demand & Fleet Limit" : "Fleet Limit: Unserved Stops"}
                          </h4>
                        </div>
                        <span className="px-1.5 py-0.5 rounded-full bg-amber-900/80 border border-amber-600/60 text-[9px] font-mono font-bold text-amber-200">
                          {optimizationResult.unservedNodes.length} Unvisited
                        </span>
                      </div>

                      <p className="text-[10px] text-amber-200/90 leading-tight">
                        {isOversized ? (
                          <>
                            Node demand up to <strong className="text-white">{maxOversizedDemand}kg</strong> exceeds vehicle capacity (<strong className="text-white">{vehicleCapacity}kg/veh</strong>). Unserved:
                          </>
                        ) : (
                          <>
                            Strict payload limit of <strong className="text-white">{vehicleCapacity}kg/veh</strong> enforced. Unserved:
                          </>
                        )}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {optimizationResult.unservedNodes.map((un) => (
                          <span
                            key={un.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-900/60 border border-amber-700/70 text-[10px] font-mono text-amber-200"
                          >
                            <span>📍 {un.name.split(" ")[0]}</span>
                            <span className="text-amber-400 font-bold">({un.demand}kg)</span>
                          </span>
                        ))}
                      </div>

                      <div className="pt-1.5 border-t border-amber-800/60 flex flex-col gap-2">
                        <div className="text-[10px] text-amber-300">
                          <span>Unserved: </span>
                          <strong className="font-mono text-white">{optimizationResult.unservedDemand ?? 0}kg</strong>
                          <span className="block text-amber-400 font-medium">
                            {isOversized
                              ? `💡 Suggestions: Increase vehicle capacity to ≥${maxOversizedDemand}kg OR add +${recommendedVehicles} vehicle(s):`
                              : `💡 Suggestion: Need +${recommendedVehicles} more vehicle(s) to fulfill all demands:`}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1.5">
                          {isOversized && (
                            <button
                              onClick={() => {
                                setVehicleCapacity(maxOversizedDemand);
                                handleRunOptimization(numVehicles, maxOversizedDemand);
                              }}
                              className="w-full py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-bold shadow-md shadow-cyan-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Zap className="h-3.5 w-3.5" />
                              <span>Upgrade Capacity to {maxOversizedDemand}kg &amp; Re-run</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              const newFleet = Math.min(20, numVehicles + recommendedVehicles);
                              setNumVehicles(newFleet);
                              handleRunOptimization(newFleet);
                            }}
                            className="w-full py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/25 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <Plus className="h-3.5 w-3.5 stroke-[3]" />
                            <span>Add +{recommendedVehicles} Vehicle(s) &amp; Re-run</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Per-Vehicle Tour breakdown */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {optimizationResult.routes.map((r, i) => (
                    <div
                      key={r.vehicleId}
                      className="p-2 rounded-lg border border-slate-800 bg-slate-900/70 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: ROUTE_COLORS[i % ROUTE_COLORS.length] }}
                        />
                        <span className="font-semibold text-slate-300">
                          Vehicle #{r.vehicleId + 1}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          ({r.stops.length - 2} stops)
                        </span>
                      </div>
                      <div className="text-right font-mono text-[11px] text-slate-400">
                        {(r.distanceMeters / 1000).toFixed(1)} km · {r.load}kg
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                Click "Run QPSO on Real Road Network" below to compute optimal multi-vehicle paths.
              </div>
            )}
          </div>
        )}

        {/* Main Action Button */}
        <button
          onClick={() => handleRunOptimization()}
          disabled={isSolving || points.length < 2}
          className="mt-auto w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 px-4 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isSolving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
              Computing Real Road QPSO...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 fill-slate-950 text-slate-950" />
              Run QPSO on Real Road Network
            </>
          )}
        </button>
      </div>

      {/* 📐 VRP Mathematical Formulation Modal */}
      {showMathModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl rounded-2xl border border-indigo-500/40 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-cyan-400" />
                <h3 className="text-lg font-bold text-white">Mathematical Formulation of VRPTW & QPSO</h3>
              </div>
              <button
                onClick={() => setShowMathModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              {/* 1. Objective Function */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                <h4 className="font-bold text-cyan-400 text-sm uppercase tracking-wide">1. Objective Function (Minimize Travel Cost)</h4>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-cyan-300 text-center text-sm">
                  {"$$\\min Z = \\sum_{k \\in V} \\sum_{i \\in N} \\sum_{j \\in N} c_{ij} \\cdot \\mu_{\\text{traffic}} \\cdot x_{ijk} + \\lambda_1 P_{\\text{capacity}} + \\lambda_2 P_{\\text{time\\_window}}$$"}
                </div>
                <p className="text-slate-400">
                  <strong className="text-slate-200">Plain English:</strong> We aim to find routes for all vehicles {"k \\in V"} that minimize total road distance and travel time under real-time traffic condition multipliers ({"\\mu_{\\text{traffic}}"}), while penalizing overloaded vehicles and late arrivals.
                </p>
              </div>

              {/* 2. Constraints */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <h4 className="font-bold text-indigo-400 text-xs uppercase tracking-wide">2. Vehicle Payload Capacity Constraint</h4>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-indigo-300 text-center text-xs">
                    {"$$\\sum_{i \\in N} d_i \\cdot y_{ik} \\le Q_k, \\quad \\forall k \\in V$$"}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    The total demand {"d_i"} of all stops visited by vehicle {"k"} cannot exceed its maximum payload capacity {"Q_k"} (e.g. 100 kg).
                  </p>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                  <h4 className="font-bold text-amber-400 text-xs uppercase tracking-wide">3. Time Window Constraint</h4>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-amber-300 text-center text-xs">
                    {"$$a_i \\le t_{ik} \\le b_i, \\quad \\forall i \\in N, k \\in V$$"}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Vehicle {"k"} must arrive at delivery node {"i"} between opening hour {"a_i"} and closing deadline {"b_i"}.
                  </p>
                </div>
              </div>

              {/* 3. Quantum Update Equations */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                <h4 className="font-bold text-emerald-400 text-sm uppercase tracking-wide">4. Quantum Delta Potential Well Update Rule (QPSO)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-center font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300">
                    {"$$p_{i,d} = \\phi \\cdot pbest_{i,d} + (1-\\phi) \\cdot gbest_d$$"}
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-emerald-300">
                    {"$$x_{i,d}^{t+1} = p_{i,d} \\pm \\beta \\cdot |mbest_d - x_{i,d}^t| \\cdot \\ln\\left(\\frac{1}{u}\\right)$$"}
                  </div>
                </div>
                <p className="text-slate-400">
                  <strong className="text-slate-200">Quantum Mechanical Insight:</strong> Unlike classical PSO where particles move using velocity vectors, QPSO particles move in a quantum delta potential well centered at local attractor {"p_{i,d}"}. The parameter {"\\beta"} controls swarm contraction/expansion, allowing particles to escape local minima and sample global optimal routes with high probability.
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowMathModal(false)}
                className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
              >
                Got it, Return to Map
              </button>
            </div>
          </div>
        </div>
      )}
      </div>{/* end main map+sidebar row */}

      {/* ── Live QPSO Activity & Decision Log (Executive 3-Column Layout) ─── */}
      <LiveQpsoLog
        points={points}
        numVehicles={numVehicles}
        vehicleCapacity={vehicleCapacity}
        trafficCondition={trafficCondition}
        optimizationResult={optimizationResult}
        isSolving={isSolving}
      />

      {/* ── Multi-Algorithm Real Road Benchmark (Full Width at Bottom of Page) ─── */}
      {optimizationResult && (
        <div className="mt-8 space-y-4">
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-cyan-400 flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-cyan-400" />
              Real Road Multi-Algorithm Benchmark Results
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>

          <RoadBenchmarkPanel
            config={{
              result: optimizationResult,
              numVehicles,
              vehicleCapacity,
              trafficCondition,
              numStops: points.length,
              cityName: selectedCity.name,
            }}
            onRerun={() => handleRunOptimization()}
          />
        </div>
      )}
    </div>
  );
}

// ── Live QPSO Decision Log Component (Matching User Mockup) ────────────────

function LiveQpsoLog({
  points,
  numVehicles,
  vehicleCapacity,
  trafficCondition,
  optimizationResult,
  isSolving,
}: {
  points: RoadPoint[];
  numVehicles: number;
  vehicleCapacity: number;
  trafficCondition: TrafficCondition;
  optimizationResult: RoadOptimizationResult | null;
  isSolving: boolean;
}) {
  const customerNodes = useMemo(() => points.filter((p) => !p.isDepot), [points]);
  const activeRoutes = useMemo(() => optimizationResult?.routes || [], [optimizationResult]);
  const activeCount = activeRoutes.length;
  const idleCount = Math.max(0, numVehicles - activeCount);
  const activePercent = numVehicles > 0 ? Math.round((activeCount / numVehicles) * 100) : 0;
  const idlePercent = 100 - activePercent;

  // Build vehicle assignment rows for all configured vehicles V-001 ... V-00N
  const vehicleRows = useMemo(() => {
    return Array.from({ length: numVehicles }, (_, idx) => {
      const vId = `V-${String(idx + 1).padStart(3, "0")}`;
      if (idx < activeRoutes.length) {
        const route = activeRoutes[idx];
        const assignedStops = route.stops
          .filter((s) => s !== "depot")
          .map((sid) => {
            const p = points.find((pt) => pt.id === sid);
            return p?.name || sid;
          });

        return {
          id: vId,
          nodes: assignedStops.length > 0 ? assignedStops.join(", ") : "Depot Route",
          status: "Active" as const,
          load: route.load,
        };
      }
      return {
        id: vId,
        nodes: "None (Not needed)",
        status: "Idle" as const,
        load: 0,
      };
    });
  }, [numVehicles, activeRoutes, points]);

  return (
    <div className="mt-4 rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl backdrop-blur-md text-slate-100 transition-all">
      {/* Top Title */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800 mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Live QPSO Execution &amp; Decision Log
          </h2>
        </div>
        {isSolving ? (
          <span className="flex items-center gap-1.5 rounded-full bg-cyan-950/80 border border-cyan-700/80 px-3.5 py-1.5 text-xs font-bold text-cyan-300 animate-pulse">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            Optimizing Swarm...
          </span>
        ) : optimizationResult ? (
          <span className="rounded-full bg-emerald-950/80 border border-emerald-700/80 px-3.5 py-1.5 text-xs font-bold text-emerald-300">
            ✓ Optimization Converged
          </span>
        ) : (
          <span className="rounded-full bg-slate-800/80 border border-slate-700/80 px-3.5 py-1.5 text-xs font-semibold text-slate-300">
            ○ Ready to Run
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Col 1: Parameter Summary (lg:col-span-3) */}
        <div className="lg:col-span-3 flex flex-col space-y-4 pr-0 lg:pr-4 lg:border-r border-slate-800">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">Parameter Summary</h3>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Execution Parameters</p>
          </div>

          <div className="space-y-3.5 pt-1">
            {/* Nodes */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-cyan-400 shadow-sm shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Nodes:</p>
                <p className="text-xs font-bold text-slate-100">
                  {customerNodes.length} Customer Stops <span className="text-slate-500 font-normal">(+1 Depot)</span>
                </p>
              </div>
            </div>

            {/* No of Vehicles */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-cyan-400 shadow-sm shrink-0">
                <Car className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">No. of vehicles:</p>
                <p className="text-xs font-bold text-slate-100">{numVehicles} Vehicles</p>
              </div>
            </div>

            {/* Capacity per vehicle */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-cyan-400 shadow-sm shrink-0">
                <Gauge className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Capacity per vehicle:</p>
                <p className="text-xs font-bold text-slate-100">
                  {vehicleCapacity} kg ({vehicleCapacity >= 100 ? "High Capacity" : "Standard Capacity"})
                </p>
              </div>
            </div>

            {/* Traffic Condition */}
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/60 text-cyan-400 shadow-sm shrink-0">
                <Sliders className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-slate-400 font-semibold">Traffic condition:</p>
                <p className="text-xs font-bold text-slate-100">
                  {TRAFFIC_PRESETS[trafficCondition].icon} {TRAFFIC_PRESETS[trafficCondition].label}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Col 2: Vehicle Assignment Status (lg:col-span-5) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">
            Vehicle Assignment Status
          </h3>

          <div className="overflow-hidden rounded-2xl border border-slate-800 shadow-sm max-h-[340px] overflow-y-auto bg-slate-950/60">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/90 text-slate-200 font-bold sticky top-0 z-10 border-b border-slate-700">
                  <th className="py-3 px-3.5">Vehicle ID</th>
                  <th className="py-3 px-3.5">Assigned Nodes</th>
                  <th className="py-3 px-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {vehicleRows.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono font-bold text-cyan-300">{v.id}</td>
                    <td className="py-2.5 px-3.5 text-slate-300 font-medium">
                      {v.nodes}
                      {v.status === "Active" && (
                        <span className="ml-1.5 text-[10px] text-slate-400 font-mono">
                          ({v.load}kg)
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3.5 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          v.status === "Active"
                            ? "bg-emerald-950/80 text-emerald-300 border border-emerald-700/60"
                            : "bg-slate-800/80 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Col 3: Key Decisions (lg:col-span-4) */}
        <div className="lg:col-span-4 flex flex-col space-y-4 pl-0 lg:pl-4 lg:border-l border-slate-800">
          <h3 className="text-sm font-bold uppercase tracking-wider text-white">Key Decisions</h3>

          {/* Highlight Banner */}
          {optimizationResult?.unservedNodes && optimizationResult.unservedNodes.length > 0 ? (() => {
            const maxOversizedDemand = Math.max(...optimizationResult.unservedNodes.map((n) => n.demand || 10));
            const isOversized = maxOversizedDemand > vehicleCapacity;
            const recommendedVehicles = optimizationResult.recommendedAdditionalVehicles ?? 1;

            return (
              <div className="rounded-2xl border border-amber-500/50 bg-amber-950/40 p-4 text-amber-100 shadow-sm space-y-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                  </span>
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-300">
                    {isOversized ? "Oversized Demand & Fleet Capacity Limit" : "Fleet Capacity Constraint Limit Hit"}
                  </p>
                </div>
                <p className="text-xs text-amber-200/90 leading-snug">
                  {isOversized ? (
                    <>
                      Stops with demand (up to <strong className="text-white">{maxOversizedDemand}kg</strong>) exceed single vehicle capacity limit (<strong className="text-white">{vehicleCapacity}kg</strong>).
                      {" "}<strong className="text-white">{optimizationResult.unservedNodes.length} stop(s)</strong> ({optimizationResult.unservedDemand}kg) were left unserved.
                    </>
                  ) : (
                    <>
                      Strict vehicle payload limit of <strong className="text-white">{vehicleCapacity}kg</strong> was maintained.
                      {" "}<strong className="text-white">{optimizationResult.unservedNodes.length} stop(s)</strong> ({optimizationResult.unservedDemand}kg) were left unserved.
                    </>
                  )}
                </p>
                <div className="pt-1 text-[11px] text-amber-300 font-semibold leading-relaxed">
                  {isOversized
                    ? `💡 Suggestions: Increase vehicle capacity to ≥${maxOversizedDemand}kg OR add +${recommendedVehicles} more vehicles to split/fulfill all demands.`
                    : `💡 Suggestion: Need +${recommendedVehicles} more vehicle(s) to fulfill all demands.`}
                </div>
              </div>
            );
          })() : (
            <div className="rounded-2xl border border-indigo-800/50 bg-indigo-950/40 p-4 text-indigo-100 shadow-sm">
              <p className="text-sm font-bold leading-snug text-slate-100">
                {activeCount > 0 ? (
                  <>
                    <span className="text-cyan-300 font-bold">{activeCount} vehicles</span> were sufficient &amp; other{" "}
                    <span className="text-cyan-300 font-bold">{idleCount} vehicles</span> can remain idle.
                  </>
                ) : (
                  <>
                    Ready to compute optimal fleet dispatch across {numVehicles} configured vehicles.
                  </>
                )}
              </p>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {activeCount > 0
                  ? `QPSO dynamically assigned all ${customerNodes.length} delivery nodes while strictly adhering to vehicle payload capacity (${vehicleCapacity}kg) & time constraints.`
                  : `Click "Run QPSO on Real Road Network" to evaluate optimal multi-vehicle paths.`}
              </p>
            </div>
          )}

          {/* Vehicle Utilization Bar */}
          <div className="rounded-2xl border border-slate-800 p-4 space-y-3 bg-slate-950/50 shadow-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-400" />
              <p className="text-xs font-bold text-slate-200">
                Vehicle Utilization: {activeCount} Active / {idleCount} Idle
              </p>
            </div>

            {/* Split Stacked Bar */}
            <div className="h-10 w-full rounded-xl overflow-hidden flex font-bold text-xs text-white shadow-inner bg-slate-900 border border-slate-800">
              <div
                style={{ width: `${Math.max(activePercent, activeCount > 0 ? 12 : 0)}%` }}
                className="bg-gradient-to-r from-cyan-600 to-indigo-600 flex items-center justify-center transition-all duration-500 font-mono"
              >
                {activePercent > 0 ? `${activePercent}%` : ""}
              </div>
              <div
                style={{ width: `${Math.max(idlePercent, idleCount > 0 ? 12 : 0)}%` }}
                className="bg-slate-800 text-slate-400 flex items-center justify-center transition-all duration-500 font-mono"
              >
                {idlePercent > 0 ? `${idlePercent}%` : ""}
              </div>
            </div>
            <div className="flex justify-between text-[11px] text-slate-400 font-medium px-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Active Fleet ({activeCount})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-700" /> Idle Fleet ({idleCount})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer metadata */}
      <div className="pt-4 mt-6 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
        <span>Quantum Particle Swarm Optimization (QPSO) • Vehicle Routing Model</span>
        <span>Last Updated: {optimizationResult ? "Just now" : "Awaiting Run"}</span>
      </div>
    </div>
  );
}

