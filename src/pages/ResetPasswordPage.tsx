import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Lock, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";

const MIN_PASSWORD_LENGTH = 8;

/** Read the error Supabase puts in the URL (expired/used link) before it strips the hash. */
function readLinkError(): string | null {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const description = hash.get("error_description") ?? query.get("error_description");
  if (description) return description.replace(/\+/g, " ");
  return hash.get("error") ?? query.get("error");
}

type Status = "checking" | "ready" | "invalid";

export default function ResetPasswordPage() {
  // Captured on first render — supabase-js clears the hash once it processes the link.
  const [linkError] = useState(readLinkError);
  const [status, setStatus] = useState<Status>(linkError ? "invalid" : "checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (linkError) return;

    let cancelled = false;

    // Fires when supabase-js finishes parsing the recovery token out of the URL.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === "PASSWORD_RECOVERY" || session) setStatus("ready");
    });

    // getSession() resolves after the client has processed the URL, so this also
    // covers the case where recovery completed before this component mounted.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setStatus((current) => (data.session ? "ready" : current === "ready" ? "ready" : "invalid"));
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [linkError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "Please retype both fields.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      // Sign out so the new password is used to log back in, and so the one-time
      // recovery session can't keep being used.
      await supabase.auth.signOut();
      toast({ title: "Password updated", description: "Sign in with your new password." });
      navigate("/login", { replace: true });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
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
            Choose a new password
          </h1>
          <p className="text-primary-foreground/70 text-lg leading-relaxed">
            Pick something you haven't used elsewhere. You'll use it to sign in from now on.
          </p>
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
              <CardTitle className="text-2xl font-bold text-foreground">
                {status === "invalid" ? "Link no longer valid" : "Set a new password"}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {status === "invalid"
                  ? "Reset links expire after a short while and can only be used once."
                  : `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters`}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {status === "checking" && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground py-4">
                  <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  Verifying your reset link...
                </div>
              )}

              {status === "invalid" && (
                <div className="space-y-4">
                  <div className="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    <p className="text-sm text-destructive">
                      {linkError ?? "This reset link is invalid or has expired. Request a new one to continue."}
                    </p>
                  </div>
                  <Button onClick={() => navigate("/login", { replace: true })} className="w-full h-11 text-sm font-medium gap-2 group bg-black hover:bg-black/90 text-white">
                    Back to sign in
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              )}

              {status === "ready" && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-foreground text-sm font-medium">New password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 pr-10 h-11 bg-white/40 backdrop-blur-md border-white/30 focus:bg-white/60 transition-colors" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-foreground text-sm font-medium">Confirm new password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input id="confirmPassword" type={showPassword ? "text" : "password"} placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11 bg-white/40 backdrop-blur-md border-white/30 focus:bg-white/60 transition-colors" required minLength={MIN_PASSWORD_LENGTH} autoComplete="new-password" />
                    </div>
                    {confirmPassword.length > 0 && password !== confirmPassword && (
                      <p className="text-xs text-destructive">Passwords don't match</p>
                    )}
                  </div>

                  <Button type="submit" className="w-full h-11 text-sm font-medium gap-2 group bg-black hover:bg-black/90 text-white" disabled={loading}>
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Update password
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </>
                    )}
                  </Button>
                </form>
              )}

              {status !== "invalid" && (
                <div className="mt-6 text-center">
                  <button onClick={() => navigate("/login", { replace: true })} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                    Back to <span className="font-medium text-primary">Sign in</span>
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
