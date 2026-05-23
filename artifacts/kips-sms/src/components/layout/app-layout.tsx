import { useState } from "react";
import { Sidebar } from "./sidebar";
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

      {/* Main content column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-3 py-2 bg-white border-b shadow-sm no-print flex-shrink-0">
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

        {/* Scrollable content — overflow-auto allows both vertical AND horizontal scroll */}
        <div className="flex-1 overflow-auto print:overflow-visible">
          <main
            id="printable-area"
            className="p-3 sm:p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full print:p-0 print:max-w-none"
          >
            {/* Global print header */}
            <div className="print-header hidden">
              <img src={schoolInfo.logoUrl} alt={schoolInfo.name} onError={e => { (e.target as HTMLImageElement).src = "/kips-logo.jpeg"; }} />
              <div className="print-header-text">
                <div className="print-header-title">{schoolInfo.name}</div>
                <div className="print-header-sub">{schoolInfo.tagline} — School Portal</div>
                <div className="print-header-date">{today}</div>
              </div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
