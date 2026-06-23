export type UserRole = 'super_admin' | 'admin' | 'agent' | 'lawyer';

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  status: 'active' | 'inactive';
  created_at: string;
}
