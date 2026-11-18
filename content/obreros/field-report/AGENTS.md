# Development instructions

Read LOCAL_DEVELOPMENT.md before changing this project.

- Continue this existing app locally. Do not deploy or modify hosted access,
  data, or secrets unless the user explicitly requests it.
- Keep all user-facing interface text, validation messages, and CSV headers in Spanish.
- Preserve individual participant access, server-side authorization, and the protected admin view.
- Never include access secrets or signed admin/participant links in committed code or demo artifacts.
- Keep the optional “Apoya mi trabajo” QR upload and donation-link fields.
- Keep public Mensajero pages separate from signed private editing links. Never expose private annual records publicly.
- Annual records begin with each Mensajero’s graduation year; do not impose a five-year history on an individual.
- Public pages use the last administrator-approved snapshot so pending edits do not replace approved content.
- Use the existing Vinext/React/TypeScript architecture and package lock.
- Preserve existing Site identity and the sites() Vite integration.
- For behavior changes, run npm run test:core, npx tsc --noEmit, and npm run build.
- Test meaningful data and permission behaviors. Do not add tests that merely repeat UI markup.
- Use the supported browser tooling when available for UI testing.

