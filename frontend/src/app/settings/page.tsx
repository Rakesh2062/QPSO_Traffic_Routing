"use client";

import { useState } from "react";
import { Settings, Save } from "lucide-react";
import { MOCK_PRESETS } from "@/lib/mockData";
import { useAppStore } from "@/store/useAppStore";

export default function SettingsPage() {
  const { defaultAlgorithmParams, setDefaultAlgorithmParams, selectedPreset, setSelectedPreset } = useAppStore();
  const [params, setParams] = useState(defaultAlgorithmParams);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setDefaultAlgorithmParams(params);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">Global Defaults</p>
        <h1 className="text-3xl font-bold text-white">Presets & Configuration</h1>
        <p className="mt-2 text-sm text-slate-400">
          Set default QPSO hyperparameters that will be pre-filled in new scenario forms.
        </p>
      </div>

      {/* Preset Cards */}
      <div className="mb-7">
        <h2 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
          <Settings className="h-4 w-4 text-cyan-400" /> Quick Presets
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MOCK_PRESETS.map((preset) => {
            const isSelected = selectedPreset.name === preset.name;
            return (
              <button
                key={preset.name}
                onClick={() => {
                  setSelectedPreset(preset);
                  setParams(preset.algorithm_params);
                }}
                className={`text-left rounded-xl border p-4 transition-all ${
                  isSelected
                    ? "border-cyan-700 bg-cyan-950/50 shadow-md shadow-cyan-500/10"
                    : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                }`}
              >
                <p className={`text-sm font-bold mb-1 ${isSelected ? "text-cyan-300" : "text-slate-200"}`}>
                  {preset.label.split(" (")[0]}
                </p>
                <p className="text-xs text-slate-500 leading-relaxed">{preset.description}</p>
                <div className="mt-3 flex gap-2 flex-wrap">
                  <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-400">
                    N={preset.algorithm_params.swarm_size}
                  </span>
                  <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-400">
                    T={preset.algorithm_params.T_max}
                  </span>
                  <span className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 font-mono text-slate-400">
                    β=[{preset.algorithm_params.beta_min},{preset.algorithm_params.beta_max}]
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual Parameter Overrides */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-sm font-semibold text-slate-300 mb-5">Fine-tune Defaults</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
          {[
            { key: "swarm_size", label: "Swarm Size N", min: 5, max: 500 },
            { key: "T_max", label: "Max Iterations T_max", min: 10, max: 5000 },
            { key: "beta_max", label: "β_max", min: 0.1, max: 5, step: 0.05 },
            { key: "beta_min", label: "β_min", min: 0.05, max: 5, step: 0.05 },
            { key: "opt2_frequency", label: "2-Opt Frequency", min: 1, max: 100 },
          ].map(({ key, label, min, max, step }) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
              <input
                type="number"
                value={(params as unknown as Record<string, number>)[key] ?? 0}
                onChange={(e) =>
                  setParams((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }))
                }
                min={min} max={max} step={step ?? 1}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
            </div>
          ))}
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={params.enable_2opt}
                onChange={(e) => setParams((prev) => ({ ...prev, enable_2opt: e.target.checked }))}
                className="h-4 w-4 rounded accent-cyan-500"
              />
              <span className="text-sm text-slate-300">Enable 2-Opt Local Search</span>
            </label>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow hover:from-cyan-400 transition-all"
        >
          {saved ? (
            <><span>✓</span> Saved!</>
          ) : (
            <><Save className="h-4 w-4" /> Save Defaults</>
          )}
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-slate-800/60 bg-slate-900/40 px-5 py-4 text-xs text-slate-500 leading-relaxed">
        <strong className="text-slate-400">Note:</strong> These settings are stored in browser memory (Zustand) and pre-fill all new scenario forms during this session.
        To persist across sessions, configure the backend <code className="font-mono bg-slate-800 px-1 rounded">algorithm_params</code> defaults via the settings API endpoint.
      </div>
    </div>
  );
}
