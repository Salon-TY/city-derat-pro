import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { usernameToEmail } from "@/lib/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Bug } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Connexion — CITY DERAT" }] }),
  component: AuthPage,
});

// Un technicien atterrit sur son interface dédiée (/tech), tous les autres
// (owner, bureau) sur le tableau de bord admin (/).
async function resolveHomeRoute(): Promise<"/tech" | "/"> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return "/";
  const [{ data: role }, { data: member }] = await Promise.all([
    supabase.rpc("current_user_role"),
    supabase.from("team_members").select("poste").eq("user_id", user.id).maybeSingle(),
  ]);
  const isTechnician = role !== "owner" && member?.poste === "technicien";
  return isTechnician ? "/tech" : "/";
}

function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) navigate({ to: await resolveHomeRoute(), replace: true });
    });
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const v = identifier.trim();
      const email = v.includes("@") ? v : usernameToEmail(v);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Connecté");
      navigate({ to: await resolveHomeRoute(), replace: true });
    } catch {
      toast.error("Identifiant ou mot de passe incorrect, ou compte désactivé.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Bug className="h-7 w-7" />
          </div>
          <CardTitle className="mt-2 text-2xl tracking-tight">CITY DERAT</CardTitle>
          <CardDescription>Connectez-vous à votre espace</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="identifier">Identifiant ou email</Label>
              <Input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Patientez..." : "Se connecter"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
