import { useState, useEffect, createContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { UserRole, UserProfile } from "./auth.types";

// Minimal session shape used by the MySQL client (compatible with Supabase shape)
export interface AppSession {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: AppUser;
}

export interface AppUser {
  id: string;
  email?: string;
  user_metadata?: Record<string, any>;
}

export interface AuthContextType {
  session: AppSession | null;
  user: AppUser | null;
  profile: UserProfile | null;
  role: UserRole;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  role: 'agent',
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

function buildProfile(data: Record<string, unknown>): UserProfile {
  return {
    id: data.id as string,
    user_id: data.user_id as string,
    full_name: (data.full_name as string) ?? null,
    email: (data.email as string) ?? null,
    phone: (data.phone as string) ?? null,
    avatar_url: (data.avatar_url as string) ?? null,
    role: (data.role as UserRole) || 'agent',
    status: (data.status as 'active' | 'inactive') || 'active',
    created_at: data.created_at as string,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AppSession | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s as AppSession | null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(buildProfile(data));
      });
  }, [session?.user?.id]);

  const refreshProfile = async () => {
    if (!session?.user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();
    if (data) setProfile(buildProfile(data));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? 'agent',
      loading,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
