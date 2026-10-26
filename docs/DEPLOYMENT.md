# Deployment

## Local judging and recording

`npm start` is the supported, zero-install-dependency demo. Run Node 22.16+, open http://localhost:3000, and follow README. Both studio and OBS can run on the broadcaster’s machine. This already connects to Twitch through outbound HTTPS and EventSub; it does not require a public webhook.

## Public server or container

Use an existing HTTPS-capable host that supports long-lived Node processes, outbound WebSockets, streaming HTTP responses, and a writable persistent volume. Static hosting and short-lived function environments cannot run the real integration. Run exactly one replica per channel.

1. Copy the repository to the server. Generate a private studio key with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Store it in the host’s secret settings or private `.env`, never in source or a public link.
2. Set `HOST=0.0.0.0`, `PORT=3000`, `BASE_URL=https://YOUR_DOMAIN`, a 24+ character `ADMIN_KEY`, and `DATA_DIR` to a private persistent volume. Add Twitch app credentials if using live chat. Replace `YOUR_DOMAIN` with the actual domain, not the literal placeholder.
3. Register `https://YOUR_DOMAIN/auth/callback` in Twitch. The URI must match exactly, including scheme, port, and path. Sign in through the deployed studio. Existing localhost tokens and cookies should not be copied into the deployment.
4. Terminate TLS at a reverse proxy. Forward the original path, including query strings. Disable buffering for `/api/events`, allow streaming responses and a long idle timeout, and preserve cookies. Do not rewrite the browser Origin. Put connection/body/rate limits at the edge. `BASE_URL` must equal the URL the browser actually uses.
5. Run `node src/server.js` with the environment configured. For a local `.env` use `npm start`; the direct Node command does not load the file automatically.
6. Check `/health`, unlock studio, test a command from real Twitch chat, and verify `/overlay` in a fresh private browser window. Verify pending proposals are not visible in `/api/state?public=1`.
7. Use the HTTPS overlay URL in OBS. Share the overlay link freely; share studio control only with authorized collaborators, never with viewers.

### Docker

```sh
docker build -t sceneshift:1.0 .
docker volume create sceneshift-data
docker run -d --name sceneshift --restart unless-stopped \
  --env-file .env \
  -e HOST=0.0.0.0 -e DATA_DIR=/app/data \
  -p 127.0.0.1:3000:3000 \
  -v sceneshift-data:/app/data sceneshift:1.0
```

Set `ADMIN_KEY` and `BASE_URL` in `.env` first. The image runs as the unprivileged `node` user. The proxy on the same server connects to 127.0.0.1:3000. A mounted host directory must be writable by the container’s Node user. Keep the data volume when upgrading or restarting. The Docker recipe is prepared but was not built in this environment.

## Public judging link

A permanent public test deployment requires a domain/hosting account and secure configuration. No public deployment has been claimed or fabricated. Judges can run the complete rehearsal locally without Twitch credentials. For a public interactive rehearsal, deploy a **separate instance** containing only disposable sample data and a dedicated demo key, with **no Twitch credentials**, and publish that demo key only after you decide to make the instance intentionally shared. Do not share the key of your real channel’s studio. A read-only overlay alone cannot exercise streamer controls.

## Recovery

Before upgrades, stop the process and back up the private data directory. On restart, a vote whose deadline elapsed is closed by the first timer tick; tokens are revalidated before Twitch subscriptions resume. A corrupt/unsupported state file causes startup failure rather than silent reset: restore a known backup. A lost key can be replaced using `ADMIN_KEY` and a process restart, which also invalidates old studio sessions. Export canon from the UI before resetting rehearsal. Twitch authorization can be revoked from the account’s Connections settings.
