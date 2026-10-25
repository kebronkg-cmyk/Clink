import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig();

// `npm run build` startet den Cloudflare-Build; der ruft hierüber den reinen Next.js-Build auf.
config.buildCommand = "npm run build:next";

export default config;
