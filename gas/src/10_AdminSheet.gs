/**
 * 10_AdminSheet.gs
 * Admin_Classrooms / Admin_Version シートの初期化・CRUD。
 * 親シート（テンプレート管理用SS）でのみ使用する。
 */

const AdminSheet = {
  /**
   * 現在のSSが親シートかどうかを判定する。
   * Admin_Classrooms シートが存在すれば親と見なす。
   */
  isParent() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(CONFIG.PARENT.SHEETS.ADMIN_CLASSROOMS) !== null;
  },

  /**
   * Admin_Classrooms シートを初期化（ヘッダー設定）する。
   * シートが存在しない場合は新規作成する。
   */
  initializeClassroomsSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.PARENT.SHEETS.ADMIN_CLASSROOMS;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const cols = CONFIG.PARENT.ADMIN_CLASSROOMS.COLS;
    const headers = [];
    headers[cols.CLASSROOM_ID - 1]   = '教室ID';
    headers[cols.CLASSROOM_NAME - 1] = '教室名';
    headers[cols.MANAGER_ID - 1]     = '管理者ID';
    headers[cols.MANAGER_NAME - 1]   = '管理者名';
    headers[cols.SS_URL - 1]         = 'SS URL';
    headers[cols.SS_ID - 1]          = 'SS ID';
    headers[cols.CURRENT_VERSION - 1] = 'バージョン';
    headers[cols.SYNC_STATUS - 1]    = 'ステータス';
    headers[cols.MANAGER_EMAIL - 1]  = 'メールアドレス';

    const headerRow = CONFIG.PARENT.ADMIN_CLASSROOMS.HEADER_ROW;
    sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(headerRow, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(headerRow);

    return sheet;
  },

  /**
   * Admin_Version シートを初期化（ヘッダー設定）する。
   * シートが存在しない場合は新規作成する。
   */
  initializeVersionSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.PARENT.SHEETS.ADMIN_VERSION;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    const cols = CONFIG.PARENT.ADMIN_VERSION.COLS;
    const headers = [];
    headers[cols.VERSION - 1]      = 'バージョン';
    headers[cols.RELEASE_DATE - 1] = 'リリース日';
    headers[cols.DESCRIPTION - 1]  = '説明';
    headers[cols.COMMIT_HASH - 1]  = 'コミットハッシュ';

    const headerRow = CONFIG.PARENT.ADMIN_VERSION.HEADER_ROW;
    sheet.getRange(headerRow, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(headerRow, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(headerRow);

    return sheet;
  },

  /**
   * Admin_Classrooms の全教室データを取得する。
   * @returns {Object[]} 各教室のデータオブジェクト配列
   */
  getClassrooms() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.PARENT.SHEETS.ADMIN_CLASSROOMS);
    if (!sheet) return [];

    const cfg = CONFIG.PARENT.ADMIN_CLASSROOMS;
    const lastRow = sheet.getLastRow();
    if (lastRow < cfg.DATA_START_ROW) return [];

    const numCols = Object.keys(cfg.COLS).length;
    const data = sheet.getRange(cfg.DATA_START_ROW, 1, lastRow - cfg.DATA_START_ROW + 1, numCols).getValues();

    return data
      .filter(row => row[cfg.COLS.CLASSROOM_ID - 1])
      .map(row => ({
        classroomId:    row[cfg.COLS.CLASSROOM_ID - 1],
        classroomName:  row[cfg.COLS.CLASSROOM_NAME - 1],
        managerId:      row[cfg.COLS.MANAGER_ID - 1],
        managerName:    row[cfg.COLS.MANAGER_NAME - 1],
        ssUrl:          row[cfg.COLS.SS_URL - 1],
        ssId:           row[cfg.COLS.SS_ID - 1],
        currentVersion: row[cfg.COLS.CURRENT_VERSION - 1],
        syncStatus:     row[cfg.COLS.SYNC_STATUS - 1],
        managerEmail:   row[cfg.COLS.MANAGER_EMAIL - 1],
      }));
  },

  /**
   * 教室データを追加または更新する（classroomId で一致判定）。
   * @param {Object} data  classroomId, classroomName, managerId, managerName, ssUrl, ssId, currentVersion, syncStatus
   */
  upsertClassroom(data) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.PARENT.SHEETS.ADMIN_CLASSROOMS);
    if (!sheet) throw new Error('Admin_Classrooms シートが見つかりません');

    const cfg = CONFIG.PARENT.ADMIN_CLASSROOMS;
    const lastRow = sheet.getLastRow();
    let targetRow = null;

    // 既存行を検索
    if (lastRow >= cfg.DATA_START_ROW) {
      const ids = sheet.getRange(cfg.DATA_START_ROW, cfg.COLS.CLASSROOM_ID, lastRow - cfg.DATA_START_ROW + 1, 1).getValues();
      for (let i = 0; i < ids.length; i++) {
        if (ids[i][0] === data.classroomId) {
          targetRow = cfg.DATA_START_ROW + i;
          break;
        }
      }
    }

    // 新規行
    if (!targetRow) {
      targetRow = Math.max(lastRow + 1, cfg.DATA_START_ROW);
    }

    const cols = cfg.COLS;
    const rowData = [];
    rowData[cols.CLASSROOM_ID - 1]    = data.classroomId || '';
    rowData[cols.CLASSROOM_NAME - 1]  = data.classroomName || '';
    rowData[cols.MANAGER_ID - 1]      = data.managerId || '';
    rowData[cols.MANAGER_NAME - 1]    = data.managerName || '';
    rowData[cols.SS_URL - 1]          = data.ssUrl || '';
    rowData[cols.SS_ID - 1]           = data.ssId || '';
    rowData[cols.CURRENT_VERSION - 1] = data.currentVersion || '';
    rowData[cols.SYNC_STATUS - 1]     = data.syncStatus || '';
    rowData[cols.MANAGER_EMAIL - 1]   = data.managerEmail || '';

    sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
  },

  /**
   * Admin_Version シートから最新バージョンを取得する。
   * @returns {Object|null} { version, releaseDate, description, commitHash }
   */
  getLatestVersion() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.PARENT.SHEETS.ADMIN_VERSION);
    if (!sheet) return null;

    const cfg = CONFIG.PARENT.ADMIN_VERSION;
    const lastRow = sheet.getLastRow();
    if (lastRow < cfg.DATA_START_ROW) return null;

    const row = sheet.getRange(lastRow, 1, 1, Object.keys(cfg.COLS).length).getValues()[0];
    return {
      version:     row[cfg.COLS.VERSION - 1],
      releaseDate: row[cfg.COLS.RELEASE_DATE - 1],
      description: row[cfg.COLS.DESCRIPTION - 1],
      commitHash:  row[cfg.COLS.COMMIT_HASH - 1],
    };
  },

  /**
   * Template_Cover シートを初期化する。
   * 教室名・教室長名・バージョン・更新日のラベルを配置する表紙シート。
   */
  initializeCoverSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = CONFIG.PARENT.SHEETS.TEMPLATE_COVER;
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }

    // タイトル行
    sheet.getRange('A1').setValue('教室情報');
    sheet.getRange('A1').setFontWeight('bold').setFontSize(14);

    // ラベル（A列）
    const labels = [
      ['教室名'],
      ['教室長名'],
      ['バージョン'],
      ['更新日'],
    ];
    sheet.getRange('A3:A6').setValues(labels);
    sheet.getRange('A3:A6').setFontWeight('bold');

    // 列幅調整
    sheet.setColumnWidth(1, 120);  // A列: ラベル
    sheet.setColumnWidth(2, 240);  // B列: 値

    return sheet;
  },

  /**
   * Template_Cover の各セルに教室情報を書き込む。
   * コピー生成後に呼び出して教室固有の値を埋める。
   * @param {string} classroomName 教室名
   * @param {string} managerName   教室長名
   */
  updateCover(classroomName, managerName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.PARENT.SHEETS.TEMPLATE_COVER);
    if (!sheet) throw new Error('Template_Cover シートが見つかりません');

    const cells = CONFIG.PARENT.TEMPLATE_COVER.CELLS;
    sheet.getRange(cells.CLASSROOM_NAME).setValue(classroomName || '');
    sheet.getRange(cells.MANAGER_NAME).setValue(managerName || '');

    const ver = this.getLatestVersion();
    sheet.getRange(cells.VERSION).setValue(ver ? ver.version : '');
    sheet.getRange(cells.UPDATE_DATE).setValue(new Date());
  },

  /**
   * Admin_Version シートにバージョンを追記する。
   * @param {string} version  例: '1.0.0'
   * @param {string} description
   * @param {string} commitHash
   */
  addVersion(version, description, commitHash) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.PARENT.SHEETS.ADMIN_VERSION);
    if (!sheet) throw new Error('Admin_Version シートが見つかりません');

    const cfg = CONFIG.PARENT.ADMIN_VERSION;
    const lastRow = sheet.getLastRow();
    const newRow = Math.max(lastRow + 1, cfg.DATA_START_ROW);

    const cols = cfg.COLS;
    const rowData = [];
    rowData[cols.VERSION - 1]      = version;
    rowData[cols.RELEASE_DATE - 1] = new Date();
    rowData[cols.DESCRIPTION - 1]  = description;
    rowData[cols.COMMIT_HASH - 1]  = commitHash || '';

    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
  },
};
