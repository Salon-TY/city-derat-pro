import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeUsername, usernameToEmail, USERNAME_RE } from "@/lib/team";

// IMPORTANT : le client service-role (supabaseAdmin) est chargé via un import
// dynamique DANS chaque handler, jamais au niveau module. Le code de module
// d'un fichier *.functions.ts est expédié au bundle client ; seul un module
// *.server.ts importé dynamiquement à l'intérieur d'un handler est exclu du
// bundle client (voir le commentaire dans client.server.ts).

async function requireOwner(context: { supabase: any }) {
  const { data, error } = await context.supabase.rpc("current_user_role");
  if (error || data !== "owner") {
    throw new Error("Action réservée au propriétaire du compte.");
  }
}

export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    displayName: z.string().trim().min(1, "Nom requis"),
    username: z.string().trim().min(1, "Identifiant requis"),
    password: z.string().min(8, "8 caractères minimum"),
  }))
  .handler(async ({ data, context }) => {
    await requireOwner(context);

    const username = normalizeUsername(data.username);
    if (!USERNAME_RE.test(username)) {
      throw new Error("Identifiant invalide (3 à 30 caractères : lettres, chiffres, . _ -).");
    }

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await admin
      .from("team_members")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) throw new Error("Cet identifiant est déjà utilisé.");

    const email = usernameToEmail(username);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName, username },
    });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Impossible de créer le compte employé.");
    }

    const { error: insertErr } = await admin.from("team_members").insert({
      owner_id: context.userId,
      user_id: created.user.id,
      email,
      username,
      display_name: data.displayName,
      role: "employe",
      active: true,
    });
    if (insertErr) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw new Error(insertErr.message);
    }

    return { ok: true };
  });

export const resetEmployeePassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    memberId: z.string().uuid(),
    newPassword: z.string().min(8, "8 caractères minimum"),
  }))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await admin
      .from("team_members")
      .select("id, owner_id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error || !member || member.owner_id !== context.userId) {
      throw new Error("Employé introuvable.");
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(member.user_id, {
      password: data.newPassword,
    });
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });

export const setEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    memberId: z.string().uuid(),
    active: z.boolean(),
  }))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await admin
      .from("team_members")
      .select("id, owner_id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error || !member || member.owner_id !== context.userId) {
      throw new Error("Employé introuvable.");
    }

    const { error: updateErr } = await admin
      .from("team_members")
      .update({ active: data.active })
      .eq("id", data.memberId);
    if (updateErr) throw new Error(updateErr.message);

    const { error: banErr } = await admin.auth.admin.updateUserById(member.user_id, {
      ban_duration: data.active ? "none" : "876000h",
    });
    if (banErr) throw new Error(banErr.message);

    return { ok: true };
  });

export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({
    memberId: z.string().uuid(),
  }))
  .handler(async ({ data, context }) => {
    await requireOwner(context);
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    const { data: member, error } = await admin
      .from("team_members")
      .select("id, owner_id, user_id")
      .eq("id", data.memberId)
      .maybeSingle();
    if (error || !member || member.owner_id !== context.userId) {
      throw new Error("Employé introuvable.");
    }

    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(member.user_id);
    if (deleteAuthErr) throw new Error(deleteAuthErr.message);

    const { error: deleteRowErr } = await admin.from("team_members").delete().eq("id", data.memberId);
    if (deleteRowErr) throw new Error(deleteRowErr.message);

    return { ok: true };
  });
