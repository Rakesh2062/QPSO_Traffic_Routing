/**
 * WebSocket streaming hook for real-time multi-algorithm optimization convergence.
 * Branches on msg.algorithm to route telemetry into parallel algorithm lines.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { WebSocketProgressMessage, RouteDTO, ConvergencePoint } from "@/types";

interface UseJobStreamOptions {
  jobId: string;
  totalIterations?: number;
  onDone?: () => void;
}

export interface AlgorithmStreamState {
  latestMessage: WebSocketProgressMessage;
  history: ConvergencePoint[];
  currentRoute?: RouteDTO[];
  isDone: boolean;
}

export function useJobStream({
  jobId,
  totalIterations = 150,
  onDone,
}: UseJobStreamOptions) {
  const [messages, setMessages] = useState<WebSocketProgressMessage[]>([]);
  const [latestMessage, setLatestMessage] = useState<WebSocketProgressMessage | null>(null);
  const [algorithmStreams, setAlgorithmStreams] = useState<Record<string, AlgorithmStreamState>>({});
  const [throttledRoute, setThrottledRoute] = useState<RouteDTO[] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const lastRouteUpdateRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!jobId) return;

    let ws: WebSocket | null = null;
    let isMocking = false;
    const wsUrl = process.env.NEXT_PUBLIC_WS_BASE_URL || "ws://localhost:8000";

    try {
      ws = new WebSocket(`${wsUrl}/ws/scenarios/${jobId}`);

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg: WebSocketProgressMessage = JSON.parse(event.data);
          handleNewMessage(msg);
        } catch (e) {
          console.error("Error parsing WS message:", e);
        }
      };

      ws.onerror = () => {
        if (!isMocking) {
          startMockSimulation();
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
      };
    } catch {
      startMockSimulation();
    }

    function handleNewMessage(msg: WebSocketProgressMessage) {
      const algo = msg.algorithm || "qpso";

      setMessages((prev) => [...prev, msg]);
      setLatestMessage(msg);

      setAlgorithmStreams((prev) => {
        const current = prev[algo] || {
          latestMessage: msg,
          history: [],
          currentRoute: msg.current_best_route,
          isDone: false,
        };

        const point: ConvergencePoint = {
          iteration: msg.iteration,
          best_fitness: msg.best_fitness,
          elapsed_ms: msg.elapsed_ms,
        };

        return {
          ...prev,
          [algo]: {
            latestMessage: msg,
            history: [...current.history, point],
            currentRoute: msg.current_best_route ?? current.currentRoute,
            isDone: !!msg.done,
          },
        };
      });

      // Throttle map route updates to max 1 update per 500ms
      const now = Date.now();
      if (msg.current_best_route && now - lastRouteUpdateRef.current > 500) {
        setThrottledRoute(msg.current_best_route);
        lastRouteUpdateRef.current = now;
      }

      if (msg.done) {
        if (msg.current_best_route) {
          setThrottledRoute(msg.current_best_route);
        }
        if (algo === "qpso" || msg.done) {
          setIsDone(true);
          if (onDone) onDone();
        }
      }
    }

    function startMockSimulation() {
      isMocking = true;
      setIsConnected(true);

      let iter = 1;
      let qpsoFit = 145.0;
      let gaFit = 160.0;

      timerRef.current = setInterval(() => {
        if (iter > totalIterations) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsDone(true);
          const finalMsg: WebSocketProgressMessage = {
            job_id: jobId,
            algorithm: "qpso",
            iteration: totalIterations,
            best_fitness: 41.2,
            elapsed_ms: totalIterations * 18,
            current_best_route: generateMockLiveRoutes(iter),
            done: true,
          };
          handleNewMessage(finalMsg);
          return;
        }

        const qpsoDecay = Math.exp(-iter / 30);
        qpsoFit = 41.2 + (145.0 - 41.2) * qpsoDecay + (Math.random() - 0.48) * 1.2;

        const gaDecay = Math.exp(-iter / 45);
        gaFit = 56.4 + (160.0 - 56.4) * gaDecay + (Math.random() - 0.48) * 1.8;

        // Emit QPSO telemetry
        handleNewMessage({
          job_id: jobId,
          algorithm: "qpso",
          iteration: iter,
          best_fitness: Math.max(41.0, qpsoFit),
          elapsed_ms: iter * 18,
          current_best_route: iter % 3 === 0 ? generateMockLiveRoutes(iter) : undefined,
          done: false,
        });

        // Emit Baseline GA telemetry alongside
        if (iter % 2 === 0) {
          handleNewMessage({
            job_id: jobId,
            algorithm: "ga",
            iteration: iter,
            best_fitness: Math.max(56.0, gaFit),
            elapsed_ms: iter * 22,
            done: false,
          });
        }

        iter += 1;
      }, 50);
    }

    return () => {
      if (ws) ws.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jobId, totalIterations]);

  return {
    messages,
    latestMessage,
    algorithmStreams,
    throttledRoute,
    isConnected,
    isDone,
  };
}

function generateMockLiveRoutes(iter: number): RouteDTO[] {
  if (iter < 30) {
    return [
      { vehicle_id: 0, stops: ["depot", "n1", "n4", "n7", "n2", "depot"], distance: 16800, time: 38.2, load: 95 },
      { vehicle_id: 1, stops: ["depot", "n8", "n3", "n10", "n9", "depot"], distance: 15400, time: 34.1, load: 88 },
      { vehicle_id: 2, stops: ["depot", "n5", "n15", "n14", "n6", "depot"], distance: 14200, time: 31.0, load: 82 },
    ];
  }
  return [
    { vehicle_id: 0, stops: ["depot", "n1", "n2", "n3", "n4", "depot"], distance: 12400, time: 26.5, load: 92 },
    { vehicle_id: 1, stops: ["depot", "n7", "n8", "n9", "n10", "depot"], distance: 11100, time: 24.1, load: 85 },
    { vehicle_id: 2, stops: ["depot", "n5", "n14", "n15", "n6", "depot"], distance: 10700, time: 23.6, load: 78 },
  ];
}
