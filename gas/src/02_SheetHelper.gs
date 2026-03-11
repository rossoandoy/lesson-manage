/**
 * 02_SheetHelper.gs
 * SpreadsheetAPI の共通ラッパー。バッチ操作を徹底する。
 */

const SheetHelper = {

  /**
   * アクティブなスプレッドシートから指定シートを取得。
   * @param {string} name シート名
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(name);
    if (!sheet) throw new Error(`シート "${name}" が見つかりません`);
    return sheet;
  },

  /**
   * シートが存在しなければ作成して返す。
   * @param {string} name シート名
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getOrCreateSheet(name) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    return ss.getSheetByName(name) || ss.insertSheet(name);
  },

  /**
   * バッチで値を取得する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} startRow 1-indexed
   * @param {number} startCol 1-indexed
   * @param {number} numRows
   * @param {number} numCols
   * @returns {Array<Array<any>>}
   */
  batchGetValues(sheet, startRow, startCol, numRows, numCols) {
    if (numRows <= 0 || numCols <= 0) return [];
    return sheet.getRange(startRow, startCol, numRows, numCols).getValues();
  },

  /**
   * バッチで値をセットする。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} startRow 1-indexed
   * @param {number} startCol 1-indexed
   * @param {Array<Array<any>>} values 2次元配列
   */
  batchSetValues(sheet, startRow, startCol, values) {
    if (!values || values.length === 0) return;
    sheet.getRange(startRow, startCol, values.length, values[0].length).setValues(values);
  },

  /**
   * セルをマージして値をセットする（左上セルに書き込む）。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} row 1-indexed
   * @param {number} col 1-indexed
   * @param {number} numRows マージ行数
   * @param {number} numCols マージ列数
   * @param {any} value
   */
  setMergeAndValue(sheet, row, col, numRows, numCols, value) {
    const range = sheet.getRange(row, col, numRows, numCols);
    range.merge();
    range.setValue(value);
  },

  /**
   * マージセルの値を取得（左上セルの値を返す）。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} row 1-indexed
   * @param {number} col 1-indexed
   * @returns {any}
   */
  getMergedValue(sheet, row, col) {
    return sheet.getRange(row, col).getValue();
  },

  /**
   * シートの末尾に1行追記する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Array<any>} rowData 1次元配列
   * @returns {number} 書き込んだ行番号 (1-indexed)
   */
  appendRow(sheet, rowData) {
    const lastRow = sheet.getLastRow();
    const newRow = lastRow + 1;
    sheet.getRange(newRow, 1, 1, rowData.length).setValues([rowData]);
    return newRow;
  },

  /**
   * 文字列を安全にローカルタイムゾーンの Date に変換する。
   * 'YYYY-MM-DD' や 'YYYY/MM/DD' を new Date() すると UTC 解釈で1日ズレるため、
   * 年月日を分解してローカルタイムで構築する。
   * @param {Date|string} str
   * @returns {Date}
   */
  parseDate(str) {
    if (str instanceof Date) return new Date(str);
    const parts = String(str).split(/[-\/]/);
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0);
  },

  /**
   * Date オブジェクトを 'YYYY/MM/DD' 文字列に変換。
   * @param {Date|string} date
   * @returns {string}
   */
  formatDate(date) {
    if (!date) return '';
    const d = (date instanceof Date) ? date : this.parseDate(date);
    return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  },

  /**
   * 日付の曜日名（日本語）を返す。
   * @param {Date|string} date
   * @returns {string} '月'〜'日'
   */
  getWeekdayName(date) {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    const d = (date instanceof Date) ? date : this.parseDate(date);
    return days[d.getDay()];
  },

  /**
   * セルにドロップダウンバリデーションを設定する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} row
   * @param {number} col
   * @param {string[]} values
   */
  createDropdownValidation(sheet, row, col, values) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(row, col).setDataValidation(rule);
  },

  /**
   * 複数行にドロップダウンバリデーションを一括設定する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} startRow
   * @param {number} col
   * @param {number} numRows
   * @param {string[]} values
   */
  createDropdownValidationRange(sheet, startRow, col, numRows, values) {
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(values, true)
      .setAllowInvalid(false)
      .build();
    sheet.getRange(startRow, col, numRows, 1).setDataValidation(rule);
  },

  /**
   * 列インデックス (1-indexed) をアルファベット列名に変換。
   * @param {number} col 1-indexed
   * @returns {string} 例: 1→'A', 27→'AA'
   */
  colToLetter(col) {
    let letter = '';
    while (col > 0) {
      const rem = (col - 1) % 26;
      letter = String.fromCharCode(65 + rem) + letter;
      col = Math.floor((col - 1) / 26);
    }
    return letter;
  },

  /**
   * セルの背景色を設定する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} row
   * @param {number} col
   * @param {number} numRows
   * @param {number} numCols
   * @param {string} color 例: '#FFFFFF'
   */
  setBackground(sheet, row, col, numRows, numCols, color) {
    sheet.getRange(row, col, numRows, numCols).setBackground(color);
  },

  /**
   * セルの罫線を設定する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} row
   * @param {number} col
   * @param {number} numRows
   * @param {number} numCols
   */
  setBorder(sheet, row, col, numRows, numCols) {
    sheet.getRange(row, col, numRows, numCols)
      .setBorder(true, true, true, true, true, true);
  },

  /**
   * スプレッドシートのタイムゾーンをスクリプトTZに合わせる。
   * TZが異なると日付セルの表示が1日ズレるため、onOpen等で強制統一する。
   */
  ensureTimezone() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const scriptTz = Session.getScriptTimeZone();
    if (ss.getSpreadsheetTimeZone() !== scriptTz) {
      ss.setSpreadsheetTimeZone(scriptTz);
    }
  },
};
