// src/lib/print.ts
// Fenêtre d'impression avec un format de page A4 homogène pour TOUS les PDF
// de l'application (contrats, factures, devis, rapports, certificat).
// Le format et les marges sont fixés ici une seule fois : le rendu est donc
// identique quel que soit l'appareil (mobile / ordinateur, A4 / Letter).

export interface PrintOptions {
  /** Titre du document (onglet + nom de fichier proposé à l'impression). */
  title: string;
  /** Contenu HTML du corps (SANS les balises <html>/<head>/<body>). */
  bodyHtml: string;
  /** CSS spécifique au document (styles des .header, tableaux, etc.). */
  css?: string;
}

const PAGE_SHELL_CSS = `
  /* Format fixé : A4 + marges constantes, répétées sur CHAQUE page imprimée */
  @page { size: A4; margin: 14mm 15mm; }

  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 11px;
    color: #1f2937;
    line-height: 1.4;
    /* Conserve les fonds colorés (bandeaux verts / oranges) à l'impression */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  img { max-width: 100%; }
`;

/**
 * Ouvre une fenêtre d'impression au format A4 homogène.
 * @returns false si la popup a été bloquée (l'appelant affiche alors le toast).
 */
export function printDocument({ title, bodyHtml, css = "" }: PrintOptions): boolean {
  const win = window.open("", "_blank");
  if (!win) return false;

  win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>${title}</title>
<style>${PAGE_SHELL_CSS}${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 600);
  return true;
}
