# Frontend MCP servers

`.mcp.json` at the repo root gives Claude Code six MCP servers for frontend and component work.
Claude Code asks you to approve project servers the first time you open the repo; run `/mcp` to see their status.

| Server | Use it for | Needs |
| --- | --- | --- |
| `playwright` | Drive the app in a real browser: click through landing → register → billing → onboarding → dashboard, fill forms, take screenshots, write e2e specs (the repo already uses `@playwright/test`) | Nothing |
| `chrome-devtools` | Console errors, network requests, performance traces (LCP, layout shift) on `npm run dev` or the Render URL | Node 22+, Chrome stable |
| `shadcn` | Browse and install shadcn/ui components (Dialog, Sheet, Tabs, Tooltip, Command) instead of hand-rolling them | `frontend/components.json` to install into the repo (see below) |
| `magic-21st` | Search 21st.dev components and generate or refine UI from a prompt | Free API key from https://21st.dev/mcp, set as env var `TWENTY_FIRST_API_KEY` |
| `context7` | Current docs for React 19, React Router 7, Tailwind v4, TanStack Query 5, Recharts 3, motion 12, zod 4 | Nothing (a free key raises rate limits) |
| `figma` | Pull a Figma frame's layout, tokens and copy as design context | Figma account; run `/mcp` → figma → Authenticate |

## Platform note
The stdio servers use `cmd /c npx …`, which native Windows needs. On macOS, Linux or WSL, change each to
`"command": "npx", "args": ["-y", "<package>", …]`.

## Keys
Never put keys in `.mcp.json` (it is committed). Set them as user environment variables, e.g. in PowerShell:
`[Environment]::SetEnvironmentVariable("TWENTY_FIRST_API_KEY", "<key>", "User")`, then restart Claude Code.

## shadcn install target
The shadcn MCP can browse without config, but installing needs `frontend/components.json` and an `@/` path alias
(`tsconfig.app.json` `paths` + `vite.config.ts` `resolve.alias`). Add both before the first `shadcn add`, or generated
components will import `@/lib/utils` and fail to build.

## Suggested prompts
- "Use playwright to walk the signup → billing → onboarding flow at 390px width and list every horizontal overflow."
- "Use chrome-devtools to record a performance trace of `/` and tell me what delays LCP."
- "Use context7 for Recharts 3 docs and rebuild the 14-day trend chart with real RTO data."
- "Use shadcn to add Sheet and Tabs, then replace OrderDrawer's custom drawer with Sheet."
