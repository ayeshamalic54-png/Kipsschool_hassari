import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { AuthGuard } from "@/components/auth-guard";
import { AppLayout } from "@/components/layout/app-layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Students from "@/pages/students";
import StudentDetail from "@/pages/student-detail";
import StudentNew from "@/pages/student-new";
import Classes from "@/pages/classes";
import Fees from "@/pages/fees";
import FeeDefaulters from "@/pages/fee-defaulters";
import FeeVoucher from "@/pages/fee-voucher";
import Arrears from "@/pages/arrears";
import Attendance from "@/pages/attendance";
import Exams from "@/pages/exams";
import Staff from "@/pages/staff";
import Salaries from "@/pages/salaries";
import Accounts from "@/pages/accounts";
import Certificates from "@/pages/certificates";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";

setAuthTokenGetter(() => localStorage.getItem("kips_token"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function AuthenticatedRoutes() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/students/new" component={StudentNew} />
        <Route path="/students/:id" component={StudentDetail} />
        <Route path="/students" component={Students} />
        <Route path="/classes" component={Classes} />
        <Route path="/fees/defaulters" component={FeeDefaulters} />
        <Route path="/fees/voucher" component={FeeVoucher} />
        <Route path="/fees" component={Fees} />
        <Route path="/arrears" component={Arrears} />
        <Route path="/attendance" component={Attendance} />
        <Route path="/exams" component={Exams} />
        <Route path="/staff" component={Staff} />
        <Route path="/salaries" component={Salaries} />
        <Route path="/accounts" component={Accounts} />
        <Route path="/certificates" component={Certificates} />
        <Route path="/reports" component={Reports} />
        <Route path="/settings" component={Settings} />
        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route>
        <AuthGuard>
          <AuthenticatedRoutes />
        </AuthGuard>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
