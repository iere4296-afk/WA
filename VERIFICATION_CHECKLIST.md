# 🚀 Quick Verification Checklist

Run this checklist to verify everything is set up correctly.

## ✅ Pre-Launch Checklist (5 minutes)

```bash
# 1. Verify Node.js version
node --version
# Expected: v22.x or v20.x

# 2. Check Redis is available
redis-cli ping
# Expected: PONG

# 3. Verify backend compiles
cd backend && npm run build
# Expected: Build success in ~50ms

# 4. Verify frontend builds
cd frontend && npm run build
# Expected: ✓ Compiled successfully, 21 pages

# 5. Check environment files exist
ls backend/.env
ls frontend/.env.local
# Expected: Both files exist with values
```

## 🎯 Backend Verification (Terminal 1)

```bash
cd backend
export TZ=UTC
npm run dev

# Expected output:
# ├─ [PID] listening on port 3001
# ├─ Logger initialized
# └─ Redis connected

# Test endpoint:
curl http://localhost:3001/api/v1/setup/status
# Expected: { status: "ready" }
```

## 🎯 Frontend Verification (Terminal 2)

```bash
cd frontend
npm run dev

# Expected output:
# ▲ Next.js 15.5.14
# - Local:        http://localhost:3000
# - Environments: .env.local

# Test in browser:
# http://localhost:3000
# Expected: Redirect to /login
```

## 📝 Login Flow Test

1. **Navigate to** http://localhost:3000/login
2. **Expected**: Login form with email/password inputs
3. **Wait**: Should see loading spinner briefly
4. **Check**: Browser DevTools → Network tab → auth/login response
   - Status: 200
   - Response: `{ userId: "...", orgId: "..." }`
5. **Verify**: Redirects to /dashboard after 2 seconds

## 📊 Dashboard Smoke Test

1. **On Dashboard** (http://localhost:3000/dashboard)
2. **Check Elements**:
   - [ ] 4 StatCards (devices, contacts, campaigns, messages)
   - [ ] 2 Charts (volume, engagement)
   - [ ] Recent campaigns list
   - [ ] Connected devices list
3. **Wait 3 seconds**: Real data should load
4. **DevTools Network**: Should see:
   - ✅ GET /api/v1/devices
   - ✅ GET /api/v1/campaigns
   - ✅ GET /api/v1/analytics/summary

## 🔌 API Endpoint Test

Run these curl commands from a terminal:

```bash
# 1. Setup Organization (first time only)
curl -X POST http://localhost:3001/api/v1/setup/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!@#",
    "orgName": "Test Org"
  }'

# Expected: 
{
  "data": {
    "userId": "uuid",
    "orgId": "uuid",
    "token": "eyJhbGc..."
  }
}

# 2. Login
RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -k \
  -c cookies.txt \
  -d '{
    "email": "admin@test.com",
    "password": "Test123!@#"
  }')

echo $RESPONSE

# Expected: JWT token in w a_token cookie

# 3. Get Current User
curl -X GET http://localhost:3001/api/v1/auth/me \
  -b cookies.txt

# Expected:
{
  "data": {
    "id": "uuid",
    "email": "admin@test.com",
    "org": {
      "id": "uuid",
      "name": "Test Org"
    }
  }
}

# 4. List Devices (empty initially)
curl -X GET http://localhost:3001/api/v1/devices \
  -b cookies.txt

# Expected:
{
  "data": [],
  "meta": {
    "nextCursor": null,
    "hasMore": false
  }
}
```

## 🗄️ Database Verification

In Supabase dashboard:

```sql
-- 1. Check schema exists
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public';
-- Expected: 23

-- 2. Check organization
SELECT * FROM organizations LIMIT 1;
-- Expected: 1 row if setup/initialize was called

-- 3. Check RLS is enabled
SELECT * FROM pg_policies 
WHERE schemaname = 'public' 
LIMIT 5;
-- Expected: Multiple rows for RLS policies

-- 4. Check audit log
SELECT * FROM audit_logs LIMIT 5;
-- Expected: Log entries from API mutations
```

##  📱 Device Connection Test

1. **In Dashboard**, click **Devices**
2. **Click "Add Device"** button
3. **Scan QR code** with WhatsApp-connected phone
4. **Expected**: Device status changes:
   - Initial: "Connecting" with QR code
   - After scan: "Connected" with ✅ green badge
5. **Check Browser DevTools** → Network:
   - POST `/api/v1/devices/:id/connect` → { "qrCode": "data:image/..." }
   - Device socket should show connection event logs

## 💬 Test Campaign Send

1. **Go to Campaigns** page
2. **Click "New Campaign"**
3. **Fill form**:
   - Name: "Test Campaign"
   - Type: "Bulk"
   - Device: Select connected device
   - Contact: Enter +1234567890 (or import)
   - Template: "Hello {{firstName}}"
4. **Click Send**
5. **Check**:
   - [ ] Response: `{ jobsQueued: 1, campaignId: "..." }`
   - [ ] Message appears in device's WhatsApp
   - [ ] Status updates in real-time on dashboard
6. **In Database**:
   ```sql
   SELECT * FROM messages 
   WHERE direction = 'outbound' 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
   - Expected: Entry with status = 'sent'

## 📈 Real-Time Test

1. **Open Dashboard** in two browser tabs
2. **In Tab 1**: Create a new contact
3. **In Tab 2**: Dashboard should update instantly
   - Expected: Contact count increases
   - No page refresh needed
4. **Verify**: Network tab shows WebSocket connection to Supabase Realtime

## ❌ Error Handling Test

1. **Try invalid JWT**:
   ```bash
   curl -X GET http://localhost:3001/api/v1/devices \
     -H "Authorization: Bearer invalid_token"
   # Expected: 401 Unauthorized
   ```

2. **Try missing auth**:
   ```bash
   curl -X GET http://localhost:3001/api/v1/devices
   # Expected: 401 Unauthorized
   ```

3. **Try non-existent device**:
   ```bash
   curl -X GET http://localhost:3001/api/v1/devices/invalid-uuid \
     -b cookies.txt
   # Expected: 404 Not Found
   ```

## 🎨 Frontend Rendering Test

Check all pages load without errors:

- [ ] /login - Form with inputs
- [ ] /dashboard - 4 cards + charts loaded
- [ ] /devices - List + "Add Device" button
- [ ] /contacts - List + import button
- [ ] /campaigns - List + "New Campaign" button
- [ ] /templates - List + "Add Template" button
- [ ] /inbox - Split-pane chat interface
- [ ] /flows - Workflow builder (visual canvas)
- [ ] /auto-reply - Rule builder table
- [ ] /analytics - Charts with data
- [ ] /anti-ban - Health score dashboard
- [ ] /ai-studio - Message generation form
- [ ] /settings/api - API key management
- [ ] /settings/billing - Stripe integration
- [ ] /settings/team - Team member list

## 🐛 Troubleshooting Quick Links

| Issue | Check | Fix |
|-------|-------|-----|
| Backend won't start | Is Redis running? | `docker-compose up redis` |
| 401 on every request | Are cookies sent? | Check browser DevTools → Storage → Cookies |
| "Cannot find module" | Did npm install run? | `npm install --legacy-peer-deps` |
| QR code won't load | Is backend running? | `npm run dev` in backend terminal |
| Frontend loading forever | Is API_URL correct? | Check NEXT_PUBLIC_API_URL in .env.local |
| Supabase connection error | Are credentials valid? | Verify SUPABASE_URL + SUPABASE_KEY |

##  ✅ Final Checklist

- [ ] Node.js 22+ installed
- [ ] npm install completed (both backend + frontend)
- [ ] .env files created with values
- [ ] Supabase project set up
- [ ] Database migrations applied (001→004)
- [ ] Redis running locally
- [ ] Backend compiles (npm run build)
- [ ] Frontend builds (npm run build)
- [ ] Backend starts (npm run dev) - listens on 3001
- [ ] Frontend starts (npm run dev) - listens on 3000
- [ ] Login flow works
- [ ] Dashboard loads data
- [ ] Device list appears
- [ ] Realtime subscriptions work
- [ ] All 21 pages accessible
- [ ] Zero console errors in backend
- [ ] Zero console errors in frontend
- [ ] API tests pass (curl commands above)

---

## 🎉 You're Ready!

Once all checks pass:

```bash
# Run full stack in production
docker-compose up redis &
cd backend && npm run build && npm start &
cd frontend && npm run build && npm start
```

**Status**: Production-ready ✅  
**Support**: Check SETUP.md for detailed documentation  
**Issues**: Check browser DevTools (Ctrl+Shift+I) → Console for errors
