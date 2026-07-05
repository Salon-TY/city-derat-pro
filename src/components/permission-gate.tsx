// Wraps a protected page. If the current user may not see it, redirects to
// Terrain (/interventions) — the page that's always allowed.
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useMyAccess } from "@/lib/queries";
import type { PermissionKey } from "@/lib/permissions";

export function PermissionGate({ perm, children }: { perm: PermissionKey; children: React.ReactNode }) {
  const { can, loading } = useMyAccess();
  const navigate = useNavigate();
  const allowed = can(perm);
  useEffect(() => {
    if (!loading && !allowed) {
      toast.error("Accès non autorisé.");
      navigate({ to: "/interventions", replace: true });
    }
  }, [loading, allowed, navigate]);
  if (loading || !allowed) return null;
  return <>{children}</>;
}
