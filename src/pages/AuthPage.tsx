import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Scale, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
type AuthMode = "login" | "signup" | "forgot";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();

  if (authLoading) return null;

  if (session) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/login`,
        });
        if (error) throw error;
        toast({ title: "Check your email", description: "We sent you a password reset link." });
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Check your email to verify your account." });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const titles: Record<AuthMode, string> = {
    login: "Welcome back",
    signup: "Create your account",
    forgot: "Reset your password",
  };
  const descriptions: Record<AuthMode, string> = {
    login: "Enter your credentials to access your dashboard",
    signup: "Get started with your legal practice management",
    forgot: "Enter your email and we'll send a reset link",
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12" style={{ backgroundImage: "url('https://st4.depositphotos.com/3163989/22632/i/450/depositphotos_226327238-stock-photo-lawyers-office-background-law-symbols.jpg')", backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 bg-black/30" />

        <div className="relative z-10 text-primary-foreground max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <img src="https://advmdsarda.in/wp-content/uploads/2026/04/img18-1.jpg" alt="Logo" className="w-14 h-14 object-contain rounded-xl bg-white shadow-md shadow-black/20" />
            <span className="text-2xl font-bold tracking-tight">Lawmind</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Manage your legal practice with confidence
          </h1>
          <p className="text-primary-foreground/70 text-lg leading-relaxed">
            Streamline cases, track hearings, manage clients, and handle invoices — all in one powerful platform.
          </p>
          <div className="mt-12 space-y-4">
            {["Case & hearing management", "Client & advocate tracking", "Invoice & expense automation"].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-secondary" />
                <span className="text-primary-foreground/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <Card className="border-0 shadow-none bg-transparent">
            <CardHeader className="px-0 pt-0">
              <div className="mb-8 flex justify-start">
                <img src="https://advmdsarda.in/wp-content/uploads/2026/04/img18-1.jpg" alt="Lawmind Logo" className="h-[72px] sm:h-[84px] w-auto object-contain mix-blend-multiply" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">{titles[mode]}</CardTitle>
              <CardDescription className="text-muted-foreground">{descriptions[mode]}</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground text-sm font-medium">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-10 h-11 bg-white/40 backdrop-blur-md border-white/30 focus:bg-white/60 transition-colors" required />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground text-sm font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11 bg-white/40 backdrop-blur-md border-white/30 focus:bg-white/60 transition-colors" required />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-foreground text-sm font-medium">Password</Label>
                      {(mode === "login" || mode === "signup") && (
                        <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11 bg-white/40 backdrop-blur-md border-white/30 focus:bg-white/60 transition-colors" required minLength={6} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" className="w-full h-11 text-sm font-medium gap-2 group bg-black hover:bg-black/90 text-white" disabled={loading}>
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-2">
                {mode === "forgot" ? (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setMode("login")} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      Back to <span className="font-medium text-primary">Sign in</span>
                    </button>
                    <button onClick={() => setMode("signup")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                      Need an account? <span className="font-medium text-primary">Sign up</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {mode === "login" ? (
                        <>Don't have an account? <span className="font-medium text-primary">Sign up</span></>
                      ) : (
                        <>Already have an account? <span className="font-medium text-primary">Sign in</span></>
                      )}
                    </button>
                    {mode === "signup" && (
                      <button onClick={() => setMode("forgot")} className="text-xs text-muted-foreground hover:text-primary transition-colors">
                        Forgot password?
                      </button>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
