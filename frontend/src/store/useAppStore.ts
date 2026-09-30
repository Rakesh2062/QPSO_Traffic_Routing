import { create } from "zustand";
import { AlgorithmParams, ObjectiveWeights, Preset } from "@/types";
import { MOCK_PRESETS } from "@/lib/mockData";

interface AppState {
  // Navigation & System Status
  backendConnected: boolean;
  setBackendConnected: (connected: boolean) => void;

  // Active Job Telemetry
  activeJobId: string | null;
  setActiveJobId: (id: string | null) => void;

  // Time-of-day simulation scrubber (0 to 86400 seconds)
  timeOfDaySeconds: number;
  setTimeOfDaySeconds: (seconds: number) => void;

  // Scenario Defaults
  defaultWeights: ObjectiveWeights;
  setDefaultWeights: (weights: ObjectiveWeights) => void;
  defaultAlgorithmParams: AlgorithmParams;
  setDefaultAlgorithmParams: (params: AlgorithmParams) => void;

  // Selected Preset
  selectedPreset: Preset;
  setSelectedPreset: (preset: Preset) => void;
}

export const useAppStore = create<AppState>((set) => ({
  backendConnected: false,
  setBackendConnected: (backendConnected) => set({ backendConnected }),

  activeJobId: null,
  setActiveJobId: (activeJobId) => set({ activeJobId }),

  // Default to 8:30 AM (Morning rush hour)
  timeOfDaySeconds: 8.5 * 3600,
  setTimeOfDaySeconds: (timeOfDaySeconds) => set({ timeOfDaySeconds }),

  defaultWeights: {
    distance: 0.4,
    time: 0.4,
    congestion: 0.2,
  },
  setDefaultWeights: (defaultWeights) => set({ defaultWeights }),

  defaultAlgorithmParams: {
    swarm_size: 50,
    T_max: 200,
    beta_max: 1.5,
    beta_min: 0.5,
    enable_2opt: true,
    opt2_frequency: 10,
  },
  setDefaultAlgorithmParams: (defaultAlgorithmParams) =>
    set({ defaultAlgorithmParams }),

  selectedPreset: MOCK_PRESETS[1], // Balanced default
  setSelectedPreset: (selectedPreset) =>
    set({
      selectedPreset,
      defaultAlgorithmParams: selectedPreset.algorithm_params,
    }),
}));
