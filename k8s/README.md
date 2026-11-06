# Hearth on Kubernetes

Plain manifests (no Helm needed), checked in CI with kubeconform. Tested shape: one namespace, data
stores as StatefulSets, every Hearth service as a Deployment with probes, resource limits and a
non-root security context.

| File | Contents |
| --- | --- |
| `00-namespace.yaml` | Namespace `hearth` |
| `01-config.yaml` | Shared settings (ConfigMap `hearth-config`) |
| `01-secrets.example.yaml` | The secret's keys: copy, fill in, apply (never commit the filled-in copy) |
| `02-postgres.yaml` | PostgreSQL 16 StatefulSet and the `db-setup` Job that creates the seven databases |
| `03-kafka.yaml` | Kafka 3.9 (KRaft) StatefulSet |
| `04-neo4j-redis.yaml` | Neo4j 5 StatefulSet, Redis 7 Deployment |
| `05-services.yaml` | The seven services, their Services, and the care-documents volume |
| `06-gateway-web-ingress.yaml` | Gateway, web app, and the Ingress (ingress-nginx + cert-manager) |
| `07-autoscaling.yaml` | HorizontalPodAutoscalers (gateway, task, decision) and a PodDisruptionBudget |

## Needs

- Kubernetes 1.27 or newer with a default StorageClass
- [ingress-nginx](https://kubernetes.github.io/ingress-nginx/) and [cert-manager](https://cert-manager.io/)
  with a ClusterIssuer named `letsencrypt` (or edit the annotations)
- [metrics-server](https://github.com/kubernetes-sigs/metrics-server) for autoscaling
- The images in a registry the cluster can pull from

## Deploy

```bash
# 1. Build and push the images (replace the registry).
REG=registry.example.com/hearth
for m in api-gateway services/family-service services/task-service services/decision-service \
         services/care-service services/notification-service services/audit-service services/ai-service; do
  name=$(basename "$m")
  docker build -t "$REG/$name:1.0.0" --build-arg MODULE="$m" backend && docker push "$REG/$name:1.0.0"
done
docker build -t "$REG/web:1.0.0" frontend && docker push "$REG/web:1.0.0"

# 2. Point the manifests at them, and set your domain (hearth.example.com in 01-config.yaml and 06-*).
sed -i "s#image: hearth/\([a-z-]*\):latest#image: $REG/\1:1.0.0#" k8s/05-services.yaml k8s/06-gateway-web-ingress.yaml

# 3. Secrets.
cp k8s/01-secrets.example.yaml k8s/01-secrets.yaml      # fill in; keep it out of git
kubectl apply -f k8s/00-namespace.yaml
kubectl apply -f k8s/01-secrets.yaml

# 4. Everything else.
kubectl apply -f k8s/
kubectl -n hearth rollout status deploy --timeout=10m
```

The services wait for their database (`db-setup` creates it) and connect to Kafka when it is ready;
startup probes give them up to five minutes.

## Notes

- **care-service** runs one replica: uploaded documents live on a ReadWriteOnce volume. To run more,
  use a ReadWriteMany StorageClass and raise the replicas.
- **notification-service** can run several replicas: each one reads Kafka with its own consumer group
  for live updates, so every open stream gets every event, and the push relay uses
  `FOR UPDATE SKIP LOCKED` so replicas never send the same push twice.
- **Live updates** need the separate `hearth-stream` Ingress (no buffering, one-hour timeout).
- **Metrics:** pods carry `prometheus.io/*` annotations for a Prometheus that discovers pods; the
  dashboard in `infrastructure/monitoring/grafana/dashboards` works unchanged.
- For real production data prefer a managed PostgreSQL with point-in-time recovery: point `DB_HOST`
  at it and skip `02-postgres.yaml` (still run the `db-setup` Job against it).
