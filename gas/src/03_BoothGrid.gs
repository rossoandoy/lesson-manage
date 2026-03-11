/**
 * 03_BoothGrid.gs
 * ブース表グリッドの座標計算・読み書き。
 *
 * グリッド構造:
 *   行7 : 時限ヘッダー
 *   行8〜: データ領域
 *     A列 : 日付（ROWS_PER_DAY行マージ）
 *     各時限ブロック (5列幅) × Nブース (2行/ブース)
 *       col+0: ブース番号 (2行merge)
 *       col+1: 講師名    (2行merge)
 *       col+2: 生徒名    (row1=生徒1, row2=生徒2)
 *       col+3: 学年      (row1/row2)
 *       col+4: 教科      (row1/row2)
 */

const BoothGrid = {

  /** 日付→開始行番号マップのキャッシュ */
  _dateRowCache: null,

  /**
   * セル座標からコマ情報を解読する。
   * @param {number} row 1-indexed
   * @param {number} col 1-indexed
   * @returns {{ date:Date, period:number, booth:number, dayIndex:number, boothIndex:number } | null}
   *          グリッド外なら null
   */
  decodeCell(row, col) {
    const g = SettingsService.getBoothGridConfig();
    if (row < g.DATA_START_ROW) return null;

    const relRow = row - g.DATA_START_ROW;
    const dayIndex   = Math.floor(relRow / g.ROWS_PER_DAY);
    const rowInDay   = relRow % g.ROWS_PER_DAY;
    const boothIndex = Math.floor(rowInDay / g.ROWS_PER_BOOTH);

    const periodIndex = g.PERIOD_START_COLS.findIndex(
      (startCol) => col >= startCol && col < startCol + g.BLOCK_WIDTH
    );
    if (periodIndex === -1) return null;

    return {
      dayIndex,
      boothIndex,
      period: periodIndex + 1,
      booth:  boothIndex + 1,
    };
  },

  /**
   * dayIndex / period / boothIndex からセル開始座標を計算する。
   * @param {number} dayIndex  0-indexed
   * @param {number} period    1-indexed
   * @param {number} boothIndex 0-indexed
   * @returns {{ dayStartRow:number, boothStartRow:number, periodStartCol:number }}
   */
  encodeCell(dayIndex, period, boothIndex) {
    const g = SettingsService.getBoothGridConfig();
    const dayStartRow    = g.DATA_START_ROW + dayIndex * g.ROWS_PER_DAY;
    const boothStartRow  = dayStartRow + boothIndex * g.ROWS_PER_BOOTH;
    const periodStartCol = g.PERIOD_START_COLS[period - 1];
    return { dayStartRow, boothStartRow, periodStartCol };
  },

  /**
   * A列を走査して日付文字列 → 開始行番号のマップを返す（キャッシュ付き）。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet ブース表シート
   * @param {boolean} [forceRefresh=false]
   * @returns {Map<string, number>} key='YYYY/MM/DD', value=開始行(1-indexed)
   */
  buildDateRowMap(sheet, forceRefresh) {
    if (this._dateRowCache && !forceRefresh) return this._dateRowCache;

    const g = SettingsService.getBoothGridConfig();
    const lastRow = sheet.getLastRow();
    if (lastRow < g.DATA_START_ROW) return new Map();

    const numRows = lastRow - g.DATA_START_ROW + 1;
    const colValues = SheetHelper.batchGetValues(
      sheet, g.DATA_START_ROW, g.DATE_COL, numRows, 1
    );

    const map = new Map();
    for (let i = 0; i < numRows; i++) {
      const val = colValues[i][0];
      if (val instanceof Date && !isNaN(val)) {
        const key = SheetHelper.formatDate(val);
        if (!map.has(key)) {
          map.set(key, g.DATA_START_ROW + i);
        }
      }
    }
    this._dateRowCache = map;
    return map;
  },

  /**
   * キャッシュをクリアする（initializeGrid後に呼ぶ）。
   */
  clearCache() {
    this._dateRowCache = null;
  },

  /**
   * ブース表の1コマにデータを書き込む。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {ScheduleEntry} entry
   */
  writeSlot(sheet, entry) {
    const dateRowMap = this.buildDateRowMap(sheet);
    const dayStartRow = dateRowMap.get(entry.dateLabel);
    if (dayStartRow === undefined) return;

    const g = SettingsService.getBoothGridConfig();
    const boothIndex    = entry.booth - 1;
    const boothStartRow = dayStartRow + boothIndex * g.ROWS_PER_BOOTH;
    const periodStartCol = g.PERIOD_START_COLS[entry.period - 1];
    const o = g.COL_OFFSET;

    // ブース番号（mergeは initializeGrid で作成済み）
    sheet.getRange(boothStartRow, periodStartCol + o.BOOTH_NUM).setValue(entry.booth);
    // 講師名（mergeは initializeGrid で作成済み）
    sheet.getRange(boothStartRow, periodStartCol + o.TEACHER).setValue(entry.teacherName);

    // 生徒1（1行目）
    sheet.getRange(boothStartRow, periodStartCol + o.STUDENT).setValue(entry.student1Name || '');
    sheet.getRange(boothStartRow, periodStartCol + o.GRADE).setValue(entry.student1Grade || '');
    sheet.getRange(boothStartRow, periodStartCol + o.SUBJECT).setValue(entry.subject1 || '');

    // 生徒2（2行目）
    const row2 = boothStartRow + 1;
    sheet.getRange(row2, periodStartCol + o.STUDENT).setValue(entry.student2Name || '');
    sheet.getRange(row2, periodStartCol + o.GRADE).setValue(entry.student2Grade || '');
    sheet.getRange(row2, periodStartCol + o.SUBJECT).setValue(entry.subject2 || '');
  },

  /**
   * ブース表の1コマをクリアする。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string} dateLabel 'YYYY/MM/DD'
   * @param {number} period
   * @param {number} booth
   */
  clearSlot(sheet, dateLabel, period, booth) {
    const dateRowMap = this.buildDateRowMap(sheet);
    const dayStartRow = dateRowMap.get(dateLabel);
    if (dayStartRow === undefined) return;

    const g = SettingsService.getBoothGridConfig();
    const boothIndex    = booth - 1;
    const boothStartRow = dayStartRow + boothIndex * g.ROWS_PER_BOOTH;
    const periodStartCol = g.PERIOD_START_COLS[period - 1];

    const range = sheet.getRange(boothStartRow, periodStartCol, g.ROWS_PER_BOOTH, g.BLOCK_WIDTH);
    range.breakApart();
    range.clearContent();
    // ブース番号・講師セルの merge を再構築
    SheetHelper.setMergeAndValue(
      sheet, boothStartRow, periodStartCol + g.COL_OFFSET.BOOTH_NUM, 2, 1, `B${booth}`
    );
    sheet.getRange(boothStartRow, periodStartCol + g.COL_OFFSET.TEACHER, 2, 1).merge();
  },

  /**
   * ブース表のグリッドを初期化する（指定期間の日付行・時限ヘッダーを生成）。
   * バッチ書き込み + まとめて merge/border 適用でタイムアウトを回避する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Date} startDate
   * @param {Date} endDate
   */
  initializeGrid(sheet, startDate, endDate) {
    const g = SettingsService.getBoothGridConfig();
    const o = g.COL_OFFSET;

    // 既存データ行を削除
    const lastRow = sheet.getLastRow();
    if (lastRow >= g.DATA_START_ROW) {
      sheet.deleteRows(g.DATA_START_ROW, lastRow - g.DATA_START_ROW + 1);
    }
    // ヘッダー行の merge リセット
    const totalCols = 1 + g.PERIOD_COUNT * g.BLOCK_WIDTH;
    sheet.getRange(g.HEADER_ROW, 1, 1, totalCols).breakApart();

    // 時限ヘッダー行を書き込む
    this._writeHeaderRow(sheet);

    // --- 全日付を配列に集める ---
    let currentDate = new Date(startDate);
    currentDate.setHours(12, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(12, 0, 0, 0);

    const allDates = [];
    while (currentDate <= end) {
      allDates.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }
    const totalDays = allDates.length;
    if (totalDays === 0) { this.clearCache(); return; }

    // --- 全行データを2次元配列で構築 ---
    const totalRows = totalDays * g.ROWS_PER_DAY;
    const allData = [];
    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      for (let rowInDay = 0; rowInDay < g.ROWS_PER_DAY; rowInDay++) {
        const row = new Array(totalCols).fill('');
        // A列: 日付は各日の先頭行のみ
        if (rowInDay === 0) {
          row[0] = allDates[dayIdx];
        }
        // 各時限のブース番号
        const boothIdx = Math.floor(rowInDay / g.ROWS_PER_BOOTH);
        const rowInBooth = rowInDay % g.ROWS_PER_BOOTH;
        if (rowInBooth === 0) {
          for (let periodIdx = 0; periodIdx < g.PERIOD_COUNT; periodIdx++) {
            const colOffset = g.PERIOD_START_COLS[periodIdx] - 1; // 0-indexed
            row[colOffset + o.BOOTH_NUM] = `B${boothIdx + 1}`;
          }
        }
        allData.push(row);
      }
    }

    // 一括書き込み
    SheetHelper.batchSetValues(sheet, g.DATA_START_ROW, 1, allData);

    // --- merge と border を日単位バッチで適用 ---
    const FLUSH_INTERVAL = 50; // 50日ごとに flush
    for (let dayIdx = 0; dayIdx < totalDays; dayIdx++) {
      const dayStartRow = g.DATA_START_ROW + dayIdx * g.ROWS_PER_DAY;

      // A列: 日付マージ + フォーマット + 罫線
      const dateRange = sheet.getRange(dayStartRow, g.DATE_COL, g.ROWS_PER_DAY, 1);
      dateRange.merge();
      sheet.getRange(dayStartRow, g.DATE_COL).setNumberFormat('M/d\n(ddd)');
      dateRange.setBorder(true, true, true, true, true, true);

      // 各時限・各ブースの merge + border
      for (let periodIdx = 0; periodIdx < g.PERIOD_COUNT; periodIdx++) {
        const periodStartCol = g.PERIOD_START_COLS[periodIdx];
        for (let boothIdx = 0; boothIdx < g.BOOTH_COUNT; boothIdx++) {
          const boothStartRow = dayStartRow + boothIdx * g.ROWS_PER_BOOTH;
          // ブース番号（2行merge）
          sheet.getRange(boothStartRow, periodStartCol + o.BOOTH_NUM, 2, 1).merge();
          // 講師セル（2行merge）
          sheet.getRange(boothStartRow, periodStartCol + o.TEACHER, 2, 1).merge();
          // ブースブロック全体の罫線（5列 × 2行）
          sheet.getRange(boothStartRow, periodStartCol, g.ROWS_PER_BOOTH, g.BLOCK_WIDTH)
            .setBorder(true, true, true, true, true, true);
        }
      }

      // 定期的に flush してバッファを確定
      if ((dayIdx + 1) % FLUSH_INTERVAL === 0) {
        SpreadsheetApp.flush();
      }
    }

    this.clearCache();
  },

  /**
   * 年度全体（4/1〜翌3/31）のグリッドを一括生成する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} fiscalYear 例: 2025 → 2025/4/1〜2026/3/31
   */
  initializeYearGrid(sheet, fiscalYear) {
    const startDate = new Date(fiscalYear,     3,  1, 12, 0, 0);  // 4月1日
    const endDate   = new Date(fiscalYear + 1, 2, 31, 12, 0, 0);  // 翌3月31日
    this.initializeGrid(sheet, startDate, endDate);
  },

  /**
   * 表示期間外の行を hide / show で切り替える。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Date|string} startDate
   * @param {Date|string} endDate
   */
  setDisplayDateRange(sheet, startDate, endDate) {
    const g = SettingsService.getBoothGridConfig();
    const dateRowMap = this.buildDateRowMap(sheet);
    const s = (startDate instanceof Date) ? new Date(startDate) : SheetHelper.parseDate(startDate);
    s.setHours(12, 0, 0, 0);
    const e = (endDate instanceof Date) ? new Date(endDate) : SheetHelper.parseDate(endDate);
    e.setHours(12, 0, 0, 0);

    for (const [label, startRow] of dateRowMap) {
      const d = SheetHelper.parseDate(label); d.setHours(12, 0, 0, 0);
      const hide = d < s || d > e;
      if (hide) {
        sheet.hideRows(startRow, g.ROWS_PER_DAY);
      } else {
        sheet.showRows(startRow, g.ROWS_PER_DAY);
      }
    }
  },

  /**
   * 指定範囲外の時限列を hide / show で切り替える。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} fromPeriod 1-indexed
   * @param {number} toPeriod   1-indexed
   */
  setDisplayPeriods(sheet, fromPeriod, toPeriod) {
    const g = SettingsService.getBoothGridConfig();
    for (let i = 0; i < g.PERIOD_COUNT; i++) {
      const col = g.PERIOD_START_COLS[i];
      if (i + 1 < fromPeriod || i + 1 > toPeriod) {
        sheet.hideColumns(col, g.BLOCK_WIDTH);
      } else {
        sheet.showColumns(col, g.BLOCK_WIDTH);
      }
    }
  },

  /**
   * ブース表の全コマを走査し、データがあるコマを配列で返す。
   * 日付ごとにバッチ取得してパフォーマンスを確保する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @returns {Array<Object>}
   */
  readAllSlots(sheet) {
    const g = SettingsService.getBoothGridConfig();
    const dateRowMap = this.buildDateRowMap(sheet, true);
    const o = g.COL_OFFSET;
    const slots = [];

    for (const [dateLabel, dayStartRow] of dateRowMap) {
      // 日単位で全データをバッチ取得
      const totalCols = 1 + g.PERIOD_COUNT * g.BLOCK_WIDTH;
      const dayData = SheetHelper.batchGetValues(
        sheet, dayStartRow, 1, g.ROWS_PER_DAY, totalCols
      );

      for (let periodIdx = 0; periodIdx < g.PERIOD_COUNT; periodIdx++) {
        const periodStartCol = g.PERIOD_START_COLS[periodIdx];
        const colIdx = periodStartCol - 1; // 0-indexed for array access

        for (let boothIdx = 0; boothIdx < g.BOOTH_COUNT; boothIdx++) {
          const rowInDay = boothIdx * g.ROWS_PER_BOOTH;
          const row1 = dayData[rowInDay];
          const row2 = dayData[rowInDay + 1];
          if (!row1) continue;

          const teacherName = String(row1[colIdx + o.TEACHER] || '');
          if (!teacherName) continue; // 講師がいない = 空きコマ

          const student1Name  = String(row1[colIdx + o.STUDENT] || '');
          const student1Grade = String(row1[colIdx + o.GRADE] || '');
          const subject1      = String(row1[colIdx + o.SUBJECT] || '');
          const student2Name  = row2 ? String(row2[colIdx + o.STUDENT] || '') : '';
          const student2Grade = row2 ? String(row2[colIdx + o.GRADE] || '') : '';
          const subject2      = row2 ? String(row2[colIdx + o.SUBJECT] || '') : '';
          const capacity = student2Name ? '1：2' : '1：1';

          slots.push({
            dateLabel,
            period: periodIdx + 1,
            booth: boothIdx + 1,
            teacherName,
            student1Name,
            student1Grade,
            subject1,
            student2Name,
            student2Grade,
            subject2,
            capacity,
          });
        }
      }
    }
    return slots;
  },

  /**
   * 生徒名でブース表を検索しハイライト（黄色背景）する。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string} studentName
   * @returns {number} ヒット数
   */
  searchAndHighlight(sheet, studentName) {
    if (!studentName) return 0;
    const finder = sheet.createTextFinder(studentName).matchEntireCell(true);
    const ranges = finder.findAll();
    ranges.forEach((r) => r.setBackground('#fff2cc'));
    return ranges.length;
  },

  /**
   * ブース表のデータ領域の背景色をリセットする。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   */
  clearHighlight(sheet) {
    const g = SettingsService.getBoothGridConfig();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < g.DATA_START_ROW || lastCol < 1) return;
    sheet.getRange(g.DATA_START_ROW, 1, lastRow - g.DATA_START_ROW + 1, lastCol)
      .setBackground(null);
  },

  /**
   * 1:2 コマの片方の生徒のみクリアする（merge は崩さない）。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string} dateLabel 'YYYY/MM/DD'
   * @param {number} period
   * @param {number} booth
   * @param {number} studentRow 1 or 2（どちらの生徒行をクリアするか）
   */
  clearStudentFromSlot(sheet, dateLabel, period, booth, studentRow) {
    const dateRowMap = this.buildDateRowMap(sheet);
    const dayStartRow = dateRowMap.get(dateLabel);
    if (dayStartRow === undefined) return;

    const g = SettingsService.getBoothGridConfig();
    const boothStartRow  = dayStartRow + (booth - 1) * g.ROWS_PER_BOOTH;
    const periodStartCol = g.PERIOD_START_COLS[period - 1];
    const o = g.COL_OFFSET;

    const targetRow = boothStartRow + (studentRow - 1);
    sheet.getRange(targetRow, periodStartCol + o.STUDENT).clearContent();
    sheet.getRange(targetRow, periodStartCol + o.GRADE).clearContent();
    sheet.getRange(targetRow, periodStartCol + o.SUBJECT).clearContent();
  },

  /**
   * 時限ヘッダー行を書き込む（内部関数）。
   * @private
   */
  _writeHeaderRow(sheet) {
    const g = SettingsService.getBoothGridConfig();
    const times = g.PERIOD_TIMES || [];
    for (let periodIdx = 0; periodIdx < g.PERIOD_COUNT; periodIdx++) {
      const periodStartCol = g.PERIOD_START_COLS[periodIdx];
      const timeLabel = times[periodIdx] ? `${periodIdx + 1}限\n${times[periodIdx]}` : `${periodIdx + 1}限`;
      SheetHelper.setMergeAndValue(
        sheet, g.HEADER_ROW, periodStartCol, 1, g.BLOCK_WIDTH, timeLabel
      );
    }
  },

  /**
   * 選択セルからコマ情報と日付を含む完全なコンテキストを返す。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {number} row 1-indexed
   * @param {number} col 1-indexed
   * @returns {{ dateLabel:string, period:number, booth:number } | null}
   */
  getSlotContext(sheet, row, col) {
    const decoded = this.decodeCell(row, col);
    if (!decoded) return null;

    const dateRowMap = this.buildDateRowMap(sheet);
    const g = SettingsService.getBoothGridConfig();
    const targetStartRow = g.DATA_START_ROW + decoded.dayIndex * g.ROWS_PER_DAY;

    let dateLabel = null;
    for (const [label, startRow] of dateRowMap) {
      if (startRow === targetStartRow) {
        dateLabel = label;
        break;
      }
    }
    if (!dateLabel) return null;

    return {
      dateLabel,
      period: decoded.period,
      booth:  decoded.booth,
    };
  },
};
