# Infra Setup

This directory contains the necessary Dockerfiles and docker-compose configurations to deploy the private media platform on a Raspberry Pi (ARM64).

## Prerequisites

1. **Docker & Docker Compose**: Ensure they are installed on your Raspberry Pi.
2. **FFmpeg**: The `server.Dockerfile` installs `ffmpeg` automatically within the Alpine Node container.
3. **External SSD**: Mount your SSD to a known directory, for example, `/mnt/ssd`.

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

```bash
# Serve the NGINX dashboard on HTTPS
tailscale serve --bg 80

# Serve the Express API on HTTPS under /api
tailscale serve --bg --set-path /api http://127.0.0.1:3000/api
```

This ensures everything is served securely on your private Tailscale network. Your tailnet URL (e.g., `https://raspberrypi.tailnet-xyz.ts.net`) will serve the Angular app at `/` and the API at `/api`.
