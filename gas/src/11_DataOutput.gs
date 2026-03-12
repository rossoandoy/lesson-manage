/**
 * 11_DataOutput.gs
 * データ出力シートの生成・フィルタリング。
 * ブース表の全コマをリスト化し、生徒名・講師名・期間でフィルタ可能。
 */

const DataOutput = {

  /**
   * ブース表の全コマからデータ出力シートを生成する。
   * フィルタ条件を指定可能。
   * @param {Object} [filter]
   * @param {string} [filter.studentName]  生徒名（部分一致）
   * @param {string} [filter.teacherName]  講師名（部分一致）
   * @param {string} [filter.fromDate]     'YYYY-MM-DD' or 'YYYY/MM/DD'
   * @param {string} [filter.toDate]       'YYYY-MM-DD' or 'YYYY/MM/DD'
   */
  generate(filter) {
    filter = filter || {};
    const boothSheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    const slots = BoothGrid.readAllSlots(boothSheet);

    // フィルタ用の日付を準備
    let fromTime = null;
    let toTime = null;
    if (filter.fromDate) {
      const d = SheetHelper.parseDate(filter.fromDate);
      d.setHours(0, 0, 0, 0);
      fromTime = d.getTime();
    }
    if (filter.toDate) {
      const d = SheetHelper.parseDate(filter.toDate);
      d.setHours(23, 59, 59, 999);
      toTime = d.getTime();
    }

    // コマを行データに展開（1:2 は 2行に分割）
    const rows = [];
    for (const slot of slots) {
      const slotDate = SheetHelper.parseDate(slot.dateLabel);

      // 期間フィルタ
      if (fromTime !== null) {
        const t = new Date(slotDate); t.setHours(0, 0, 0, 0);
        if (t.getTime() < fromTime) continue;
      }
      if (toTime !== null) {
        const t = new Date(slotDate); t.setHours(23, 59, 59, 999);
        if (t.getTime() > toTime) continue;
      }

      // 講師フィルタ
      if (filter.teacherName && !slot.teacherName.includes(filter.teacherName)) {
        continue;
      }

      const weekday = SheetHelper.getWeekdayName(slotDate);

      // 生徒1
      if (slot.student1Name) {
        if (!filter.studentName || slot.student1Name.includes(filter.studentName)) {
          rows.push([
            slotDate, weekday, slot.period, slot.booth,
            slot.teacherName, slot.student1Name, slot.student1Grade,
            slot.subject1, slot.capacity,
          ]);
        }
      }

      // 生徒2（1:2 の場合）
      if (slot.student2Name) {
        if (!filter.studentName || slot.student2Name.includes(filter.studentName)) {
          rows.push([
            slotDate, weekday, slot.period, slot.booth,
            slot.teacherName, slot.student2Name, slot.student2Grade,
            slot.subject2, slot.capacity,
          ]);
        }
      }

      // 生徒なし（講師のみ配置）の場合も出力
      if (!slot.student1Name && !slot.student2Name && !filter.studentName) {
        rows.push([
          slotDate, weekday, slot.period, slot.booth,
          slot.teacherName, '', '', '', slot.capacity,
        ]);
      }
    }

    // ソート: 日付→時限→ブース
    rows.sort((a, b) => {
      const dateA = a[0] instanceof Date ? a[0].getTime() : 0;
      const dateB = b[0] instanceof Date ? b[0].getTime() : 0;
      return dateA - dateB || a[2] - b[2] || a[3] - b[3];
    });

    // シートに書き込み
    const sheet = this._initSheet();
    const cfg = CONFIG.DATA_OUTPUT_SHEET;

    if (rows.length === 0) {
      SpreadsheetApp.getActiveSpreadsheet().toast('該当するコマがありません');
      return;
    }

    SheetHelper.batchSetValues(sheet, cfg.DATA_START_ROW, 1, rows);

    // 日付列フォーマット
    sheet.getRange(cfg.DATA_START_ROW, cfg.COLS.DATE, rows.length, 1)
      .setNumberFormat('yyyy/MM/dd');

    // 列幅自動調整
    for (let col = 1; col <= 9; col++) {
      sheet.autoResizeColumn(col);
    }

    SpreadsheetApp.getActiveSpreadsheet().toast(
      `データ出力: ${rows.length}件を出力しました`
    );
  },

  /**
   * データ出力シートを初期化（ヘッダー設定）する。
   * @returns {GoogleAppsScript.Spreadsheet.Sheet}
   */
  _initSheet() {
    const cfg = CONFIG.DATA_OUTPUT_SHEET;
    const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.DATA_OUTPUT);

    // 既存データをクリア
    sheet.clear();

    // ヘッダー行
    const headers = ['日付', '曜日', '時限', 'ブース', '講師', '生徒', '学年', '教科', '定員'];
    sheet.getRange(cfg.HEADER_ROW, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(cfg.HEADER_ROW, 1, 1, headers.length).setFontWeight('bold');

    // ヘッダー行をフリーズ
    sheet.setFrozenRows(cfg.HEADER_ROW);

    return sheet;
  },

  /**
   * フィルタ条件入力ダイアログを表示する。
   */
  showFilterDialog() {
    const html = HtmlService.createHtmlOutputFromFile('dialog_dataoutput')
      .setWidth(400)
      .setHeight(320)
      .setTitle('データ出力');
    SpreadsheetApp.getUi().showModalDialog(html, 'データ出力（フィルタ付き）');
  },
};
