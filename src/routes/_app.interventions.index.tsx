import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_app/interventions/")({
  head: () => ({ meta: [{ title: "Interventions — CITY DERAT" }] }),
  component: () => (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Interventions</h1>
      <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Module à venir dans la prochaine étape.</CardContent></Card>
    </div>
  ),
});
