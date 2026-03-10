/**
 * LessonService.gs
 * レッスン実績の管理・集計ロジック
 */

const LessonService = {
  /**
   * レッスン実績を集計するエントリーポイント
   * （メニューから呼び出し）
   */
  aggregateLessons() {
    // TODO: 実績シートを読み込み、集計処理を実装
    SpreadsheetApp.getUi().alert('レッスン実績集計機能は実装中です。');
  },

  /**
   * 指定期間のレッスン実績を取得
   * @param {Date} startDate
   * @param {Date} endDate
   * @returns {any[][]}
   */
  getLessonsInRange(startDate, endDate) {
    const data = SheetHelper.getAllData(CONFIG.SHEETS.LESSONS);
    if (data.length < 2) return [];
    const [, ...rows] = data;
    return rows.filter(row => {
      const lessonDate = row[0]; // 日付列想定
      return lessonDate >= startDate && lessonDate <= endDate;
    });
  },

  /**
   * 講師別・月別のレッスン数を集計
   * @param {any[][]} lessonRows
   * @returns {Object} { teacherName: { 'YYYY/MM': count } }
   */
  aggregateByTeacherAndMonth(lessonRows) {
    const result = {};
    lessonRows.forEach(row => {
      const date    = row[0];
      const teacher = row[2]; // 講師列想定
      const monthKey = Utilities.formatDate(new Date(date), CONFIG.TIMEZONE, 'yyyy/MM');
      if (!result[teacher]) result[teacher] = {};
      result[teacher][monthKey] = (result[teacher][monthKey] || 0) + 1;
    });
    return result;
  },
};
