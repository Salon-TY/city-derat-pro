import { useEffect, useState } from "react";
import {
  Select, SelectContent, SelectGroup, SelectItem, SelectLabel,
  SelectSeparator, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAssignableMembers, useTechnicianWorkload } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

// Sélecteur de technicien partagé (formulaire d'intervention + réassignation
// sur la fiche détail) : uniquement les techniciens (le personnel de bureau
// est déjà exclu par useAssignableMembers), avec "Moi" épinglé en tête et
// séparé du reste de l'équipe, plus un indicateur de charge (interventions
// planifiées) entre parenthèses.

export function TechnicianSelect({
  value,
  onValueChange,
  triggerClassName,
  placeholder = "Non assigné",
}: {
  value: string; // "none" ou un user_id
  onValueChange: (v: string) => void;
  triggerClassName?: string;
  placeholder?: string;
}) {
  const { data: members = [] } = useAssignableMembers();
  const { data: workload = {} } = useTechnicianWorkload();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const selfMember = currentUserId ? members.find((m) => m.user_id === currentUserId) : undefined;
  const otherMembers = members.filter((m) => m.user_id !== currentUserId);

  function labelFor(m: { user_id: string; display_name: string }): string {
    const count = workload[m.user_id];
    return count ? `${m.display_name} (${count})` : m.display_name;
  }

  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Non assigné</SelectItem>
        {selfMember && (
          <>
            <SelectGroup>
              <SelectLabel>Moi</SelectLabel>
              <SelectItem value={selfMember.user_id}>Moi — {labelFor(selfMember)}</SelectItem>
            </SelectGroup>
            {otherMembers.length > 0 && <SelectSeparator />}
          </>
        )}
        {otherMembers.length > 0 && (
          <SelectGroup>
            {selfMember && <SelectLabel>Équipe</SelectLabel>}
            {otherMembers.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>{labelFor(m)}</SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
