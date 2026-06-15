import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useClients } from "@/lib/queries";
import { Plus, Search, Phone, MapPin, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/clients/")({
  head: () => ({ meta: [{ title: "Clients — CITY DERAT" }] }),
  component: ClientsList,
});

function ClientsList() {
  const { data: clients = [], isLoading } = useClients();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return clients;
    return clients.filter((c) =>
      [c.raison_sociale, c.adresse_site, c.telephone, c.email, c.type_nuisible]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(s))
    );
  }, [clients, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/clients/new"><Plus className="mr-1 h-4 w-4" /> Ajouter</Link>
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un client…" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Chargement…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          {clients.length === 0 ? "Aucun client. Commencez par en ajouter un." : "Aucun résultat."}
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <Link key={c.id} to="/clients/$id" params={{ id: c.id }} className="block">
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{c.raison_sociale}</div>
                      {c.adresse_site && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{c.adresse_site}</span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-3 text-xs">
                        {c.telephone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{c.telephone}</span>}
                        {c.type_nuisible && <span className="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-accent font-medium">{c.type_nuisible}</span>}
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
