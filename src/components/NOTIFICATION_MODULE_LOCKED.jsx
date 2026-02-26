# NOTIFICATION MODULE: LOCKED & STABLE ✅

**Status:** LOCKED FOR PRODUCTION  
**Lock Date:** 2026-02-26  
**Lock Level:** CRITICAL  
**Next Review:** 2026-03-12 (2 weeks post-deployment)

---

## 🔒 LOCK STATEMENT

**The Notification module is LOCKED as production-stable.**

No structural changes, refactoring, or architectural modifications may be made to:
- notifyStudentsOnNoticePublish
- notifyStudentsOnDiaryPublish
- notifyStudentsOnQuizPublish
- notifyStudentsOnMarksPublish
- notifyStaffOnNoticePublish
- notifyStaffOnQuizSubmission
- notifyStaffOnStudentMessage
- Message entity read logic
- Badge calculation logic
- Push notification delivery pipeline

**Any proposed changes require:**
1. Formal change review document
2. Risk assessment
3. Regression test plan
4. Approval sign-off

---

## 📊 LIVE MONITORING CHECKLIST

Monitor these metrics continuously during first 2 weeks post-deployment:

### 1️⃣ Duplicate Notification Creation

**What to watch for:**
- Same `(recipient_student_id, related_entity_id, type)` appearing multiple times
- Same `(recipient_staff_id, related_entity_id, type)` appearing multiple times

**Metrics:**
```
Query 1 (every 4 hours):
  Notification
    .filter(duplicate_key is not null)
    .group_by(duplicate_key)
    .count()
    
Expected: 0 groups with count > 1
Alert threshold: Any duplicate_key with count > 1 = CRITICAL
```

**Log pattern to watch:**
```
"Duplicate <TYPE> notification for <student_id> detected, ignoring"
```

**Expected behavior:** Warnings are OK (means dedup worked). Errors = BAD.

**Action if triggered:**
1. Check timestamps of duplicates
2. Identify concurrent calls (publish same content twice?)
3. Review idempotency logic execution
4. Report to dev team immediately

---

### 2️⃣ Badge Mismatch Reports

**What to watch for:**
- Students/staff reporting badge counts don't match visible notifications
- "I have 3 unread but badge shows 5"
- "Badge shows 0 but I see messages"

**Metrics:**
```
For each student (random sample, 50/day):
  unread_notif_count = Notification.count(
    recipient_student_id = X,
    is_read = false
  )
  
  badge_count = StudentBottomNav.badges.messages + 
                StudentBottomNav.badges.quiz_posted + 
                StudentBottomNav.badges.results_posted
  
Expected: unread_notif_count === badge_count
Alert threshold: Mismatch on >5 students in same day
```

**Log pattern to watch:**
```
StudentBottomNav: fetchBadges() call logs
StudentMessaging: markAllInboxRead() execution logs
Notification subscription updates
```

**Possible causes:**
- Race condition in badge calculation
- Double-counting Message + Notification (indicates FIX #2 regression)
- Stale subscription updates
- Database inconsistency

**Action if triggered:**
1. Clear user's localStorage (force fresh fetch)
2. Verify Notification counts match visuals
3. Check Message.is_read vs Notification.is_read sync
4. Report if pattern repeats

---

### 3️⃣ Push Delivery Failures

**What to watch for:**
- Web push notification delivery failures
- "sendStudentPushNotification" or "sendStaffPushNotification" errors
- FCM/VAPID token rejection
- Browser permission issues

**Metrics:**
```
Log pattern:
  "Push send error (non-fatal): <error>"
  "Push delivery error: <error>"
  "Failed to send to student_id <id>: <error>"

Expected: <5 failures per 1000 notifications (0.5%)
Alert threshold: >50 failures per day, OR >10% failure rate
```

**Track these separately:**
```
Push failures by cause:
  - Invalid token (expired/revoked): OK, user disabled push
  - FCM auth failed: CRITICAL (secret misconfigured)
  - Network timeout: OK, retry on next publish
  - Browser offline: OK, will receive when online
```

**Action if triggered:**
1. Check FCM_SERVER_KEY secret validity
2. Check VAPID_PRIVATE_KEY secret validity
3. Verify push subscription tokens are valid
4. Check browser console for permission errors
5. Test push with manual trigger

---

## 📋 MONITORING RUNBOOK

### Daily (Automated)

```bash
# Every 4 hours
Query: Duplicate notifications
  SELECT type, related_entity_id, recipient_student_id, COUNT(*) 
  FROM Notification 
  GROUP BY type, related_entity_id, recipient_student_id 
  HAVING COUNT(*) > 1
  
Alert: Any results = CRITICAL
```

### Weekly (Manual Review)

1. **Duplicate count trend**
   - Week 1: 0 duplicates
   - Week 2: 0 duplicates
   - Expected pattern: 0 duplicates throughout

2. **Badge mismatch reports**
   - Check support tickets mentioning badge count issues
   - Expected: 0 tickets
   - If >1 ticket: investigate

3. **Push failure rate**
   - Calculate: failed_pushes / total_notifications_sent
   - Expected: <0.5%
   - If >2%: investigate

4. **Log analysis**
   - Search for "Duplicate <TYPE> notification detected"
   - Expected: 0-5 occurrences per week (means dedup working)
   - If >100: investigate

---

## ✅ 2-WEEK VALIDATION TIMELINE

### Week 1 (2026-02-26 to 2026-03-05)

**Day 1-2: Deployment & Initial Monitoring**
- Deploy all 5 functions simultaneously
- Enable detailed logging
- Monitor dashboards every 2 hours
- Expected: Normal operation, no errors

**Day 3-7: Stability Check**
- No critical alerts
- No duplicate notifications (0 expected)
- No badge mismatch reports
- <0.5% push failure rate
- Log show dedup warnings working (expected: <10/day)

**Checkpoint (Day 7):** Pass/Fail Decision
- ✅ PASS: All metrics normal → continue monitoring
- ❌ FAIL: Any critical issue → initiate change review & fix

### Week 2 (2026-03-05 to 2026-03-12)

**Day 8-14: Extended Monitoring**
- Continue baseline metrics
- Stress test: Publish notice to all students (test parallelism)
- Publish quiz to multiple classes (test race conditions)
- Expect: 0 duplicates, all notifications created

**Final Checkpoint (Day 14):** Validation Sign-Off
- ✅ ALL PASS: Module marked as "Fully Validated" → frozen long-term
- ❌ ANY FAIL: Module returns to review → structural changes allowed

---

## 🚨 CRITICAL ALERTS (Immediate Action)

| Alert | Severity | Action |
|---|---|---|
| Duplicate notification found | CRITICAL | Pause publishing, investigate |
| Bulk read fails (e.g., "Mark All" broken) | CRITICAL | Disable feature, notify users |
| Push auth error (FCM/VAPID) | CRITICAL | Check secrets, rotate if needed |
| Badge shows >20% wrong count | CRITICAL | Clear user cache, investigate |
| Race condition symptoms (same notif 2x) | CRITICAL | Review micro-check logic |

---

## 📝 EVIDENCE TO COLLECT

Before final sign-off on 2026-03-12, gather:

1. **Zero-duplicate proof**
   - SQL query: `COUNT(*) WHERE duplicate_key appears >1`
   - Expected: 0 results

2. **Badge accuracy proof**
   - Sample 50 random students
   - Query: `Notification count (is_read=false) vs badge display`
   - Expected: 100% match

3. **Push delivery proof**
   - Total notifications: X
   - Failed pushes: <0.5% of X
   - No auth errors (FCM/VAPID)

4. **Log analysis**
   - "Duplicate <TYPE> notification detected" warnings: <100 total
   - "Push send error (non-fatal)": <50 total
   - "Failed to notify": <20 total
   - No "Race condition" errors

5. **User feedback**
   - Support tickets: 0 related to notifications
   - Bug reports: 0 related to duplicate/missing notifications
   - Badge complaints: 0

---

## 🔐 NO-CHANGE POLICY

**During 2-week validation period:**

All changes to notification module functions are **FORBIDDEN** except:
- ✅ Bug fixes (breaking functional issues only)
- ✅ Logging enhancements (no logic changes)
- ✅ Secret rotation (no code changes)
- ✅ Monitoring/observability additions

**All other changes require:**
1. Change review document
2. Test plan
3. Risk assessment
4. Sign-off

**Rationale:** Any changes during validation could mask or introduce new issues, compromising confidence in the module.

---

## 📌 FINAL SIGN-OFF (Due 2026-03-12)

**After 2-week validation, one of two outcomes:**

### ✅ OUTCOME A: FULLY VALIDATED
```
Module Status: FULLY VALIDATED & PRODUCTION-HARDENED
Lock Level: PERMANENT (no further changes without major incident)
Approval: Sign-off by DevOps Lead
Next Review: 3 months (routine audit)
Confidence: 99%+
```

### ❌ OUTCOME B: ANOMALY DETECTED
```
Module Status: LOCKED FOR REVIEW
Lock Level: TEMP (pending investigation)
Issue: [describe anomaly]
Required Action: Formal change review + testing
Timeline: Resolve within 1 week
Confidence: Reduced (investigation ongoing)
```

---

## 📞 ESCALATION CONTACTS

**Critical Issues (P0):**
- On-call Dev: [escalation contact]
- DevOps Lead: [escalation contact]

**Standard Issues (P1-P2):**
- Notification Module Owner: [owner contact]
- QA Lead: [qa contact]

---

## 🎯 SUCCESS CRITERIA

**Module is "Fully Validated" if ALL are true:**

1. ✅ Zero duplicate notifications (0 found in 2 weeks)
2. ✅ Zero badge mismatch reports (0 user complaints)
3. ✅ <0.5% push delivery failure rate
4. ✅ No race condition symptoms
5. ✅ All dedup warnings work as expected (<100 total)
6. ✅ No increase in support tickets related to notifications
7. ✅ All 5 functions executed at least 10 times each (normal usage)

**If any condition fails:** Return to review stage, analyze root cause.

---

**Lock Timestamp:** 2026-02-26T00:00:00Z  
**Validation Complete Date:** 2026-03-12T23:59:59Z (pending)  
**Module Owner:** Notification Systems Team  
**Approved By:** [QA Lead Sign-off Required]