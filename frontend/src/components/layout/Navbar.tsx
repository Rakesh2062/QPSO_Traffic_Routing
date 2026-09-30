"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  GitBranch,
  History,
  PlusCircle,
  Settings,
  Cpu,
  Map as MapIcon,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/studio", label: "Map & Graph Studio", icon: MapIcon },
    // { href: "/scenarios/new", label: "New Scenario", icon: PlusCircle },
    { href: "/benchmark", label: "Benchmarks", icon: BarChart3 },
    { href: "/history", label: "Run History", icon: History },
    // { href: "/settings", label: "Presets & Config", icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Cpu className="h-5 w-5 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">QPSO</span>
              <span className="rounded-full bg-cyan-950 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-800/60">
                VRP Engine
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Quantum-Inspired Metaheuristic Routing
            </p>
          </div>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {links.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium transition-all ${isActive
                  ? "bg-slate-800 text-cyan-400 border border-slate-700/60 shadow-sm"
                  : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                  }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-cyan-400" : "text-slate-400"}`} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Live Backend Badge */}
        <div className="hidden lg:flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-3 py-1 text-xs text-emerald-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>FastAPI Engine Ready</span>
        </div>
      </div>
    </header>
  );
}
