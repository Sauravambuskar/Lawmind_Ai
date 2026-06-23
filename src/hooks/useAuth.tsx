import { useContext } from "react";
import { AuthContext } from "./AuthContext";
import type { AuthContextType } from "./AuthContext";

export type { AuthContextType };

export function useAuth() {
  return useContext(AuthContext);
}
