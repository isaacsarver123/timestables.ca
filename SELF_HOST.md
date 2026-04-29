# Self-hosting timestables.ca

This document is tailored for the user's specific Ubuntu server with reserved ports
`80, 443, 3000, 3001, 3002, 8001, 8002, 8847, 18789, 27017, 11434, 1000` and a
mounted data drive named **`MATHACCOUNTS`** (literal mount path used as-is).

We bind every container to **localhost only** and use a reverse-proxy (Caddy or nginx)
on a free port to terminate TLS and route to the app. None of our containers expose
any of the forbidden ports.

## 1) Picked free ports (change in `.env` if needed)

| Service        | Bound on             | Notes                              |
| -------------- | -------------------- | ---------------------------------- |
| MongoDB        | `127.0.0.1:37017`    | NOT 27017                          |
| Backend (FastAPI) | `127.0.0.1:38001` | NOT 8001                          |
| Frontend (CRA build via nginx) | `127.0.0.1:33000` | NOT 3000  |
| Reverse proxy (Caddy) | `:8443`        | TLS, public — pick whatever is free on your edge |

If `8443` is taken too, change `EDGE_PORT` in `.env`.

## 2) Layout

```
/path/to/repo/
├── backend/
├── frontend/
├── docker-compose.yml          ← in repo root, see below
├── Caddyfile                   ← see below
└── .env                        ← see below
```

MongoDB data is bind-mounted to **`MATHACCOUNTS/timestables-mongo`** (the user's
drive name, literal — adjust the host prefix if your drive lives elsewhere, e.g.
`/mnt/MATHACCOUNTS/timestables-mongo`).

## 3) `.env` (next to docker-compose.yml)

```
DOMAIN=timestables.example.com
EDGE_PORT=8443

MONGO_HOST_PORT=37017
BACKEND_HOST_PORT=38001
FRONTEND_HOST_PORT=33000

DB_NAME=timestables
JWT_SECRET=<run: openssl rand -hex 64>
ADMIN_EMAIL=admin@timestables.ca
ADMIN_PASSWORD=<change-me>

STRIPE_API_KEY=sk_live_xxx_or_sk_test_xxx
SUBSCRIPTION_PRICE_CAD=5.00
TRIAL_DAYS=2

# This MUST be the public URL the browser hits — used for CORS + Stripe redirects
FRONTEND_URL=https://timestables.example.com:8443

# Path on the host where Mongo data lives (this is the literal drive name the user mounted)
MONGO_DATA=MATHACCOUNTS/timestables-mongo
```

## 4) `docker-compose.yml`

A copy is provided at `/app/docker-compose.yml`. Highlights:

- All app containers expose **only** to `127.0.0.1` (`"127.0.0.1:HOST:CONTAINER"`).
- `mongo` mounts `${MONGO_DATA}` → `/data/db`.
- `caddy` is the only container with public ports (`${EDGE_PORT}:443`).
- Backend reads `MONGO_URL=mongodb://mongo:27017` (internal compose network).
- Backend `CORS` is restricted to `${FRONTEND_URL}`.

## 5) `Caddyfile`

```
{
    auto_https disable_redirects
}

{$DOMAIN}:443 {
    encode gzip
    handle_path /api/* {
        reverse_proxy backend:8001
    }
    handle {
        reverse_proxy frontend:80
    }
}
```

If you don't have a domain, change `{$DOMAIN}:443` to `:443` and Caddy will
serve the IP. If your edge sits behind another proxy (NPM, Cloudflare),
disable Caddy's TLS and just `reverse_proxy` HTTP.

## 6) Running

```bash
# create the data dir (on the MATHACCOUNTS drive)
sudo mkdir -p MATHACCOUNTS/timestables-mongo

# build & start
docker compose up -d --build

# tail logs
docker compose logs -f backend

# admin gets seeded on first backend boot — log in at https://your-domain:8443
```

## 7) Pointing Stripe webhooks at it

Run `stripe listen --forward-to https://your-domain:8443/api/webhook/stripe`
during dev, or add a webhook endpoint in your live Stripe dashboard pointing
to that URL. Without webhooks, the backend still polls `stripe/status/...`
on payment success.

## 8) Backups

The MongoDB data lives entirely under the `MATHACCOUNTS` mount you specified.
Snapshot that path on your usual schedule (e.g. `restic`, `borg`, ZFS snapshot).

## 9) Rolling updates

```
git pull
docker compose up -d --build
```

The frontend rebuild bakes `REACT_APP_BACKEND_URL=https://your-domain:8443`
in via the build arg in `docker-compose.yml`.

---

**Forbidden ports double-checked:** none of `80, 443, 3000, 3001, 3002, 8001,
8002, 8847, 18789, 27017, 11434, 1000` are bound by our containers. The only
containers with public binds are Caddy on `${EDGE_PORT}` (default `8443`).
