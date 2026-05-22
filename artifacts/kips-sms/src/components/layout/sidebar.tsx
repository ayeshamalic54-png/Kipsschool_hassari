import { useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  CalendarCheck,
  FileText,
  Users2,
  Wallet,
  PieChart,
  Award,
  FileBarChart,
  LogOut,
  AlertTriangle,
  ReceiptText,
  ClipboardList,
  Settings,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useListClasses } from "@workspace/api-client-react";

const NAVY = "#1a2a5e";
const ORANGE = "#e07b1a";

const getNavigation = (role?: string) => {
  const allRoutes = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, gradient: "from-pink-500 to-rose-500", roles: ["admin", "teacher", "student"] },
    { name: "Students", href: "/students", icon: Users, gradient: "from-blue-500 to-cyan-500", roles: ["admin", "teacher"], hasDropdown: true },
    { name: "Classes", href: "/classes", icon: BookOpen, gradient: "from-indigo-500 to-purple-500", roles: ["admin", "teacher"] },
    { name: "Fees", href: "/fees", icon: CreditCard, gradient: "from-emerald-500 to-green-500", roles: ["admin", "student"] },
    { name: "Fee Voucher", href: "/fees/voucher", icon: ReceiptText, gradient: "from-teal-500 to-cyan-500", roles: ["admin"] },
    { name: "Fee Defaulters", href: "/fees/defaulters", icon: AlertTriangle, gradient: "from-red-500 to-rose-600", roles: ["admin"] },
    { name: "Arrears", href: "/arrears", icon: ClipboardList, gradient: "from-orange-500 to-amber-500", roles: ["admin"] },
    { name: "Attendance", href: "/attendance", icon: CalendarCheck, gradient: "from-amber-400 to-orange-500", roles: ["admin", "teacher", "student"] },
    { name: "Exams", href: "/exams", icon: FileText, gradient: "from-violet-500 to-fuchsia-500", roles: ["admin", "teacher", "student"] },
    { name: "Staff", href: "/staff", icon: Users2, gradient: "from-teal-400 to-emerald-500", roles: ["admin"] },
    { name: "Salaries", href: "/salaries", icon: Wallet, gradient: "from-cyan-500 to-blue-600", roles: ["admin"] },
    { name: "Accounts", href: "/accounts", icon: PieChart, gradient: "from-purple-500 to-indigo-600", roles: ["admin"] },
    { name: "Certificates", href: "/certificates", icon: Award, gradient: "from-yellow-400 to-amber-500", roles: ["admin"] },
    { name: "Reports",  href: "/reports",  icon: FileBarChart, gradient: "from-slate-600 to-slate-800",   roles: ["admin"] },
    { name: "Settings", href: "/settings", icon: Settings,     gradient: "from-gray-500 to-gray-700",     roles: ["admin"] },
  ];
  return allRoutes.filter(route => !role || route.roles.includes(role));
};

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const searchStr = useSearch(); // wouter v3 — reactive query string
  const { user, logout } = useAuthStore();
  const navigation = getNavigation(user?.role);
  const [studentsExpanded, setStudentsExpanded] = useState(
    location.startsWith("/students")
  );

  const { data: classes } = useListClasses();

  const isStudentsActive = location.startsWith("/students");

  return (
    <div className="flex flex-col h-full w-64 border-r shadow-sm no-print" style={{ background: "#fff" }}>
      <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor: "#e5e7eb" }}>
        <img
          src="/kips-logo.jpeg"
          alt="KIPS"
          className="w-11 h-11 rounded-full object-cover border-2 shadow"
          style={{ borderColor: ORANGE }}
        />
        <div>
          <h1 className="font-bold text-base leading-tight" style={{ color: NAVY }}>KIPS School</h1>
          <p className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: ORANGE }}>Hassari • Bright Future</p>
        </div>
      </div>

      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-0.5 px-2">
          {navigation.map((item) => {
            const isActive = location === item.href || (item.href !== "/fees" && !item.hasDropdown && location.startsWith(item.href + "/")) || (item.href === "/fees" && location === "/fees");

            if (item.hasDropdown) {
              return (
                <div key={item.name}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group relative",
                      isStudentsActive
                        ? "font-semibold"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                    style={isStudentsActive ? { background: "#f0f4ff", color: NAVY } : {}}
                    onClick={() => {
                      setStudentsExpanded(v => !v);
                      setLocation("/students");
                    }}
                  >
                    {isStudentsActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full"
                        style={{ background: ORANGE }}
                      />
                    )}
                    <div className={cn(
                      "w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 bg-gradient-to-br",
                      item.gradient,
                      isStudentsActive ? "opacity-100" : "opacity-75 group-hover:opacity-100"
                    )}>
                      <item.icon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm flex-1">{item.name}</span>
                    {studentsExpanded
                      ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                      : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    }
                  </div>

                  <AnimatePresence initial={false}>
                    {studentsExpanded && classes && classes.length > 0 && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-3 mt-0.5 border-l-2 pl-2 space-y-0.5" style={{ borderColor: "#e5e7eb" }}>
                          {/* All Students link */}
                          <Link href="/students">
                            <div
                              className={cn(
                                "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors",
                                location === "/students" && !location.includes("?")
                                  ? "font-semibold"
                                  : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                              )}
                              style={location === "/students" ? { color: NAVY, background: "#f0f4ff" } : {}}
                            >
                              <Users className="w-3 h-3" />
                              All Students
                            </div>
                          </Link>

                          {/* Class items */}
                          {classes.map(cls => {
                            const sections = cls.sections
                              ? cls.sections.split(",").map(s => s.trim()).filter(Boolean)
                              : [];
                            const classHref = `/students?classId=${cls.id}`;
                            const isClassActive = location.startsWith("/students") && searchStr.includes(`classId=${cls.id}`);

                            return (
                              <div key={cls.id}>
                                <Link href={classHref}>
                                  <div
                                    className={cn(
                                      "flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-xs transition-colors",
                                      isClassActive
                                        ? "font-semibold"
                                        : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                                    )}
                                    style={isClassActive ? { color: NAVY, background: "#f0f4ff" } : {}}
                                  >
                                    <BookOpen className="w-3 h-3 shrink-0" style={{ color: "#6366f1" }} />
                                    <span className="truncate">{cls.name}</span>
                                    {cls.studentCount > 0 && (
                                      <span className="ml-auto text-[10px] text-gray-400 tabular-nums">{cls.studentCount}</span>
                                    )}
                                  </div>
                                </Link>

                                {/* Sections under class */}
                                {sections.length > 0 && (
                                  <div className="ml-4 mt-0.5 space-y-0.5">
                                    {sections.map(sec => {
                                      const secHref = `/students?classId=${cls.id}&section=${encodeURIComponent(sec)}`;
                                      const isSecActive = searchStr.includes(`classId=${cls.id}`) && searchStr.includes(`section=${encodeURIComponent(sec)}`);
                                      return (
                                        <Link key={sec} href={secHref}>
                                          <div
                                            className={cn(
                                              "flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-[11px] transition-colors",
                                              isSecActive
                                                ? "font-semibold"
                                                : "text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                                            )}
                                            style={isSecActive ? { color: NAVY, background: "#f0f4ff" } : {}}
                                          >
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-300 shrink-0" />
                                            Section {sec}
                                          </div>
                                        </Link>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group relative",
                    isActive
                      ? "font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                  style={isActive ? { background: "#f0f4ff", color: NAVY } : {}}
                >
                  {isActive && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full"
                      style={{ background: ORANGE }}
                    />
                  )}
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 bg-gradient-to-br",
                    item.gradient,
                    isActive ? "opacity-100" : "opacity-75 group-hover:opacity-100"
                  )}>
                    <item.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      <div className="p-3 border-t" style={{ borderColor: "#e5e7eb" }}>
        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shadow"
            style={{ background: `linear-gradient(135deg, ${NAVY}, ${ORANGE})` }}>
            {user?.name?.charAt(0).toUpperCase() || "U"}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate" style={{ color: NAVY }}>{user?.name || "User"}</p>
            <p className="text-xs text-gray-400 capitalize">{user?.role || "Guest"}</p>
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-red-600 rounded-lg hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
