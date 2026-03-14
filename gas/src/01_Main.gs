/**
 * 01_Main.gs
 * GAS トリガー・カスタムメニュー・グローバルエントリーポイント。
 */

/**
 * スプレッドシートを開いたときにカスタムメニューを登録する。
 */
function onOpen(e) {
  SheetHelper.ensureTimezone();
  const ui = SpreadsheetApp.getUi();

  // コマ組メニュー（日常操作のみ）
  ui.createMenu('コマ組')
    .addItem('コマ組サイドバーを開く', 'openScheduleSidebar')
    .addSeparator()
    .addItem('データ出力', 'showDataOutputDialog')
    .addItem('印刷プレビュー', 'showPrintViewDialog')
    .addSeparator()
    .addItem('印刷シートを同期', 'syncPrintSheet')
    .addToUi();

  // レポートメニュー
  ui.createMenu('レポート')
    .addItem('回数報告を生成', 'runReport')
    .addItem('全生徒一括レポート', 'runAllReports')
    .addItem('前年度累計を設定', 'setPrevYearTotals')
    .addToUi();

  // 初期設定メニュー
  ui.createMenu('初期設定')
    .addItem('ブース表を初期化', 'setDisplayRange')
    .addItem('印刷シートヘッダーを初期化', 'initPrintSheetHeader')
    .addSeparator()
    .addItem('教科マスタを初期化', 'initSubjectMaster')
    .addItem('講師マスタを初期化', 'initStaffMaster')
    .addItem('生徒マスタを初期化', 'initStudentMaster')
    .addItem('tran シートを初期化', 'initTranSheet')
    .addToUi();

  // 親シートの場合のみ管理メニューを追加
  if (AdminSheet.isParent()) {
    ui.createMenu('管理メニュー')
      .addItem('教室を同期', 'syncClassroomsFromSF')
      .addItem('教室シートを生成', 'provisionNewClassrooms')
      .addItem('テンプレート一括更新', 'updateAllTemplates')
      .addSeparator()
      .addItem('tran を同期', 'syncTranFromSF')
      .addItem('SF に URL 書き戻し', 'writebackUrlsToSF')
      .addSeparator()
      .addItem('SF 接続設定', 'setupSFCredentials')
      .addItem('SF 接続テスト', 'testSFConnection')
      .addSeparator()
      .addItem('自動同期を開始', 'installProvisionTrigger')
      .addItem('自動同期を停止', 'removeProvisionTrigger')
      .addToUi();
  } else {
    // 子シートでも初期化メニューを出す（Admin未作成時に使う）
    ui.createMenu('管理メニュー')
      .addItem('Admin シートを初期化（親シート化）', 'initAdminSheets')
      .addToUi();
  }
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
function bulkDeleteByStudent(studentName, fromDateStr) {
  return ScheduleService.bulkDeleteByStudent(studentName, fromDateStr);
}

/**
 * 指定講師の指定日以降の全コマを一括削除する。
 * @param {string} teacherName
 * @param {string} fromDateStr 'YYYY-MM-DD'
 * @returns {{ success:boolean, message:string, count:number }}
 */
function bulkDeleteByTeacher(teacherName, fromDateStr) {
  return ScheduleService.bulkDeleteByTeacher(teacherName, fromDateStr);
}

/**
 * 印刷シートのヘッダーを初期化する。
 */
function initPrintSheetHeader() {
  PrintSheet.initializeHeader();
}

/**
 * ブース表から印刷シートを再生成する。
 */
function syncPrintSheet() {
  PrintSheet.syncFromBoothGrid();
  SpreadsheetApp.getActiveSpreadsheet().toast('印刷シートをブース表から再生成しました');
}

/**
 * 全生徒一括レポートを生成する。
 */
function runAllReports() {
  ReportSheet.generateAllReports();
}

/**
 * 前年度累計を設定する。
 */
function setPrevYearTotals() {
  ReportSheet.promptPrevYearTotals();
}

/**
 * 出欠を記録する（サイドバーから呼び出し）。
 * @param {string} dateLabel
 * @param {number} period
 * @param {number} booth
 * @param {string} studentName
 * @param {string} status
 * @param {string} [transferToDate]
 * @returns {{ success:boolean, message:string }}
 */
function markAttendance(dateLabel, period, booth, studentName, status, transferToDate) {
  return ScheduleService.markAttendance(dateLabel, period, booth, studentName, status, transferToDate);
}

// ───────── データ出力・印刷ビューのグローバル関数 ─────────

/**
 * データ出力ダイアログを表示する。
 */
function showDataOutputDialog() {
  DataOutput.showFilterDialog();
}

/**
 * ブース表印刷ビューダイアログを表示する。
 */
function showPrintViewDialog() {
  PrintView.showPrintDialog();
}

/**
 * フィルタ条件付きでデータ出力シートを生成する（ダイアログから呼び出し）。
 * @param {Object} filter { studentName, teacherName, fromDate, toDate }
 */
function runDataOutput(filter) {
  DataOutput.generate(filter);
}

/**
 * 印刷ビューを生成する（ダイアログから呼び出し）。
 * @param {string} fromDate 'YYYY-MM-DD'
 * @param {string} toDate   'YYYY-MM-DD'
 */
function runPrintView(fromDate, toDate) {
  PrintView.generatePrintView(fromDate, toDate);
}

/**
 * コマ組ダイアログの初期化データを返す。
 * @returns {Object}
 */
function getDialogInitData() {
  return ScheduleService.getDialogInitData();
}

/**
 * コマ組ダイアログのフォーム送信を処理する。
 * @param {Object} formData
 * @returns {Object}
 */
function processScheduleDialogSubmit(formData) {
  return ScheduleService.processSubmit(formData);
}

// ───────── 管理メニューから呼び出されるグローバル関数 ─────────

/**
 * Admin_Classrooms + Admin_Version シートを初期化して親シート化する。
 */
function initAdminSheets() {
  AdminSheet.initializeClassroomsSheet();
  AdminSheet.initializeVersionSheet();
  AdminSheet.initializeCoverSheet();
  AdminSheet.addVersion('1.0.0', '初期バージョン', '');
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Admin シートを初期化しました。リロードすると管理メニューが表示されます。'
  );
}

/**
 * 教室一覧を Salesforce から同期する。
 */
function syncClassroomsFromSF() {
  if (!SfdcApi.hasCredentials()) {
    SpreadsheetApp.getUi().alert('SF 接続情報が未設定です。管理メニュー → SF 接続設定 を実行してください。');
    return;
  }
  SfdcApi.syncClassroomsToSheet();
}

/**
 * Admin_Classrooms の SS URL を Salesforce に書き戻す。
 */
function writebackUrlsToSF() {
  if (!SfdcApi.hasCredentials()) {
    SpreadsheetApp.getUi().alert('SF 接続情報が未設定です。管理メニュー → SF 接続設定 を実行してください。');
    return;
  }
  SfdcApi.writebackAllUrls();
}

/**
 * Salesforce の請求データを tran シートに同期する。
 */
function syncTranFromSF() {
  if (!SfdcApi.hasCredentials()) {
    SpreadsheetApp.getUi().alert('SF 接続情報が未設定です。管理メニュー → SF 接続設定 を実行してください。');
    return;
  }
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('tran シート同期', '同期する年月を入力してください (例: 2025/04)', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const yearMonth = resp.getResponseText().trim();
  if (!/^\d{4}\/\d{2}$/.test(yearMonth)) {
    ui.alert('年月の形式が正しくありません。YYYY/MM 形式で入力してください。');
    return;
  }
  SfdcApi.syncTranSheet(yearMonth);
}

/**
 * SF 接続情報を設定する。
 */
function setupSFCredentials() {
  SfdcApi.promptCredentials();
}

/**
 * SF 接続をテストする。
 */
function testSFConnection() {
  SfdcApi.testConnection();
}

/**
 * 新規教室のスプレッドシートを生成する。
 */
function provisionNewClassrooms() {
  const ui = SpreadsheetApp.getUi();
  const classrooms = AdminSheet.getClassrooms().filter(c => !c.ssId);
  if (classrooms.length === 0) {
    ui.alert('プロビジョニング', '新規教室はありません。', ui.ButtonSet.OK);
    return;
  }
  const resp = ui.alert(
    'プロビジョニング',
    classrooms.length + ' 件の教室シートを生成します。よろしいですか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp !== ui.Button.OK) return;

  const result = Provisioning.provisionAll();
  let msg = result.provisioned + ' 件の教室シートを生成しました。';
  if (result.errors.length > 0) {
    msg += '\n\nエラー:\n' + result.errors.join('\n');
  }
  ui.alert('プロビジョニング結果', msg, ui.ButtonSet.OK);
}

/**
 * 全教室のテンプレートを更新する。
 */
function updateAllTemplates() {
  const ui = SpreadsheetApp.getUi();
  const classrooms = AdminSheet.getClassrooms().filter(c => c.ssId);
  if (classrooms.length === 0) {
    ui.alert('テンプレート更新', '更新対象の教室がありません。', ui.ButtonSet.OK);
    return;
  }
  const resp = ui.alert(
    'テンプレート更新',
    classrooms.length + ' 件の教室テンプレートを更新します。よろしいですか？',
    ui.ButtonSet.OK_CANCEL
  );
  if (resp !== ui.Button.OK) return;

  const result = Provisioning.updateAllTemplates();
  let msg = result.updated + ' 件のテンプレートを更新しました。';
  if (result.errors.length > 0) {
    msg += '\n\nエラー:\n' + result.errors.join('\n');
  }
  ui.alert('テンプレート更新結果', msg, ui.ButtonSet.OK);
}

/**
 * 日次同期+プロビジョニング（トリガーから呼び出し）。
 */
function triggerDailySyncAndProvision() {
  Provisioning.dailySyncAndProvision();
}

/**
 * 定期同期トリガーを設定する。
 */
function installProvisionTrigger() {
  Provisioning.installDailyTrigger();
  SpreadsheetApp.getUi().alert(
    'トリガー設定',
    '日次同期トリガーを設定しました（毎日 ' + CONFIG.PARENT.PROVISION.TRIGGER_HOUR + ' 時に実行）。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * 定期同期トリガーを解除する。
 */
function removeProvisionTrigger() {
  Provisioning.removeDailyTrigger();
  SpreadsheetApp.getUi().alert(
    'トリガー解除',
    '日次同期トリガーを解除しました。',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

