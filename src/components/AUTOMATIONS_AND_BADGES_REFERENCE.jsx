# AUTOMATIONS & BADGES COMPLETE REFERENCE

**Documentation Date:** 2026-02-26  
**Scope:** All automations, notifications, badges, push notifications

---

## AUTOMATIONS SUMMARY

| Automation | Trigger | Action | Created Notification | Push Sent To |
|---|---|---|---|---|
| notifyStudentsOnNoticePublish | Notice.status = "Published" | Create `notice_posted` for each student | ✅ Yes | Students |
| notifyStaffOnNoticePublish | Notice.status = "Published" | Create `notice_posted_staff` for staff | ✅ Yes | Staff |
| notifyStudentsOnDiaryPublish | Diary.status = "Published" | Create `diary_published` for class | ✅ Yes | Students |
| notifyStudentsOnMarksPublish | Marks.status = "Published" | Create `marks_published` for class | ✅ Yes | Students |
| notifyStudentsOnQuizSubmission | QuizAttempt.created | Create `quiz_submitted` for teacher | ✅ Yes | Teacher |
| notifyStaffOnStudentMessage | Message.created (student→teacher) | Create `student_message` in staff inbox | ✅ Yes | Staff |
| cleanupOldNotifications | Weekly (Mon 2 AM UTC) | Delete read 90+ day old notifications | N/A | N/A |

---

## NOTIFICATION AUTOMATIONS (DETAILED)

### Automation 1: Notice Published to Students

**Trigger:** `Notice.status = "Published"` AND `target_audience` includes "Students"

**Affected Records:**
- Check: `target_classes` (if provided) OR use all classes
- Query: Student where class in target_classes, academic_year=current

**Notification Created:**
```javascript
{
  type: "notice_posted",
  title: "[Notice Title]",
  message: "New [Type] notice published",
  recipient_student_id: each_student.student_id,
  recipient_name: each_student.name,
  related_entity_id: notice.id,
  action_url: "/notices",
  is_read: false,
  academic_year: notice.academic_year,
  duplicate_key: "notice_" + notice.id + "_" + student_id
}
```

**Deduplication:**
- Check if Notification exists with same duplicate_key
- If yes: Skip (idempotent)
- If no: Create

**Push Notification:**
```
IF StudentNotificationPreference.browser_push_enabled = true
THEN Send: "[Notice Type]: [Title]"
```

**Badge Updates:**
- StudentBottomNav: Notices badge increases

---

### Automation 2: Notice Published to Staff

**Trigger:** `Notice.status = "Published"` AND `target_audience` includes "Staff" OR "Teachers"

**Affected Records:**
- Query: All StaffAccount where is_active=true, role in ["Teacher", "Principal", "Staff"]

**Notification Created:**
```javascript
{
  type: "notice_posted_staff",
  title: "[Notice Title]",
  message: "New [Type] notice posted",
  recipient_staff_id: staff.email,
  recipient_name: staff.full_name,
  related_entity_id: notice.id,
  action_url: "/notices",
  is_read: false,
  academic_year: notice.academic_year,
  duplicate_key: "notice_staff_" + notice.id + "_" + staff.email
}
```

**Push Notification:**
```
IF StaffNotificationPreference.browser_push_enabled = true
THEN Send: "[Notice Type]: [Title]"
```

---

### Automation 3: Diary Published to Students

**Trigger:** `Diary.status = "Published"`

**Affected Records:**
- Query: Student where class_name=diary.class_name, section=diary.section, academic_year=current

**Notification Created:**
```javascript
{
  type: "diary_published",
  title: "New Diary: [Diary Title]",
  message: "[Teacher Name] posted a diary entry",
  recipient_student_id: each_student.student_id,
  recipient_name: each_student.name,
  related_entity_id: diary.id,
  action_url: "/diary",
  is_read: false,
  academic_year: diary.academic_year,
  duplicate_key: "diary_" + diary.id + "_" + student_id
}
```

**Push Notification:**
```
IF StudentNotificationPreference.browser_push_enabled = true
THEN Send: "New Diary: [Title]"
Tap → Opens Diary page
```

**Badge Updates:**
- StudentBottomNav: Diary badge increases

---

### Automation 4: Marks Published to Students

**Trigger:** `Marks.status = "Published"` (bulk for all students in class for exam)

**Affected Records:**
- Query: Student where class_name=exam.class_name, section=exam.section, academic_year=current
- For each: Get their marks for this exam

**Notification Created:**
```javascript
{
  type: "marks_published",
  title: "Results Published",
  message: "Your marks for [Exam Type] have been published",
  recipient_student_id: each_student.student_id,
  recipient_name: each_student.name,
  related_entity_id: exam_type_id, // Or first marks ID
  action_url: "/results",
  is_read: false,
  academic_year: marks.academic_year,
  duplicate_key: "marks_" + exam_type_id + "_" + class + "_" + student_id
}
```

**Deduplication:**
- Check if notification exists for this exam/class/student
- If yes: Skip
- If no: Create

**Push Notification:**
```
IF StudentNotificationPreference.browser_push_enabled = true
THEN Send: "Results Published - [Exam Name]"
Tap → Opens Results page
```

**Badge Updates:**
- StudentBottomNav: Results badge increases

---

### Automation 5: Quiz Submitted by Student

**Trigger:** `QuizAttempt.created` (student submits quiz)

**Affected Records:**
- Query: Teacher who created quiz

**Notification Created (to teacher):**
```javascript
{
  type: "quiz_submitted",
  title: "[Student Name] submitted quiz: [Quiz Title]",
  message: "Student submission ready for review",
  recipient_staff_id: teacher.email,
  recipient_name: teacher.name,
  related_entity_id: quiz_attempt.id,
  action_url: "/quiz/attempt/" + attempt_id,
  is_read: false,
  academic_year: attempt.academic_year,
  duplicate_key: "quiz_" + attempt_id + "_" + teacher_email
}
```

**Push Notification (to teacher):**
```
IF StaffNotificationPreference.browser_push_enabled = true
THEN Send: "[Student Name] submitted [Quiz Title]"
Tap → Opens Quiz Attempt page
```

**Badge Updates:**
- Teacher: Unread quiz submission count increases
- Dashboard shows pending submissions

---

### Automation 6: Message from Student to Staff

**Trigger:** `Message.created` where sender_role="student" AND recipient is staff

**Affected Records:**
- recipient_id = teacher.email (if individual message)
- OR all staff in classes_assigned (if class message)

**Notification Created:**
```javascript
{
  type: "student_message",
  title: "[Student Name] sent a message",
  message: "[Message preview]",
  recipient_staff_id: teacher.email,
  recipient_name: teacher.name,
  related_entity_id: message.id,
  action_url: "/messages",
  is_read: false,
  academic_year: message.academic_year,
  duplicate_key: "msg_" + message.id + "_" + teacher.email
}
```

**Push Notification:**
```
IF StaffNotificationPreference.browser_push_enabled = true
THEN Send: "[Student Name]: [Preview]"
Tap → Opens Messages page
```

**Badge Updates:**
- Teacher: Unread message count increases

---

## SCHEDULED AUTOMATION: NOTIFICATION CLEANUP

**Schedule:** Every Monday 2 AM UTC (7:30 AM IST in Asia/Calcutta timezone)

**Function:** `cleanupOldNotifications` (backend)

**Logic:**
```javascript
1. Query notifications to delete:
   WHERE is_read = true
     AND created_date < (today - 90 days)
     AND academic_year != current_academic_year
   
2. Get count: How many notifications match?

3. Safety check:
   IF count <= 1000 {
     RETURN { status: "skipped", reason: "Below threshold" }
   }
   
4. Delete the notifications:
   DELETE WHERE condition above
   
5. Log action:
   AuditLog.create({
     action: "cleanup",
     module: "Notifications",
     details: "Deleted " + count + " old notifications",
     performed_by: "system",
     academic_year: current_year
   })
   
6. RETURN { status: "success", deleted_count: count }
```

**Safeguards:**
```javascript
// NEVER delete:
- Unread notifications (is_read = false)
- Current academic year notifications
- Notifications from last 90 days

// ONLY delete if:
- Count of deletable > 1000 threshold
- Status is confirmed as "success"
```

**Manual Trigger (Admin):**
- Admin can click "Cleanup Notifications" on dashboard
- Shows count of notifications to delete
- Confirmation dialog
- Executes same logic
- Shows result (deleted count)

**Admin-Only Access:**
```javascript
// Backend function checks:
const user = await base44.auth.me();
if (user?.role !== 'admin') {
  return { status: 403, error: 'Forbidden: Admin access required' }
}
// Only admin can trigger
```

---

---

## BADGE SYSTEM (STUDENT)

### Badge Locations
```
StudentBottomNav (fixed at bottom):
- Notices: Shows unread notice count
- Gallery: No badge
- Calendar: No badge
- Diary: Shows unread diary count
- Results: Shows unread marks count
- More: Shows message + notification count (combined)
```

### Badge Increment (What Increases Count)

| Badge | Increases When | Notification Type |
|---|---|---|
| Notices | Notice published to student's class | `notice_posted` |
| Diary | Diary published to student's class | `diary_published` |
| Results | Marks published | `marks_published` |
| Messages | Message received from teacher | `student_message`, `class_message` |
| More (General) | Any notification created | All types |

### Badge Decrement (What Decreases Count)

| Badge | Decreases When |
|---|---|
| Notices | Student marks notice as read (taps it) |
| Diary | Student marks diary as read |
| Results | Student marks results as read |
| Messages | Student marks message as read |
| More (General) | Student marks notification as read |

### Badge Clearing

```javascript
// When user taps notification:
1. Notification.is_read = true
2. Badge count query re-runs:
   WHERE recipient_student_id = student_id
     AND is_read = false
3. New count = count() [decreases by 1]
4. UI updates badge

// When user deletes notification:
1. Notification deleted
2. Badge count query re-runs
3. Count decreases
```

---

## BADGE SYSTEM (TEACHER/ADMIN)

### Teacher Dashboard Badges
```
Messages: Shows unread message count
Notifications: Shows unread notification count
Pending Approvals: Show by type (if applicable)
```

### Admin Dashboard Badges
```
Pending Marks: Count of submitted marks awaiting approval
Pending Attendance: Count of submitted attendance awaiting approval
Pending Notices: Count of submitted notices awaiting approval
Pending Gallery: Count of pending photos
Messages: Unread message count
Notifications: Unread notification count
```

### Badge Update Trigger
```javascript
// Real-time subscription
base44.entities.Notification.subscribe((event) => {
  if (event.type === 'create') {
    // Badge count increases
  } else if (event.type === 'update' && event.data.is_read === true) {
    // Badge count decreases
  }
})

// OR polling every 30 seconds:
setInterval(() => {
  fetchPendingApprovals();
  fetchUnreadNotifications();
}, 30000);
```

---

## PUSH NOTIFICATION SYSTEM

### Prerequisites
```
1. Service Worker registered (initServiceWorker function)
2. VAPID_PRIVATE_KEY secret configured
3. User has browser_push_enabled = true in preference
4. User has granted browser push notification permission
```

### User Opt-In Flow
```javascript
1. Student/Staff opens browser
2. App requests permission:
   Notification.requestPermission()
3. User grants or denies
4. If granted:
   - Register service worker
   - Generate VAPID token (push subscription)
   - Save to StudentNotificationPreference.browser_push_token
5. If denied:
   - No push notifications sent
```

### Push Notification Trigger

When automation sends notification, backend also:
```javascript
1. Check: StudentNotificationPreference.browser_push_enabled = true
2. Check: browser_push_token exists
3. Call: sendStudentPushNotification or sendStaffPushNotification
4. Send via: VAPID subscription + FCM (if configured)
```

### Push Notification Message Templates

```javascript
// Notice Published
"[Notice Type]: [Title]"
Example: "Exam: Mid-Term Exam Postponed"

// Diary Published
"New Diary: [Title]"
Example: "New Diary: Chapter 5 Review"

// Marks Published
"Results Published - [Exam Name]"
Example: "Results Published - Summative Assessment 1"

// Quiz Submitted (to teacher)
"[Student Name] submitted [Quiz Title]"
Example: "Aman Kumar submitted Math Quiz 3"

// Message from Student
"[Student Name]: [Message preview]"
Example: "Aman Kumar: Can you clarify this problem?"

// Message from Teacher
"[Teacher Name]: [Message preview]"
Example: "Ms. Smith: Assignment due tomorrow"
```

### Push Notification Display
```javascript
// When clicked (tap):
→ Open notification.action_url
→ e.g., "/notices", "/diary", "/results", "/messages"

// If app is closed:
→ Open app and navigate to URL

// If app is open:
→ Navigate to URL and bring app to foreground
```

---

## DEDUPLICATION SYSTEM

### Duplicate Key Strategy
```javascript
// Pattern: entity_type_entity_id_recipient_id

// Examples:
"notice_12345_S001"           // Notice 12345 for student S001
"diary_67890_S002"            // Diary 67890 for student S002
"marks_99999_12345_S001"      // Marks for class/exam 12345, student S001
"quiz_55555_user@email.com"   // Quiz submission for teacher
"msg_77777_user@email.com"    // Message for teacher
```

### Implementation
```javascript
ON create_notification:
  1. Generate duplicate_key = entity_type + "_" + entity_id + "_" + recipient_id
  2. Query: Notification where duplicate_key = generated_key
  3. IF found AND is_read = false:
     SKIP creation (already notified, not read yet)
  4. ELSE IF found AND is_read = true:
     DELETE old notification (allow new one)
  5. CREATE new notification
```

### Result
```
No duplicate unread notifications
If user reads notification then deletes it, can get notified again later
Prevents notification spam
```

---

## NOTIFICATION PREFERENCES

### Student Preferences
```javascript
StudentNotificationPreference:
  - browser_push_enabled: bool
  - browser_push_token: string (VAPID subscription JSON)
  
(All students receive all notifications by default)
(User can toggle browser_push_enabled on/off)
```

### Staff Preferences
```javascript
StaffNotificationPreference:
  - browser_push_enabled: bool
  - browser_push_token: string (VAPID subscription JSON)
  - notify_on_student_message: bool (default: true)
  - notify_on_quiz_submission: bool (default: true)
  - notify_on_homework_submission: bool (default: true)
  - notify_on_notice: bool (default: true)
  
(Staff can customize which events trigger notifications)
```

---

## REAL-TIME UPDATES

### Subscriptions Used
```javascript
// Notifications
base44.entities.Notification.subscribe((event) => {
  // event.type: 'create', 'update', 'delete'
  // event.data: Full notification data
  // Updates badge counts in real-time
})

// Messages
base44.entities.Message.subscribe((event) => {
  // Updates message list
  // Updates badge count
})

// Marks
base44.entities.Marks.subscribe((event) => {
  // Updates marks table
  // Updates pending approval count
})

// Attendance
base44.entities.Attendance.subscribe((event) => {
  // Updates attendance table
  // Updates pending approval count
})
```

### Polling Fallback
```javascript
// If real-time subscriptions unavailable:
setInterval(() => {
  refetchQueries(['notifications', 'unread-count', 'pending-approvals']);
}, 30000); // Every 30 seconds
```

---

## FAILURE HANDLING

### Push Notification Failure
```javascript
TRY {
  Send push notification
} CATCH (error) {
  Log error (non-blocking)
  // Notification still created in database
  // User can see it when they open app
}
```

### Notification Creation Failure (Race Condition)
```javascript
TRY {
  Check duplicate_key
  IF exists: SKIP
  ELSE: CREATE
} CATCH (error) {
  // Possible race condition (two requests simultaneously)
  IF error.code === 'DUPLICATE_KEY_ERROR' {
    Log as race condition (safe)
  } ELSE {
    Throw error
  }
}
```

---

**All automations, badges, and push notifications documented. Production-ready.**