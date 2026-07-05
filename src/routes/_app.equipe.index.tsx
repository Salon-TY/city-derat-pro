import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useCurrentRole, useTeamMembers, type TeamMember } from "@/lib/queries";
import { USERNAME_RE } from "@/lib/team";
import { createEmployee, resetEmployeePassword, setEmployeeActive, deleteEmployee } from "@/lib/api/team.functions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, KeyRound, ShieldOff, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/equipe/")({
  head: () => ({ meta: [{ title: "Équipe — CITY DERAT" }] }),
  component: EquipePage,
});

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Une erreur est survenue";
}

// ─── Ajouter un employé ────────────────────────────────────────────────────────

function AddEmployeeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);

  function reset() {
    setDisplayName("");
    setUsername("");
    setPassword("");
    setCreated(null);
  }

  async function handleCreate() {
    if (!displayName.trim()) { toast.error("Nom affiché requis"); return; }
    const u = username.trim().toLowerCase();
    if (!USERNAME_RE.test(u)) { toast.error("Identifiant invalide (3-30 car. : lettres, chiffres, . _ -)"); return; }
    if (password.length < 8) { toast.error("Mot de passe : 8 caractères minimum"); return; }

    setSaving(true);
    try {
      await createEmployee({ data: { displayName: displayName.trim(), username: u, password } });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      setCreated({ username: u, password });
      toast.success("Employé créé");
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Ajouter un employé</DialogTitle></DialogHeader>
        {created ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Notez ces identifiants et transmettez-les à l'employé — le mot de passe ne sera plus affiché ensuite.
            </p>
            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div><span className="text-muted-foreground">Identifiant : </span><span className="font-mono font-semibold">{created.username}</span></div>
              <div><span className="text-muted-foreground">Mot de passe : </span><span className="font-mono font-semibold">{created.password}</span></div>
            </div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Fermer</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom affiché</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="ex: Marie Dupont" />
            </div>
            <div className="space-y-1.5">
              <Label>Identifiant</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ex: marie" />
              <p className="text-[11px] text-muted-foreground">3 à 30 caractères : lettres minuscules, chiffres, . _ -</p>
            </div>
            <div className="space-y-1.5">
              <Label>Mot de passe</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">8 caractères minimum</p>
            </div>
            <Button className="w-full" disabled={saving} onClick={handleCreate}>
              {saving ? "Création…" : "Créer l'employé"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Réinitialiser le mot de passe ─────────────────────────────────────────────

function ResetPasswordDialog({ memberId, open, onOpenChange }: { memberId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  async function handleReset() {
    if (newPassword.length < 8) { toast.error("Mot de passe : 8 caractères minimum"); return; }
    setSaving(true);
    try {
      await resetEmployeePassword({ data: { memberId, newPassword } });
      setDone(newPassword);
      toast.success("Mot de passe réinitialisé");
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setNewPassword(""); setDone(null); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Réinitialiser le mot de passe</DialogTitle></DialogHeader>
        {done ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Nouveau mot de passe — ne sera plus affiché ensuite.</p>
            <div className="rounded-lg border bg-muted/30 p-3 text-sm font-mono font-semibold">{done}</div>
            <Button className="w-full" onClick={() => onOpenChange(false)}>Fermer</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">8 caractères minimum</p>
            </div>
            <Button className="w-full" disabled={saving} onClick={handleReset}>
              {saving ? "Enregistrement…" : "Réinitialiser"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Ligne employé ──────────────────────────────────────────────────────────────

function EmployeeRow({ member }: { member: TeamMember }) {
  const qc = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  async function handleToggleActive() {
    setToggling(true);
    try {
      await setEmployeeActive({ data: { memberId: member.id, active: !member.active } });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success(member.active ? "Employé désactivé" : "Employé activé");
    } catch (e) {
      toast.error(errMessage(e));
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    try {
      await deleteEmployee({ data: { memberId: member.id } });
      qc.invalidateQueries({ queryKey: ["team_members"] });
      toast.success("Employé supprimé");
    } catch (e) {
      toast.error(errMessage(e));
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold truncate">{member.display_name || member.username}</div>
            <div className="text-xs text-muted-foreground font-mono">{member.username}</div>
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase",
            member.active ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {member.active ? "Actif" : "Désactivé"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setResetOpen(true)}>
            <KeyRound className="mr-1.5 h-3.5 w-3.5" /> Réinitialiser le mot de passe
          </Button>
          <Button variant="outline" size="sm" disabled={toggling} onClick={handleToggleActive}>
            {member.active
              ? <><ShieldOff className="mr-1.5 h-3.5 w-3.5" /> Désactiver</>
              : <><ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Activer</>}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive border-destructive/30 hover:bg-destructive/5">
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Le compte de {member.display_name || member.username} sera définitivement supprimé. Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive">Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
      <ResetPasswordDialog memberId={member.id} open={resetOpen} onOpenChange={setResetOpen} />
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

function EquipePage() {
  const { data: role, isLoading: roleLoading } = useCurrentRole();
  const { data: members = [], isLoading: membersLoading } = useTeamMembers();
  const [addOpen, setAddOpen] = useState(false);

  if (roleLoading) {
    return <div className="text-sm text-muted-foreground py-10 text-center">Chargement…</div>;
  }

  if (role !== "owner") {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-2">
          <Users className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Accès réservé au responsable.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Équipe</h1>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> Ajouter un employé
        </Button>
      </div>

      {membersLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
      ) : members.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Aucun employé. Ajoutez-en un pour partager l'accès à vos données.
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {members.map((m) => <EmployeeRow key={m.id} member={m} />)}
        </div>
      )}

      <AddEmployeeDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}
