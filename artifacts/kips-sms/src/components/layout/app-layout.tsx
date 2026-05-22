import { useState } from "react";
import { Sidebar } from "./sidebar";
import { ScrollArea } from "../ui/scroll-area";
import { Menu, X } from "lucide-react";
import { useSchoolInfo } from "@/lib/school-info";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toLocaleDateString("en-PK", { dateStyle: "long" });
  const [mobileOpen, setMobileOpen] = useState(false);
  const schoolInfo = useSchoolInfo();

  return (
    <div className="flex h-[100dvh] bg-gray-50 overflow-hidden">
      {/* Sidebar — desktop: always visible; mobile: slide-in drawer */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 transform transition-transform duration-200 md:transform-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <Sidebar onNavigate={() => setMobileOpen(false)} />
      </div>

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden no-print"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden flex items-center gap-3 px-3 py-2 bg-white border-b shadow-sm no-print">
          <button
            onClick={() => setMobileOpen(v => !v)}
            className="p-2 rounded-lg hover:bg-gray-100 active:bg-gray-200"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={schoolInfo.logoUrl} alt="KIPS" className="w-8 h-8 rounded-full object-cover border" onError={e => { (e.target as HTMLImageElement).src = "/kips-logo.jpeg"; }} />
          <span className="font-bold text-sm" style={{ color: "#1a2a5e" }}>{schoolInfo.name}</span>
        </div>

        <ScrollArea className="flex-1 print:overflow-visible">
          <main id="printable-area" className="p-3 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full print:p-0 print:max-w-none">

            {/* ── Global print header: hidden on screen, shown centered on every printout ── */}
            <div className="print-header hidden">
              <img src="/kips-logo.jpeg" alt="KIPS School Hassari" />
              <div className="print-header-text">
                <div className="print-header-title">KIPS School Hassari</div>
                <div className="print-header-sub">Bright Future — School Portal</div>
                <div className="print-header-date">{today}</div>
              </div>
            </div>

            {children}
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}
