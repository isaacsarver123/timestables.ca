# timestables.ca — Operations Handoff

> For the person responsible for keeping the server up, the database backed up,
> and the lights on. Last updated: Feb 2026.

If you're a developer wanting to understand the codebase, see **`HANDOFF.md`**
and **`README.md`** instead. This document is the runbook.

---

## 1. What's running

```
                    ┌──────────────────┐
                    │      User        │
                    └────────┬─────────┘
                             │ HTTPS
                    ┌────────▼─────────┐
                    │   Caddy (edge)   │   :8443  (only public-facing port)
                    │   TLS + reverse  │
                    │     proxy        │
                    └────────┬─────────┘
            /api/*           │           /
       ┌────────────┐        │       ┌────────────┐
       │  FastAPI   │◄──────internal-►│  Frontend  │
       │  :8001     │   compose net   │  (nginx)   │
       └─────┬──────┘                 │  serves    │
             │                        │  CRA build │
             │ Motor (async)          └────────────┘
             ▼
       ┌────────────┐
       │  MongoDB   │  bind-mounted volume: MATHACCOUNTS/timestables-mongo
       │  :27017    │
       └────────────┘
```

### Reserved / forbidden ports on the host
```
80, 443, 3000, 3001, 3002, 8001, 8002, 8847, 18789, 27017, 11434, 1000
```
None of these are bound by our containers. We use:

| Service | Bound on | Container port |
| --- | --- | --- |
| MongoDB | `127.0.0.1:37017` | `27017` |
| Backend (FastAPI) | `127.0.0.1:38001` | `8001` |
| Frontend (CRA + nginx) | `127.0.0.1:33000` | `80` |
| Caddy edge | `:8443` (public) | `443` |

If `8443` ever conflicts, change `EDGE_PORT` in `.env` and restart Caddy.

---

## 2. First-time provision (fresh Ubuntu host)

Prerequisites: Docker engine + Docker Compose v2, a domain pointed at the host's
public IP, and 4 GB+ free under the `MATHACCOUNTS` mount.

```bash
# 1. Pull the repo
git clone https://github.com/<you>/timestables.git /opt/timestables
cd /opt/timestables

# 2. Create the Mongo data dir on the persistent drive
sudo mkdir -p /mnt/MATHACCOUNTS/timestables-mongo
sudo chown -R 999:999 /mnt/MATHACCOUNTS/timestables-mongo  # mongo container UID

# 3. Generate secrets
JWT_SECRET=$(openssl rand -hex 64)
ADMIN_PASSWORD=$(openssl rand -base64 24)

# 4. Write .env (next to docker-compose.yml)
cat > .env <<EOF
DOMAIN=timestables.example.com
EDGE_PORT=8443

MONGO_HOST_PORT=37017
BACKEND_HOST_PORT=38001
FRONTEND_HOST_PORT=33000

DB_NAME=timestables
JWT_SECRET=$JWT_SECRET

ADMIN_EMAIL=isaacsarver100@gmail.com
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_NAME=Isaac

STRIPE_API_KEY=
SUBSCRIPTION_PRICE_CAD=5.00
TRIAL_DAYS=2
ALLOW_MULTI_SIGNUP_PER_IP=0

FRONTEND_URL=https://timestables.example.com:8443

MONGO_DATA=/mnt/MATHACCOUNTS/timestables-mongo
EOF

# 5. Build & start
docker compose up -d --build

# 6. Watch the backend boot
docker compose logs -f backend
# Look for "Seeded admin user isaacsarver100@gmail.com (Isaac)"

# 7. Sign in at https://timestables.example.com:8443
# 8. Admin → CMS → paste your Stripe Secret Key. Done.
```

**Save the generated `JWT_SECRET` and `ADMIN_PASSWORD` somewhere safe.** Losing the
JWT secret invalidates everyone's sessions on the next boot but doesn't destroy
data — they'll just have to log in again.

---

## 3. Daily operations

### Restart something
```bash
cd /opt/timestables
docker compose restart backend          # most common
docker compose restart frontend caddy   # after a frontend rebuild
docker compose restart mongo            # rare; will brief-disconnect users
```

### Tail logs (last 200 lines + follow)
```bash
docker compose logs --tail=200 -f backend
docker compose logs --tail=200 -f caddy
docker compose logs --tail=200 -f mongo
```

### Check service health
```bash
# All containers up?
docker compose ps

# Backend health
curl -fsS https://timestables.example.com:8443/api/ | python3 -m json.tool
# Expected: { "app": "timestables.ca", "status": "ok", "stripe_configured": true|false }

# Frontend (just hits index.html)
curl -fsS -o /dev/null -w "%{http_code}\n" https://timestables.example.com:8443/

# MongoDB ping (from inside the network)
docker compose exec mongo mongosh --eval 'db.adminCommand({ping:1})'
```

### Update to a new release
```bash
cd /opt/timestables
git pull
docker compose up -d --build       # rebuild + rolling restart
docker compose logs --tail=50 backend  # watch the boot
```

The frontend rebuild bakes `REACT_APP_BACKEND_URL=$FRONTEND_URL` from `.env` into
the static bundle, so you must `--build` for any frontend env change to apply.

---

## 4. Backups

### What to back up
- `/mnt/MATHACCOUNTS/timestables-mongo` — the **only** stateful directory.
- `/opt/timestables/.env` — secrets + config. Back this up to a password manager
  too, not the regular file backup target.
- Stripe keys are stored inside the `cms` MongoDB collection (CMS-rotated key).
  Backing up Mongo backs them up.

### Nightly full snapshot (sample)
```bash
# Add to /etc/cron.daily/timestables-backup
#!/bin/bash
set -e
TS=$(date +%F_%H%M)
DEST=/var/backups/timestables
mkdir -p "$DEST"

# Mongo dump (consistent across collections via --oplog)
docker compose -f /opt/timestables/docker-compose.yml exec -T mongo \
  mongodump --archive --gzip --db=timestables \
  > "$DEST/dump_$TS.gz"

# Keep 30 days
find "$DEST" -name 'dump_*.gz' -mtime +30 -delete
```

### Incremental snapshots
If your `MATHACCOUNTS` drive is on ZFS or btrfs, prefer filesystem snapshots —
they're atomic and orders of magnitude faster than `mongodump`. Stop the mongo
container, snapshot, restart:
```bash
docker compose stop mongo
zfs snapshot tank/mathaccounts@$(date +%F_%H%M)
docker compose start mongo
# total downtime: ~3 seconds
```

### Restore from a `mongodump` archive
```bash
docker compose stop backend          # so nothing writes during restore
gunzip -c /var/backups/timestables/dump_2026-02-15_0300.gz | \
  docker compose exec -T mongo mongorestore --archive --drop --db=timestables
docker compose start backend
```

### Verifying a backup
At least once a quarter, restore the latest backup into a throwaway container
and run the smoke tests from §6. A backup you've never restored is a wish, not
a backup.

---

## 5. Monitoring

There's no APM by default. Minimum viable monitoring:

### Uptime check
External pinger (UptimeRobot, Healthchecks.io) hitting:
```
GET https://timestables.example.com:8443/api/
Expect: 200 with body containing "status":"ok"
Frequency: 1 minute
Alert after: 2 consecutive failures
```

### Disk alarm
The most common silent killer is the Mongo volume filling up (lesson runs and
gem transactions accumulate). Alert when `MATHACCOUNTS` is >80% full:
```bash
df -h /mnt/MATHACCOUNTS | awk 'NR==2 {gsub(/%/, "", $5); if ($5+0 > 80) print "DISK_FULL", $5 "%"}'
```

### Log files to watch
| File / source | What you're looking for |
| --- | --- |
| `docker compose logs backend` | `ERROR`, `Stripe error:`, repeated 401/403 |
| `docker compose logs caddy` | TLS handshake failures, 502 (means backend is down) |
| `docker compose logs mongo` | `WiredTiger` errors, `out of memory` |
| Stripe Dashboard → Webhooks | Failed deliveries to `/api/webhook/stripe` |

### Healthchecks endpoints
```
GET  /api/                  # app status + stripe_configured flag
GET  /api/cms/public        # 200 if Mongo is reachable
POST /api/auth/login        # 401 with valid email-not-found is fine; 502 means trouble
```

---

## 6. Smoke tests after a deploy

Save as `/opt/timestables/scripts/smoke.sh`:
```bash
#!/bin/bash
set -e
URL=https://timestables.example.com:8443
EMAIL=$ADMIN_EMAIL
PASS=$ADMIN_PASSWORD

echo "1. Root health"
curl -fsS "$URL/api/" >/dev/null

echo "2. CMS public"
curl -fsS "$URL/api/cms/public" >/dev/null

echo "3. Admin login"
COOKIE=$(mktemp)
curl -fsS -c $COOKIE -X POST "$URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" >/dev/null

echo "4. /auth/me"
curl -fsS -b $COOKIE "$URL/api/auth/me" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['is_admin'], 'not admin'; print('  ok, role=admin')"

echo "5. Admin stats"
curl -fsS -b $COOKIE "$URL/api/admin/stats" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  users=%d active_subs=%d' % (d['total_users'], d['active_subs']))"

rm -f $COOKIE
echo "ALL OK"
```

Run after every deploy:
```bash
chmod +x /opt/timestables/scripts/smoke.sh
/opt/timestables/scripts/smoke.sh
```

---

## 7. Incident runbooks

### 7.1 Site is down (502 / no response)
1. `docker compose ps` — anything not `Up`?
2. If `caddy` is down: `docker compose restart caddy`. Check certs in
   `docker compose logs caddy` (auto-renews via Let's Encrypt; if the host's
   port 80 is blocked, ACME challenges fail).
3. If `backend` is down: `docker compose logs --tail=200 backend`. Common
   causes:
   - Mongo unreachable (check `mongo` container).
   - Bad `JWT_SECRET` (boot crashes immediately on `KeyError`).
   - Out of memory (look for `Killed` in dmesg).
4. If `mongo` is down: check `df -h` for full disk. If full, see §7.4.
5. After fixing, run §6 smoke tests.

### 7.2 Stripe checkout returns 503 "Stripe not configured"
The CMS-stored Stripe key is missing or empty. Two paths:
- **Preferred:** sign in as admin → Admin → CMS → paste a rotated `sk_live_…`
  → Save. Verify with `curl /api/` showing `"stripe_configured": true`.
- **Fallback:** add `STRIPE_API_KEY=sk_live_…` to `.env`, then
  `docker compose restart backend`.

The CMS-stored key takes precedence over `.env`. Saving an empty CMS key does
NOT clear the existing one — to fully clear, edit Mongo directly:
```js
db.cms.updateOne({_id:"site"}, {$set:{stripe_secret_key:""}})
```

### 7.3 Stripe webhooks failing
1. Check Stripe Dashboard → Webhooks → recent attempts. Look for non-200
   responses.
2. If 401/403: `STRIPE_WEBHOOK_SECRET` mismatch. Roll the secret in Stripe and
   update `.env` → restart backend.
3. If 502: backend is down (see §7.1).
4. If signature verification is skipped (`STRIPE_WEBHOOK_SECRET` blank), webhook
   accepts anything. **Set the secret in production.**

### 7.4 Mongo disk full
1. `du -sh /mnt/MATHACCOUNTS/timestables-mongo/* | sort -h`
2. The `lesson_runs` and `gem_transactions` collections grow forever. Trim:
   ```bash
   docker compose exec mongo mongosh timestables --eval '
     db.lesson_runs.deleteMany({created_at: {$lt: new Date(Date.now() - 1000*60*60*24*180)}});
     db.gem_transactions.deleteMany({created_at: {$lt: new Date(Date.now() - 1000*60*60*24*180)}.toISOString()});
   '
   ```
   *(180 days = our retention default; tune to taste.)*
3. Run `db.runCommand({compact: "lesson_runs"})` to reclaim space.
4. Long-term: add the trim to `cron.weekly`.

### 7.5 Auth lockout — too many failed login attempts
After 5 failed logins from the same `IP:email` pair within 15 min, the user is
locked out (HTTP 429). To unlock manually:
```bash
docker compose exec mongo mongosh timestables --eval '
  db.login_attempts.deleteMany({identifier: /:user@example\.com$/});
'
```

### 7.6 Forgot admin password
```bash
NEW_HASH=$(docker compose exec backend python -c "
import bcrypt
print(bcrypt.hashpw(b'NewAdminPassword!', bcrypt.gensalt()).decode())
")
docker compose exec mongo mongosh timestables --eval "
  db.users.updateOne(
    {email:'isaacsarver100@gmail.com'},
    {\$set:{password_hash:'$NEW_HASH'}}
  );
"
```
Or, just change `ADMIN_PASSWORD` in `.env` and restart the backend — the seed
job will overwrite the password to match.

### 7.7 IP-trial gate is blocking legitimate signups (e.g. behind a NAT)
Set `ALLOW_MULTI_SIGNUP_PER_IP=1` in `.env` and restart. Note the abuse risk —
multiple trial accounts from the same IP become possible.

### 7.8 Out-of-memory on the host
- `docker stats --no-stream` to see which container is hogging RAM.
- Mongo's WiredTiger cache defaults to 50% of RAM. To cap it, add to
  `docker-compose.yml` under the `mongo` service:
  ```yaml
  command: ["mongod", "--wiredTigerCacheSizeGB", "1"]
  ```
- Backend memory leak suspected: `docker compose restart backend` is a fine
  band-aid; capture the logs first.

---

## 8. Security & secret rotation

### 8.1 Rotate the JWT secret
Forces every user to log in again.
```bash
NEW=$(openssl rand -hex 64)
sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$NEW|" /opt/timestables/.env
docker compose restart backend
```

### 8.2 Rotate the admin password
Two ways. Both work:
1. Edit `ADMIN_PASSWORD` in `.env` → `docker compose restart backend`. The
   seed job re-hashes on boot.
2. Mongo direct write (see §7.6).

### 8.3 Rotate the Stripe secret key
Live or test, both work the same:
1. Generate a new key in Stripe Dashboard → Developers → API keys → Roll.
2. Sign in to the app as admin → Admin → CMS → paste the new key → Save.
3. The old key is replaced in MongoDB. The full key is **never** echoed back —
   the admin GET shows `sk_live_…WXYZ` masked.
4. Update Stripe webhooks if you also rolled the webhook secret (see §8.4).

### 8.4 Rotate the Stripe webhook secret
1. Stripe Dashboard → Webhooks → your endpoint → "Roll secret".
2. Update `STRIPE_WEBHOOK_SECRET=` in `.env`.
3. `docker compose restart backend`.
4. Send a test event from the Stripe dashboard and confirm 200 in
   `docker compose logs backend`.

### 8.5 Cookie / TLS settings to never weaken
- Cookies are `samesite=none; secure=true; httpOnly`. Don't relax this; we
  rely on the `secure` + `httpOnly` combo for XSS / CSRF defence.
- Caddy auto-issues + renews TLS. If you front Caddy with another proxy, ensure
  the other proxy also enforces TLS — internal HTTP between proxies is fine
  inside Docker but the public edge must be HTTPS.

### 8.6 Audit checklist (quarterly)
- [ ] All secrets in `.env` are current and not committed to git.
- [ ] No admin accounts other than the documented one (`db.users.find({role:"admin"})`).
- [ ] Login-attempts collection size reasonable (`db.login_attempts.countDocuments()`).
  Trim with `db.login_attempts.deleteMany({ts:{$lt:<old date>}})`.
- [ ] Stripe Dashboard shows no unexplained refunds or disputes.
- [ ] Backups have been restored at least once and verified.
- [ ] OS packages up to date: `sudo apt-get update && sudo apt-get upgrade`.

---

## 9. Database administration

### Connect a shell
```bash
docker compose exec mongo mongosh timestables
```

### Useful queries
```js
// Total user count, broken down by access state
db.users.aggregate([
  { $group: {
      _id: { role: "$role", status: "$subscription.status" },
      n: { $sum: 1 }
  }}
])

// Most active users (by lesson runs in the last 30 days)
db.lesson_runs.aggregate([
  { $match: { created_at: { $gte: new Date(Date.now() - 30*86400000) } } },
  { $group: { _id: "$user_id", runs: { $sum: 1 } } },
  { $sort: { runs: -1 } }, { $limit: 10 }
])

// Find a user by email
db.users.findOne({email:"foo@example.com"}, {password_hash:0})

// Manually grant 100 gems to a user
db.users.updateOne({email:"foo@example.com"}, {$inc:{gems:100}})
db.gem_transactions.insertOne({
  user_id:"<their _id as string>",
  delta:100,
  reason:"manual_grant_ops",
  created_at:new Date().toISOString()
})

// Comp 30 days of access
db.users.updateOne(
  {email:"foo@example.com"},
  {$set:{trial_start: new Date(Date.now() - 0)}}  // resets trial; or set subscription.status:"active"
)
```

### Indexes (created on backend startup)
- `users.email` (unique)
- `users.signup_ip`
- `users.username` (unique, partial — only when string)
- `payment_transactions.session_id` (unique)
- `user_state.user_id` (unique)
- `login_attempts.identifier`
- `follows.{follower_id, following_id}` (unique compound)
- `follows.following_id`

If you add a query to the backend that scans, add an index here.

---

## 10. Disaster recovery

**Goal: get the app back online with current data within 30 minutes.**

1. Provision a fresh Ubuntu host (or restore a VM snapshot).
2. Install Docker + Docker Compose v2.
3. Restore `MATHACCOUNTS/timestables-mongo` from your latest snapshot to
   `/mnt/MATHACCOUNTS/timestables-mongo` (or run `mongorestore` per §4).
4. Pull the repo: `git clone … /opt/timestables`.
5. Restore `.env` from the password-manager backup.
6. `docker compose up -d --build`.
7. Run smoke tests (§6).
8. Update DNS only **after** the new host passes smoke tests, to avoid users
   hitting a half-up box.

**RPO (recoverable point):** as old as your latest backup (max 24h with daily backups).
**RTO (recovery time):** ~30 min if the backup is on the same network, ~2h if you have
to restore a multi-GB Mongo dump from object storage.

---

## 11. Contact / escalation

| Role | Who | When to ping |
| --- | --- | --- |
| Owner | Isaac Sarver — `isaacsarver100@gmail.com` / `825-962-3425` | Any P0 (site down >15min, data loss risk, security incident) |
| Stripe support | dashboard.stripe.com → Help | Payment processing issues you can't reproduce |
| Domain / DNS | Whatever registrar holds `timestables.ca` | Propagation issues, NS changes |

When paging, include:
- What's broken (URL + HTTP code)
- When it started
- `docker compose ps` output
- Tail of relevant logs
- What you've tried so far

---

## 12. Glossary
- **Trial** — 2-day window from `users.trial_start`. During trial, `has_access=true`.
- **Has-access** — `role=="admin" || in_trial || subscription.status in {active, trialing, past_due}`.
- **Gems** — second currency, server-authoritative (in `users.gems`).
- **Coins** — first currency, client-mirrored in `user_state.state.coins`.
- **CMS** — single document at `db.cms._id="site"` holding every editable string.
- **Lesson path** — generated client-side from `lib/lessonPath.js` (deterministic
  given the same seed). Server only stores `lesson_runs` (history).
