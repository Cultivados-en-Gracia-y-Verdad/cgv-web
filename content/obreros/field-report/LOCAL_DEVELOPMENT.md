# Local development handoff: Informe de campo

## Start here

This application manages private organizational follow-up and public support profiles for CGV graduates who enter ministry, called “Mensajeros”. Continue the existing application locally. Do not rebuild it from scratch. Keep all participant and administrator interface text in Spanish.

Important requirement update:
- CGV has operated for five years, but an individual Mensajero may have graduated recently.
- Private annual records begin with that person’s graduation year and continue through the current year; they are not public.
- Each Mensajero has a stable public URL containing only the last administrator-approved profile, authorized photos, and donation information.
- The signed participant URL is private and is used only to edit the profile and internal information.
- Publishing a new approved snapshot must not expose annual records or replace the previously published profile while edits are pending.

The user asked for:
- One personal link per participant, suitable for sending privately in WhatsApp.
- Each participant enters their own public-profile content, private annual information since graduation, and photos.
- An optional “Apoya mi trabajo” section: upload an existing donation QR image and add a funding URL and message.
- An administrator who can review everyone, publish public profiles, prepare private individual printable reports, and export Excel-compatible CSV files.
- A shareable JPG demonstration with fictional data.

The current hosted app is at https://field-report-workspace.calmnorth2.chatgpt.site
The public, fictional demonstration is at https://field-report-workspace.calmnorth2.chatgpt.site/demo

The next work is LOCAL ONLY. Do not deploy, change hosted access, rotate production secrets, or write to the hosted database unless the user explicitly requests it.

## Servicio remoto de formularios

El 19 de noviembre de 2026 se creó un servicio aislado para que los Mensajeros
puedan completar el formulario desde sus teléfonos:

- Worker: `cgv-mensajeros-formularios`
- URL pública: `https://formularios.discipuladocgv.org`
- Origen interno: `https://cgv-mensajeros-formularios.johnwry.workers.dev`
- Proxy Pages: `cgv-mensajeros-acceso`
- D1: `cgv-mensajeros-formularios`
- R2: `cgv-mensajeros-imagenes`
- Configuración: `wrangler.form-service.jsonc`

El panel administrativo remoto permanece bloqueado mediante
`ADMIN_LOCAL_ONLY=true`. El administrador local comparte `REPORT_SECRET` con
el servicio únicamente para crear invitaciones válidas, y usa otro secreto
independiente para sincronizar. Ambos valores están en archivos ignorados y en
los secretos de Cloudflare; nunca deben añadirse a Git ni imprimirse.

No vuelvas a ejecutar `scripts/configure-form-service-secrets.mjs` durante el
uso normal: rota las claves y anula todas las invitaciones existentes. Antes de
desplegar cambios deliberados, ejecuta las tres verificaciones y después
`npm run deploy:forms:check`. `npm run deploy:forms` actualiza únicamente este
Worker y requiere autorización explícita.

## Run locally

Requires Node.js 22.13 or newer and npm. Node.js 24 is recommended for matching the tested runtime.

From the extracted project directory:

1. Install the existing lockfile dependencies:
   npm ci

2. Create local configuration and a new local-only access secret:
   node scripts/local-setup.mjs

   This writes an ignored .dev.vars file, selects the portable execution profile,
   and prints your LOCAL administrator URL. Keep using that URL on localhost.
   It does not use, change, or print the production secret.

3. Build once to generate the local Worker binding configuration:
   npm run build

4. On a fresh local database only, apply the initial migration:
   node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_melodic_slapstick.sql

   Do not replay this migration against an already-initialized local database.
   Additional schema changes require new Drizzle migrations. Never rewrite
   applied migrations. Local D1 and R2 state lives in ignored .wrangler/.

5. Start development:
   npm run dev

   This starts the local application and a CSV watcher. Each successful save
   updates the ignored `private-data/` snapshot automatically.

6. Open the LOCAL administrator URL printed in step 2, starting with:
   http://localhost:5173/administrar/

   Visiting that URL sets an HttpOnly administrator cookie and redirects to /.
   The bare / page shows an invitation landing page to visitors without that cookie.
   The standalone demonstration is available at http://localhost:5173/demo.

7. In the administrator interface, open “Recopilar respuestas” and copy a personal
   invitation. Invitations use `https://formularios.discipuladocgv.org/participar/...` by
   default, even when the administrator is running locally. Set
   `PUBLIC_FORM_ORIGIN` only if the private form moves to another HTTPS origin.

## Datos privados locales y publicación mediante Git

El administrador continúa funcionando solamente en tu computadora. D1 y R2 se
utilizan como almacenamiento operativo local para conservar guardados y cargas
de imágenes con seguridad. Los CSV privados sirven como copia local legible y
restaurable; nunca deben añadirse a Git.

Con el servidor local activo, actualiza la copia CSV después de trabajar:

1. `npm run data:export`
2. Los archivos se escriben en `private-data/`, que está excluido por `.gitignore`.
3. Se crean CSV separados para Mensajeros, registros anuales, fotos, perfiles
   aprobados y fotos aprobadas. Las imágenes privadas se respaldan en la misma
   carpeta.

Para restaurar deliberadamente esos CSV sobre la base local actual:

`npm run data:import -- --confirm`

La importación reemplaza la información local, por eso requiere `--confirm`.

Para preparar el sitio público después de revisar y publicar perfiles:

1. Ejecuta `npm run data:export`.
2. Ejecuta `npm run site:prepare`.
3. Revisa `content/mensajeros/` y `static/img/mensajeros/` en la raíz del sitio.
4. Ejecuta Hugo localmente y revisa los perfiles.
5. Añade a Git únicamente los archivos públicos generados y los cambios de código.

`site:prepare` lee exclusivamente `perfiles-publicados.csv` y
`fotos-publicadas.csv`. No copia años, notas internas, estados de revisión,
fuentes privadas ni enlaces personales. Las páginas resultantes usan URLs como
`https://discipuladocgv.org/mensajeros/P01/`.

Los enlaces privados para completar el formulario todavía requieren el servicio
de formularios accesible desde Internet. Configura `PUBLIC_FORM_ORIGIN` en ese
servicio cuando tenga su dominio definitivo. La interfaz administrativa no
necesita publicarse; únicamente el formulario privado y sus API de guardado.
Configura `ADMIN_LOCAL_ONLY=true` en ese servicio para que la entrada y las API
administrativas rechacen solicitudes que no provengan de localhost.

### Sincronizar formularios remotos sin publicar el administrador

El servicio remoto usa un secreto independiente, `SYNC_SECRET`, únicamente en
su API de sincronización. No reutilices `REPORT_SECRET`. En la computadora del
administrador crea el archivo ignorado `.sync.vars`:

```text
REMOTE_FORM_ORIGIN="https://URL-DEL-SERVICIO-DE-FORMULARIOS"
REMOTE_SYNC_SECRET="EL-MISMO-VALOR-DE-SYNC_SECRET"
```

Flujo recomendado:

1. Antes de revisar, ejecuta `npm run sync:pull` para traer respuestas e imágenes.
2. Revisa y publica perfiles solamente en el administrador local.
3. Ejecuta `npm run sync:push -- --confirm` para devolver estados y datos
   necesarios para futuras actualizaciones de los Mensajeros.
4. Si alguien respondió mientras revisabas, el envío se detiene en vez de
   sobrescribirlo. Ejecuta de nuevo `sync:pull`, revisa y vuelve a enviar.
5. Ejecuta `npm run site:prepare` para generar únicamente el sitio público.

La API de sincronización no muestra una interfaz administrativa y requiere
`SYNC_SECRET` en cada solicitud. Los secretos y el estado de sincronización
permanecen fuera de Git.


If working in a managed preview environment, follow its preview instructions.
Do not substitute another browser automation framework. The earlier managed
preview relay was unavailable; the hosted /demo page was visually inspected
using the supported browser tool.

## Verification

Run:
- npm run test:core
- npx tsc --noEmit
- npm run build

The existing core tests use an in-memory SQLite database and a mocked R2 binding.
They exercise actual route code and SQL, not the live service. They cover:
- Administrator authentication and protected endpoints.
- Thirty signed participant invitations.
- One participant being denied access to another participant’s data and images.
- Concurrent saves by different people and stale-save rejection.
- Participant inability to mark their own data reviewed.
- Upload type validation and retrieving scoped images.
- Ownership of QR images.
- Final submission requirements.
- Spanish CSV headers, quotation marks, accented text, line breaks, zero values,
  funding links, and 150 annual export rows.

Browser-check these flows locally:
- Admin opens, names a person, saves, reloads, and copies their invitation.
- Participant opens their own link, fills data, saves, reloads, and submits.
- Each annual tab preserves edits when switching years.
- Image upload, captions, year selection, permission status, and persistence.
- QR upload, replacement, removal, and inclusion in individual reports/CSV.
- CSV downloads in Excel, including accented names and multiline stories.
- Print/PDF layout and mobile widths around 390 px.

## Architecture

Framework: React 19, TypeScript, Vinext (Next.js-compatible routing), Vite,
Cloudflare Workers, D1, and R2. Preserve the existing sites() Vite integration.
This is not a plain static site and needs its Worker for saving and uploads.

Main files:
- app/field-report.tsx: administrator interface, reports, invitations, CSV exports.
- app/participant.tsx: participant flow with five steps, photos, and funding QR.
- app/model.ts: shared types, defaults, Spanish statuses, CSV serialization.
- app/access.ts: HMAC links, admin cookie, scoped participant authorization.
- app/api/report/route.ts: administrator read/save.
- app/api/participant/[id]/route.ts: personal read/save/submit.
- app/api/images/route.ts and app/api/images/[id]/route.ts: scoped R2 uploads/read.
- app/api/invitations/route.ts: administrator-only invitation generation.
- app/administrar/[token]/route.ts: administrator link to HttpOnly cookie.
- app/participar/[id]/[token]/page.tsx: personal form entry point.
- app/demo/page.tsx: static fictional demonstration; never use it as real data.
- app/globals.css, app/participant.css, app/demo.css: interface styling.
- db/schema.ts and drizzle/: database schema and initial migration.
- tests/core.mjs: core verification.
- .openai/hosting.json: existing Site identity and DB/BUCKET binding names.

## Storage and access

D1 stores one report document in reports.payload with a global version for
administrator saves. personVersions tracks individual revisions. Participant
saves merge only that person’s allowed fields into the latest document and
retry if someone else saves simultaneously.

R2 stores actual uploaded images. Image objects carry personId metadata.
Participant image reads and QR attachment validation check that ownership.

REPORT_SECRET is a server-only runtime secret. It signs:
- admin: the administrator entry token and cookie.
- person:<ID>: one bearer link scoped to that person.

Whoever holds a personal link can edit that person’s data. Send these links
privately. Never expose an admin link or REPORT_SECRET in client code, source
archives, screenshots, demo data, CSV exports, or logs.

The hosted Site now serves public invitation/demo pages, with protected
application routes. Do not remove those route checks. Do not rely on hiding
navigation elements as authorization. Do not change the hosting audience.

The source package intentionally excludes production secrets, .dev.vars,
node_modules, dist, .wrangler state, and the administrator token.

## Current behavior and limits

- All interface text and CSV headers are Spanish.
- Starts with 30 blank people. Five annual records per person are exported,
  even if some remain blank. Admin can add more people.
- A participant can save drafts and return with the same link.
- Final submission requires a name and content for each year, or
  “No corresponde” for a year they did not participate.
- Submitted data is marked “Enviado para revisión”. Only admin can review it.
- Photos support JPEG, PNG, WebP, GIF up to 12 MB each.
- The QR is an uploaded image. No payment processing or automatic verification
  of payment destinations is implemented.
- The photos CSV contains links and metadata, not image bytes. The people CSV
  includes funding URL and QR image URL.
- WhatsApp messages/polls are manual. No WhatsApp account access, messaging,
  poll creation, or automatic poll import is implemented.
- There is no separate participant password or account-registration flow.
- The demo uses fictional content and an illustrated QR placeholder.

## Next improvements to prioritize

1. Verify all participant/admin workflows in a real local browser at desktop
   and mobile sizes; improve contrast, text sizing, and validation where needed.
2. Improve draft/review handling so saving an unchanged year does not reset its
   review state. Reset review only for records the participant changed.
3. Add a visible fallback for copying invitations if clipboard permission is
   unavailable; allow selecting the personal URL manually.
4. Add per-person invitation revocation/reissue rather than requiring a global
   secret rotation to invalidate links.
5. Add photo download/original-image export and cleanup for orphaned uploads.
   Removing a photo from the form currently removes its metadata only.
6. Add a safe CSV import/restore flow only if the user requests it.
7. Improve draft recovery and conflict handling while preserving unsaved text.
8. Preserve the clear Spanish participant flow and the optional funding section.

Do not introduce WhatsApp automation or a payment gateway without a new request.

