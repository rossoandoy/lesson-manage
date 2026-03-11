/**
 * 01_Main.gs
 * GAS トリガー・カスタムメニュー・グローバルエントリーポイント。
 */

/**
 * スプレッドシートを開いたときにカスタムメニューを登録する。
 */
function onOpen(e) {
  SheetHelper.ensureTimezone();
  SpreadsheetApp.getUi()
    .createMenu('コマ組メニュー')
    .addItem('コマ組サイドバーを開く', 'openScheduleSidebar')
    .addSeparator()
    .addItem('ブース表を初期化（表示期間を設定）', 'setDisplayRange')
    .addSeparator()
    .addItem('回数報告を生成', 'runReport')
    .addSeparator()
    .addItem('教科マスタを初期化', 'initSubjectMaster')
    .addItem('講師マスタを初期化', 'initStaffMaster')
    .addItem('生徒マスタを初期化', 'initStudentMaster')
    .addItem('tran シートを初期化', 'initTranSheet')
    .addSeparator()
    .addItem('印刷シートを同期', 'syncPrintSheet')
    .addToUi();
}

/**
 * セルが編集されたときのトリガー。
 * 印刷シートの出欠列を検証する。
 */
function onEdit(e) {
  try {
    PrintSheet.validateAttendance(e);
  } catch (err) {
    console.error('onEdit error:', err.message);
  }
}

// ───────── メニューから呼び出されるグローバル関数 ─────────

/**
 * コマ組サイドバーを開く。
 */
function openScheduleSidebar() {
  ScheduleService.openSidebar();
}

/**
 * 表示期間を設定してブース表グリッドを生成する（レガシー：ダイアログ版）。
 */
function setDisplayRange() {
  const ui = SpreadsheetApp.getUi();

  const startResp = ui.prompt(
    '表示期間の設定',
    '開始日を入力してください (例: 2025/04/01)',
    ui.ButtonSet.OK_CANCEL
  );
  if (startResp.getSelectedButton() !== ui.Button.OK) return;

  const endResp = ui.prompt(
    '表示期間の設定',
    '終了日を入力してください (例: 2025/04/30)',
    ui.ButtonSet.OK_CANCEL
  );
  if (endResp.getSelectedButton() !== ui.Button.OK) return;

  const startDate = SheetHelper.parseDate(startResp.getResponseText().trim());
  const endDate   = SheetHelper.parseDate(endResp.getResponseText().trim());

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    ui.alert('日付の形式が正しくありません。YYYY/MM/DD 形式で入力してください');
    return;
  }
  if (startDate > endDate) {
    ui.alert('開始日は終了日より前の日付を入力してください');
    return;
  }

  const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.BOOTH);
  BoothGrid.initializeGrid(sheet, startDate, endDate);

  const days = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  ui.alert(`ブース表を初期化しました (${days}日間)`);
}

/**
 * 回数報告を生成する。
 */
function runReport() {
  ReportSheet.generateReport();
}

/**
 * 教科マスタシートを初期化する。
 */
function initSubjectMaster() {
  const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.SUBJECTS);
  const m = CONFIG.MASTER.SUBJECTS;

  sheet.getRange(m.HEADER_ROW, 1).setValue('教科名');
  sheet.getRange(m.HEADER_ROW, 1).setFontWeight('bold');

  const defaultSubjects = [
    ['英語'], ['数学'], ['国語'], ['理科'], ['社会'],
    ['物理'], ['化学'], ['生物'], ['日本史'], ['世界史'],
    ['地理'], ['現代文'], ['古文'], ['漢文'], ['小論文'],
    ['英作文'], ['数Ⅰ・A'], ['数Ⅱ・B'], ['数Ⅲ'],
  ];

  SheetHelper.batchSetValues(sheet, m.DATA_START_ROW, 1, defaultSubjects);
  SpreadsheetApp.getActiveSpreadsheet().toast('教科マスタを初期化しました');
}

/**
 * tran シートを初期化する。
 */
function initTranSheet() {
  TranSheet.initializeSheet();
}

// ───────── google.script.run から呼び出されるグローバル関数 ─────────

/**
 * サイドバーの初期化データを返す。
 * @returns {{ teachers, students, subjects, slotStatus, settings }}
 */
function getSidebarData() {
  return ScheduleService.getSidebarData();
}

/**
 * 現在のアクティブセルのコマ状態を返す（講師・生徒情報を含む）。
 * @returns {{ dateLabel, period, booth, teacherName, student1Name, student2Name } | null}
 */
function getSlotStatus() {
  return ScheduleService.getSlotStatus();
}

/**
 * 教室設定を取得する。
 * @returns {Object} settings
 */
function getSettings() {
  return SettingsService.getSettings();
}

/**
 * 教室設定を保存する。
 * @param {Object} settings
 */
function saveSettings(settings) {
  SettingsService.saveSettings(settings);
}

/**
 * 年度全体のグリッドを生成する。
 * @param {number} fiscalYear 例: 2025
 */
function initializeYearGrid(fiscalYear) {
  SheetHelper.ensureTimezone();
  const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.BOOTH);
  BoothGrid.initializeYearGrid(sheet, Number(fiscalYear));
}

/**
 * 表示期間・表示時限を一括更新する。
 * @param {string} startStr  'YYYY-MM-DD'
 * @param {string} endStr    'YYYY-MM-DD'
 * @param {number} fromPeriod 1-indexed
 * @param {number} toPeriod   1-indexed
 */
function updateDisplaySettings(startStr, endStr, fromPeriod, toPeriod) {
  const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
  BoothGrid.setDisplayDateRange(sheet, SheetHelper.parseDate(startStr), SheetHelper.parseDate(endStr));
  BoothGrid.setDisplayPeriods(sheet, Number(fromPeriod), Number(toPeriod));
}

/**
 * 講師のみをブース表に配置する。
 * @param {Object} formData  teacherName, endDate, repeat を含む
 * @returns {{ success:boolean, message:string, count?:number }}
 */
function placeTeacherFromSidebar(formData) {
  return ScheduleService.placeTeacherFromSidebar(formData);
}

/**
 * サイドバーからコマを配置する（生徒配置）。
 * @param {Object} formData
 * @returns {{ success:boolean, message:string, count?:number }}
 */
function placeScheduleFromSidebar(formData) {
  return ScheduleService.placeScheduleFromSidebar(formData);
}

/**
 * サイドバーからブース表グリッドを生成する（レガシー互換）。
 * @param {string} startDateStr  'YYYY-MM-DD'
 * @param {string} endDateStr    'YYYY-MM-DD'
 */
function initializeBoothGrid(startDateStr, endDateStr) {
  const startDate = SheetHelper.parseDate(startDateStr);
  const endDate   = SheetHelper.parseDate(endDateStr);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('日付の形式が正しくありません');
  }
  if (startDate > endDate) {
    throw new Error('開始日は終了日より前の日付を入力してください');
  }
  const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.BOOTH);
  BoothGrid.initializeGrid(sheet, startDate, endDate);
}

/**
 * 講師マスタシートを初期化する。
 */
function initStaffMaster() {
  const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.STAFFS);
  const m = CONFIG.MASTER.STAFFS;
  sheet.getRange(m.HEADER_ROW, 1).setValue('ID');
  sheet.getRange(m.HEADER_ROW, 2).setValue('氏名');
  sheet.getRange(m.HEADER_ROW, 1, 1, 2).setFontWeight('bold');
  SpreadsheetApp.getActiveSpreadsheet().toast('講師マスタを初期化しました。データを入力してください。');
}

/**
 * 生徒マスタシートを初期化する。
 */
function initStudentMaster() {
  const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.STUDENTS);
  const m = CONFIG.MASTER.STUDENTS;
  sheet.getRange(m.HEADER_ROW, 1).setValue('ID');
  sheet.getRange(m.HEADER_ROW, 2).setValue('氏名');
  sheet.getRange(m.HEADER_ROW, 3).setValue('学年');
  sheet.getRange(m.HEADER_ROW, 1, 1, 3).setFontWeight('bold');
  SpreadsheetApp.getActiveSpreadsheet().toast('生徒マスタを初期化しました。データを入力してください。');
}

/**
 * 選択中のコマを削除する。
 * @returns {{ success:boolean, message:string }}
 */
function deleteCurrentSlot() {
  return ScheduleService.deleteCurrentSlot();
}

/**
 * 生徒名でブース表を検索しハイライトする。
 * @param {string} studentName
 * @returns {{ found:number }}
 */
function searchAndHighlightStudent(studentName) {
  const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
  BoothGrid.clearHighlight(sheet);
  const found = BoothGrid.searchAndHighlight(sheet, studentName);
  return { found };
}

/**
 * ブース表のハイライトを解除する。
 */
function clearHighlight() {
  const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
  BoothGrid.clearHighlight(sheet);
}

/**
 * 指定日の全コマを一括削除する（休校日対応）。
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {{ success:boolean, message:string, count:number }}
 */
function bulkDeleteByDate(dateStr) {
  return ScheduleService.bulkDeleteByDate(dateStr);
}

/**
 * 指定生徒の指定日以降の全コマを一括削除する（途中解約対応）。
 * @param {string} studentName
 * @param {string} fromDateStr 'YYYY-MM-DD'
 * @returns {{ success:boolean, message:string, count:number }}
 */
function bulkDeleteStudentSlots(studentName, fromDateStr) {
  return ScheduleService.bulkDeleteByStudent(studentName, fromDateStr);
}

/**
 * 指定講師の指定日以降の全コマを一括削除する。
 * @param {string} teacherName
 * @param {string} fromDateStr 'YYYY-MM-DD'
 * @returns {{ success:boolean, message:string, count:number }}
 */
function bulkDeleteTeacherSlots(teacherName, fromDateStr) {
  return ScheduleService.bulkDeleteByTeacher(teacherName, fromDateStr);
}

/**
 * ブース表から印刷シートを再生成する。
 */
function syncPrintSheet() {
  PrintSheet.syncFromBoothGrid();
  SpreadsheetApp.getActiveSpreadsheet().toast('印刷シートをブース表から再生成しました');
}
