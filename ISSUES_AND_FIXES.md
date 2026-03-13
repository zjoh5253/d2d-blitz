# D2D Blitz - Issues & Fix Tracking

**Last Updated:** 2026-03-13  
**Status:** Active Development

---

## 🔴 Critical Issues (Fix ASAP)

### 1. API Endpoints Missing/Inconsistent
| Issue | Impact | Fix | Status |
|-------|--------|-----|--------|
| `POST /api/auth/login` returns 400 not 401 | Poor UX for error handling | Update to return 401 | 🔴 Pending |
| `GET /api/user` doesn't exist | Cannot fetch user profile | Create endpoint | 🔴 Pending |
| `POST /api/auth/register` behavior | Accepts duplicate emails silently? | Add validation | 🟡 Check |

### 2. Touchpoints Feature
| Issue | Impact | Fix | Status |
|-------|--------|-----|--------|
| Touchpoints admin page not deployed | Cannot manage customer touchpoints | Build & deploy | 🔴 Pending |
| Touchpoints API missing | No backend for SMS/email automation | Create endpoints | 🔴 Pending |
| No touchpoints DB schema | Cannot store touchpoint data | Add Prisma model | 🔴 Pending |

### 3. Commission Enhancements
| Issue | Impact | Fix | Status |
|-------|--------|-----|--------|
| Streak bonuses not in UI | Reps can't see streak progress | Add to dashboard | 🟡 Pending |
| Scout premium not visible | Recruitment incentives hidden | Add to profile | 🟡 Pending |
| Weekly pay calculations | No weekly payout view | Create reports page | 🟡 Pending |
| Real-time commission preview | Reps can't see potential earnings | Add preview API | 🟡 Pending |

---

## 🟡 Medium Priority

### UI/UX Issues
- [ ] **Mobile responsiveness** - Test all pages on mobile viewport
- [ ] **Loading states** - Add skeleton loaders for data fetching
- [ ] **Empty states** - Better messaging when no data exists
- [ ] **Form validation** - Real-time validation feedback
- [ ] **Error boundaries** - Catch and display errors gracefully

### Missing Pages
- [ ] **Password reset flow** - Complete forgot password → email → reset
- [ ] **Email verification** - Verify email after registration
- [ ] **Profile settings** - Edit profile, change password, etc.
- [ ] **Notification preferences** - Toggle email/push notifications

### API Improvements
- [ ] **Rate limiting** - Add rate limits to auth endpoints
- [ ] **Input sanitization** - Validate all inputs
- [ ] **Error logging** - Log API errors for monitoring
- [ ] **API versioning** - Consider /api/v1/ prefix

---

## 🟢 Low Priority / Nice to Have

### Features
- [ ] **Dark mode** - Toggle between light/dark themes
- [ ] **Offline mode** - Better offline queue management
- [ ] **PWA support** - Service worker, manifest, installable
- [ ] **Push notifications** - Browser push for updates
- [ ] **Analytics dashboard** - Usage metrics, conversion rates

### DevOps
- [ ] **Staging environment** - Deploy previews for PRs
- [ ] **Automated backups** - Database backup strategy
- [ ] **Monitoring** - Uptime monitoring, error tracking (Sentry)
- [ ] **Performance budgets** - Bundle size limits

---

## ✅ Recently Fixed

| Issue | Date Fixed | Commit |
|-------|------------|--------|
| API health endpoint missing | 2026-03-13 | 4f8af47 |
| Leaderboard 404 error | 2026-03-13 | 4f8af47 |
| Touchpoints 404 error | 2026-03-13 | 4f8af47 (redirect) |

---

## 📋 Pre-Deployment Checklist

Run before every production deployment:

```bash
# 1. Run API test suite
node scripts/api-test-suite.js --base-url=https://d2d-blitz.vercel.app

# 2. Run UI test checklist
# See UI_TESTING_CHECKLIST.md

# 3. Type check
npm run typecheck

# 4. Lint
npm run lint

# 5. Build test
npm run build
```

---

## 🚀 Deployment Plan

### Phase 1: Critical Fixes (This Week)
- [ ] Fix login error response (400 → 401)
- [ ] Create /api/user endpoint
- [ ] Deploy touchpoints feature
- [ ] Add commission UI components

### Phase 2: Polish (Next Week)
- [ ] Mobile responsiveness pass
- [ ] Loading states & empty states
- [ ] Form validation improvements
- [ ] Error boundaries

### Phase 3: Advanced Features (Future)
- [ ] Push notifications
- [ ] Advanced analytics
- [ ] PWA support
- [ ] Offline-first mobile app

---

## 🧪 Testing

### Automated Tests
- ✅ API test suite (11/13 passing)
- ⏳ UI E2E tests (planned)
- ⏳ Unit tests (planned)

### Manual Testing
- ✅ UI testing checklist
- ⏳ Mobile device testing
- ⏳ Cross-browser testing

---

*Document maintained by Carl (OpenClaw)*
