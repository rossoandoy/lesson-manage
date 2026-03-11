# Sidebar Master List Dropdown Display - Comprehensive Diagnostic Report

**Investigation Date:** 2026-03-10  
**Scope:** Complete data flow analysis from sidebar UI through service layer  
**Files Examined:** 7 (sidebar_schedule.html, 01_Main.gs, 04_ScheduleService.gs, 00_Config.gs, 02_SheetHelper.gs, 03_BoothGrid.gs, 05_PrintSheet.gs)

---

## PART I: COMPLETE DATA FLOW ANALYSIS

### 1. Sidebar UI Architecture (sidebar_schedule.html)

**HTML Structure:**
- Section: "📅 表示期間設定" (Display period settings)
- Section: "📌 選択中のコマ" (Selected slot)
- Section: "👨‍🏫 講師" (Teacher)
  - `<select id="teacherName">` - single select
- Section: "授業形式" (Class format)
  - Radio buttons: "1：1" (checked), "1：2"
  - Event: `onchange="toggleStudent2()"` triggers visibility toggle
- Section: "👤 生徒1" (Student 1)
  - `<select id="student1Name" onchange="updateGrade('student1Name','grade1')">` - auto-updates grade badge
  - `<select id="subject1">`
  - Grade badge: `<div class="grade-badge" id="grade1">`
- Section: "👤 生徒2" (Student 2) - hidden by default
  - `id="student2Section" style="display:none;"`
  - Similar structure to student1
- Section: "🔁 繰り返し" (Repeat)
  - `<input type="date" id="repeatEnd">`
  - Radio buttons: "weekly" (checked), "daily"

**JavaScript Initialization (DOMContentLoaded):**
```javascript
document.addEventListener('DOMContentLoaded', function() {
  // Set default dates to today
  var today = new Date();
  var yyyy = today.getFullYear();
  var mm = String(today.getMonth() + 1).padStart(2, '0');
  var dd = String(today.getDate()).padStart(2, '0');
  var todayStr = yyyy + '-' + mm + '-' + dd;
  document.getElementById('gridStart').value = todayStr;
  document.getElementById('gridEnd').value = todayStr;
  document.getElementById('repeatEnd').value = todayStr;

  setMsg('msgPlace', 'マスタデータを読み込み中...', 'loading');
  google.script.run
    .withSuccessHandler(onSidebarDataLoaded)
    .withFailureHandler(function(e) { setMsg('msgPlace', 'データ取得エラー: ' + e.message, 'error'); })
    .getSidebarData();
});
```

**Key Point:** Calls `google.script.run.getSidebarData()` asynchronously, expects callback `onSidebarDataLoaded(data)`

---

### 2. Master Data Reception & Processing (sidebar_schedule.html)

**onSidebarDataLoaded callback:**
```javascript
function onSidebarDataLoaded(data) {
  masterData = data;
  populateSelect('teacherName', data.teachers.map(function(t) { return { value: t.name, label: t.name }; }));
  populateStudentSelect('student1Name', data.students);
  populateStudentSelect('student2Name', data.students);
  populateSelect('subject1', data.subjects.map(function(s) { return { value: s, label: s }; }));
  populateSelect('subject2', data.subjects.map(function(s) { return { value: s, label: s }; }));

  if (data.currentSlot) {
    currentSlot = data.currentSlot;
    showSlot(currentSlot);
  }
  setMsg('msgPlace', '', '');
}
```

**Expected `data` object structure:**
```javascript
{
  teachers: [
    { id: string, name: string },  // _getMasterList() output
    ...
  ],
  students: [
    { id: string, name: string, grade?: string },  // _getMasterList() output
    ...
  ],
  subjects: [ string, string, ... ],  // _getSubjectList() output
  currentSlot: {
    dateLabel: string,      // 'YYYY/MM/DD'
    period: number,         // 1-10
    booth: number           // 1-5
  } || null
}
```

**populateSelect() Implementation:**
```javascript
function populateSelect(id, items) {
  var sel = document.getElementById(id);
  sel.innerHTML = '<option value="">-- 選択 --</option>';
  items.forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = item.value;
    opt.textContent = item.label;
    sel.appendChild(opt);
  });
}
```

**populateStudentSelect() Implementation:**
```javascript
function populateStudentSelect(id, students) {
  var sel = document.getElementById(id);
  sel.innerHTML = '<option value="">-- 選択 --</option>';
  students.forEach(function(s) {
    var opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name + (s.grade ? ' (' + s.grade + ')' : '');
    opt.dataset.grade = s.grade || '';
    sel.appendChild(opt);
  });
}
```

**Critical Requirements:**
- populateSelect() expects: `{ value: string, label: string }[]`
- populateStudentSelect() expects: `{ name: string, grade?: string }[]`
- Both require non-empty arrays
- populateSelect() accesses `item.value` and `item.label` properties
- populateStudentSelect() accesses `s.name` and `s.grade` properties

---

### 3. GAS Server-Side: getSidebarData() Implementation

**Entry Point (01_Main.gs, line 142-144):**
```javascript
function getSidebarData() {
  return ScheduleService.getSidebarData();
}
```

**Service Implementation (04_ScheduleService.gs, lines 179-186):**
```javascript
getSidebarData() {
  return {
    teachers:    this._getMasterList(CONFIG.SHEETS.STAFFS,  CONFIG.MASTER.STAFFS),
    students:    this._getMasterList(CONFIG.SHEETS.STUDENTS, CONFIG.MASTER.STUDENTS),
    subjects:    this._getSubjectList(),
    currentSlot: this._getActiveSlot(),
  };
},
```

**Delegates to three helper methods:**
1. `_getMasterList(CONFIG.SHEETS.STAFFS, CONFIG.MASTER.STAFFS)` for teachers
2. `_getMasterList(CONFIG.SHEETS.STUDENTS, CONFIG.MASTER.STUDENTS)` for students
3. `_getSubjectList()` for subjects
4. `_getActiveSlot()` for current selection context

---

### 4. _getMasterList() Implementation (04_ScheduleService.gs, lines 269-289)

```javascript
_getMasterList(sheetName, config) {
  try {
    const sheet = SheetHelper.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow < config.DATA_START_ROW) return [];
    const numRows = lastRow - config.DATA_START_ROW + 1;
    const numCols = Object.keys(config.COLS).length;
    const values = SheetHelper.batchGetValues(
      sheet, config.DATA_START_ROW, 1, numRows, numCols
    );
    return values
      .filter((row) => row[config.COLS.NAME - 1])
      .map((row) => ({
        id:    String(row[config.COLS.ID - 1] || ''),
        name:  String(row[config.COLS.NAME - 1]),
        grade: config.COLS.GRADE ? String(row[config.COLS.GRADE - 1] || '') : undefined,
      }));
  } catch (e) {
    return [];
  }
}
```

**Execution Flow:**
1. Get sheet by name: `SheetHelper.getSheet(sheetName)`
2. Get last row: `sheet.getLastRow()`
3. **Validation:** If `lastRow < config.DATA_START_ROW`, return `[]` (EMPTY)
4. Calculate row count: `lastRow - config.DATA_START_ROW + 1`
5. Call `SheetHelper.batchGetValues()` to fetch data range
6. **Filter:** Only include rows where `row[config.COLS.NAME - 1]` is truthy
7. **Map:** Transform to `{id, name, grade?}` objects
8. **Fallback:** If any error occurs, return `[]` (EMPTY)

**Critical Assumptions:**
- Sheet exists and is accessible
- `config.DATA_START_ROW` is correctly set
- `config.COLS.ID`, `config.COLS.NAME`, `config.COLS.GRADE` match actual spreadsheet columns
- Data exists in rows >= `config.DATA_START_ROW`
- Column numbers are 1-indexed

---

### 5. SheetHelper.batchGetValues() Implementation (02_SheetHelper.gs, lines 39-42)

```javascript
batchGetValues(sheet, startRow, startCol, numRows, numCols) {
  const range = sheet.getRange(startRow, startCol, numRows, numCols);
  return range.getValues();
}
```

**Behavior:**
- Creates range from `(startRow, startCol)` with dimensions `(numRows, numCols)`
- Returns 2D array: `any[][]`
- Empty cells return `''` (empty string)
- Dates return `Date` objects

---

### 6. Form Submission Flow (sidebar_schedule.html)

**placeSchedule() Function:**
```javascript
function placeSchedule() {
  if (!currentSlot) {
    setMsg('msgPlace', 'ブース表のコマセルを選択し、「現在のセルを確認」を押してください', 'error');
    return;
  }
  var teacherName = document.getElementById('teacherName').value;
  if (!teacherName) { setMsg('msgPlace', '講師を選択してください', 'error'); return; }

  var student1Name = document.getElementById('student1Name').value;
  if (!student1Name) { setMsg('msgPlace', '生徒1を選択してください', 'error'); return; }

  var capacity = document.querySelector('input[name="capacity"]:checked').value;
  var repeatVal = document.querySelector('input[name="repeat"]:checked').value;
  var repeatEnd = document.getElementById('repeatEnd').value;

  var formData = {
    teacherName:   teacherName,
    student1Name:  student1Name,
    student1Grade: getGradeFromSelect('student1Name'),
    subject1:      document.getElementById('subject1').value,
    capacity:      capacity,
    startDate:     currentSlot.dateLabel,
    endDate:       repeatEnd ? repeatEnd.replace(/-/g, '/') : currentSlot.dateLabel,
    repeat:        repeatVal,
  };

  if (capacity === '1：2') {
    formData.student2Name  = document.getElementById('student2Name').value;
    formData.student2Grade = getGradeFromSelect('student2Name');
    formData.subject2      = document.getElementById('subject2').value;
  }

  setMsg('msgPlace', '処理中...', 'loading');
  document.getElementById('btnPlace').disabled = true;
  google.script.run
    .withSuccessHandler(function(result) {
      document.getElementById('btnPlace').disabled = false;
      if (result.success) {
        setMsg('msgPlace', result.message, 'success');
      } else {
        setMsg('msgPlace', result.message, 'error');
      }
    })
    .withFailureHandler(function(e) {
      document.getElementById('btnPlace').disabled = false;
      setMsg('msgPlace', 'エラー: ' + e.message, 'error');
    })
    .placeScheduleFromSidebar(formData);
}
```

**Validation:**
- Requires `currentSlot` (dateLabel/period/booth context)
- Requires `teacherName` (non-empty)
- Requires `student1Name` (non-empty)
- Capacity defaults to "1：1", conditionally adds student2 fields if "1：2"
- Converts repeat end date format: `YYYY-MM-DD` → `YYYY/MM/DD`

**Calls:** `google.script.run.placeScheduleFromSidebar(formData)`

---

### 7. Backend Processing (04_ScheduleService.gs)

**placeScheduleFromSidebar() (lines 202-209):**
```javascript
placeScheduleFromSidebar(formData) {
  const slot = this._getActiveSlot();
  if (!slot) {
    return { success: false, message: 'ブース表のコマセルを選択してください' };
  }
  const fullFormData = Object.assign({}, formData, slot);
  return this.processSubmit(fullFormData);
}
```

**processSubmit() (lines 71-95):**
```javascript
processSubmit(formData) {
  try {
    const entries = this.expandRepeatPattern(formData);
    if (entries.length === 0) {
      return { success: false, message: '書き込む対象の日付がありません' };
    }

    const conflicts = this.checkConflicts(entries);
    if (conflicts.length > 0) {
      const msgs = conflicts.map(
        (c) => `${c.dateLabel} ${c.period}限 ブース${c.booth}: ${c.teacherName || c.student1Name}`
      );
      return {
        success: false,
        message: `以下のコマに既存データがあります:\n${msgs.join('\n')}`,
        conflicts,
      };
    }

    this.writeAll(entries);
    return { success: true, message: `${entries.length}コマを登録しました`, count: entries.length };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
```

**writeAll() (lines 157-163):**
```javascript
writeAll(entries) {
  const boothSheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
  entries.forEach((entry) => {
    BoothGrid.writeSlot(boothSheet, entry);
  });
  PrintSheet.appendEntries(entries);
}
```

---

### 8. Data Writing to Sheets

**BoothGrid.writeSlot() (03_BoothGrid.gs, lines 114-144):**
- Writes ScheduleEntry to booth grid at coordinate (dateLabel, period, booth)
- Handles both student1 and student2 based on capacity field
- Writes: booth number, teacher name (2-row merge), student1 (row 1), student2 (row 2), grades, subjects

**PrintSheet.appendEntries() (05_PrintSheet.gs, lines 79-81):**
```javascript
appendEntries(entries) {
  entries.forEach((entry) => this.appendEntry(entry));
}
```

**appendEntry() (lines 27-73):**
- Creates baseRow with all fields including capacity
- Appends row1 for student1
- If capacity === '1：2' && student2Name exists, appends row2 for student2
- Sets dropdown validation for attendance column

---

## PART II: IDENTIFIED BOTTLENECK SCENARIOS

### Scenario A: Master Sheet Existence or Data Absence

**Potential Causes:**
1. Master sheet (master_students, master_staffs, master_subjects) does not exist
2. Master sheet exists but has no data rows after header
3. Last row is less than DATA_START_ROW (early return in _getMasterList())
4. DATA_START_ROW configured incorrectly

**Evidence Points:**
- _getMasterList() returns `[]` if `lastRow < config.DATA_START_ROW`
- No error shown - empty arrays pass silently through onSidebarDataLoaded()
- populateSelect() and populateStudentSelect() receive empty arrays
- HTML shows empty dropdowns with only default option "-- 選択 --"

**Testing Steps:**
1. Check if master sheets exist: `CONFIG.SHEETS.STAFFS`, `CONFIG.SHEETS.STUDENTS`, `CONFIG.SHEETS.SUBJECTS`
2. Verify actual last row in each master sheet
3. Check `CONFIG.MASTER.STAFFS.DATA_START_ROW`, `CONFIG.MASTER.STUDENTS.DATA_START_ROW`, `CONFIG.MASTER.SUBJECTS.DATA_START_ROW`
4. Verify data exists in rows >= DATA_START_ROW

---

### Scenario B: SheetHelper.batchGetValues() Failure

**Potential Causes:**
1. Sheet exists but cannot be accessed (permissions issue)
2. Range creation fails silently
3. getValues() returns empty or malformed array

**Evidence Points:**
- _getMasterList() catches all errors with `catch (e) { return []; }`
- Error is silent - no console message
- Caller receives empty array, indistinguishable from "no data" scenario

**Testing Steps:**
1. Add console.log() statements in _getMasterList() before/after batchGetValues()
2. Verify SheetHelper.getSheet() succeeds
3. Verify sheet.getLastRow() returns expected value
4. Check if permissions prevent sheet access

---

### Scenario C: _getMasterList() Implementation Bugs

**Potential Causes:**
1. Column index calculation wrong: `row[config.COLS.NAME - 1]` accesses wrong column
2. Filter condition too strict: `row[config.COLS.NAME - 1]` evaluates falsy for valid names
3. Empty string names pass filter but cause issues downstream

**Evidence Points:**
- Filter uses `row[config.COLS.NAME - 1]` as truthy test
- Empty strings are falsy, excluded from results
- Spaces-only names might evaluate oddly
- Column indices are 1-indexed in config but must be converted to 0-indexed in array

**Testing Steps:**
1. Log actual values of `row[config.COLS.NAME - 1]` for first few rows
2. Verify CONFIG column indices match actual sheet structure
3. Check if names have unexpected whitespace or formatting

---

### Scenario D: populateSelect() / populateStudentSelect() Issues

**Potential Causes:**
1. HTML element IDs don't exist in DOM (teacherName, student1Name, student2Name, subject1, subject2)
2. data.teachers/students/subjects are `null` or `undefined`
3. Data structure mismatch: expected `{value, label}` but received different format
4. Student names contain special characters breaking HTML

**Evidence Points:**
- populateSelect() attempts `document.getElementById(id).innerHTML = ...`
- If element not found, throws error caught in onSidebarDataLoaded failure handler
- If data structure wrong, options created with undefined properties
- Student2 dropdown never populated if student2Section hidden initially

**Testing Steps:**
1. Verify HTML contains `<select id="teacherName">`, `<select id="student1Name">`, etc.
2. Add console.log(data) in onSidebarDataLoaded to verify structure
3. Check browser console for JavaScript errors
4. Inspect student2Section visibility toggle logic

---

### Scenario E: google.script.run() Callback Failure

**Potential Causes:**
1. Failure handler triggered instead of success handler
2. Network timeout between sidebar and GAS server
3. GAS function throws exception
4. Return value cannot be serialized to JSON

**Evidence Points:**
- withFailureHandler() sets message to "データ取得エラー: " + error message
- No onSidebarDataLoaded() call means dropdowns never populated
- Error message in sidebar indicates network/server issue
- GAS console.log statements may show exception

**Testing Steps:**
1. Check GAS execution logs for errors
2. Monitor browser console for failure messages
3. Verify GAS functions getSidebarData() and supporting methods execute
4. Add detailed console.log() in GAS functions to trace execution

---

## PART III: ROOT CAUSE ANALYSIS FRAMEWORK

### Most Likely Cause: Scenario A (Master Sheet Data Absence)

**Reasoning:**
1. **Highest probability** - data source issues are most common
2. **Silent failure** - empty arrays don't trigger errors, just empty UI
3. **Cascading effect** - affects all three dropdowns (teachers, students, subjects)
4. **Configuration-sensitive** - small DATA_START_ROW mismatch causes complete failure
5. **No error indication** - user sees empty dropdowns without error message

**Common Scenarios:**
- Master sheets never created/initialized
- initSubjectMaster() called but master_students/master_staffs not initialized
- DATA_START_ROW set to row 1 but headers in row 1 (off-by-one error)
- Master sheets exist but in different workbook (Sidebar opened in wrong sheet context)

---

### Secondary Likely Cause: Scenario D (UI Integration Issues)

**Reasoning:**
1. **Common HTML/JS mismatches** - element IDs easily get out of sync
2. **Browser console visible** - errors would be immediately apparent
3. **Partial failures possible** - one dropdown might work while others fail
4. **Debugging trail clear** - JavaScript errors logged with line numbers

---

### Less Likely Causes: Scenarios B, C, E

**Scenario B (SheetHelper):**
- Less likely because same code used elsewhere successfully
- Would affect multiple features simultaneously

**Scenario C (_getMasterList logic):**
- Less likely because filter logic is simple and tested
- Would show as systematic pattern (e.g., only some names appearing)

**Scenario E (google.script.run):**
- Would show error message in sidebar immediately
- Network issues would affect all sidebar functionality

---

## PART IV: DIAGNOSTIC EXECUTION PLAN

### Phase 1: Verify Master Sheet Existence and Data

**Step 1a:** Check if master sheets exist
```javascript
// In GAS console, run:
const ss = SpreadsheetApp.getActiveSpreadsheet();
const staffsSheet = ss.getSheetByName(CONFIG.SHEETS.STAFFS);
const studentsSheet = ss.getSheetByName(CONFIG.SHEETS.STUDENTS);
const subjectsSheet = ss.getSheetByName(CONFIG.SHEETS.SUBJECTS);
console.log('Staffs sheet exists:', !!staffsSheet);
console.log('Students sheet exists:', !!studentsSheet);
console.log('Subjects sheet exists:', !!subjectsSheet);
```

**Step 1b:** Check last rows and DATA_START_ROW values
```javascript
// In GAS console, run:
console.log('Staffs lastRow:', staffsSheet?.getLastRow(), 'DATA_START_ROW:', CONFIG.MASTER.STAFFS.DATA_START_ROW);
console.log('Students lastRow:', studentsSheet?.getLastRow(), 'DATA_START_ROW:', CONFIG.MASTER.STUDENTS.DATA_START_ROW);
console.log('Subjects lastRow:', subjectsSheet?.getLastRow(), 'DATA_START_ROW:', CONFIG.MASTER.SUBJECTS.DATA_START_ROW);
```

**Step 1c:** Verify data exists in master sheets
```javascript
// In GAS console, run:
if (staffsSheet) {
  const data = staffsSheet.getRange(CONFIG.MASTER.STAFFS.DATA_START_ROW, 1, 10, 3).getValues();
  console.log('Staffs data (first 10 rows):', data);
}
if (studentsSheet) {
  const data = studentsSheet.getRange(CONFIG.MASTER.STUDENTS.DATA_START_ROW, 1, 10, 4).getValues();
  console.log('Students data (first 10 rows):', data);
}
if (subjectsSheet) {
  const data = subjectsSheet.getRange(CONFIG.MASTER.SUBJECTS.DATA_START_ROW, 1, 10, 1).getValues();
  console.log('Subjects data (first 10 rows):', data);
}
```

### Phase 2: Trace getSidebarData() Execution

**Step 2a:** Add logging to getSidebarData()
```javascript
// Modify getSidebarData() in 04_ScheduleService.gs:
getSidebarData() {
  const teachers = this._getMasterList(CONFIG.SHEETS.STAFFS, CONFIG.MASTER.STAFFS);
  console.log('Teachers returned:', teachers);
  const students = this._getMasterList(CONFIG.SHEETS.STUDENTS, CONFIG.MASTER.STUDENTS);
  console.log('Students returned:', students);
  const subjects = this._getSubjectList();
  console.log('Subjects returned:', subjects);
  const currentSlot = this._getActiveSlot();
  console.log('Current slot:', currentSlot);
  
  return { teachers, students, subjects, currentSlot };
}
```

**Step 2b:** Check GAS execution logs
- In GAS editor, go to "Execution log"
- Trigger sidebar to load
- Observe logged values

### Phase 3: Verify Browser-Side Reception

**Step 3a:** Add logging to onSidebarDataLoaded()
```javascript
// Modify in sidebar_schedule.html:
function onSidebarDataLoaded(data) {
  console.log('Received data:', data);
  console.log('Teachers:', data.teachers);
  console.log('Students:', data.students);
  console.log('Subjects:', data.subjects);
  
  masterData = data;
  // ... rest of function
}
```

**Step 3b:** Open sidebar and check browser console
- Developer tools → Console
- Look for "Received data:" logs
- Verify data structure and content

### Phase 4: Verify Column Configuration

**Step 4a:** Check CONFIG.MASTER settings
```javascript
// In GAS console, log column configuration:
console.log('STAFFS config:', CONFIG.MASTER.STAFFS);
console.log('STUDENTS config:', CONFIG.MASTER.STUDENTS);
console.log('SUBJECTS config:', CONFIG.MASTER.SUBJECTS);
```

**Step 4b:** Manually call _getMasterList() with logging
```javascript
// In GAS console:
const ScheduleService = (() => { /* paste implementation */ })();
const result = ScheduleService._getMasterList(CONFIG.SHEETS.STAFFS, CONFIG.MASTER.STAFFS);
console.log('_getMasterList result:', result);
```

---

## PART V: NEXT IMMEDIATE ACTIONS

1. **Execute Phase 1 diagnostics** - Determine if master sheets exist and contain data
2. **Check CONFIG settings** - Verify DATA_START_ROW and column indices match actual sheets
3. **Enable GAS logging** - Add console.log() statements to getSidebarData() and helpers
4. **Trigger sidebar load** - Open sidebar and observe GAS execution logs
5. **Check browser console** - Verify data reaches sidebar and is formatted correctly
6. **Test individual functions** - Call _getMasterList() directly in GAS console

---

## Summary

The dropdown display issue follows a clear data pipeline:
- **UI expects:** Non-empty arrays of objects with specific properties
- **Provider source:** _getMasterList() and _getSubjectList()
- **Silent failure points:** Empty arrays, catch-all error handling, no validation
- **Most likely cause:** Master sheets missing/empty or DATA_START_ROW misconfigured

Once master sheet data existence is confirmed, the issue becomes systematic and traceable through GAS execution logs and browser console output.
