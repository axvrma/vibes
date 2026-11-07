> Vibes 2.3: follow [the upgrade and backup guide](../docs/UPGRADE-2.3.md) before the legacy quick-start below. Production secrets and exact origins are required. External mounts are opt-in through docker-compose.media.yml. Keep your existing project name and volume.

# Vibes Infra Deployment Guide

This folder contains the Docker Compose configurations required to deploy the complete Vibes ecosystem (App, Dashboard, and Server) smoothly on a local server.

## Architecture
The deployment uses a **Unified NGINX Reverse Proxy (API Gateway)** that sits on port `80`. This architecture securely routes traffic to internal Docker containers without exposing their native ports to the host machine:
- `http://<your-server-ip>/app/` -> Renders the Flutter Web App
- `http://<your-server-ip>/dashboard/` -> Renders the Angular Dashboard
- `http://<your-server-ip>/api/` -> Routes directly to the Node.js Backend Server

## Quick Start (Deploy from Scratch)

## Deployment

1. Make sure to update your `docker-compose.yml` volumes to map to your SSD mount point instead of the default local volume if needed. E.g.:
   ```yaml
   volumes:
     vibes_data:
       driver: local
       driver_opts:
         type: none
         o: bind
         device: /mnt/ssd/vibes_data
   ```

2. Start the services:
   ```bash
   cd infra # From the repository root
   docker compose up -d --build
   ```

The Compose project (stack) is explicitly named `vibes`, regardless of the directory name. Containers use the names `vibes-server-1` and `vibes-dashboard-1`.

### Existing deployments named `infra`

Existing containers keep their names until you recreate them. From the `infra` directory, stop the old project before starting `vibes` to free its ports:

```bash
docker compose -p infra down
```

Do not add `--volumes` if you need to keep existing data. The project rename also changes the default data volume from `infra_vibes_data` to `vibes_vibes_data`. Before starting `vibes`, migrate your data or reuse the existing volume by adding `name: infra_vibes_data` under the top-level `volumes.vibes_data` entry in `docker-compose.yml`.

## Tailscale Serve Configuration

We want to expose the services privately over Tailscale without using Funnel (which makes it public). Tailscale Serve allows us to route traffic to the local container securely over your tailnet.

1. Install Tailscale on the Raspberry Pi and authenticate.
2. To serve the API and the Dashboard over Tailscale:

### 1. Build and Run the Stack
Navigate to the `infra` directory (if not already there) and run:
```bash
docker-compose up -d --build
```
This command will build the Flutter Web app, Angular Dashboard, and Node.js backend entirely from scratch inside Docker containers. The initial build might take a few minutes as it resolves dependencies for all three environments.

### 2. Verify Services
Check the status of your running containers:
```bash
docker-compose ps
```

You can view the logs in real-time if something fails:
```bash
docker-compose logs -f
```

### 3. Accessing the Application
Once the containers are running, simply open your browser and navigate to:
- **Web App**: `http://localhost/app/`
- **Admin Dashboard**: `http://localhost/dashboard/`

*(Replace `localhost` with your local server's IP address if accessing from another device on the network).*

## Data Persistence
The Node.js server utilizes SQLite and stores media files locally. In `docker-compose.yml`, a persistent Docker Volume named `vibes_data` is mounted to `/app/data` inside the server container.

This ensures that all your user data, uploaded videos, and metadata remain safely persisted even if you stop, rebuild, or destroy the containers!
