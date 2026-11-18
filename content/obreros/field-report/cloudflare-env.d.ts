declare namespace Cloudflare {
  interface Env {
    REPORT_SECRET?: string;
    PUBLIC_FORM_ORIGIN?: string;
    ADMIN_LOCAL_ONLY?: string;
    SYNC_SECRET?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
