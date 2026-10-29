# Hearth Production Operations & Deployment Guide

This guide describes production deployment, SSL/TLS termination, Kubernetes orchestration, and backup procedures for Hearth.

---

## 1. Production Architecture Overview

The production architecture consists of:
- **Caddy Reverse Proxy**: Handles SSL/TLS termination, automated certificate renewal via Let's Encrypt / ZeroSSL, gzip/zstd compression, and security headers (HSTS, CSP, X-Frame-Options, X-Content-Type-Options).
- **Client SPA**: High-performance React Vite production build served via NGINX/Caddy.
- **API Gateway (Port 8080)**: Central routing, CORS enforcement, and request dispatching across microservices.
- **Backend Microservices**:
  - `family-service` (8081)
  - `task-service` (8082)
  - `decision-service` (8083)
  - `care-service` (8084)
  - `notification-service` (8085)
  - `audit-service` (8086)
- **Data Stores**:
  - PostgreSQL 16: Multi-database setup (`hearth_family`, `hearth_task`, `hearth_decision`, `hearth_care`, `hearth_notification`, `hearth_audit`).
  - Apache Kafka 3.7: Event streaming with transactional outbox pattern.
  - Neo4j 5.20: CareGraph relationship model.

---

## 2. Docker Compose Production Deployment

To start the full production stack:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

### Health & Container Verification
```bash
docker compose -f docker-compose.prod.yml ps
node tools/verify-stack.mjs
```

---

## 3. Kubernetes Orchestration (`k8s/`)

For enterprise container orchestration, Hearth includes complete Kubernetes manifests in the `k8s/` directory.

### Deploying to a Kubernetes Cluster:
```bash
# 1. Create namespace
kubectl apply -f k8s/00-namespace.yaml

# 2. Apply config and secrets
kubectl apply -f k8s/01-configmap-secrets.yaml

# 3. Deploy data infrastructure
kubectl apply -f k8s/02-postgres.yaml
kubectl apply -f k8s/03-kafka.yaml

# 4. Deploy backend microservices
kubectl apply -f k8s/04-backend-microservices.yaml

# 5. Deploy gateway, frontend and ingress
kubectl apply -f k8s/05-gateway-frontend-ingress.yaml
```

---

## 4. Backup & Disaster Recovery

Automated database backup and restoration scripts reside in `infrastructure/scripts/`.

### Creating a Snapshot Backup:
```bash
./infrastructure/scripts/backup.sh
```
Dumps all 6 PostgreSQL logical databases into compressed custom format files (`.dump`) with 14-day automated retention pruning.

### Restoring from Backup:
```bash
./infrastructure/scripts/restore.sh /backups/YYYYMMDD_HHMMSS
```

---

## 5. Security Headers & TLS Configuration

Caddy enforces the following headers across all incoming traffic:
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Removal of `Server` fingerprinting headers.
