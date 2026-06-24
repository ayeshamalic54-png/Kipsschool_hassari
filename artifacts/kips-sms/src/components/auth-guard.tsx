import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";

const STUDENT_ALLOWED = ["/dashboard", "/fees", "/attendance", "/exams", "/login"];

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { isAuthenticated, user } = useAuthStore(state => state);

  useEffect(() => {
    if (!isAuthenticated && location !== "/login") {
      setLocation("/login");
      return;
    }
    if (isAuthenticated && user?.role === "student") {
      const allowed = STUDENT_ALLOWED.some(
        p => location === p || location.startsWith(p + "/") || location.startsWith(p + "?")
      );
      if (!allowed) setLocation("/dashboard");
    }
  }, [isAuthenticated, user?.role, location, setLocation]);

  if (!isAuthenticated && location !== "/login") return null;

  return <>{children}</>;
}
