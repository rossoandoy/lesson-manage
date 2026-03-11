/**
 * 07_TranSheet.gs
 * Salesforce キャッシュシート（tran）の構造定義と参照のみ実装。
 * API 接続は実装しない。
 *
 * tran シート構造:
 *   A列: 生徒ID
 *   B列: 生徒名
 *   C列: 年月 (YYYY/MM)
 *   D列: 項目
 *   E列: 請求中
 *   F列: 支払済
 */

const TranSheet = {

  /**
   * tran シートを初期化（ヘッダー行を設定）。
   * シートが存在しない場合は作成する。
   */
  initializeSheet() {
    const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.TRAN);
    const tc = CONFIG.TRAN_SHEET.COLS;

    const headers = ['生徒ID', '生徒名', '年月', '項目', '請求中', '支払済'];
    const headerRow = sheet.getRange(1, 1, 1, headers.length);
    headerRow.setValues([headers]);
    headerRow.setFontWeight('bold');
    headerRow.setBackground('#E8F0FE');

    // 列幅調整
    sheet.setColumnWidth(tc.STUDENT_ID,   80);
    sheet.setColumnWidth(tc.STUDENT_NAME, 120);
    sheet.setColumnWidth(tc.YEAR_MONTH,   90);
    sheet.setColumnWidth(tc.ITEM,         150);
    sheet.setColumnWidth(tc.BILLED,       90);
    sheet.setColumnWidth(tc.PAID,         90);

    SpreadsheetApp.getActiveSpreadsheet().toast('tran シートを初期化しました');
  },

  /**
   * 生徒IDと年月でキャッシュデータを参照する。
   * @param {string} studentId
   * @param {string} yearMonth 'YYYY/MM'
   * @returns {{ billed:number, paid:number } | null}
   */
  findRecord(studentId, yearMonth) {
    try {
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.TRAN);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return null;

      const numRows = lastRow - 1;
      const values = SheetHelper.batchGetValues(sheet, 2, 1, numRows, 6);
      const tc = CONFIG.TRAN_SHEET.COLS;

      const row = values.find(
        (r) =>
          String(r[tc.STUDENT_ID - 1]) === studentId &&
          String(r[tc.YEAR_MONTH - 1]) === yearMonth
      );
      if (!row) return null;

      return {
        billed: Number(row[tc.BILLED - 1]) || 0,
        paid:   Number(row[tc.PAID - 1])   || 0,
      };
    } catch (e) {
      return null;
    }
  },

  /**
   * tran シートの全データを取得する。
   * @returns {Array<Object>}
   */
  getAllRecords() {
    try {
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.TRAN);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return [];

      const numRows = lastRow - 1;
      const values = SheetHelper.batchGetValues(sheet, 2, 1, numRows, 6);
      const tc = CONFIG.TRAN_SHEET.COLS;

      return values.map((r) => ({
        studentId:   String(r[tc.STUDENT_ID - 1]   || ''),
        studentName: String(r[tc.STUDENT_NAME - 1] || ''),
        yearMonth:   String(r[tc.YEAR_MONTH - 1]   || ''),
        item:        String(r[tc.ITEM - 1]          || ''),
        billed:      Number(r[tc.BILLED - 1])       || 0,
        paid:        Number(r[tc.PAID - 1])         || 0,
      }));
    } catch (e) {
      return [];
    }
  },

  /**
   * tran シートにデータを一括書き込む（Salesforce同期時に使用想定）。
   * @param {Array<Object>} records
   */
  bulkWrite(records) {
    const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.TRAN);
    const tc = CONFIG.TRAN_SHEET.COLS;

    // データ行をクリア
    const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      sheet.getRange(2, 1, lastRow - 1, 6).clearContent();
    }

    if (records.length === 0) return;

    const rows = records.map((r) => [
      r.studentId   || '',
      r.studentName || '',
      r.yearMonth   || '',
      r.item        || '',
      r.billed      || 0,
      r.paid        || 0,
    ]);
    SheetHelper.batchSetValues(sheet, 2, 1, rows);
  },
};
