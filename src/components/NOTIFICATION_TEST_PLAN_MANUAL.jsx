# Manual Testing Plan: Notification System

**Test Scope:** All modules, all user roles, all devices  
**Estimated Duration:** 8-10 hours (thorough)  
**Prerequisites:** Test school setup with 3+ students, 2+ teachers, 1 admin

---

## QUICK REFERENCE: 5 CRITICAL TESTS

| ID | Name | Issue | Duration |
|----|------|-------|----------|
| TC-1.1 | Notice to All + Duplicate Check | Race Condition | 20 min |
| TC-2.2 | Per-Item Diary Read | Per-item tracking | 15 min |
| TC-5.3 | Mark All Messages Read | Message Sync Missing | 15 min |
| TC-6.1 | Badge After Refresh | Badge accuracy | 10 min |
| TC-7.2 | Push Delivery to Staff | Staff push missing | 15 min |

---

## QUICK TEST FLOW (1 hour minimum)

**If you have limited time, run these 5 tests in this order:**

1. **TC-1.1** (20 min): Publish notice, verify all students get 1 notification (not duplicates)
2. **TC-2.2** (15 min): Open one diary, verify only that diary marked read
3. **TC-5.3** (15 min): Mark all messages read, verify both Message and Notification entities updated
4. **TC-6.1** (10 min): Refresh page, badge should show same count
5. **TC-7.2** (15 min): Minimize app, publish notice, desktop notification should appear

**Total time:** ~75 minutes (covers all 4 critical issues)

---

## FULL TEST MATRIX

### TC-1.1: Notice Publication + Duplicate Prevention ⭐⭐⭐ CRITICAL
**Duration:** 20 minutes  
**Tests:** Critical Issue #1 (Race Condition)

**Setup:**
- Admin account ready
- 3 students enrolled in various classes

**Steps:**
```
1. Admin logs in
2. Navigate to Notices → Create Notice
3. Title: "Duplicate Test Notice"
4. Target Audience: "All"
5. Publish
6. Wait 2 seconds
7. Verify: Each student sees 1 unread notification
8. Check Database:
   SELECT COUNT(*) FROM Notification 
   WHERE related_entity_id = '{notice_id}' 
   AND type = 'notice_posted'
   Expected: 3 (one per student)
```

**Verification:**
- [ ] Student 1: Badge = 1
- [ ] Student 2: Badge = 1
- [ ] Student 3: Badge = 1
- [ ] DB count = 3 (not 6, not 9)
- [ ] Network tab: Only 1 publish request

**Pass Criteria:**
✅ Each student has exactly 1 notification for this notice

**Fail Indicators:**
❌ Badge shows 2+ for same notice
❌ DB shows 6+ notifications for notice_id

---

### TC-2.2: Per-Item Diary Read Tracking ⭐⭐⭐ CRITICAL
**Duration:** 15 minutes  
**Tests:** Per-item read tracking (applies to Notices, Diary, Quiz)

**Setup:**
- Teacher publishes 2 different diaries to Class 1A
- Both unread for Student 1

**Steps:**
```
1. Student 1 logs in
2. Navigate to Diary
3. Note: 2 unread diary cards
4. Badge shows: 2
5. Click on Diary #1 to open it
6. Watch badge → Should change to 1
7. Close diary
8. Verify: Diary #1 has no unread indicator, Diary #2 still unread
```

**DB Verification:**
```sql
-- For Diary 1: should be marked as read
SELECT is_read FROM Notification 
WHERE related_entity_id = '{diary1_id}' 
AND recipient_student_id = 's001'
Expected: true

-- For Diary 2: should still be unread
SELECT is_read FROM Notification 
WHERE related_entity_id = '{diary2_id}' 
AND recipient_student_id = 's001'
Expected: false
```

**Pass Criteria:**
✅ Badge decrements correctly
✅ Only clicked item marked as read
✅ Other items remain unread

**Fail Indicators:**
❌ Badge doesn't change when opening diary
❌ Both diaries marked as read (batch operation bug)

---

### TC-5.3: Mark All Messages Read ⭐⭐⭐ CRITICAL
**Duration:** 15 minutes  
**Tests:** Critical Issue #4 (Message Notification Sync)

**Setup:**
- Teacher sends 3 separate messages to Student 1
- All 3 unread

**Steps:**
```
1. Student 1 logs in
2. Navigate to StudentMessaging
3. Tab: "Inbox"
4. Should show 3 unread messages
5. Badge shows: 3
6. Click "Mark All as Read" button
7. Verify: All messages lose unread indicator
8. Badge should now be: 0
```

**CRITICAL: Both Entities Must Be Updated**

**DB Verification:**
```sql
-- Message entity should be marked read
SELECT COUNT(*) FROM Message 
WHERE recipient_id = 's001' 
AND is_read = false
Expected: 0

-- Notification entity should ALSO be marked read
SELECT COUNT(*) FROM Notification 
WHERE recipient_student_id = 's001' 
AND type = 'class_message' 
AND is_read = false
Expected: 0
```

**Pass Criteria:**
✅ Badge goes to 0
✅ All message cards lose unread indicator
✅ Both Message.is_read AND Notification.is_read = true

**Fail Indicators:**
❌ Badge shows 0 but message notification still shows unread (Issue #4)
❌ Only Message entity updated, Notification ignored
❌ Badge calculation still shows 3

**This is the most critical test for message notifications.**

---

### TC-6.1: Badge Accuracy After Page Refresh ⭐⭐ IMPORTANT
**Duration:** 10 minutes  
**Tests:** Badge count persistence

**Setup:**
- Student 1 has unread items across modules:
  - 2 unread notices
  - 1 unread diary
  - 3 unread messages

**Steps:**
```
1. Student 1 opens app
2. Note badge counts:
   - Notices: 2
   - Diary: 1
   - Messages: 3
3. Press F5 to refresh page
4. Wait for app to fully load
5. Verify badge counts match
```

**Pass Criteria:**
✅ Badge counts same before and after refresh
✅ No flicker to 0 then back up
✅ Counts accurate (not doubled)

**Fail Indicators:**
❌ Badge resets to 0 after refresh
❌ Badge shows 2x count (duplication)

**Performance Check:**
⏱️ Badge should load within 2 seconds
Check Network tab → Badge query should take <500ms

---

### TC-7.2: Push Notification Delivery to Student ⭐⭐ IMPORTANT
**Duration:** 15 minutes  
**Tests:** Push notifications work

**Setup:**
- Student 1: PWA installed and open
- Browser permission granted for notifications
- Push token registered in DB

**Steps:**
```
1. Student 1: Minimize app (but keep browser open)
2. Teacher 1 (different browser): Publish Notice
3. Watch Student 1's desktop for system notification
4. Expect: OS-level notification appears
5. Click notification → Should open app to Notices page
```

**Pass Criteria:**
✅ System notification appears within 3 seconds
✅ Notification title shows notice subject
✅ Clicking opens Notices page

**Fail Indicators:**
❌ No notification appears
❌ Notification appears but click doesn't work
⚠️ This indicates Issue #3 (Staff push definitely not working)

---

### TC-8.4: Concurrent Publishes (Stress Test) ⭐ MEDIUM
**Duration:** 15 minutes  
**Tests:** Race condition with duplicate prevention

**Setup:**
- 2 teachers ready
- Same class

**Steps:**
```
1. Browser Tab 1: Teacher 1 logged in
2. Browser Tab 2: Teacher 2 logged in
3. Tab 1: Navigate to Create Quiz
4. Tab 2: Navigate to Create Quiz
5. Tab 1: Fill form, publish quiz for Class 1A
6. Wait 1 second
7. Tab 2: Fill same form, publish quiz for Class 1A
8. Student 1: Check badges/list
```

**Pass Criteria:**
✅ Student sees 2 separate quizzes
✅ Badge shows 2
✅ No quiz duplicated

**Fail Indicators:**
❌ Badge shows 4 (duplicate notifications)
❌ Same quiz appears twice in list

---

## EDGE CASE TESTS (Optional but Important)

### TC-8.1: Logout/Login Preserves Unread
```
1. Student 1: Receive message, don't open it
2. Verify unread in list
3. Logout
4. Login
Expected: Message still unread, badge accurate
```

### TC-6.4: Multi-Tab Badge Sync
```
1. Student 1: Open 2 tabs of app
2. Tab A (Messaging): Open message, mark as read
3. Tab B (Quiz): Watch message badge
Expected: Tab B message badge updates automatically
```

---

## STAFF-SPECIFIC TESTS

### TC-9.3: Quiz Submission Notification
```
1. Student 1: Submit quiz
2. Teacher 1: Check dashboard/notifications
Expected: Teacher gets notification "Quiz submitted by Student 1"
Risk: Staff push notifications not implemented (Issue #3)
```

---

## FINAL CHECKLIST

**Before Testing:**
- [ ] DB reset or clean test data
- [ ] All users created
- [ ] No network throttling (unless testing slow network)
- [ ] Push notifications enabled if testing push
- [ ] Console open (DevTools) to catch errors

**During Testing:**
- [ ] Screenshot failures
- [ ] Note exact steps to reproduce issues
- [ ] Check Network and Console tabs for errors
- [ ] Record timings for performance tests

**After Testing:**
- [ ] Document pass/fail for each test case
- [ ] Create issues for failures
- [ ] Estimate severity (Critical/High/Medium)
- [ ] Suggest fixes based on code analysis

---

## SAMPLE TEST RESULT

```
TEST RESULT SUMMARY
===================

✅ PASSED (13/15 tests)
❌ FAILED (2/15 tests)

CRITICAL ISSUES FOUND:
1. TC-5.3 FAILED: Message notification not updating
   - When marking all messages as read, Notification entity not synced
   - Badge stays at 3 even though messages marked as read
   - Root cause: StudentMessaging.markAllInboxRead() only updates Message, not Notification

2. TC-7.2 FAILED: No staff push notification
   - When student sends message, teacher gets no push
   - DB notification created, but no push delivery code
   - Root cause: notifyStaffOnStudentMessage lacks push delivery logic

RECOMMENDATION:
- Fix TC-5.3 immediately (per Critical Issue #4)
- Fix TC-7.2 immediately (per Critical Issue #3)
- Fix race condition in TC-1.1 with DB unique constraint
- Run full test suite again after fixes
``