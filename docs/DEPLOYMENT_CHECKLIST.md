# Deployment Checklist

Use this checklist before every production deployment to Raspberry Pi.

## Pre-Deployment

### Environment

- [ ] `.env.production` is configured with correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- [ ] `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are set in GitHub secrets
- [ ] `PI_HOST`, `PI_USER`, and `PI_SSH_KEY` secrets are set in GitHub

### Database

- [ ] All Supabase migrations are applied to production: `supabase db push --linked`
- [ ] RLS policies are verified: run `./scripts/test-integration.sh` against production (with read-only credentials)
- [ ] No breaking schema changes without a corresponding migration
- [ ] Seed data removed or scoped to dev environment

### Code

- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npm run typecheck`
- [ ] No lint errors: `npm run lint`
- [ ] The correct branch/tag is being deployed (not a work-in-progress branch)
- [ ] CHANGELOG or release notes updated if applicable

### Build

- [ ] Web build succeeds locally: `npm run build:web`
- [ ] Docker build succeeds locally: `docker build -t worktracker:test .`
- [ ] Docker image runs correctly: `docker run -p 3000:3000 worktracker:test`

### Raspberry Pi

- [ ] Pi is reachable via SSH: `ssh $PI_USER@$PI_HOST`
- [ ] Docker is running on Pi: `ssh $PI_USER@$PI_HOST docker ps`
- [ ] Sufficient disk space: `ssh $PI_USER@$PI_HOST df -h` (>1 GB free)
- [ ] SSL certificates are valid or renewal is not due within 7 days
- [ ] Nginx config is up to date on Pi

## Deployment

- [ ] Trigger the [Deploy workflow](../../actions/workflows/deploy.yml) from GitHub Actions
  - Select `production` environment
  - Monitor the workflow run for errors
- [ ] Or run manually:
  ```bash
  ssh $PI_USER@$PI_HOST
  cd ~/worktracker
  git pull origin main
  ./scripts/deploy.sh
  ```

## Post-Deployment Verification

- [ ] App loads at the production URL (no 502/503 errors)
- [ ] Google OAuth sign-in completes successfully
- [ ] Timer starts and stops without errors
- [ ] Time entry appears in History after stopping timer
- [ ] Realtime: open two browser tabs, start timer in one, verify it appears in the other
- [ ] Analytics loads and displays charts
- [ ] Docker container is running: `docker ps | grep worktracker`
- [ ] Nginx logs show no errors: `sudo tail -f /var/log/nginx/error.log`
- [ ] App logs show no errors: `docker logs worktracker --tail 50`

## Rollback

If the deployment fails or the app is broken after deployment:

```bash
ssh $PI_USER@$PI_HOST
cd ~/worktracker

# Roll back to previous Docker image
docker stop worktracker
docker run -d --name worktracker --restart unless-stopped \
  -p 3000:3000 \
  worktracker:previous

# Or roll back via git and rebuild
git checkout <previous-tag>
./scripts/deploy.sh
```

To find the previous image tag:
```bash
docker images worktracker
```

## SSL Certificate Renewal

Certificates auto-renew via the certbot cron job. To renew manually:

```bash
sudo certbot renew --nginx
```

See [SSL_SETUP.md](SSL_SETUP.md) for full SSL configuration instructions.
