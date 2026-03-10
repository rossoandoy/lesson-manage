/**
 * ImportService.gs
 * 時間割データのインポート処理
 */

const ImportService = {
  /**
   * 時間割シートへデータをインポートするエントリーポイント
   * （メニューから呼び出し）
   */
  importSchedule() {
    // TODO: Driveから時間割ファイルを選択してインポートするUIを実装
    SpreadsheetApp.getUi().alert('時間割インポート機能は実装中です。');
  },

  /**
   * 2次元配列（xlsx読み込みデータ想定）を時間割形式に変換
   * @param {any[][]} rawData
   * @returns {any[][]} headers + rows
   */
  parseScheduleData(rawData) {
    if (!rawData || rawData.length < 2) return [];
    const [header, ...rows] = rawData;
    // TODO: 実際のxlsxフォーマットに合わせてマッピングを調整
    const mapped = rows.map(row => {
      return header.map((_, i) => row[i] ?? '');
    });
    return [header, ...mapped];
  },
};
