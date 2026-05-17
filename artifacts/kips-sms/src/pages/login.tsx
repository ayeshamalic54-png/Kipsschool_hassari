import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { useLogin } from "@workspace/api-client-react";
import { useAuthStore } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { User, Lock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuthStore();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate(
      { data: { ...values, role: "admin" } },
      {
        onSuccess: (data) => {
          login(data.user, data.token);
          setLocation("/dashboard");
          toast({ title: "Welcome back!", description: `Logged in as ${data.user.name}` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Login failed", description: "Invalid username or password." });
        },
      }
    );
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ background: "linear-gradient(135deg, #1a2a5e 0%, #2d4a9a 40%, #e07b1a 100%)" }}>
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center", mixBlendMode: "overlay" }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="backdrop-blur-xl bg-white/95 p-8 rounded-3xl shadow-2xl border border-white/30">
          <div className="flex flex-col items-center mb-8">
            <img
              src="/kips-logo.jpeg"
              alt="KIPS School Hassari"
              className="w-24 h-24 rounded-full object-cover shadow-xl border-4 border-white mb-4"
              style={{ boxShadow: "0 0 0 4px #e07b1a, 0 8px 32px rgba(26,42,94,0.3)" }}
            />
            <h1 className="text-2xl font-bold text-center" style={{ color: "#1a2a5e" }}>KIPS School Hassari</h1>
            <p className="text-sm text-gray-500 mt-1 font-medium tracking-wide">Bright Future — School Portal</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Username</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <Input
                          placeholder="Enter your username"
                          className="pl-10 bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          autoComplete="username"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-gray-700 font-medium">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                        <Input
                          type="password"
                          placeholder="••••••••"
                          className="pl-10 bg-gray-50 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                          autoComplete="current-password"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full text-white py-6 rounded-xl font-bold text-base shadow-lg transition-all hover:scale-[1.02] mt-2"
                style={{ background: "linear-gradient(135deg, #1a2a5e, #e07b1a)" }}
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
              </Button>
            </form>
          </Form>
        </div>
      </motion.div>
    </div>
  );
}
