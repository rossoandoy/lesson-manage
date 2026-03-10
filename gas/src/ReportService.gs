/**
 * ReportService.gs
 * 月次レポートの生成
 */

const ReportService = {
  /**
   * 月次レポートを生成するエントリーポイント
   * （メニューから呼び出し）
   */
  generateMonthlyReport() {
    // TODO: 対象月を選択するUIと集計・出力処理を実装
    SpreadsheetApp.getUi().alert('月次レポート生成機能は実装中です。');
  },

  /**
   * 集計結果をシートに書き出す
   * @param {string} sheetName 出力先シート名
   * @param {string} targetMonth 'YYYY/MM' 形式
   * @param {Object} summary { teacherName: count }
   */
  writeReportSheet(sheetName, targetMonth, summary) {
    const headers = ['講師名', `${targetMonth} レッスン数`];
    const rows = Object.entries(summary).map(([name, count]) => [name, count]);
    SheetHelper.writeData(sheetName, [headers, ...rows]);
  },
};
