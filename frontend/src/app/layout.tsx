import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";

export const metadata: Metadata = {
  title: "QPSO Traffic Routing  -  Quantum-Inspired VRP Optimizer",
  description:
    "Research-grade platform for solving Vehicle Routing Problems under dynamic traffic using Quantum-Behaved Particle Swarm Optimization (QPSO), benchmarked against PSO, GA, ACO, and OR-Tools.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#03120E] text-white font-sans">
        <Navbar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
