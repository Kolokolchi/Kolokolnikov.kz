---
name: portfolio-publish
description: Publish a finished website or a new design variant from the current Codex project to Korney Kolokolnikov's portfolio. Use when the user asks to upload a demo to their portfolio, share a site on their own portfolio domain, or add a new client-facing variant. Does not replace ordinary source-project development or deploy to GitHub.
---

# Publish a portfolio demo

This skill works from the chat where the website is being built. Upload the finished static build directly to the portfolio API. Do not message the portfolio chat, create another Site, change the source project's hosting identity, or republish the entire portfolio.

## Connection

- Portfolio checkout: `D:\Anti-Gravity\Kolokolnikov.kz\portfolio`
- Hosting identity: read that checkout's `.openai/hosting.json`; current project ID is `appgprj_6ad1e5d56cc48191a272e249c92ef477`.
- Origin: `https://korney-kolokolnikov-portfolio.cocoacrow256.chatgpt.site`
- Publisher: `D:\Anti-Gravity\Kolokolnikov.kz\portfolio\scripts\publish-demo.mjs`
- The upload key is stored under the current Windows account using DPAPI. The publisher reads it internally. Never print, decrypt in chat, copy into a project, or regenerate it as a troubleshooting step.

## Workflow

1. Inspect the current source project and follow its build instructions. Choose the finished static directory (`dist`, `out`, etc.), with `index.html` at its root. A source tree, `node_modules`, and server-only Next.js build are not uploadable demos. If server behavior is essential, explain the actual missing requirement instead of claiming the static upload implements it.
2. Reuse a project slug if the user named an existing portfolio project. To discover existing projects, use the publisher's `--list` mode below. Otherwise infer a concise lowercase Latin slug and descriptive title from the current project. Ask only if choosing between existing client projects is ambiguous.
3. Build and check the source project, including a local browser check when available. Set its router/base path for nested hosting if necessary. `--base-path /old-prefix/` rewrites an existing deployment prefix; it does not configure a client router automatically.
4. Run the publisher with `--dry-run` to validate the build before uploading. Limits: 2,000 files, 25 MiB per file, 250 MiB total. Hidden files, source maps, dependency folders, and unsupported file types are excluded.
5. Call the Sites `get_site` tool for the **portfolio** project ID. Keep `siwc_bypass_bearer_token` in tool-session memory and never print the full response. This token is used only in the `OAI-Sites-Authorization` header to the exact portfolio origin. No source-repository credential is needed. Preserve the site's audience; do not make it public to make an upload work.
6. Launch the publisher in a retained terminal session. Wait for `Ready for portfolio connection JSON on stdin (input is hidden).` Then send one newline-terminated JSON object through stdin: `{ "siteToken": <get_site token> }`. For a public site without this token, send `{}`. Never put credentials in shell arguments, files, or skill instructions.
7. Wait for completion and use the returned JSON receipt. It includes `url`, `versionUrl`, `reviewUrl`, and `adminUrl`, and confirms state by reading the server back. Check the demo with supported authenticated access before claiming it works. Requests via the service token do not grant browser owner identity; a draft preview additionally needs the publisher's own authorization.

Example command (adapt path, slug, title and version):

```powershell
node 'D:\Anti-Gravity\Kolokolnikov.kz\portfolio\scripts\publish-demo.mjs' --from 'D:\Projects\Client\dist' --id client-site --title 'Клиент — сайт' --version 'Вариант 2'
```

The default uploads a new immutable version and makes it current because the user asked to publish. Existing versions remain intact. Add `--draft` when the user asks only to upload a draft or prepare for review. Every variant has a separate URL; `/demos/<slug>/` always opens the chosen current version. Optional `--description` sets the project description. Preserve existing descriptions when updating: retrieve them with `--list` rather than replacing them with an empty string.

`--dry-run` validates without requesting credentials or changing server state. `--list` uses the same hidden-stdin connection flow and returns existing projects and versions. If an upload fails, use the printed upload ID with `--upload-id <id>` and exactly the same files/metadata to retry; the publisher verifies hashes and completed versions are immutable. Do not blindly create multiple variants after an uncertain result: read `--list` first.

If the configured checkout or DPAPI connection is missing on another machine, report that this computer has not been connected. Do not create a substitute site or silently fall back to GitHub. The panel at `/admin` remains the alternative for uploading a ZIP.

Report the direct link, the variant name, and whether it is a draft. If the hosting access from `get_site` is still owner-only, say that client viewing requires a separate access change; uploading a demo does not change that setting.
