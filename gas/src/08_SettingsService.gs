/**
 * 08_SettingsService.gs
 * 教室設定の CRUD（ScriptProperties に JSON で保存）。
 * BOOTH_GRID 互換の動的 Config を生成する。
 */

const SettingsService = {
  _KEY: 'BOOTH_SETTINGS',
  _cachedConfig: null,

  DEFAULTS: {
    classroomName:       '教室',
    boothCount:          5,
    periodCount:         10,
    periodTimes: [
      '9:00-10:00', '10:00-11:00', '11:00-12:00', '13:00-14:00',
      '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00',
      '18:00-19:00', '19:00-20:00',
    ],
    displayPeriodFrom:   1,
    displayPeriodTo:     10,
    fiscalYearStartMonth: 4,
  },

  /**
   * ScriptProperties から設定を取得してデフォルトとマージする。
   * @returns {Object} 設定オブジェクト
   */
  getSettings() {
    const raw = PropertiesService.getScriptProperties().getProperty(this._KEY);
    if (!raw) return Object.assign({}, this.DEFAULTS);
    try {
      return Object.assign({}, this.DEFAULTS, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, this.DEFAULTS);
    }
  },

  /**
   * 設定を ScriptProperties に保存する。
   * @param {Object} settings
   */
  saveSettings(settings) {
    PropertiesService.getScriptProperties()
      .setProperty(this._KEY, JSON.stringify(settings));
    this._cachedConfig = null; // キャッシュ無効化
  },

  /**
   * BOOTH_GRID 互換の Config を動的に生成する（キャッシュ付き）。
   * boothCount・periodCount から PERIOD_START_COLS・ROWS_PER_DAY を自動計算する。
   * @returns {Object} CONFIG.BOOTH_GRID 互換オブジェクト
   */
  getBoothGridConfig() {
    if (this._cachedConfig) return this._cachedConfig;
    const s = this.getSettings();
    const BLOCK_WIDTH   = CONFIG.BOOTH_GRID.BLOCK_WIDTH;
    const ROWS_PER_BOOTH = CONFIG.BOOTH_GRID.ROWS_PER_BOOTH;
    this._cachedConfig = Object.assign({}, CONFIG.BOOTH_GRID, {
      BOOTH_COUNT:  s.boothCount,
      PERIOD_COUNT: s.periodCount,
      ROWS_PER_DAY: s.boothCount * ROWS_PER_BOOTH,
      PERIOD_START_COLS: Array.from(
        { length: s.periodCount },
        (_, i) => 2 + i * BLOCK_WIDTH
      ),
      PERIOD_TIMES: s.periodTimes,
    });
    return this._cachedConfig;
  },
};
