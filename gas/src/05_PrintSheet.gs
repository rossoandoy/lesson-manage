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
   * 印刷シートのヘッダー行を初期化する。
   */
  initializeHeader() {
    const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.PRINT);
    const c = CONFIG.PRINT_SHEET;
    const cols = c.COLS;
    const headers = [
      [cols.DATE,          '日付'],
      [cols.WEEKDAY,       '曜日'],
      [cols.PERIOD,        '時限'],
      [cols.BOOTH,         'ブース'],
      [cols.TEACHER,       '講師'],
      [cols.STUDENT,       '生徒'],
      [cols.GRADE,         '学年'],
      [cols.SUBJECT,       '教科'],
      [cols.CAPACITY,      '形式'],
      [cols.ATTENDANCE,    '出欠'],
      [cols.TRANSFER_FROM, '振替元日付'],
      [cols.TRANSFER_TO,   '振替先日付'],
    ];
    headers.forEach(([col, label]) => {
      sheet.getRange(c.HEADER_ROW, col).setValue(label);
    });
    sheet.getRange(c.HEADER_ROW, 1, 1, 12).setFontWeight('bold');
    SpreadsheetApp.getActiveSpreadsheet().toast('印刷シートのヘッダーを初期化しました');
  },

  /**
   * 日付・時限・ブース・生徒名で印刷シートの行を特定する。
   * @param {string} dateLabel 'YYYY/MM/DD'
   * @param {number} period
   * @param {number} booth
   * @param {string} studentName
   * @returns {{ row:number, data:any[] } | null}
   */
  findBySlotAndStudent(dateLabel, period, booth, studentName) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;
    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.PRINT_SHEET.DATA_START_ROW) return null;

    const numRows = lastRow - CONFIG.PRINT_SHEET.DATA_START_ROW + 1;
    const values = SheetHelper.batchGetValues(
      sheet, CONFIG.PRINT_SHEET.DATA_START_ROW, 1, numRows, 12
    );

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const dateVal = row[c.DATE - 1];
      const rowDateLabel = (dateVal instanceof Date) ? SheetHelper.formatDate(dateVal) : '';
      if (
        rowDateLabel === dateLabel &&
        Number(row[c.PERIOD - 1]) === period &&
        Number(row[c.BOOTH - 1]) === booth &&
        row[c.STUDENT - 1] === studentName
      ) {
        return { row: CONFIG.PRINT_SHEET.DATA_START_ROW + i, data: row };
      }
    }
    return null;
  },

  /**
   * 振替元と振替先の行を相互リンクする。
   * @param {{ dateLabel:string, period:number, booth:number }} fromSlot
   * @param {{ dateLabel:string, period:number, booth:number }} toSlot
   * @param {string} studentName
   */
  linkTransfer(fromSlot, toSlot, studentName) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;

    // 振替元の行を検索 → L列（振替先日付）にセット
    const fromRow = this.findBySlotAndStudent(
      fromSlot.dateLabel, fromSlot.period, fromSlot.booth, studentName
    );
    if (fromRow) {
      sheet.getRange(fromRow.row, c.TRANSFER_TO).setValue(toSlot.dateLabel);
    }

    // 振替先の行を検索 → K列（振替元日付）にセット
    const toRow = this.findBySlotAndStudent(
      toSlot.dateLabel, toSlot.period, toSlot.booth, studentName
    );
    if (toRow) {
      sheet.getRange(toRow.row, c.TRANSFER_FROM).setValue(fromSlot.dateLabel);
    }
  },

  /**
   * 出欠を更新する。
   * @param {string} dateLabel
   * @param {number} period
   * @param {number} booth
   * @param {string} studentName
   * @param {string} status '出席' | '欠席' | '振替'
   */
  setAttendance(dateLabel, period, booth, studentName, status) {
    const sheet = this._getSheet();
    const c = CONFIG.PRINT_SHEET.COLS;
    const found = this.findBySlotAndStudent(dateLabel, period, booth, studentName);
    if (found) {
      sheet.getRange(found.row, c.ATTENDANCE).setValue(status);
    }
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
