import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentRole, useMyPoste } from "@/lib/queries";
import { TechShell } from "@/components/tech-shell";

export const Route = createFileRoute("/tech")({
  component: TechLayout,
});

function TechLayout() {
  const navigate = useNavigate();
  const [sessionReady, setSessionReady] = useState(false);
  const { data: role } = useCurrentRole();
  const { data: myPoste } = useMyPoste();

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (!data.session) {
        navigate({ to: "/auth", replace: true });
      } else {
        setSessionReady(true);
      }
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === "SIGNED_OUT") {
        setSessionReady(false);
        navigate({ to: "/auth", replace: true });
      } else if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session) {
        setSessionReady(true);
      }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  const posteResolved = role !== undefined && myPoste !== undefined;
  const isTechnician = role !== undefined && role !== "owner" && myPoste === "technicien";

  // Un non-technicien (owner, bureau) ne doit jamais voir l'interface
  // technicien — retour à l'interface admin.
  useEffect(() => {
    if (sessionReady && posteResolved && !isTechnician) {
      navigate({ to: "/", replace: true });
    }
  }, [sessionReady, posteResolved, isTechnician, navigate]);

  if (!sessionReady || !posteResolved || !isTechnician) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <div className="text-sm text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <TechShell>
      <Outlet />
    </TechShell>
  );
}
