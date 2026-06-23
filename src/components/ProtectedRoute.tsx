import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, signOut } = useAuth();
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!loading && profile && profile.status === "inactive") {
      toast.error("Your account has been deactivated. Contact your administrator.");
      signOut();
      setBlocked(true);
    }
  }, [loading, profile, signOut]);

  if (loading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (!session || blocked) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
