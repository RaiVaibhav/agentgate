# AgentGate Deployment Guide

AgentGate consists of three core microservices and a shared PostgreSQL database:

1. **Dashboard** (`Next.js 15`) — Web management UI, user auth, team management, approval workflows, and audit analytics.
2. **Proxy Service** (`Express + TypeScript`) — Session management, permission rules engine, and policy store REST API.
3. **MCP Gateway** (`Express + TypeScript`) — Streamable HTTP JSON-RPC gateway that AI agents (Claude, Cursor, Devin) connect to at `/mcp/:token`.
4. **PostgreSQL Database** — Stores users, sessions, agents, policies, and tamper-evident audit logs.

---

## Option 1: Deploy on Render (Recommended — 1-Click Blueprint)

AgentGate includes a [render.yaml](file:///Users/vaibhav/agentgate/render.yaml) blueprint specification that automatically provisions the PostgreSQL database and all 3 services with free SSL and interconnected environment variables.

### Steps:

1. **Push your code to GitHub**:
   Ensure your repository is pushed to your GitHub account:
   ```bash
   git add .
   git commit -m "feat: add production deployment configs"
   git push origin main
   ```

2. **Open Render Dashboard**:
   - Go to [dashboard.render.com](https://dashboard.render.com).
   - Click **New +** in the top navigation and select **Blueprint**.
   - Connect your GitHub repository `RaiVaibhav/agentgate`.

3. **Render Automatically Discovers `render.yaml`**:
   Render will detect all 4 resources:
   - `agentgate-db` (PostgreSQL)
   - `agentgate-gateway` (MCP Streamable HTTP Gateway)
   - `agentgate-proxy` (Agent Permission Engine API)
   - `agentgate-dashboard` (Next.js Dashboard)

4. **Apply and Deploy**:
   - Click **Apply**.
   - Render will provision the database, automatically run database migrations during the dashboard build (`pnpm db:migrate:all`), and launch the services.

5. **First-time Login**:
   - Navigate to your deployed `agentgate-dashboard` URL (e.g., `https://agentgate-dashboard.onrender.com`).
   - Click **Sign Up** to create your administrator account, or run `pnpm db:seed` using the Render web shell to seed `test@test.com / admin123`.

---

## Option 2: Deploy on Railway

Railway allows deploying multi-service repositories with instant PostgreSQL provisioning and custom domains.

### Steps:

1. **Create a Railway Project**:
   - Go to [railway.app](https://railway.app) and click **New Project**.
   - Select **Provision PostgreSQL**.

2. **Add Service 1: MCP Gateway**:
   - Click **+ New** > **GitHub Repo** > Select `agentgate`.
   - In Settings:
     - **Build Command**: `pnpm install && pnpm --filter @agent-permission/mcp-gateway build`
     - **Start Command**: `node backend/mcp-gateway/dist/index.js`
   - In Variables:
     - `POSTGRES_URL`: `${{Postgres.DATABASE_URL}}`
     - `PROXY_SECRET`: *(Generate a 32-character random string)*
     - `ENCRYPTION_KEY`: *(Generate a 64-character hex string)*
   - In Networking: Click **Generate Domain** (e.g. `gateway-production.up.railway.app`).

3. **Add Service 2: Proxy Service**:
   - Click **+ New** > **GitHub Repo** > Select `agentgate`.
   - In Settings:
     - **Build Command**: `pnpm install && pnpm --filter @agent-permission/proxy build`
     - **Start Command**: `node backend/proxy/dist/index.js`
   - In Variables:
     - `POSTGRES_URL`: `${{Postgres.DATABASE_URL}}`
     - `PROXY_SECRET`: *(Same string as Gateway)*
     - `ENCRYPTION_KEY`: *(Same key as Gateway)*
     - `GATEWAY_URL`: `https://${{Gateway.RAILWAY_PUBLIC_DOMAIN}}`
   - In Networking: Click **Generate Domain** (e.g. `proxy-production.up.railway.app`).

4. **Add Service 3: Dashboard**:
   - Click **+ New** > **GitHub Repo** > Select `agentgate`.
   - In Settings:
     - **Build Command**: `pnpm install && pnpm db:migrate:all && pnpm build`
     - **Start Command**: `pnpm start`
   - In Variables:
     - `POSTGRES_URL`: `${{Postgres.DATABASE_URL}}`
     - `AUTH_SECRET`: *(Generate random string)*
     - `PROXY_URL`: `https://${{Proxy.RAILWAY_PUBLIC_DOMAIN}}`
     - `GATEWAY_URL`: `https://${{Gateway.RAILWAY_PUBLIC_DOMAIN}}`
     - `NEXT_PUBLIC_GATEWAY_URL`: `https://${{Gateway.RAILWAY_PUBLIC_DOMAIN}}`
     - `BASE_URL`: `https://${{RAILWAY_PUBLIC_DOMAIN}}`
   - In Networking: Click **Generate Domain**.

---

## Option 3: Deploy with Docker Compose (VPS / Cloud VM)

Deploy all services and PostgreSQL on any Linux server (AWS EC2, DigitalOcean, Hetzner, GCP Compute Engine).

### Steps:

1. **Clone the repository on the server**:
   ```bash
   git clone https://github.com/RaiVaibhav/agentgate.git
   cd agentgate
   ```

2. **Configure Environment Variables**:
   Copy the example environment:
   ```bash
   cp .env.example .env
   ```
   Generate random keys for `AUTH_SECRET`, `PROXY_SECRET`, and `ENCRYPTION_KEY`.

3. **Start the containers**:
   ```bash
   docker compose up --build -d
   ```

4. **Run Database Migrations**:
   ```bash
   docker compose exec dashboard pnpm db:migrate:all
   # Optional: seed initial user (test@test.com / admin123)
   docker compose exec dashboard pnpm db:seed
   ```

5. **Exposed Ports**:
   - Dashboard: `http://<server-ip>:3000`
   - Proxy: `http://<server-ip>:3001`
   - MCP Gateway: `http://<server-ip>:3003`

   *(For production HTTPS on a custom domain, point a reverse proxy like Caddy or Nginx with Let's Encrypt to port 3000 for dashboard and 3003 for gateway).*

---

## Environment Variables Reference

| Variable | Description | Services Needed |
|---|---|---|
| `POSTGRES_URL` | PostgreSQL connection string | Dashboard, Proxy, Gateway |
| `PROXY_SECRET` | Shared secret between Gateway & Proxy | Proxy, Gateway |
| `ENCRYPTION_KEY` | 32-byte key for AES-256 credential encryption | Proxy, Gateway |
| `AUTH_SECRET` | Secret used for Next.js JWT user session cookies | Dashboard |
| `PROXY_URL` | Internal or public URL to Proxy API | Dashboard |
| `GATEWAY_URL` | Public or internal URL to MCP Gateway | Dashboard, Proxy |
| `NEXT_PUBLIC_GATEWAY_URL` | Public HTTPS URL for MCP Gateway shown in UI | Dashboard |
| `BASE_URL` | Public HTTPS URL of the Dashboard | Dashboard |
| `STRIPE_SECRET_KEY` | *(Optional)* Stripe API key for subscriptions | Dashboard |
| `STRIPE_WEBHOOK_SECRET` | *(Optional)* Stripe webhook secret | Dashboard |

---

## Verifying Your Deployment

1. **Check Service Health**:
   ```bash
   curl -s https://<proxy-domain>/health
   # Response: {"status":"ok","service":"agent-permission-proxy"}

   curl -s https://<gateway-domain>/health
   # Response: {"status":"ok","service":"mcp-gateway","transport":"streamable-http"}
   ```

2. **Test Agent Permission Enforcement**:
   After creating an agent, service, and session in the dashboard:
   ```bash
   curl -s -X POST "https://<gateway-domain>/mcp/<SESSION_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
   ```
