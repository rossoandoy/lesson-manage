/**
 * 12_PrintView.gs
 * ブース表の印刷ビュー生成。
 * 指定日付範囲のブース表を印刷用に整形する。
 */

const PrintView = {

  /**
   * 指定日付範囲のブース表を印刷用に整形する。
   * ブース表の表示範囲を絞り、印刷に適した状態にする。
   * @param {string} fromDate 'YYYY-MM-DD' or 'YYYY/MM/DD'
   * @param {string} toDate   'YYYY-MM-DD' or 'YYYY/MM/DD'
   */
  generatePrintView(fromDate, toDate) {
    const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    const startDate = SheetHelper.parseDate(fromDate);
    const endDate = SheetHelper.parseDate(toDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('日付の形式が正しくありません');
    }
    if (startDate > endDate) {
      throw new Error('開始日は終了日より前の日付を入力してください');
    }

    // 指定範囲のみ表示
    BoothGrid.setDisplayDateRange(sheet, startDate, endDate);

    // 使用されている時限を検出して表示を絞る
    const slots = BoothGrid.readAllSlots(sheet);
    let minPeriod = Infinity;
    let maxPeriod = 0;
    for (const slot of slots) {
      const slotDate = SheetHelper.parseDate(slot.dateLabel);
      slotDate.setHours(12, 0, 0, 0);
      const s = new Date(startDate); s.setHours(12, 0, 0, 0);
      const e = new Date(endDate); e.setHours(12, 0, 0, 0);
      if (slotDate >= s && slotDate <= e) {
        if (slot.period < minPeriod) minPeriod = slot.period;
        if (slot.period > maxPeriod) maxPeriod = slot.period;
      }
    }

    // コマがある場合のみ時限を絞る
    if (minPeriod <= maxPeriod) {
      BoothGrid.setDisplayPeriods(sheet, minPeriod, maxPeriod);
    }

    // ブース表シートをアクティブにする
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sheet);

    const fromStr = SheetHelper.formatDate(startDate);
    const toStr = SheetHelper.formatDate(endDate);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      `印刷ビュー: ${fromStr} 〜 ${toStr} を表示中。印刷後、表示設定を戻してください。`
    );
  },

  /**
   * 日付範囲入力ダイアログを表示する。
   */
  showPrintDialog() {
    const html = HtmlService.createHtmlOutputFromFile('dialog_printview')
      .setWidth(380)
      .setHeight(260)
      .setTitle('ブース表 印刷ビュー');
    SpreadsheetApp.getUi().showModalDialog(html, 'ブース表を印刷用に表示');
  },
};
