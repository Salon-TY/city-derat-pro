/**
 * Patch @netlify/dev's bundled @netlify/config to fix:
 * "omit.default is not a function" (CJS/ESM interop bug in @netlify/config@24.x)
 */
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const file = resolve(
  import.meta.dirname,
  "../node_modules/@netlify/dev/node_modules/@netlify/config/lib/env/main.js"
);

try {
  const src = readFileSync(file, "utf8");
  const patched = src.replace(
    "return omit.default(userEnv, READONLY_ENV);",
    "return (omit.default ?? omit)(userEnv, READONLY_ENV);"
  );
  if (src === patched) {
    console.log("[postinstall] @netlify/config patch: already applied or not needed.");
  } else {
    writeFileSync(file, patched);
    console.log("[postinstall] @netlify/config patch: applied successfully.");
  }
} catch {
  // File doesn't exist (e.g. future version fixed it) — silently skip
}
