/**
 * 06_ReportSheet.gs
 * 回数報告シートの集計・書き込み。
 */

const ReportSheet = {

  /**
   * メニューから呼び出し。生徒選択→集計→書き込み。
   */
  generateReport() {
    const ui = SpreadsheetApp.getUi();
    const students = this._getStudentNames();
    if (students.length === 0) {
      ui.alert('master_students に生徒データがありません');
      return;
    }

    const response = ui.prompt(
      '回数報告',
      `生徒名を入力してください:\n${students.join(', ')}`,
      ui.ButtonSet.OK_CANCEL
    );
    if (response.getSelectedButton() !== ui.Button.OK) return;

    const studentName = response.getResponseText().trim();
    if (!students.includes(studentName)) {
      ui.alert(`「${studentName}」は生徒リストにありません`);
      return;
    }

    const stats = this.aggregateByMonth(studentName);
    const sheet = SheetHelper.getOrCreateSheet(CONFIG.SHEETS.REPORT);
    this.writeRightHalf(sheet, stats, studentName);
    this.writeTranReferences(sheet, studentName);

    ui.alert(`「${studentName}」の回数報告を更新しました`);
  },

  /**
   * 印刷シートから生徒の月別集計を行う。
   * @param {string} studentName
   * @returns {Object} { yearMonth: { plan, attended, absent, transfer }, ... }
   */
  aggregateByMonth(studentName) {
    const rows = PrintSheet.findByStudent(studentName);
    const c = CONFIG.PRINT_SHEET.COLS;
    const stats = {};

    rows.forEach(({ data }) => {
      const dateVal = data[c.DATE - 1];
      if (!(dateVal instanceof Date)) return;

      const ym = SheetHelper.formatDate(dateVal).slice(0, 7); // 'YYYY/MM'
      if (!stats[ym]) {
        stats[ym] = { plan: 0, attended: 0, absent: 0, transfer: 0 };
      }
      stats[ym].plan++;

      const attendance = data[c.ATTENDANCE - 1];
      if (attendance === '出席')   stats[ym].attended++;
      if (attendance === '欠席')   stats[ym].absent++;
      if (attendance === '振替')   stats[ym].transfer++;
    });

    return stats;
  },

  /**
   * 集計値を右半分（F〜J列）に書き込む。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {Object} stats aggregateByMonth の戻り値
   * @param {string} [studentName] 前年度累計を加算する場合に指定
   */
  writeRightHalf(sheet, stats, studentName) {
    const r = CONFIG.REPORT_SHEET;
    const c = r.COLS_RIGHT;

    // ソートされた年月リスト
    const sortedYm = Object.keys(stats).sort();

    let totalPlan = 0, totalAttended = 0, totalAbsent = 0, totalTransfer = 0;

    sortedYm.forEach((ym, i) => {
      const row = r.DATA_START_ROW + i;
      const s = stats[ym];

      // 年月ラベル
      sheet.getRange(row, 1).setValue(ym);

      // 集計値
      sheet.getRange(row, c.PLAN).setValue(s.plan);
      sheet.getRange(row, c.ATTENDED).setValue(s.attended);
      sheet.getRange(row, c.ABSENT).setValue(s.absent);
      sheet.getRange(row, c.TRANSFER).setValue(s.transfer);
      sheet.getRange(row, c.BALANCE).setValue(s.plan - s.attended);

      totalPlan     += s.plan;
      totalAttended += s.attended;
      totalAbsent   += s.absent;
      totalTransfer += s.transfer;
    });

    // 今年度合計行
    const totalRow = r.TOTAL_ROW;
    sheet.getRange(totalRow, c.PLAN).setValue(totalPlan);
    sheet.getRange(totalRow, c.ATTENDED).setValue(totalAttended);
    sheet.getRange(totalRow, c.ABSENT).setValue(totalAbsent);
    sheet.getRange(totalRow, c.TRANSFER).setValue(totalTransfer);
    sheet.getRange(totalRow, c.BALANCE).setValue(totalPlan - totalAttended);

    // 前年度累計を加算して総合計行に書き込み
    const prev = studentName ? this.getPrevYearTotals(studentName) : { plan:0, attended:0, absent:0, transfer:0 };
    const grandRow = r.GRAND_TOTAL_ROW;
    const grandPlan     = totalPlan     + prev.plan;
    const grandAttended = totalAttended + prev.attended;
    const grandAbsent   = totalAbsent   + prev.absent;
    const grandTransfer = totalTransfer + prev.transfer;
    sheet.getRange(grandRow, c.PLAN).setValue(grandPlan);
    sheet.getRange(grandRow, c.ATTENDED).setValue(grandAttended);
    sheet.getRange(grandRow, c.ABSENT).setValue(grandAbsent);
    sheet.getRange(grandRow, c.TRANSFER).setValue(grandTransfer);
    sheet.getRange(grandRow, c.BALANCE).setValue(grandPlan - grandAttended);
  },

  /**
   * A〜E列に tran シートへの参照式をセットする。
   * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
   * @param {string} studentName
   */
  writeTranReferences(sheet, studentName) {
    const r = CONFIG.REPORT_SHEET;
    const tc = CONFIG.TRAN_SHEET.COLS;

    const sortedYm = this._getSortedYearMonths(studentName);

    sortedYm.forEach((ym, i) => {
      const row = r.DATA_START_ROW + i;
      const tranSheet = CONFIG.SHEETS.TRAN;

      // MATCH で tran シートから対応行を引く参照式（VLOOKUP 風）
      const formula =
        `=IFERROR(INDEX(${tranSheet}!$A:$A,MATCH("${studentName}"&"${ym}",` +
        `${tranSheet}!$B:$B&${tranSheet}!$C:$C,0)),"")`;
      sheet.getRange(row, r.COLS_LEFT.STUDENT_ID).setFormula(formula);
    });
  },

  /**
   * 前年度累計を ScriptProperties に保存する。
   * @param {string} studentName
   * @param {{ plan:number, attended:number, absent:number, transfer:number }} totals
   */
  setPrevYearTotals(studentName, totals) {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('PREV_YEAR_TOTALS_' + studentName, JSON.stringify(totals));
  },

  /**
   * 前年度累計を ScriptProperties から取得する。
   * @param {string} studentName
   * @returns {{ plan:number, attended:number, absent:number, transfer:number }}
   */
  getPrevYearTotals(studentName) {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('PREV_YEAR_TOTALS_' + studentName);
    if (!raw) return { plan: 0, attended: 0, absent: 0, transfer: 0 };
    try {
      return JSON.parse(raw);
    } catch (e) {
      return { plan: 0, attended: 0, absent: 0, transfer: 0 };
    }
  },

  /**
   * メニューから前年度累計を設定する。
   */
  promptPrevYearTotals() {
    const ui = SpreadsheetApp.getUi();
    const students = this._getStudentNames();
    if (students.length === 0) {
      ui.alert('master_students に生徒データがありません');
      return;
    }

    const nameResp = ui.prompt('前年度累計設定', `生徒名を入力:\n${students.join(', ')}`, ui.ButtonSet.OK_CANCEL);
    if (nameResp.getSelectedButton() !== ui.Button.OK) return;
    const studentName = nameResp.getResponseText().trim();
    if (!students.includes(studentName)) {
      ui.alert(`「${studentName}」は生徒リストにありません`);
      return;
    }

    const current = this.getPrevYearTotals(studentName);
    const valResp = ui.prompt(
      '前年度累計設定',
      `${studentName} の前年度累計を入力（カンマ区切り: 予定,出席,欠席,振替）\n現在値: ${current.plan},${current.attended},${current.absent},${current.transfer}`,
      ui.ButtonSet.OK_CANCEL
    );
    if (valResp.getSelectedButton() !== ui.Button.OK) return;

    const parts = valResp.getResponseText().split(',').map(s => parseInt(s.trim()) || 0);
    if (parts.length < 4) {
      ui.alert('4つの数値をカンマ区切りで入力してください');
      return;
    }

    this.setPrevYearTotals(studentName, {
      plan: parts[0], attended: parts[1], absent: parts[2], transfer: parts[3],
    });
    ui.alert(`${studentName} の前年度累計を保存しました`);
  },

  /**
   * 全生徒一括でレポートを生成する。生徒ごとに「回数報告_生徒名」シートを作成。
   */
  generateAllReports() {
    const students = this._getStudentNames();
    if (students.length === 0) {
      SpreadsheetApp.getUi().alert('master_students に生徒データがありません');
      return;
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    students.forEach((studentName, idx) => {
      ss.toast(`${idx + 1}/${students.length}: ${studentName} のレポートを生成中...`);
      const sheetName = '回数報告_' + studentName;
      const sheet = SheetHelper.getOrCreateSheet(sheetName);

      // 既存データクリア
      sheet.clear();

      // ヘッダー
      sheet.getRange(1, 1).setValue('生徒名');
      sheet.getRange(1, 2).setValue(studentName);
      sheet.getRange(1, 1, 1, 2).setFontWeight('bold');

      const stats = this.aggregateByMonth(studentName);
      this.writeRightHalf(sheet, stats, studentName);
      this.writeTranReferences(sheet, studentName);
    });

    ss.toast(`全${students.length}名のレポートを生成しました`);
    SpreadsheetApp.getUi().alert(`${students.length}名のレポートを生成しました`);
  },

  // --- プライベートヘルパー ---

  /**
   * master_students から生徒名一覧を取得する。
   * @returns {string[]}
   */
  _getStudentNames() {
    try {
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.STUDENTS);
      const m = CONFIG.MASTER.STUDENTS;
      const lastRow = sheet.getLastRow();
      if (lastRow < m.DATA_START_ROW) return [];
      const numRows = lastRow - m.DATA_START_ROW + 1;
      const values = SheetHelper.batchGetValues(sheet, m.DATA_START_ROW, m.COLS.NAME, numRows, 1);
      return values.map((r) => String(r[0])).filter(Boolean);
    } catch (e) {
      return [];
    }
  },

  /**
   * 集計対象の年月リストを返す（印刷シートから）。
   * @param {string} studentName
   * @returns {string[]} ソート済み 'YYYY/MM'
   */
  _getSortedYearMonths(studentName) {
    const stats = this.aggregateByMonth(studentName);
    return Object.keys(stats).sort();
  },
};
