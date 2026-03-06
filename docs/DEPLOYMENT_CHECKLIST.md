# Deployment Checklist

Use this before every deployment to make sure nothing is missed.

---

## First deployment

- [ ] Pi is running 64-bit Raspberry Pi OS (`uname -m` → `aarch64`)
- [ ] Docker is installed (`docker version`)
- [ ] Docker Compose v2 is installed (`docker compose version`)
- [ ] Port is open in firewall: `sudo ufw allow <port>/tcp`
- [ ] Repo cloned to `/opt/worktracker`
- [ ] `.env` created from `.env.example` with `SUPABASE_URL` and `SUPABASE_ANON_KEY` filled in
- [ ] `WORKTRACKER_HTTP_PORT` set to a port not used by other apps
- [ ] `docker compose -f docker-compose.prod.yml build --pull` succeeds
- [ ] `docker compose -f docker-compose.prod.yml up -d` succeeds
- [ ] `curl http://localhost:<port>/health` returns `OK`
- [ ] App loads in browser at `http://<pi-ip>:<port>`
- [ ] Google OAuth sign-in works (redirect URL configured in Supabase)
- [ ] Systemd service installed and enabled (auto-start on reboot)

---

## Subsequent deployments

- [ ] All tests pass locally: `npm test`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] Changes committed and pushed to `main`
- [ ] Run on Pi: `cd /opt/worktracker && ./scripts/deploy.sh`
- [ ] Container is healthy after deploy: `docker compose -f docker-compose.prod.yml ps`
- [ ] App loads and sign-in works

---

## Post-deployment verification

- [ ] `http://<pi-ip>:<port>/health` → `OK`
- [ ] Sign in with Google completes without error
- [ ] Start and stop a timer — entry appears in History
- [ ] Analytics screen loads with charts
- [ ] No errors in logs: `docker compose -f docker-compose.prod.yml logs --tail 50 web`

---

## Rollback

If something breaks after a deploy:

```bash
cd /opt/worktracker
git log --oneline -5           # find the last good commit
git checkout <good-commit>
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```
