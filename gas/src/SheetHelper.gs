/**
 * SheetHelper.gs
 * スプレッドシート操作の共通ユーティリティ
 */

const SheetHelper = {
  /**
   * アクティブなスプレッドシートから指定シートを取得（なければ作成）
   * @param {string} sheetName
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getOrCreateSheet(sheetName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
  },

  /**
   * シートの全データを2次元配列で取得（ヘッダー含む）
   * @param {string} sheetName
   * @returns {any[][]}
   */
  getAllData(sheetName) {
    const sheet = SheetHelper.getOrCreateSheet(sheetName);
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow === 0 || lastCol === 0) return [];
    return sheet.getRange(1, 1, lastRow, lastCol).getValues();
  },

  /**
   * シートにデータを書き込む（既存データをクリア後）
   * @param {string} sheetName
   * @param {any[][]} data - ヘッダー行を含む2次元配列
   */
  writeData(sheetName, data) {
    const sheet = SheetHelper.getOrCreateSheet(sheetName);
    sheet.clearContents();
    if (data.length > 0) {
      sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
    }
  },

  /**
   * 日付を 'YYYY/MM/DD' 形式の文字列に変換
   * @param {Date} date
   * @returns {string}
   */
  formatDate(date) {
    return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy/MM/dd');
  },

  /**
   * 日時を 'YYYY/MM/DD HH:mm' 形式の文字列に変換
   * @param {Date} date
   * @returns {string}
   */
  formatDateTime(date) {
    return Utilities.formatDate(date, CONFIG.TIMEZONE, 'yyyy/MM/dd HH:mm');
  },
};
