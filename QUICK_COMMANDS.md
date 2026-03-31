# ⚡ Quick Command Reference

Copy and paste these commands to get started instantly.

## 🚀 Start Everything (4 Terminals)

### Terminal 1: Redis
```bash
docker-compose up redis
```

### Terminal 2: Backend Dev Server
```bash
cd backend
export TZ=UTC
npm run dev
# Listens on http://localhost:3001
```

### Terminal 3: Frontend Dev Server
```bash
cd frontend
npm run dev
# Listens on http://localhost:3000
```

### Terminal 4: Monitor/Testing
```bash
# Keep this terminal open for running tests and commands
# See below for test commands
```

---

## 🔍 Quick API Tests

### 1. Setup Organization (First Time)
```bash
curl -X POST http://localhost:3001/api/v1/setup/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!@#",
    "orgName": "My Org"
  }'
```

### 2. Login & Get Token
```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!@#"
  }'
```

### 3. Verify Auth (with Token)
```bash
curl -X GET http://localhost:3001/api/v1/auth/me \
  -b cookies.txt
```

### 4. Get Devices
```bash
curl -X GET http://localhost:3001/api/v1/devices \
  -b cookies.txt | jq .
```

### 5. Get Campaigns
```bash
curl -X GET http://localhost:3001/api/v1/campaigns \
  -b cookies.txt | jq .
```

### 6. Get Contacts
```bash
curl -X GET http://localhost:3001/api/v1/contacts \
  -b cookies.txt | jq .
```

### 7. Get Analytics
```bash
curl -X GET "http://localhost:3001/api/v1/analytics/summary?startDate=2024-01-01&endDate=2024-12-31" \
  -b cookies.txt | jq .
```

---

## 🛠️ Build Commands

### Build Backend
```bash
cd backend
npm run build
# Creates dist/ folder ready for production
```

### Build Frontend  
```bash
cd frontend
npm run build
# Creates .next/ folder ready for production
```

### Start Production Backend
```bash
cd backend
export TZ=UTC
export NODE_ENV=production
npm start
```

### Start Production Frontend
```bash
cd frontend
npm start
```

---

## 📊 Database Commands (Supabase SQL)

### Check Schema
```sql
SELECT count(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
```

### List Organizations
```sql
SELECT id, name, slug, plan FROM organizations;
```

### Check Audit Logs
```sql
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Messages
```sql
SELECT id, direction, status, created_at FROM messages 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Devices
```sql
SELECT id, name, status, health_score FROM whatsapp_devices;
```

### Check Contacts
```sql
SELECT id, phone, name, status FROM contacts 
LIMIT 10;
```

### Enable RLS Debugging
```sql
SET log_statement = 'all';
```

---

## 🔑 Environment Variables

### Backend (.env)
```bash
NODE_ENV=development
TZ=UTC
PORT=3001
LOG_LEVEL=info

SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

REDIS_HOST=localhost
REDIS_PORT=6379

GROQ_API_KEY=gsk_...
OPENAI_API_KEY=sk-...

STRIPE_SECRET_KEY=sk_test_...
FRONTEND_URL=http://localhost:3000
SESSION_SECRET=your_secret_min_32_chars
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 🐛 Debugging

### Enable Debug Logging
```bash
# Backend
export LOG_LEVEL=debug
npm run dev

# Frontend DevTools
# Press Ctrl+Shift+I or F12
```

### Monitor Redis
```bash
redis-cli monitor
```

### Check Node Processes
```bash
# List all Node processes
lsof -i :3000
lsof -i :3001

# Kill a process by port
kill -9 $(lsof -t -i:3001)
```

### TypeScript Compilation Check
```bash
cd backend && npx tsc --noEmit
cd frontend && npx tsc --noEmit
```

---

## 🧪 Run Tests

### Unit Tests (When Available)
```bash
cd backend && npm test
cd frontend && npm test
```

### E2E Tests (With Playwright)
```bash
cd frontend && npm run test:e2e
```

### Type Check
```bash
cd backend && npm run type-check
cd frontend && npm run type-check
```

---

## 📦 Dependency Management

### Install Dependencies
```bash
# Backend
cd backend && npm install --legacy-peer-deps

# Frontend
cd frontend && npm install --legacy-peer-deps
```

### Check for Vulnerabilities
```bash
npm audit
```

### Update Dependencies (Risky!)
```bash
npm update
npm audit fix --force
```

---

## 🌐 Browser Testing URLs

```
Login Page:         http://localhost:3000/login
Dashboard:          http://localhost:3000/dashboard
Devices:            http://localhost:3000/devices
Contacts:           http://localhost:3000/contacts
Campaigns:          http://localhost:3000/campaigns
Campaigns New:      http://localhost:3000/campaigns/new
Templates:          http://localhost:3000/templates
Inbox:              http://localhost:3000/inbox
Flows:              http://localhost:3000/flows
Auto-Reply:         http://localhost:3000/auto-reply
Analytics:          http://localhost:3000/analytics
Anti-Ban:           http://localhost:3000/anti-ban
AI Studio:          http://localhost:3000/ai-studio
Settings:           http://localhost:3000/settings
Settings → API:     http://localhost:3000/settings/api
Settings → Billing: http://localhost:3000/settings/billing
Settings → Team:    http://localhost:3000/settings/team
```

---

## 🚀 Docker Commands

### Start Redis Container
```bash
docker-compose up redis
```

### Stop Redis
```bash
docker-compose down redis
```

### Stop Everything
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs redis -f
```

---

## 🔄 Git Commands

### Check Status
```bash
git status
git log --oneline -10
```

### Commit Work
```bash
git add .
git commit -m "feat: implement campaign feature"
git push
```

---

## 📈 Performance Testing

### Backend Load Test
```bash
# Using Apache Bench (if installed)
ab -n 1000 -c 10 http://localhost:3001/api/v1/devices

# Using wrk (if installed)
wrk -t12 -c400 -d30s http://localhost:3001/api/v1/devices
```

### Frontend Build Analysis
```bash
cd frontend
npm run build -- --analyze
```

---

## 🎯 Common Workflows

### Add New Feature to Backend
```bash
# 1. Create route file
touch src/routes/myfeature.ts

# 2. Create handler module (if needed)
mkdir src/modules/myfeature
touch src/modules/myfeature/handler.ts

# 3. Import in index.ts
# app.use('/api/v1/myfeature', myfeatureRoutes)

# 4. Test
npm run build
npm run dev
```

### Add New Page to Frontend
```bash
# 1. Create page file
mkdir src/app/\(auth\)/mypage
touch src/app/\(auth\)/mypage/page.tsx

# 2. Create custom hook (if needed)
touch src/hooks/useMypage.ts

# 3. Test
npm run dev
# Visit http://localhost:3000/mypage
```

### Update Database Schema
```bash
# 1. Create migration
ls supabase/migrations/
# Note next number (e.g., 005)

# 2. Create SQL file
touch supabase/migrations/005_add_feature.sql

# 3. Write migration SQL
# 4. Apply in Supabase console
```

---

## 🆘 Emergency Reset

### Hard Reset (Lose All Data)
```bash
# Kill all processes
kill -9 $(lsof -t -i:3000)
kill -9 $(lsof -t -i:3001)

# Clear Next.js cache
rm -rf frontend/.next

# Reset Redis
redis-cli FLUSHALL

# Reinstall dependencies
cd backend && rm -rf node_modules && npm install --legacy-peer-deps
cd frontend && rm -rf node_modules && npm install --legacy-peer-deps
```

### Soft Reset (Keep Data)
```bash
# Clear RedisSession cache only
redis-cli DEL wa:sessions:*

# Restart servers
# Terminal 1: Ctrl+C then npm run dev
# Terminal 2: Ctrl+C then npm run dev
```

---

## 📞 Quick Support

### Check Server Status
```bash
curl http://localhost:3001/api/v1/setup/status
# Expected: { status: "ready" }

curl http://localhost:3000
# Expected: Redirect to /login with 307
```

### Verify Dependencies Installed
```bash
cd backend && npm list | head -20
cd frontend && npm list | head -20
```

### Check Port Availability
```bash
# Windows PowerShell
netstat -ano | grep 3000
netstat -ano | grep 3001
netstat -ano | grep 6379
```

---

**Pro Tips:**
- Keep all 4 terminals visible side-by-side
- Use `npm run dev` for development (watches for changes)
- Use `npm run build` then `npm start` for production
- Always export `TZ=UTC` before running backend
- Check browser DevTools (F12) for frontend errors
- Check `npm logs` for backend errors
- Use `jq` to prettify JSON responses (install: `npm install -g jq`)

**Keyboard Shortcuts:**
- Backend auto-reload: Ctrl+C then up arrow + Enter
- Frontend auto-reload: Ctrl+C then up arrow + Enter
- Browser reload: F5
- Browser hard reload: Ctrl+Shift+Delete
- DevTools toggle: F12
