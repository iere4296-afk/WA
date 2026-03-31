# PHASE 9 QUICK DEPLOYMENT GUIDE 🚀

**Status**: READY FOR PRODUCTION  
**Date**: March 28, 2026  
**Approval**: Engineering Lead

---

## 📋 PRE-DEPLOYMENT (48 Hours Before)

### 1. Run Pre-Deployment Checks

```bash
# Make script executable
chmod +x pre-deployment-check.sh

# Run comprehensive verification
./pre-deployment-check.sh
```

**Expected Output:**
```
✓ Passed checks: 25
✗ Failed checks: 0
✓ READY FOR DEPLOYMENT
```

### 2. Load Testing (Recommended)

```bash
# Install k6 (https://k6.io)
# macOS: brew install k6
# Windows: choco install k6
# Linux: sudo apt install k6

# Run load test
k6 run load-test-k6.js \
  -e BASE_URL=https://staging-api.example.com \
  -e EMAIL=test@example.com \
  -e PASSWORD=TestPassword123!

# Expected: Error rate < 1%, p95 response time < 500ms
```

### 3. Backup Database

```bash
# Create backup via Supabase CLI
supabase db push --dry-run  # Verify pending changes

# Via Supabase Dashboard:
# Settings → Backups → Create Backup
```

### 4. Verification Checklist

```
[ ] Code compiled successfully (npm run build)
[ ] All tests passing
[ ] Database migrations verified
[ ] Environment variables configured
[ ] SSL certificates valid
[ ] Monitoring configured (Sentry)
[ ] Load testing completed
[ ] Database backup created
[ ] Rollback plan documented
[ ] Team notified
```

---

## 🚀 DEPLOYMENT DAY (T-0)

### Timeline: 2-3 Hour Window (Low-Traffic Time)

**T-30 min: Final Checks**
```bash
# 1. Verify database is healthy
supabase status

# 2. Check Redis connectivity
redis-cli ping
# Output: PONG

# 3. Verify Supabase auth
curl "https://your-project.supabase.co/auth/v1/health"
```

**T-15 min: Notify Team**
- [ ] Post in Slack: "Deployment starting in 15 minutes"
- [ ] Set status to "In Progress"
- [ ] Ensure on-call engineer is ready

**T-0: Deploy Backend**

```bash
# Option A: Railway
railway up
# (automatic deployment from git)

# Option B: Fly.io
flyctl deploy

# Option C: Manual Docker
docker-compose -f docker-compose.prod.yml up -d
```

**T+5 min: Deploy Frontend**

```bash
# Vercel (automatic from git push)
git push origin main

# or manual:
vercel deploy --prod
```

**T+10 min: Run Smoke Tests**

```bash
# Health check
curl https://api.example.com/api/v1/health
# Expected: {"status":"ok","supabase":true,"redis":true,"ai":true}

# Authentication test
curl -X POST https://api.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"PASSWORD"}'

# Dashboard API test
curl -H "Authorization: Bearer TOKEN" \
  https://api.example.com/api/v1/inbox/conversations
# Expected: {"data":[...]}
```

**T+15 min: User-Facing Tests**

1. Open https://app.example.com
2. Login with test account
3. Check dashboard loads
4. Send test message
5. Verify inbox updates

---

## 📊 POST-DEPLOYMENT MONITORING (T+1 to T+24 hours)

### First Hour (Critical)

```
Every 5 minutes:
  ✓ Check error rate in Sentry (should be < 0.1%)
  ✓ Monitor response times (p95 < 500ms)
  ✓ Verify database connections (< 40 of 50)
  ✓ Check Redis memory (< 500MB)

Every 15 minutes:
  ✓ Check Slack/Discord for user reports
  ✓ Monitor queue backlog (should be < 100)
  ✓ Verify webhook deliveries
```

### Key Metrics Dashboard

| Metric | Target | Alert If |
|--------|--------|----------|
| Error Rate | < 0.1% | > 1% |
| Response Time (p95) | < 500ms | > 1000ms |
| Database Connections | < 40 | > 45 |
| Queue Depth | < 100 | > 500 |
| Redis Memory | < 500MB | > 1GB |
| CPU Usage | < 60% | > 80% |
| Disk Usage | < 70% | > 85% |

### 24-Hour Stability Check

If any issues:
1. ✅ Error rate stable
2. ✅ No spike in database errors
3. ✅ Webhook deliveries > 99% success
4. ✅ User reports: 0
5. ✅ Performance metrics normal

**Then**: Declare deployment successful ✓

---

## 🔄 ROLLBACK PROCEDURE (If Needed)

**Condition**: Error rate > 2% OR availability < 99% for > 15 minutes

### Immediate Actions

```bash
# 1. Page on-call engineer
# 2. Check logs in Sentry
# 3. Determine root cause

# 4. If unfixable: Rollback backend
git revert HEAD
git push origin main  # Trigger re-deployment

# 5. If frontend issue: Rollback Vercel
vercel rollback

# 6. If database issue: Restore backup
supabase db restore --backup-id=<BACKUP_ID>
```

**Estimated Time**: 5-10 minutes

**Success Criteria**:
- ✓ Error rate < 0.1%
- ✓ All users can login
- ✓ Core features working

---

## 📋 DEPLOYMENT CHECKLIST

### Pre-Deployment (48h)
- [ ] Pre-deployment script passes (0 failures)
- [ ] Load testing completed
- [ ] Database backup created
- [ ] Team briefing completed
- [ ] Monitoring configured
- [ ] Incident response ready

### Deployment Day
- [ ] Final health checks passed
- [ ] Team notified (Slack)
- [ ] Backend deployment started
- [ ] Frontend deployment started
- [ ] Smoke tests passing
- [ ] No critical errors

### Post-Deployment (1h)
- [ ] Health endpoint responding
- [ ] Authentication working
- [ ] Dashboard loading
- [ ] Error rate < 0.1%
- [ ] Response times normal
- [ ] Queue processing

### Post-Deployment (24h)
- [ ] Error rate stable
- [ ] Performance metrics normal
- [ ] No user complaints
- [ ] Database healthy
- [ ] Backups running

---

## 🆘 COMMON ISSUES & FIXES

### Issue: "502 Bad Gateway"

**Cause**: Backend not responding  
**Fix**:
```bash
# Check backend health
curl http://localhost:3001/api/v1/health

# Check logs
docker logs <container-id>

# Restart if needed
docker restart <container-id>
```

### Issue: "Too many connections" database error

**Cause**: Connection pool exhausted  
**Fix**:
```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections (if safe)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle' AND query_start < now() - interval '30 min';

-- Increase pool size if needed
-- Edit Supabase settings: Connections → increase to 100
```

### Issue: "Redis connection refused"

**Cause**: Redis not running or network issue  
**Fix**:
```bash
# Check Redis status
redis-cli ping

# Restart Redis
docker restart redis

# If Redis unavailable, queue falls back to cron (slower but works)
```

### Issue: High error rate after deployment

**Cause**: Regression or configuration issue  
**Fix**:
```
1. Check Sentry for error patterns
2. Search logs for specific error message
3. Check recent git changes
4. Compare with pre-deployment metrics
5. If unclear: Rollback and investigate
```

---

## 📞 ESCALATION CONTACTS

```
On-Call Engineer: [NAME] ([PHONE])
Engineering Lead: [NAME] ([PHONE])
DevOps Lead: [NAME] ([PHONE])
Product Manager: [NAME] ([PHONE])

Slack Channel: #deployment-status
```

---

## 📚 DOCUMENTATION REFERENCES

- **Phase 9 Full Guide**: [PHASE_9_PERFORMANCE_DEPLOYMENT.md](PHASE_9_PERFORMANCE_DEPLOYMENT.md)
- **Architecture Overview**: [README.md](README.md)
- **Setup Instructions**: [SETUP.md](SETUP.md)
- **API Documentation**: Available at `/api-docs` endpoint

---

## ✅ DEPLOYMENT COMPLETION CHECKLIST

After successful deployment, verify:

```
[ ] All services deployed and healthy
[ ] Error tracking (Sentry) active
[ ] Performance monitoring active
[ ] Backups scheduled and verified
[ ] On-call rotation activated
[ ] Team documented in runbook
[ ] Incident response plan in place
[ ] Post-incident retrospective scheduled
```

---

## 🎉 SUCCESS METRICS

Deployment is **SUCCESSFUL** when:

✅ **Uptime**: 99.9%+ for first 24 hours  
✅ **Error Rate**: < 0.1%  
✅ **Response Time**: p95 < 500ms  
✅ **User Reports**: 0 critical issues  
✅ **Database**: Healthy, no connection issues  
✅ **Cache**: Redis operational, > 90% hit rate  
✅ **Queue**: Processing normally, no backlog  

---

**Deployment Status**: 🟢 READY TO LAUNCH

**Final Approval By**: [CTO Name], [Date]

---

*For detailed information about each component and performance targets, see PHASE_9_PERFORMANCE_DEPLOYMENT.md*
