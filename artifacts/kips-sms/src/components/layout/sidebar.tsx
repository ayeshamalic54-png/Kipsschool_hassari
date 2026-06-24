import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useSchoolInfo } from "@/lib/school-info";
import {
  LayoutDashboard, Users, BookOpen, CreditCard, CalendarCheck, FileText,
  Users2, Wallet, PieChart, Award, FileBarChart, LogOut, AlertTriangle,
  ReceiptText, ClipboardList, Settings, LayoutList, PhoneCall,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const NAVY   = "#1a2a5e";
const ORANGE = "#e07b1a";

const getNavigation = (role?: string) => {
  const allRoutes = [
    { name: "Dashboard",      href: "/dashboard",       icon: LayoutDashboard, gradient: "from-pink-500 to-rose-500",     roles: ["admin", "teacher", "student"] },
    { name: "Students",       href: "/students",        icon: Users,           gradient: "from-blue-500 to-cyan-500",     roles: ["admin", "teacher"] },
    { name: "Contact List",   href: "/students/contacts", icon: PhoneCall,     gradient: "from-sky-400 to-blue-500",      roles: ["admin", "teacher"] },
    { name: "Classes",        href: "/classes",         icon: BookOpen,        gradient: "from-indigo-500 to-purple-500", roles: ["admin", "teacher"] },
    { name: "Fees",           href: "/fees",            icon: CreditCard,      gradient: "from-emerald-500 to-green-500", roles: ["admin"] },
    { name: "Fee Structure",  href: "/fee-structure",   icon: LayoutList,      gradient: "from-sky-500 to-blue-600",      roles: ["admin"] },
    { name: "Fee Voucher",    href: "/fees/voucher",    icon: ReceiptText,     gradient: "from-teal-500 to-cyan-500",     roles: ["admin"] },
    { name: "Fee Defaulters", href: "/fees/defaulters", icon: AlertTriangle,   gradient: "from-red-500 to-rose-600",      roles: ["admin"] },
    { name: "Arrears",        href: "/arrears",         icon: ClipboardList,   gradient: "from-orange-500 to-amber-500",  roles: ["admin"] },
    { name: "Attendance",     href: "/attendance",      icon: CalendarCheck,   gradient: "from-amber-400 to-orange-500",  roles: ["admin", "teacher", "student"] },
    { name: "Exams",          href: "/exams",           icon: FileText,        gradient: "from-violet-500 to-fuchsia-500",roles: ["admin", "teacher", "student"] },
    { name: "Staff",          href: "/staff",           icon: Users2,          gradient: "from-teal-400 to-emerald-500",  roles: ["admin"] },
    { name: "Salaries",       href: "/salaries",        icon: Wallet,          gradient: "from-cyan-500 to-blue-600",     roles: ["admin"] },
    { name: "Accounts",       href: "/accounts",        icon: PieChart,        gradient: "from-purple-500 to-indigo-600", roles: ["admin"] },
    { name: "Certificates",   href: "/certificates",    icon: Award,           gradient: "from-yellow-400 to-amber-500",  roles: ["admin"] },
    { name: "Reports",        href: "/reports",         icon: FileBarChart,    gradient: "from-slate-600 to-slate-800",   roles: ["admin"] },
    { name: "Settings",       href: "/settings",        icon: Settings,        gradient: "from-gray-500 to-gray-700",     roles: ["admin"] },
  ];
  return allRoutes.filter(route => !role || route.roles.includes(role));
};

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { user, logout } = useAuthStore();
  const schoolInfo = useSchoolInfo();
  const navigation = getNavigation(user?.role);

  return (
    <div className="flex flex-col h-full w-64 border-r shadow-sm no-print" style={{ background: "#fff" }}>
      <div className="p-4 flex items-center gap-3 border-b" style={{ borderColor: "#e5e7eb" }}>
        <img
          src={schoolInfo.logoUrl}
          alt="School Logo"
          className="w-11 h-11 rounded-full object-cover border-2 shadow"
          style={{ borderColor: ORANGE }}
          onError={e => { (e.target as HTMLImageElement).src = "/kips-logo.jpeg"; }}
        />
        <div>
          <h1 className="font-bold text-base leading-tight truncate max-w-[140px]" style={{ color: NAVY }}>{schoolInfo.name}</h1>
          <p className="text-[10px] uppercase font-semibold tracking-wider truncate max-w-[140px]" style={{ color: ORANGE }}>{schoolInfo.tagline}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 py-3">
        <nav className="space-y-0.5 px-2">
          {navigation.map((item) => {
            const isActive =
              location === item.href ||
              (item.href === "/fee-structure" && location === "/fee-structure") ||
              (item.href !== "/fees" && item.href !== "/fee-structure" && location.startsWith(item.href + "/")) ||
              (item.href === "/fees" && location === "/fees") ||
              (item.href === "/students" && location.startsWith("/students"));

            return (
              <Link key={item.name} href={item.href}>
                <div
                  onClick={() => onNavigate?.()}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-150 group relative",
                    isActive ? "font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
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
