declare namespace Cloudflare {
  interface Env {
    REPORT_SECRET?: string;
    PUBLIC_FORM_ORIGIN?: string;
    ADMIN_LOCAL_ONLY?: string;
    SYNC_SECRET?: string;
    NOTIFICATION_EMAIL?: string;
    NOTIFICATION_FROM?: string;
    EMAIL?: {
      send(message: {to: string; from: {email: string; name: string}; subject: string; text: string; html: string}): Promise<void>;
    };
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
