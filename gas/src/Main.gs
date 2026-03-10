/**
 * Main.gs
 * エントリーポイント・トリガー定義
 */

/**
 * スプレッドシートを開いたときにカスタムメニューを追加
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu(CONFIG.MENU_TITLE)
    .addItem('時間割をインポート', 'ImportService.importSchedule')
    .addSeparator()
    .addItem('レッスン実績を集計', 'LessonService.aggregateLessons')
    .addItem('月次レポートを生成', 'ReportService.generateMonthlyReport')
    .addToUi();
}
