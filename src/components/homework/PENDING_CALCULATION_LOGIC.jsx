# Pending Count Calculation Logic

## Current Implementation in HomeworkSubmissions

### Algorithm
```javascript
const uniqueStudents = new Map();
submissions.forEach(s => {
  const normalized = normalizeHomeworkSubmissionStatus(s.status);
  uniqueStudents.set(s.student_id, normalized);
});

const totalUniqueSubmitted = uniqueStudents.size;
const pending = Math.max(0, 30 - totalUniqueSubmitted); // Fallback: 30 students per class
```

## Logic Explanation

1. **Map of unique students**: Each submission record is indexed by `student_id`
2. **Count submitted**: `totalUniqueSubmitted = uniqueStudents.size` (unique count)
3. **Calculate pending**: `assigned - submitted`
   - Assigned students = 30 (fallback estimate)
   - Submitted students = unique students with ANY submission status
   - Pending = assigned - submitted

## Limitations & Future Improvements

### Current Limitation
- Uses fallback of 30 students per class
- Does not dynamically count actual assigned students in the homework's class/section

### To Improve
Would need to:
1. Query `Student` entity for the homework's `class_name` and `section`
2. Filter out deleted/inactive students (`is_deleted !== true`, `is_active === true`)
3. If `section === "All"`, include ALL sections in that class
4. Count: assigned active students for that class+section
5. Then: `pending = assignedCount - uniqueStuditted.size`

### Example Query Pattern (pseudo-code)
```javascript
// Get assigned students for this homework
const assignedStudents = await base44.asServiceRole.entities.Student.filter({
  class_name: homework.class_name,
  section: homework.section === 'All' ? { $exists: true } : homework.section,
  is_deleted: { $ne: true },
  is_active: true
});

const assignedCount = assignedStudents.length;
const pending = Math.max(0, assignedCount - totalUniqueSubmitted);
```

## Notes
- Section "All" in homework means it applies to ALL sections in that class
- Deleted students should never be counted in pending
- Only active students are counted as assigned

## Status
**PATCH**: Temporary fallback of 30 students implemented for production stability.
**TODO**: Replace with actual student count query in next phase.