/**
 * 14_Provisioning.gs
 * マルチ教室プロビジョニング。
 * 親SSをテンプレートとして教室ごとの子SSを自動生成し、
 * テンプレート更新・定期同期を実装する。
 */

const Provisioning = {

  /** Admin 系シート名（子SSからは削除する） */
  ADMIN_SHEET_NAMES: ['Admin_Classrooms', 'Admin_Version'],

  // ─── 5.2 プロビジョニング ───

  /**
   * 1教室分の子SSを生成する。
   * @param {Object} classroom  AdminSheet.getClassrooms() の1要素
   * @returns {{ ssId:string, ssUrl:string }}
   */
  provisionOne(classroom) {
    const parentId = SpreadsheetApp.getActiveSpreadsheet().getId();
    const provision = CONFIG.PARENT.PROVISION;
    const newName = provision.NAME_PREFIX + classroom.classroomName;

    // コピー先フォルダ（指定なしなら親SSと同じフォルダ）
    const parentFile = DriveApp.getFileById(parentId);
    const folder = provision.FOLDER_ID
      ? DriveApp.getFolderById(provision.FOLDER_ID)
      : parentFile.getParents().next();

    // 親SSをコピー
    const copiedFile = parentFile.makeCopy(newName, folder);
    const copiedId = copiedFile.getId();
    const copiedSs = SpreadsheetApp.openById(copiedId);
    const copiedUrl = copiedSs.getUrl();

    // Admin系シートを子SSから削除
    this._removeAdminSheets(copiedSs);

    // Template_Cover に教室情報を書き込み
    this._updateChildCover(copiedSs, classroom);

    // 権限設定
    this._setPermissions(copiedSs, classroom.managerEmail);

    // Admin_Classrooms を更新
    const ver = AdminSheet.getLatestVersion();
    AdminSheet.upsertClassroom({
      classroomId:    classroom.classroomId,
      classroomName:  classroom.classroomName,
      managerId:      classroom.managerId,
      managerName:    classroom.managerName,
      managerEmail:   classroom.managerEmail,
      ssUrl:          copiedUrl,
      ssId:           copiedId,
      currentVersion: ver ? ver.version : '',
      syncStatus:     'ok',
    });

    // SF に URL を書き戻し
    if (classroom.classroomId) {
      try {
        SfdcApi.updateSpreadsheetUrl(classroom.classroomId, copiedUrl);
      } catch (e) {
        console.warn('SF URL 書き戻し失敗 (' + classroom.classroomName + '): ' + e.message);
      }
    }

    return { ssId: copiedId, ssUrl: copiedUrl };
  },

  /**
   * ssId が未設定の全教室を一括プロビジョニングする。
   * @returns {{ provisioned:number, errors:string[] }}
   */
  provisionAll() {
    const classrooms = AdminSheet.getClassrooms();
    const maxPerRun = CONFIG.PARENT.PROVISION.MAX_PROVISION_PER_RUN;
    const targets = classrooms.filter(c => !c.ssId).slice(0, maxPerRun);

    let provisioned = 0;
    const errors = [];

    targets.forEach(c => {
      try {
        this.provisionOne(c);
        provisioned++;
      } catch (e) {
        const msg = c.classroomName + ': ' + e.message;
        errors.push(msg);
        console.error('プロビジョニングエラー: ' + msg);
        // syncStatus にエラーを記録
        AdminSheet.upsertClassroom({
          classroomId:   c.classroomId,
          classroomName: c.classroomName,
          managerId:     c.managerId,
          managerName:   c.managerName,
          managerEmail:  c.managerEmail,
          ssUrl:         c.ssUrl,
          ssId:          c.ssId,
          currentVersion: c.currentVersion,
          syncStatus:    'エラー: ' + e.message,
        });
      }
    });

    return { provisioned, errors };
  },

  // ─── 5.3 テンプレート更新 ───

  /**
   * 1教室の子SSにテンプレートシートを更新する。
   * @param {Object} classroom  AdminSheet.getClassrooms() の1要素
   * @returns {boolean}
   */
  updateOneTemplate(classroom) {
    if (!classroom.ssId) throw new Error('SS ID が未設定です');

    const parentSs = SpreadsheetApp.getActiveSpreadsheet();
    const childSs = SpreadsheetApp.openById(classroom.ssId);
    const templateSheets = CONFIG.PARENT.PROVISION.TEMPLATE_SHEETS;

    templateSheets.forEach(sheetName => {
      const parentSheet = parentSs.getSheetByName(sheetName);
      if (!parentSheet) return; // 親に無ければスキップ

      // 子SSの同名シートを削除
      const oldSheet = childSs.getSheetByName(sheetName);
      if (oldSheet) {
        childSs.deleteSheet(oldSheet);
      }

      // 親から子へコピー & リネーム
      const copied = parentSheet.copyTo(childSs);
      copied.setName(sheetName);
    });

    // Template_Cover に教室情報を書き込み
    this._updateChildCover(childSs, classroom);

    // Admin_Classrooms を更新
    const ver = AdminSheet.getLatestVersion();
    AdminSheet.upsertClassroom({
      classroomId:    classroom.classroomId,
      classroomName:  classroom.classroomName,
      managerId:      classroom.managerId,
      managerName:    classroom.managerName,
      managerEmail:   classroom.managerEmail,
      ssUrl:          classroom.ssUrl,
      ssId:           classroom.ssId,
      currentVersion: ver ? ver.version : '',
      syncStatus:     'ok',
    });

    return true;
  },

  /**
   * ssId が設定済みの全教室のテンプレートを更新する。
   * @returns {{ updated:number, errors:string[] }}
   */
  updateAllTemplates() {
    const classrooms = AdminSheet.getClassrooms();
    const targets = classrooms.filter(c => c.ssId);

    let updated = 0;
    const errors = [];

    targets.forEach(c => {
      try {
        this.updateOneTemplate(c);
        updated++;
      } catch (e) {
        const msg = c.classroomName + ': ' + e.message;
        errors.push(msg);
        console.error('テンプレート更新エラー: ' + msg);
        AdminSheet.upsertClassroom({
          classroomId:   c.classroomId,
          classroomName: c.classroomName,
          managerId:     c.managerId,
          managerName:   c.managerName,
          managerEmail:  c.managerEmail,
          ssUrl:         c.ssUrl,
          ssId:          c.ssId,
          currentVersion: c.currentVersion,
          syncStatus:    'エラー: ' + e.message,
        });
      }
    });

    return { updated, errors };
  },

  // ─── ヘルパー ───

  /**
   * Admin 系シートを SS から削除する。
   * @param {SpreadsheetApp.Spreadsheet} ss
   */
  _removeAdminSheets(ss) {
    this.ADMIN_SHEET_NAMES.forEach(name => {
      const sheet = ss.getSheetByName(name);
      if (sheet) {
        ss.deleteSheet(sheet);
      }
    });
  },

  /**
   * Template_Cover に教室情報を書き込む。
   * @param {SpreadsheetApp.Spreadsheet} ss
   * @param {Object} classroom
   */
  _updateChildCover(ss, classroom) {
    const sheetName = CONFIG.PARENT.SHEETS.TEMPLATE_COVER;
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const cells = CONFIG.PARENT.TEMPLATE_COVER.CELLS;
    sheet.getRange(cells.CLASSROOM_NAME).setValue(classroom.classroomName || '');
    sheet.getRange(cells.MANAGER_NAME).setValue(classroom.managerName || '');

    const ver = AdminSheet.getLatestVersion();
    sheet.getRange(cells.VERSION).setValue(ver ? ver.version : '');
    sheet.getRange(cells.UPDATE_DATE).setValue(new Date());
  },

  /**
   * SS にエディター権限を付与する。
   * @param {SpreadsheetApp.Spreadsheet} ss
   * @param {string} email
   */
  _setPermissions(ss, email) {
    if (!email) return;
    try {
      DriveApp.getFileById(ss.getId()).addEditor(email);
    } catch (e) {
      console.warn('権限設定失敗 (' + email + '): ' + e.message);
    }
  },

  // ─── 5.4 トリガー ───

  /**
   * 日次同期トリガーを設定する。
   */
  installDailyTrigger() {
    // 既存トリガーを先に削除
    this.removeDailyTrigger();

    const funcName = CONFIG.PARENT.PROVISION.TRIGGER_FUNCTION;
    const hour = CONFIG.PARENT.PROVISION.TRIGGER_HOUR;

    ScriptApp.newTrigger(funcName)
      .timeBased()
      .everyDays(1)
      .atHour(hour)
      .create();
  },

  /**
   * 日次同期トリガーを削除する。
   */
  removeDailyTrigger() {
    const funcName = CONFIG.PARENT.PROVISION.TRIGGER_FUNCTION;
    const triggers = ScriptApp.getProjectTriggers();

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === funcName) {
        ScriptApp.deleteTrigger(trigger);
      }
    });
  },

  /**
   * 日次同期 + プロビジョニング（トリガーから呼び出し）。
   * SF同期 → 新規教室プロビジョニング → URL書き戻し。
   */
  dailySyncAndProvision() {
    try {
      // 1. SF → Admin_Classrooms 同期
      if (SfdcApi.hasCredentials()) {
        SfdcApi.syncClassroomsToSheet();
      }

      // 2. 新規教室のプロビジョニング
      const result = this.provisionAll();
      console.log('日次プロビジョニング完了: ' + result.provisioned + ' 件生成, ' + result.errors.length + ' 件エラー');

      // 3. URL 書き戻し
      if (SfdcApi.hasCredentials()) {
        SfdcApi.writebackAllUrls();
      }
    } catch (e) {
      console.error('dailySyncAndProvision エラー: ' + e.message);
    }
  },
};
