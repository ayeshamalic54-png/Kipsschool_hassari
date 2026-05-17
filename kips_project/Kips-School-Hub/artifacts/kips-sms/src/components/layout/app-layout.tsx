import { Sidebar } from "./sidebar";
import { ScrollArea } from "../ui/scroll-area";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const today = new Date().toLocaleDateString("en-PK", { dateStyle: "long" });
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible print:h-auto">
        <ScrollArea className="flex-1 print:overflow-visible">
          <main id="printable-area" className="p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full print:p-0 print:max-w-none">

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
