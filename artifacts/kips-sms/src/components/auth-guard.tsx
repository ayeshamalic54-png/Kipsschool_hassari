import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuthStore } from "@/lib/auth";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated && location !== "/login") {
      setLocation("/login");
    }
  }, [isAuthenticated, location, setLocation]);

  if (!isAuthenticated && location !== "/login") {
    return null;
  }

  return <>{children}</>;
}
