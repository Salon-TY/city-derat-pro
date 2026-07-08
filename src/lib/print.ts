// src/lib/print.ts
// Aperçu éditable + impression A4 homogène pour TOUS les PDF de l'application.
// L'utilisateur peut corriger n'importe quelle ligne à la main avant de générer
// le PDF (retouche ponctuelle, NON enregistrée).

export interface PrintOptions {
  /** Titre du document (onglet + nom de fichier proposé). */
  title: string;
  /** Contenu HTML du corps (SANS <html>/<head>/<body>). */
  bodyHtml: string;
  /** CSS spécifique au document. */
  css?: string;
}

const PAGE_SHELL_CSS = `
  @page { size: A4; margin: 14mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  body {
    font-family: Arial, "Helvetica Neue", Helvetica, sans-serif;
    font-size: 11px;
    color: #1f2937;
    line-height: 1.4;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  img { max-width: 100%; }

  /* Barre d'édition : visible à l'écran, masquée à l'impression */
  .pdf-edit-toolbar {
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px; background: #1a3c2e; color: #fff;
    font-family: Arial, sans-serif; font-size: 13px;
  }
  .pdf-edit-toolbar button {
    margin-left: auto; cursor: pointer; border: 0; border-radius: 6px;
    padding: 8px 16px; background: #f97316; color: #fff;
    font-size: 13px; font-weight: 600;
  }
  .pdf-editable { outline: none; }

  @media screen { body { padding-top: 52px; } }
  @media print {
    .pdf-edit-toolbar { display: none !important; }
    body { padding-top: 0 !important; }
  }
`;

/**
 * Ouvre un aperçu éditable du document. Retourne false si la popup est bloquée.
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
<body>
<div class="pdf-edit-toolbar">
  <span>Mode édition — cliquez dans le texte pour corriger. Les modifications ne sont pas enregistrées.</span>
  <button type="button" onclick="window.print()">Générer le PDF</button>
</div>
<div class="pdf-editable" contenteditable="true" spellcheck="false">${bodyHtml}</div>
</body>
</html>`);
  win.document.close();
  win.focus();
  return true;
}
