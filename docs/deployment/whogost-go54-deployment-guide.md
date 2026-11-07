# ChopLife Republic — Whogost (Go54) Domain & Hosting Deployment Guide

**Provider**: Whogost (Go54 — go54.com / whogohost.com)  
**Application**: ChopLife Republic (Full-Stack React + Node.js/Express + SQLite/PostgreSQL)  
**Target Audience**: Restaurant Management, DevOps, and System Administrators  

---

## 1. Overview of Whogost (Go54) Integration

Whogost (Go54) is Nigeria’s leading domain registrar and cloud hosting provider. Deploying ChopLife Republic on Go54 ensures local currency billing (NGN), fast regional latency for Nigerian customers, robust cPanel/VPS infrastructure, and reliable `.ng` / `.com.ng` / `.com` domain management.

---

## 2. Step 1: Domain Registration & DNS Management on Go54

1. **Domain Search & Purchase**:
   - Log in to your **Go54 (Whogohost)** client area.
   - Search for your desired domain (e.g., `chopliferepublic.ng`, `chopliferepublic.com.ng`, or `chopliferepublic.com`).
   - Complete checkout and registration.

2. **DNS Zone Configuration**:
   - Navigate to **Domains > My Domains > Manage DNS**.
   - Set up the authoritative DNS records:
     - **A Record**: Point `@` (root domain) to your Go54 VPS IP address or cPanel server IP.
     - **A Record**: Point `www` to your server IP (or CNAME to root).
     - **TXT / SPF Records**: (Optional) For secure transactional email delivery (Resend / SendGrid / Postfix).

---

## 3. Step 2: Choosing Your Hosting Architecture on Go54

Depending on your traffic and scale, choose one of two recommended Go54 hosting methods:

### Option A: Go54 Linux Shared Hosting with cPanel (Node.js Selector)
*Best for standard restaurant operations with low-to-medium server resource overhead.*
1. **Create Hosting Package**: Purchase a cPanel web hosting plan on Go54 supporting Node.js.
2. **Access cPanel**: Log into cPanel from your Go54 client dashboard.
3. **Setup Node.js App**:
   - Open **Setup Node.js App**.
   - Create Application:
     - Node.js Version: `18.x` or `20.x`
     - Application mode: `production`
     - Application root: `public_html` (or project root directory)
     - Application startup file: `dist/server.cjs` (or compiled server entry)
4. **Environment Variables**:
   - Add environment variables in cPanel Node.js manager or `.env`:
     ```env
     PORT=3000
     NODE_ENV=production
     DATABASE_URL=sqlite:data/choplife.db
     SESSION_SECRET=your-secure-production-secret-key
     ```
5. **Build & Deploy**:
   - Run `npm install` and `npm run build` locally or via terminal SSH.
   - Upload the build artifacts (`dist/`, `package.json`, `server.ts` / `dist/server.cjs`) to the application directory.
   - Click **Restart** in cPanel Node.js App.

### Option B: Go54 Cloud VPS / Dedicated Server
*Best for high-volume POS, multi-branch operations, real-time Kitchen Display Systems (KDS), and maximum scalability.*
1. **Provision VPS**: Deploy an Ubuntu 22.04 LTS / 24.04 LTS Cloud VPS instance on Go54.
2. **Server Provisioning (SSH)**:
   - Update packages: `sudo apt update && sudo apt upgrade -y`
   - Install Node.js (via NodeSource):
     ```bash
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt install -y nodejs build-essential
     ```
   - Install PM2 process manager:
     ```bash
     sudo npm install -g pm2
     ```
3. **Clone & Build Project**:
   ```bash
   git clone <your-repository-url> /var/www/chopliferepublic
   cd /var/www/chopliferepublic
   npm install
   npm run build
   ```
4. **Configure Environment (`.env`)**:
   Create `/var/www/chopliferepublic/.env`:
   ```env
   NODE_ENV=production
   PORT=3000
   SESSION_SECRET=<secure-random-secret>
   DATABASE_URL=sqlite:data/choplife.db
   ```
5. **Start with PM2**:
   ```bash
   pm2 start npm --name "choplife-republic" -- start
   pm2 startup
   pm2 save
   ```
6. **Configure Nginx Reverse Proxy & SSL**:
   - Install Nginx: `sudo apt install nginx -y`
   - Create Nginx site config `/etc/nginx/sites-available/chopliferepublic`:
     ```nginx
     server {
         listen 80;
         server_name chopliferepublic.ng www.chopliferepublic.ng;

         location / {
             proxy_pass http://localhost:3000;
             proxy_http_version 1.1;
             proxy_set_header Upgrade $http_upgrade;
             proxy_set_header Connection 'upgrade';
             proxy_set_header Host $host;
             proxy_cache_bypass $http_upgrade;
         }
     }
     ```
   - Enable site:
     ```bash
     sudo ln -s /etc/nginx/sites-available/chopliferepublic /etc/nginx/sites-enabled/
     sudo nginx -t
     sudo systemctl restart nginx
     ```
   - Install Free SSL via Certbot (Let's Encrypt):
     ```bash
     sudo apt install certbot python3-certbot-nginx -y
     sudo certbot --nginx -d chopliferepublic.ng -d www.chopliferepublic.ng
     ```

---

## 4. Step 3: Verification & Go-Live Checklist

- [ ] **DNS Propagation**: Verify domain resolves to Go54 server IP (`nslookup chopliferepublic.ng`).
- [ ] **SSL Security**: Confirm padlock icon in browser (HTTPS active).
- [ ] **POS & Checkout**: Test menu ordering, payment gateways (Paystack / Flutterwave / Cash), and order dispatch.
- [ ] **Kitchen Display**: Verify real-time order arrival on KDS.
- [ ] **Admin & Staff Portals**: Test secure login on staff/admin subdomains (`staff.chopliferepublic.ng` / `admin.chopliferepublic.ng`).

---
*Prepared by Senior DevOps & Infrastructure Taskforce for ChopLife Republic.*
