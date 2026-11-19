import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const [origin, confirmation] = process.argv.slice(2);

if (!origin || !/^https:\/\/[^/]+$/.test(origin) || confirmation !== "--confirm") {
  console.error(
    "Uso: node scripts/configure-form-service-secrets.mjs https://SERVICIO --confirm",
  );
  process.exit(1);
}

const appRoot = process.cwd();
const reportSecret = randomBytes(32).toString("hex");
const syncSecret = randomBytes(32).toString("hex");

function updateVars(source, updates) {
  let result = source.trimEnd();
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}=${JSON.stringify(value)}`;
    const matcher = new RegExp(`^${key}=.*$`, "m");
    result = matcher.test(result)
      ? result.replace(matcher, line)
      : `${result}${result ? "\n" : ""}${line}`;
  }
  return `${result}\n`;
}

const devVarsPath = path.join(appRoot, ".dev.vars");
let currentDevVars = "";
try {
  currentDevVars = await fs.readFile(devVarsPath, "utf8");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

await fs.writeFile(
  devVarsPath,
  updateVars(currentDevVars, {
    REPORT_SECRET: reportSecret,
    PUBLIC_FORM_ORIGIN: origin,
    ADMIN_LOCAL_ONLY: "true",
  }),
  { mode: 0o600 },
);

await fs.writeFile(
  path.join(appRoot, ".sync.vars"),
  updateVars("", {
    REMOTE_FORM_ORIGIN: origin,
    REMOTE_SYNC_SECRET: syncSecret,
  }),
  { mode: 0o600 },
);

await fs.writeFile(
  "/tmp/cgv-mensajeros-secrets.json",
  JSON.stringify({ REPORT_SECRET: reportSecret, SYNC_SECRET: syncSecret }),
  { mode: 0o600 },
);

console.log(
  "Claves nuevas preparadas. Los valores permanecen fuera de Git y no se muestran.",
);
