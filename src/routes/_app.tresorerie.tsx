import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db";
import { formatEUR } from "@/lib/schemas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Download, Mail } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/tresorerie")({
  head: () => ({ meta: [{ title: "Trésorerie — CITY DERAT" }] }),
  component: TresoreriePage,
});

type Period = "mois" | "trimestre" | "annee";

function getPeriodDates(period: Period): { start: string; end: string; prevStart: string; prevEnd: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  if (period === "mois") {
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
    const prevStart = `${y}-${String(m).padStart(2, "0") || `${y - 1}-12`}-01`;
    const ps = new Date(y, m - 1, 1);
    const pe = new Date(y, m, 0);
    return {
      start,
      end,
      prevStart: `${ps.getFullYear()}-${String(ps.getMonth() + 1).padStart(2, "0")}-01`,
      prevEnd: pe.toISOString().slice(0, 10),
    };
  }

  if (period === "trimestre") {
    const q = Math.floor(m / 3);
    const start = new Date(y, q * 3, 1).toISOString().slice(0, 10);
    const end = new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10);
    const pqs = new Date(y, (q - 1) * 3, 1);
    const pqe = new Date(y, q * 3, 0);
    return {
      start,
      end,
      prevStart: pqs.toISOString().slice(0, 10),
      prevEnd: pqe.toISOString().slice(0, 10),
    };
  }

  // annee
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    prevStart: `${y - 1}-01-01`,
    prevEnd: `${y - 1}-12-31`,
  };
}

function useTresorerieData(period: Period) {
  const { start, end, prevStart, prevEnd } = getPeriodDates(period);

  return useQuery({
    queryKey: ["tresorerie", period],
    queryFn: async () => {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      const [current, prev, overdueInvoices, allInvoices12m, clients] = await Promise.all([
        db.from("invoices").select("*, client:clients(raison_sociale)").gte("date_facture", start).lte("date_facture", end),
        db.from("invoices").select("total_ttc, statut").gte("date_facture", prevStart).lte("date_facture", prevEnd),
        db.from("invoices").select("*, client:clients(raison_sociale)").in("statut", ["envoyee", "retard"]),
        db.from("invoices").select("total_ttc, statut, client_id, date_facture, client:clients(raison_sociale)").gte("date_facture", new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10)),
        db.from("clients").select("id, raison_sociale"),
      ]);

      const PAID = ["payee", "envoyee", "retard"];
      const inv = current.data ?? [];

      const caEncaisse = inv.filter((i: any) => i.statut === "payee").reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const caAttente = inv.filter((i: any) => i.statut === "envoyee").reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const caRetard = inv.filter((i: any) => i.statut === "retard").reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const caPrevu = inv.filter((i: any) => i.statut === "brouillon").reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const caTotal = inv.filter((i: any) => PAID.includes(i.statut)).reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);

      const prevTotal = (prev.data ?? []).filter((i: any) => PAID.includes(i.statut)).reduce((s: number, i: any) => s + Number(i.total_ttc ?? 0), 0);
      const evolution = prevTotal === 0 ? null : ((caTotal - prevTotal) / prevTotal) * 100;

      // Relances urgentes
      const relances = (overdueInvoices.data ?? [])
        .filter((i: any) => i.echeance && i.echeance < today)
        .map((i: any) => ({
          ...i,
          daysLate: Math.floor((now.getTime() - new Date(i.echeance + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24)),
        }))
        .sort((a: any, b: any) => b.daysLate - a.daysLate);

      // Top 5 clients
      const clientMap = new Map<string, { nom: string; ca: number }>();
      for (const i of inv) {
        if (!PAID.includes(i.statut)) continue;
        const id = i.client_id;
        const nom = (i.client as any)?.raison_sociale ?? "—";
        const prev2 = clientMap.get(id) ?? { nom, ca: 0 };
        clientMap.set(id, { nom, ca: prev2.ca + Number(i.total_ttc ?? 0) });
      }
      const top5 = [...clientMap.entries()]
        .sort((a, b) => b[1].ca - a[1].ca)
        .slice(0, 5)
        .map(([, v]) => v);

      // Barres 6 mois
      const months6: { label: string; ca: number; current: boolean }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("fr-FR", { month: "short" });
        const ca = (allInvoices12m.data ?? [])
          .filter((inv2: any) => PAID.includes(inv2.statut) && inv2.date_facture?.startsWith(key))
          .reduce((s: number, inv2: any) => s + Number(inv2.total_ttc ?? 0), 0);
        months6.push({ label, ca, current: i === 0 });
      }

      return { caEncaisse, caAttente, caRetard, caPrevu, caTotal, prevTotal, evolution, relances, top5, months6, currentInvoices: inv };
    },
  });
}

export default function TresoreriePage() {
  const [period, setPeriod] = useState<Period>("mois");
  const { data, isLoading } = useTresorerieData(period);
  const [exporting, setExporting] = useState(false);

  const TABS: { value: Period; label: string }[] = [
    { value: "mois", label: "Ce mois" },
    { value: "trimestre", label: "Ce trimestre" },
    { value: "annee", label: "Cette année" },
  ];

  const caTotal = data?.caTotal ?? 0;
  const prevTotal = data?.prevTotal ?? 0;
  const evolution = data?.evolution;

  async function handleExport() {
    if (!data?.currentInvoices) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      const sheet = XLSX.utils.json_to_sheet(
        data.currentInvoices.map((i: any) => ({
          "Date": i.date_facture,
          "Client": (i.client as any)?.raison_sociale ?? "",
          "Statut": i.statut,
          "Total TTC": i.total_ttc,
          "Écheance": i.echeance ?? "",
        }))
      );
      XLSX.utils.book_append_sheet(wb, sheet, "Trésorerie");
      XLSX.writeFile(wb, `tresorerie-${period}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success("Export téléchargé");
    } catch {
      toast.error("Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trésorerie</h1>
          <p className="text-sm text-muted-foreground">Suivi financier de votre activité.</p>
        </div>
        <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-1.5" />
          {exporting ? "Export…" : "Excel"}
        </Button>
      </div>

      {/* Onglets période */}
      <div className="flex rounded-xl bg-muted p-1 gap-1">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setPeriod(t.value)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all ${
              period === t.value
                ? "bg-card shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* KPI principal — CA encaissé */}
      <div className="rounded-2xl p-4 text-white" style={{ background: "#1a3c2e" }}>
        <div className="text-xs uppercase tracking-widest text-white/60 mb-1">CA encaissé</div>
        <div className="text-3xl font-bold tabular-nums">
          {isLoading ? "…" : formatEUR(data?.caEncaisse ?? 0)}
        </div>
        <div className="flex items-center gap-1.5 mt-1 text-sm text-white/80">
          {evolution !== null && evolution !== undefined ? (
            <>
              {evolution > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : evolution < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-400" />
              ) : (
                <Minus className="h-4 w-4" />
              )}
              <span className={evolution > 0 ? "text-green-400" : evolution < 0 ? "text-red-400" : ""}>
                {evolution > 0 ? "+" : ""}{Math.round(evolution)}% vs période précédente
              </span>
            </>
          ) : (
            <span className="text-white/50">Pas de données précédentes</span>
          )}
        </div>
        {/* Barre CA total vs précédent */}
        {prevTotal > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-400 transition-all duration-500"
                style={{ width: `${Math.min(100, caTotal > 0 && prevTotal > 0 ? (caTotal / Math.max(caTotal, prevTotal)) * 100 : 0)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-white/50 mt-1">
              <span>Cette période : {formatEUR(caTotal)}</span>
              <span>Précédente : {formatEUR(prevTotal)}</span>
            </div>
          </div>
        )}
      </div>

      {/* 4 KPIs secondaires */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard
          label="Payé"
          value={isLoading ? "…" : formatEUR(data?.caEncaisse ?? 0)}
          color="bg-green-100 dark:bg-green-950/30"
          textColor="text-green-700 dark:text-green-400"
        />
        <KpiCard
          label="En attente"
          value={isLoading ? "…" : formatEUR(data?.caAttente ?? 0)}
          color="bg-orange-100 dark:bg-orange-950/30"
          textColor="text-orange-700 dark:text-orange-400"
        />
        <KpiCard
          label="En retard"
          value={isLoading ? "…" : formatEUR(data?.caRetard ?? 0)}
          color="bg-red-100 dark:bg-red-950/30"
          textColor="text-red-700 dark:text-red-400"
        />
        <KpiCard
          label="Prévu (brouillons)"
          value={isLoading ? "…" : formatEUR(data?.caPrevu ?? 0)}
          color="bg-purple-100 dark:bg-purple-950/30"
          textColor="text-purple-700 dark:text-purple-400"
        />
      </div>

      {/* Graphique 6 mois */}
      <Card>
        <CardContent className="p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold mb-3">
            CA des 6 derniers mois
          </div>
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">Chargement…</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={data?.months6 ?? []} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => formatEUR(v)}
                  labelStyle={{ fontSize: 12 }}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Bar dataKey="ca" radius={[4, 4, 0, 0]}>
                  {(data?.months6 ?? []).map((entry, i) => (
                    <Cell key={i} fill={entry.current ? "#1a3c2e" : "#a3c4a8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Relances urgentes */}
      {!isLoading && (data?.relances?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Relances urgentes ({data!.relances.length})
          </h2>
          <div className="space-y-2">
            {data!.relances.map((inv: any) => (
              <Card key={inv.id} className="border-red-200 dark:border-red-900/40">
                <CardContent className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">
                      {(inv.client as any)?.raison_sociale ?? "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatEUR(inv.total_ttc)} · {inv.daysLate}j de retard
                    </div>
                  </div>
                  <a
                    href={`mailto:${(inv.client as any)?.email ?? ""}?subject=Relance%20facture&body=Bonjour%2C%20nous%20vous%20relançons%20pour%20la%20facture%20de%20${formatEUR(inv.total_ttc)}%20échue%20depuis%20${inv.daysLate}%20jours.`}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-1.5 text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-100 transition-colors"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Relancer
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Top 5 clients */}
      {!isLoading && (data?.top5?.length ?? 0) > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top 5 clients — période
          </h2>
          <Card>
            <CardContent className="p-0">
              {data!.top5.map((c, i) => {
                const maxCa = data!.top5[0].ca;
                const pct = maxCa > 0 ? (c.ca / maxCa) * 100 : 0;
                return (
                  <div key={i} className={`flex items-center gap-3 px-4 py-3 ${i < data!.top5.length - 1 ? "border-b" : ""}`}>
                    <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.nom}</div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-accent transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-semibold tabular-nums shrink-0">{formatEUR(c.ca)}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>
      )}

      {!isLoading && (data?.top5?.length ?? 0) === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune facture sur cette période.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({ label, value, color, textColor }: { label: string; value: string; color: string; textColor: string }) {
  return (
    <div className={`rounded-xl p-3 ${color}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${textColor}`}>{value}</div>
    </div>
  );
}
