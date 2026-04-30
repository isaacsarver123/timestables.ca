# TimeTables.ca deploy plan for Isaac's local server

## Target layout
- Repo: `/opt/timestables`
- Mongo data: `/mnt/MATHACCOUNTS/timestables-mongo`
- Backend bind: `127.0.0.1:38001`
- Frontend build served by nginx
- Public domain: `timestables.ca` and `www.timestables.ca`
- Public edge: existing nginx on `80/443`

## Why this path
- Avoids Docker, which is not currently installed on the host.
- Reuses nginx already serving public domains on this box.
- Keeps the app behind localhost services, with nginx as the only public entry point.
- Keeps MongoDB data on the ext4 MATHACCOUNTS drive, not the NTFS AI drive.

## 1. Install runtime packages
```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx mongodb-clients nodejs npm
```

If Node is too old for the frontend, use the existing nvm setup for `deal` instead of system node.

## 2. Place repo
```bash
sudo mkdir -p /opt/timestables
sudo rsync -a --delete /home/deal/.openclaw/workspace/timestables/ /opt/timestables/
sudo chown -R deal:deal /opt/timestables
cd /opt/timestables
```

## 3. Create persistent Mongo path
```bash
sudo mkdir -p /mnt/MATHACCOUNTS/timestables-mongo
sudo chown -R deal:deal /mnt/MATHACCOUNTS/timestables-mongo
```

## 4. Start Mongo locally on a non-conflicting port
Current host Mongo is already in use on `27017` for other apps, so this app should either:
- use a separate Mongo instance on `37017`, or
- use the existing Mongo service with its own database `timestables`

Recommended simpler path: use the existing Mongo service already running on `127.0.0.1:27017`, and set:
```env
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=timestables
```

If strict isolation is required later, add a dedicated Mongo instance.

## 5. Backend env
Create `/opt/timestables/backend/.env`:
```env
MONGO_URL=mongodb://127.0.0.1:27017
DB_NAME=timestables
JWT_SECRET=<openssl rand -hex 64>
ADMIN_EMAIL=isaacsarver100@gmail.com
ADMIN_PASSWORD=<choose one>
ADMIN_NAME=Isaac
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
FRONTEND_URL=https://timestables.ca
SUBSCRIPTION_PRICE_CAD=5.00
TRIAL_DAYS=2
ALLOW_MULTI_SIGNUP_PER_IP=1
```

Generate JWT secret:
```bash
openssl rand -hex 64
```

## 6. Backend setup
```bash
cd /opt/timestables/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 38001
```

Test health:
```bash
curl http://127.0.0.1:38001/api/
```

## 7. Frontend setup
Create `/opt/timestables/frontend/.env`:
```env
REACT_APP_BACKEND_URL=https://timestables.ca
```

Build:
```bash
cd /opt/timestables/frontend
npm install
npm run build
```

## 8. nginx site
Create `/etc/nginx/sites-available/timestables.ca`:
```nginx
server {
    listen 80;
    server_name timestables.ca www.timestables.ca;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name timestables.ca www.timestables.ca;

    # Reuse your existing cert strategy here, e.g. certbot/cloudflare-managed files
    ssl_certificate     /etc/letsencrypt/live/timestables.ca/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/timestables.ca/privkey.pem;

    client_max_body_size 25m;

    location /api/ {
        proxy_pass http://127.0.0.1:38001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location / {
        root /opt/timestables/frontend/build;
        try_files $uri /index.html;
    }
}
```

Enable it:
```bash
sudo ln -s /etc/nginx/sites-available/timestables.ca /etc/nginx/sites-enabled/timestables.ca
sudo nginx -t
sudo systemctl reload nginx
```

## 9. systemd backend service
Create `/etc/systemd/system/timestables-backend.service`:
```ini
[Unit]
Description=TimeTables Backend
After=network.target mongod.service

[Service]
User=deal
WorkingDirectory=/opt/timestables/backend
EnvironmentFile=/opt/timestables/backend/.env
ExecStart=/opt/timestables/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 38001
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Start it:
```bash
sudo systemctl daemon-reload
sudo systemctl enable --now timestables-backend
sudo systemctl status timestables-backend
```

## 10. DNS / port forwarding
- If your existing sites already resolve to this server and work publicly, your router forwarding is already good.
- Point `timestables.ca` and `www.timestables.ca` DNS to the same public IP as your other sites.
- No new public ports are needed. Keep using `80/443` via nginx.

## 11. Verify
```bash
curl http://127.0.0.1:38001/api/
curl -I https://timestables.ca
```

Then sign in with the seeded admin account.
