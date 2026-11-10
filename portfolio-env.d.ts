// Bindings and secrets the portfolio code reads besides DB and BUCKET (cloudflare-env.d.ts).
declare namespace Cloudflare {
  interface Env {
    // static assets: /assets/video/* answers Range requests from them
    ASSETS?: Fetcher;
    // the publish script's key (X-Portfolio-Key), lib/portfolio-auth.ts
    PORTFOLIO_UPLOAD_KEY?: string;
    // the invitation email that claims the owner role once, lib/portfolio-auth.ts
    PORTFOLIO_OWNER_EMAIL?: string;
  }
}
