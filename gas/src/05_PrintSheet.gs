/**
 * 05_PrintSheet.gs
 * 印刷シート（授業データベース）の CRUD と出欠管理。
 */

const PrintSheet = {

  /**
   * 印刷シートを取得する。
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  _getSheet() {
    return SheetHelper.getSheet(CONFIG.SHEETS.PRINT);
  },

  /**
   * 1コマ分のエントリを末尾に追記する。
   * 1:2 の場合は 2行、1:1 の場合は 1行追記する。
   * 追記後に出欠列にドロップダウンを設定する。
   *
   * @param {ScheduleEntry} entry
   *   { dateLabel, period, booth, teacherName,
   *     student1Name, student1Grade, subject1,
   *     student2Name?, student2Grade?, subject2?,
   *     capacity }  capacity: '1：1' | '1：2'
   */
  appendEntry(entry) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;
    const date = SheetHelper.parseDate(entry.dateLabel);
    const weekday = SheetHelper.getWeekdayName(date);

    const baseRow = [
      date,
      weekday,
      entry.period,
      entry.booth,
      entry.teacherName,
      entry.student1Name || '',
      entry.student1Grade || '',
      entry.subject1 || '',
      entry.capacity || '1：1',
      '',  // 出欠（ドロップダウン）
    ];

    const row1 = SheetHelper.appendRow(sheet, baseRow);
    // 出欠ドロップダウン
    SheetHelper.createDropdownValidation(
      sheet, row1, c.ATTENDANCE, CONFIG.PRINT_SHEET.ATTENDANCE_VALUES
    );
    // 日付フォーマット
    sheet.getRange(row1, c.DATE).setNumberFormat('yyyy/MM/dd');

    if (entry.capacity === '1：2' && entry.student2Name) {
      const row2Data = [
        date,
        weekday,
        entry.period,
        entry.booth,
        entry.teacherName,
        entry.student2Name || '',
        entry.student2Grade || '',
        entry.subject2 || '',
        entry.capacity || '1：2',
        '',
      ];
      const row2 = SheetHelper.appendRow(sheet, row2Data);
      SheetHelper.createDropdownValidation(
        sheet, row2, c.ATTENDANCE, CONFIG.PRINT_SHEET.ATTENDANCE_VALUES
      );
      sheet.getRange(row2, c.DATE).setNumberFormat('yyyy/MM/dd');
    }
  },

  /**
   * 複数エントリをバッチ追記する。
   * @param {ScheduleEntry[]} entries
   */
  appendEntries(entries) {
    entries.forEach((entry) => this.appendEntry(entry));
  },

  /**
   * onEdit トリガーから呼び出し。出欠列の値を検証する。
   * @param {GoogleAppsScript.Events.SheetsOnEdit} e
   */
  validateAttendance(e) {
    if (!e || !e.range) return;
    const sheet = e.range.getSheet();
    if (sheet.getName() !== CONFIG.SHEETS.PRINT) return;

    const c = CONFIG.PRINT_SHEET.COLS;
    if (e.range.getColumn() !== c.ATTENDANCE) return;
    if (e.range.getRow() < CONFIG.PRINT_SHEET.DATA_START_ROW) return;

    const value = e.range.getValue();
    if (value && !CONFIG.PRINT_SHEET.ATTENDANCE_VALUES.includes(value)) {
      e.range.setValue('');
      SpreadsheetApp.getUi().alert(
        `出欠には「${CONFIG.PRINT_SHEET.ATTENDANCE_VALUES.join('」「')}」のいずれかを入力してください`
      );
    }
  },

  /**
   * ブース表から印刷シートを再生成する（全件リビルド）。
   */
  syncFromBoothGrid() {
    const boothSheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    const printSheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET;

    // 既存データ行を全削除
    const lastRow = printSheet.getLastRow();
    if (lastRow >= c.DATA_START_ROW) {
      printSheet.deleteRows(c.DATA_START_ROW, lastRow - c.DATA_START_ROW + 1);
    }

    // ブース表から全コマ読み取り
    const slots = BoothGrid.readAllSlots(boothSheet);
    if (slots.length === 0) return;

    // 日付→時限→ブース順でソート
    slots.sort((a, b) =>
      a.dateLabel.localeCompare(b.dateLabel) || a.period - b.period || a.booth - b.booth
    );

    // 印刷シートに一括追記
    this.appendEntries(slots);
  },

  /**
   * 生徒名で行を検索する。
   * @param {string} studentName
   * @returns {Array<{ row:number, data:any[] }>}
   */
  findByStudent(studentName) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;
    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.PRINT_SHEET.DATA_START_ROW) return [];

    const numRows = lastRow - CONFIG.PRINT_SHEET.DATA_START_ROW + 1;
    const values = SheetHelper.batchGetValues(
      sheet, CONFIG.PRINT_SHEET.DATA_START_ROW, 1, numRows, 10
    );

    const results = [];
    values.forEach((row, i) => {
      if (row[c.STUDENT - 1] === studentName) {
        results.push({ row: CONFIG.PRINT_SHEET.DATA_START_ROW + i, data: row });
      }
    });
    return results;
  },

  /**
   * 期間で行を検索する。
   * @param {Date} from
   * @param {Date} to
   * @returns {Array<{ row:number, data:any[] }>}
   */
  findByDateRange(from, to) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;
    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.PRINT_SHEET.DATA_START_ROW) return [];

    const numRows = lastRow - CONFIG.PRINT_SHEET.DATA_START_ROW + 1;
    const values = SheetHelper.batchGetValues(
      sheet, CONFIG.PRINT_SHEET.DATA_START_ROW, 1, numRows, 10
    );

    const fromTime = from.getTime();
    const toTime   = to.getTime();
    const results  = [];

    values.forEach((row, i) => {
      const dateVal = row[c.DATE - 1];
      if (dateVal instanceof Date) {
        const t = dateVal.getTime();
        if (t >= fromTime && t <= toTime) {
          results.push({ row: CONFIG.PRINT_SHEET.DATA_START_ROW + i, data: row });
        }
      }
    });
    return results;
  },

  /**
   * 特定コマ（日付・時限・ブース）の行を全削除する。
   * @param {string} dateLabel 'YYYY/MM/DD'
   * @param {number} period
   * @param {number} booth
   */
  deleteBySlot(dateLabel, period, booth) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;
    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.PRINT_SHEET.DATA_START_ROW) return;

    const numRows = lastRow - CONFIG.PRINT_SHEET.DATA_START_ROW + 1;
    const values = SheetHelper.batchGetValues(
      sheet, CONFIG.PRINT_SHEET.DATA_START_ROW, 1, numRows, 9
    );

    // 後ろから削除（行番号がずれないため）
    for (let i = values.length - 1; i >= 0; i--) {
      const row = values[i];
      const dateVal = row[c.DATE - 1];
      const rowDateLabel = (dateVal instanceof Date) ? SheetHelper.formatDate(dateVal) : '';
      if (
        rowDateLabel === dateLabel &&
        Number(row[c.PERIOD - 1]) === period &&
        Number(row[c.BOOTH - 1]) === booth
      ) {
        sheet.deleteRow(CONFIG.PRINT_SHEET.DATA_START_ROW + i);
      }
    }
  },
};
