# 🔍 SecretScan

A fullstack secret scanning app that detects leaked API keys, tokens, and credentials in code. Comes with a Next.js dashboard, Express backend, Supabase DB, and an MCP server so AI assistants can trigger scans programmatically.

---

## Architecture

```
secret-scanner/
├── frontend/          # Next.js 14 + Tailwind — dashboard UI
├── backend/           # Express + TypeScript — scanning API
├── mcp-server/        # MCP server — AI tool integration
└── supabase/          # schema.sql — run this in Supabase
```

---

## Step 1 — Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. Go to **Project Settings → API** and copy:
   - `Project URL`
   - `anon / public` key
   - `service_role` key (keep secret :D)

---

## Step 2 — Backend

```bash
cd backend
cp .env.example .env
# Fill in your Supabase values in .env

npm install
npm run dev        # Runs on http://localhost:4000
```

**Environment variables:**
```
PORT=4000
FRONTEND_URL=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

---

## Step 3 — Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Fill in your Supabase values

npm install
npm run dev        # Runs on http://localhost:3000
```

**Environment variables:**
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## Step 4 — MCP Server

```bash
cd mcp-server
cp .env.example .env
npm install
npm run build
```

**Getting your API token:**
1. Log in to the frontend
2. Open browser DevTools → Application → Local Storage
3. Find the Supabase session and copy `access_token`
4. Paste it as `SECRET_SCANNER_API_TOKEN` in `.env`

---

## Testing with Claude Desktop (Recommended)

Add this to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on Mac):

```json
{
  "mcpServers": {
    "secret-scanner": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "SECRET_SCANNER_API_URL": "http://localhost:4000",
        "SECRET_SCANNER_API_TOKEN": "your-jwt-token",
        "TRANSPORT": "stdio"
      }
    }
  }
}
```

Restart Claude Desktop. You can now say:
- *"Scan this code for secrets: [paste code]"*
- *"Show me my scan history"*
- *"Get the findings for scan ID abc-123"*

---

## Testing with HTTP transport (ChatGPT / remote)

```bash
cd mcp-server
TRANSPORT=http PORT=5000 npm start
```

Your MCP endpoint is `http://localhost:5000/mcp`. Deploy to Railway/Render and use as a Custom GPT Action.

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/scans` | Create and run a scan |
| GET | `/api/scans` | List scans (paginated) |
| GET | `/api/scans/:id` | Get scan + findings |
| DELETE | `/api/scans/:id` | Delete a scan |
| PATCH | `/api/scans/findings/:id/false-positive` | Mark/unmark false positive |

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `scanner_scan_code` | Scan code for secrets |
| `scanner_get_history` | List scan history |
| `scanner_get_findings` | Get findings for a scan |
| `scanner_mark_false_positive` | Flag a finding as false positive |

---

## Detected Secret Types (20+)

- AWS Access Key ID & Secret
- GitHub Personal / OAuth / App tokens
- Google API Key & OAuth secrets
- OpenAI API keys
- Stripe live & restricted keys
- Slack bot / user tokens & webhooks
- Twilio Account SID & Auth Token
- SendGrid & Mailgun API keys
- Firebase API keys
- PEM private keys
- JWT tokens
- Generic hardcoded passwords/secrets

---

## Deployment

**Backend + MCP server:** Deploy to [Railway](https://railway.app) or [Render](https://render.com) — both have free tiers and work with Node.js.

**Frontend:** Deploy to [Vercel](https://vercel.com) — just connect your repo and set env vars.

**Database:** Already hosted on Supabase ✅
