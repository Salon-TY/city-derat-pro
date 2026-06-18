/**
 * Patch 1: @netlify/dev's bundled @netlify/config — fix "omit.default is not a function"
 * Patch 2: @tanstack/start-plugin-core — fix SSR manifest crash when TSS_ROUTES_MANIFEST is null
 *   (version mismatch between start-plugin-core@1.169.x and react-start@1.167.x)
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// Patch 1 — omit.default
const file1 = resolve(
  import.meta.dirname,
  "../node_modules/@netlify/dev/node_modules/@netlify/config/lib/env/main.js"
);
try {
  const src = readFileSync(file1, "utf8");
  const patched = src.replace(
    "return omit.default(userEnv, READONLY_ENV);",
    "return (omit.default ?? omit)(userEnv, READONLY_ENV);"
  );
  if (src === patched) {
    console.log("[postinstall] Patch 1 (omit.default): already applied or not needed.");
  } else {
    writeFileSync(file1, patched);
    console.log("[postinstall] Patch 1 (omit.default): applied successfully.");
  }
} catch {
  // File doesn't exist (future version fixed it) — silently skip
}

// Patch 2 — TSS_ROUTES_MANIFEST null guard
// When Netlify/Nitro runs a second Vite build for the SSR function, globalThis.TSS_ROUTES_MANIFEST
// is not populated (router generator ran in a different Vite instance). Without the guard,
// Object.entries(undefined) throws. Returning an empty manifest is safe — the actual manifest
// data was already serialized during the first Vite build phase.
const file2 = resolve(
  import.meta.dirname,
  "../node_modules/@tanstack/start-plugin-core/dist/esm/vite/start-manifest-plugin/plugin.js"
);
try {
  const src = readFileSync(file2, "utf8");
  const patched = src.replace(
    "if (!clientBuild) return getEmptyStartManifestModule(clientEntry);",
    "if (!clientBuild || !routeTreeRoutes) return getEmptyStartManifestModule(clientEntry);"
  );
  if (src === patched) {
    console.log("[postinstall] Patch 2 (TSS_ROUTES_MANIFEST): already applied or not needed.");
  } else {
    writeFileSync(file2, patched);
    console.log("[postinstall] Patch 2 (TSS_ROUTES_MANIFEST): applied successfully.");
  }
} catch {
  // File doesn't exist — silently skip
}
