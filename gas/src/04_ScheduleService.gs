/**
 * 04_ScheduleService.gs
 * コマ組のビジネスロジック。BoothGrid + PrintSheet を調整する。
 *
 * ScheduleEntry 型:
 * {
 *   dateLabel:     string,  // 'YYYY/MM/DD'
 *   period:        number,  // 1〜N
 *   booth:         number,  // 1〜N
 *   teacherName:   string,
 *   student1Name:  string,
 *   student1Grade: string,
 *   subject1:      string,
 *   student2Name:  string,  // optional
 *   student2Grade: string,  // optional
 *   subject2:      string,  // optional
 *   capacity:      string,  // '1：1' | '1：2'
 * }
 */

const ScheduleService = {

  /**
   * 選択セルからコンテキストを取得してダイアログを表示する。
   */
  openDialog() {
    const sheet = SpreadsheetApp.getActiveSheet();
    if (sheet.getName() !== CONFIG.SHEETS.BOOTH) {
      SpreadsheetApp.getUi().alert('ブース表のセルを選択してからメニューを実行してください');
      return;
    }
    const range = sheet.getActiveCell();
    const context = BoothGrid.getSlotContext(sheet, range.getRow(), range.getColumn());
    if (!context) {
      SpreadsheetApp.getUi().alert('時限セル（データ領域）を選択してください');
      return;
    }

    const props = PropertiesService.getScriptProperties();
    props.setProperty('DIALOG_CONTEXT', JSON.stringify(context));

    const html = HtmlService.createHtmlOutputFromFile('dialog_schedule')
      .setWidth(520)
      .setHeight(660);
    SpreadsheetApp.getUi().showModalDialog(html, 'コマを組む');
  },

  /**
   * ダイアログ初期化データを返す（google.script.run から呼び出し）。
   */
  getDialogInitData() {
    const props = PropertiesService.getScriptProperties();
    const context = JSON.parse(props.getProperty('DIALOG_CONTEXT') || '{}');
    return {
      context,
      teachers: this._getMasterList(CONFIG.SHEETS.STAFFS,  CONFIG.MASTER.STAFFS),
      students: this._getMasterList(CONFIG.SHEETS.STUDENTS, CONFIG.MASTER.STUDENTS),
      subjects: this._getSubjectList(),
    };
  },

  /**
   * ダイアログの送信データを処理する。
   * @param {Object} formData
   * @returns {{ success:boolean, message:string, count:number }}
   */
  processSubmit(formData) {
    try {
      const entries = this.expandRepeatPattern(formData);
      if (entries.length === 0) {
        return { success: false, message: '書き込む対象の日付がありません', placed: [], skipped: [] };
      }

      const conflicts = this.checkConflicts(entries, formData._teacherOnly);
      const conflictKeys = new Set(conflicts.map(c => c.dateLabel + '|' + c.period + '|' + c.booth));
      const toWrite = entries.filter(e => !conflictKeys.has(e.dateLabel + '|' + e.period + '|' + e.booth));

      if (toWrite.length > 0) this.writeAll(toWrite);

      const placed  = toWrite.map(e => e.dateLabel + ' ' + e.period + '限');
      const skipped = conflicts.map(c => c.dateLabel + ' ' + c.period + '限（既存データあり）');

      return {
        success: toWrite.length > 0,
        message: this._buildResultMessage(placed, skipped),
        count:   toWrite.length,
        placed,
        skipped,
      };
    } catch (err) {
      return { success: false, message: err.message, placed: [], skipped: [] };
    }
  },

  /**
   * フォームデータからエントリ配列を生成する（繰り返し展開）。
   * @param {Object} formData
   * @returns {ScheduleEntry[]}
   */
  expandRepeatPattern(formData) {
    const dates = this._generateDates(
      formData.startDate,
      formData.endDate,
      formData.repeat
    );

    return dates.map((dateLabel) => ({
      dateLabel,
      period:        Number(formData.period),
      booth:         Number(formData.booth),
      teacherName:   formData.teacherName   || '',
      student1Name:  formData.student1Name  || '',
      student1Grade: formData.student1Grade || '',
      subject1:      formData.subject1      || '',
      student2Name:  formData.student2Name  || '',
      student2Grade: formData.student2Grade || '',
      subject2:      formData.subject2      || '',
      capacity:      formData.capacity      || '1：1',
    }));
  },

  /**
   * 衝突チェック: ブース表に既存データがあるコマを返す。
   * @param {ScheduleEntry[]} entries
   * @param {boolean} [teacherOnly=false] 講師配置のみの場合は講師セルのみチェック
   * @returns {ScheduleEntry[]}
   */
  checkConflicts(entries, teacherOnly) {
    const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    const dateRowMap = BoothGrid.buildDateRowMap(sheet);
    const g = SettingsService.getBoothGridConfig();
    const conflicts = [];

    entries.forEach((entry) => {
      const dayStartRow = dateRowMap.get(entry.dateLabel);
      if (dayStartRow === undefined) return;

      const boothStartRow = dayStartRow + (entry.booth - 1) * g.ROWS_PER_BOOTH;
      const periodStartCol = g.PERIOD_START_COLS[entry.period - 1];

      if (teacherOnly) {
        // 講師配置：講師セルが空の場合のみ許可
        const teacherVal = sheet.getRange(
          boothStartRow, periodStartCol + g.COL_OFFSET.TEACHER
        ).getValue();
        if (teacherVal && String(teacherVal).trim() !== '') {
          conflicts.push(entry);
        }
      } else {
        // 生徒配置：生徒1セルが空の場合のみ許可（2人目追加は別途）
        const student1Val = sheet.getRange(
          boothStartRow, periodStartCol + g.COL_OFFSET.STUDENT
        ).getValue();
        if (student1Val && String(student1Val).trim() !== '') {
          conflicts.push(entry);
        }
      }
    });
    return conflicts;
  },

  /**
   * ブース表 + 印刷シートに一括書き込む。
   * @param {ScheduleEntry[]} entries
   */
  writeAll(entries) {
    const boothSheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    entries.forEach((entry) => {
      BoothGrid.writeSlot(boothSheet, entry);
    });
    PrintSheet.appendEntries(entries);
  },

  /**
   * サイドバーを開く。
   */
  openSidebar() {
    const html = HtmlService.createHtmlOutputFromFile('sidebar_schedule')
      .setTitle('コマ組')
      .setWidth(320);
    SpreadsheetApp.getUi().showSidebar(html);
  },

  /**
   * サイドバー初期化データを返す（google.script.run から呼び出し）。
   * @returns {{ teachers, students, subjects, slotStatus, settings }}
   */
  getSidebarData() {
    return {
      teachers:   this._getMasterList(CONFIG.SHEETS.STAFFS,  CONFIG.MASTER.STAFFS),
      students:   this._getMasterList(CONFIG.SHEETS.STUDENTS, CONFIG.MASTER.STUDENTS),
      subjects:   this._getSubjectList(),
      slotStatus: this.getSlotStatus(),
      settings:   SettingsService.getSettings(),
    };
  },

  /**
   * 現在のアクティブセルのコマ状態を返す（講師・生徒情報を含む）。
   * @returns {{ dateLabel, period, booth, teacherName, student1Name, student2Name } | null}
   */
  getSlotStatus() {
    const slot = this._getActiveSlot();
    if (!slot) return null;

    const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    const dateRowMap = BoothGrid.buildDateRowMap(sheet);
    const dayStartRow = dateRowMap.get(slot.dateLabel);
    if (!dayStartRow) {
      return Object.assign({}, slot, { teacherName: '', student1Name: '', student2Name: '' });
    }

    const g = SettingsService.getBoothGridConfig();
    const boothStartRow  = dayStartRow + (slot.booth - 1) * g.ROWS_PER_BOOTH;
    const periodStartCol = g.PERIOD_START_COLS[slot.period - 1];
    const o = g.COL_OFFSET;

    return Object.assign({}, slot, {
      teacherName:  String(sheet.getRange(boothStartRow,     periodStartCol + o.TEACHER ).getValue() || ''),
      student1Name: String(sheet.getRange(boothStartRow,     periodStartCol + o.STUDENT ).getValue() || ''),
      student2Name: String(sheet.getRange(boothStartRow + 1, periodStartCol + o.STUDENT ).getValue() || ''),
    });
  },

  /**
   * 講師のみをブース表に配置する（google.script.run から呼び出し）。
   * @param {Object} formData  teacherName, endDate, repeat を含む
   * @returns {{ success:boolean, message:string, count?:number }}
   */
  placeTeacherFromSidebar(formData) {
    const slot = this._getActiveSlot();
    if (!slot) {
      return { success: false, message: 'ブース表のコマセルを選択してください' };
    }
    const fullFormData = Object.assign({}, formData, slot, {
      startDate:     slot.dateLabel,
      student1Name:  '',
      student1Grade: '',
      subject1:      '',
      student2Name:  '',
      student2Grade: '',
      subject2:      '',
      _teacherOnly:  true,
    });
    return this.processSubmit(fullFormData);
  },

  /**
   * サイドバーからコマを配置する（生徒配置）。
   * @param {Object} formData
   * @returns {{ success:boolean, message:string, count?:number }}
   */
  placeScheduleFromSidebar(formData) {
    const slot = this._getActiveSlot();
    if (!slot) {
      return { success: false, message: 'ブース表のコマセルを選択してください' };
    }
    // capacity を自動判定: student2Name があれば 1:2、なければ 1:1
    const capacity = (formData.student2Name && String(formData.student2Name).trim() !== '')
      ? '1：2' : '1：1';
    // teacherName をブース表の既存データから取得（フロントから渡されなかった場合）
    if (!formData.teacherName) {
      const status = this.getSlotStatus();
      if (status) formData.teacherName = status.teacherName || '';
    }
    const fullFormData = Object.assign({}, formData, slot, {
      startDate: slot.dateLabel,
      capacity:  capacity,
    });
    return this.processSubmit(fullFormData);
  },

  /**
   * 現在選択中のコマを削除する。
   * @returns {{ success:boolean, message:string }}
   */
  deleteCurrentSlot() {
    const slot = this._getActiveSlot();
    if (!slot) {
      return { success: false, message: 'ブース表のコマセルを選択してください' };
    }
    try {
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
      BoothGrid.clearSlot(sheet, slot.dateLabel, slot.period, slot.booth);
      PrintSheet.deleteBySlot(slot.dateLabel, slot.period, slot.booth);
      return { success: true, message: `${slot.dateLabel} ${slot.period}限 ブース${slot.booth} を削除しました` };
    } catch (e) {
      return { success: false, message: 'エラー: ' + e.message };
    }
  },

  /**
   * 指定日の全コマを一括削除する（休校日対応）。
   * @param {string} dateStr 'YYYY/MM/DD' or 'YYYY-MM-DD'
   * @returns {{ success:boolean, message:string, count:number }}
   */
  bulkDeleteByDate(dateStr) {
    try {
      const normalizedDate = dateStr.replace(/-/g, '/');
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
      const allSlots = BoothGrid.readAllSlots(sheet);
      const targets = allSlots.filter((s) => s.dateLabel === normalizedDate);

      if (targets.length === 0) {
        return { success: true, message: '該当日にコマがありません', count: 0 };
      }

      targets.forEach((s) => {
        BoothGrid.clearSlot(sheet, s.dateLabel, s.period, s.booth);
        PrintSheet.deleteBySlot(s.dateLabel, s.period, s.booth);
      });

      return { success: true, message: `${normalizedDate} の ${targets.length}コマを削除しました`, count: targets.length };
    } catch (e) {
      return { success: false, message: 'エラー: ' + e.message, count: 0 };
    }
  },

  /**
   * 指定生徒の指定日以降の全コマを一括削除する（途中解約対応）。
   * 1:1 → コマ全体クリア / 1:2 の片方 → その生徒のみクリア
   * @param {string} studentName
   * @param {string} fromDateStr 'YYYY/MM/DD' or 'YYYY-MM-DD'
   * @returns {{ success:boolean, message:string, count:number }}
   */
  bulkDeleteByStudent(studentName, fromDateStr) {
    try {
      const fromDate = SheetHelper.parseDate(fromDateStr.replace(/-/g, '/'));
      fromDate.setHours(12, 0, 0, 0);
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
      const allSlots = BoothGrid.readAllSlots(sheet);

      const targets = allSlots.filter((s) => {
        const slotDate = SheetHelper.parseDate(s.dateLabel);
        slotDate.setHours(12, 0, 0, 0);
        if (slotDate < fromDate) return false;
        return s.student1Name === studentName || s.student2Name === studentName;
      });

      if (targets.length === 0) {
        return { success: true, message: '該当するコマがありません', count: 0 };
      }

      targets.forEach((s) => {
        const isStudent1 = s.student1Name === studentName;
        const isStudent2 = s.student2Name === studentName;

        if ((isStudent1 && !s.student2Name) || (isStudent1 && isStudent2)) {
          // 1:1 or 両方同じ生徒 → コマ全体クリア
          BoothGrid.clearSlot(sheet, s.dateLabel, s.period, s.booth);
          PrintSheet.deleteBySlot(s.dateLabel, s.period, s.booth);
        } else if (isStudent1) {
          // 1:2 の生徒1 → 生徒1をクリア
          BoothGrid.clearStudentFromSlot(sheet, s.dateLabel, s.period, s.booth, 1);
          PrintSheet.deleteBySlot(s.dateLabel, s.period, s.booth);
          // 印刷シートを再構築（生徒2を生徒1に繰り上げ）
          PrintSheet.appendEntries([{
            dateLabel: s.dateLabel, period: s.period, booth: s.booth,
            teacherName: s.teacherName,
            student1Name: s.student2Name, student1Grade: s.student2Grade, subject1: s.subject2,
            student2Name: '', student2Grade: '', subject2: '',
            capacity: '1：1',
          }]);
        } else if (isStudent2) {
          // 1:2 の生徒2 → 生徒2のみクリア
          BoothGrid.clearStudentFromSlot(sheet, s.dateLabel, s.period, s.booth, 2);
          PrintSheet.deleteBySlot(s.dateLabel, s.period, s.booth);
          PrintSheet.appendEntries([{
            dateLabel: s.dateLabel, period: s.period, booth: s.booth,
            teacherName: s.teacherName,
            student1Name: s.student1Name, student1Grade: s.student1Grade, subject1: s.subject1,
            student2Name: '', student2Grade: '', subject2: '',
            capacity: '1：1',
          }]);
        }
      });

      return { success: true, message: `${studentName} の ${targets.length}コマを削除しました`, count: targets.length };
    } catch (e) {
      return { success: false, message: 'エラー: ' + e.message, count: 0 };
    }
  },

  /**
   * 講師の指定日以降の全コマを一括削除する。
   * 講師がいなければコマとして成立しないため、コマ全体を削除する。
   * @param {string} teacherName
   * @param {string} fromDateStr 'YYYY/MM/DD' or 'YYYY-MM-DD'
   * @returns {{ success:boolean, message:string, count:number }}
   */
  bulkDeleteByTeacher(teacherName, fromDateStr) {
    try {
      const fromDate = SheetHelper.parseDate(fromDateStr.replace(/-/g, '/'));
      fromDate.setHours(12, 0, 0, 0);
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
      const allSlots = BoothGrid.readAllSlots(sheet);

      const targets = allSlots.filter((s) => {
        const slotDate = SheetHelper.parseDate(s.dateLabel);
        slotDate.setHours(12, 0, 0, 0);
        if (slotDate < fromDate) return false;
        return s.teacherName === teacherName;
      });

      if (targets.length === 0) {
        return { success: true, message: '該当するコマがありません', count: 0 };
      }

      targets.forEach((s) => {
        BoothGrid.clearSlot(sheet, s.dateLabel, s.period, s.booth);
        PrintSheet.deleteBySlot(s.dateLabel, s.period, s.booth);
      });

      return { success: true, message: `${teacherName} の ${targets.length}コマを削除しました`, count: targets.length };
    } catch (e) {
      return { success: false, message: 'エラー: ' + e.message, count: 0 };
    }
  },

  /**
   * 出欠を記録する（サイドバーから呼び出し）。
   * @param {string} dateLabel 'YYYY/MM/DD'
   * @param {number} period
   * @param {number} booth
   * @param {string} studentName
   * @param {string} status '出席' | '欠席' | '振替'
   * @param {string} [transferToDate] 振替先日付（振替時のみ）
   * @returns {{ success:boolean, message:string }}
   */
  markAttendance(dateLabel, period, booth, studentName, status, transferToDate) {
    try {
      // 印刷シートの出欠列を更新
      PrintSheet.setAttendance(dateLabel, period, booth, studentName, status);

      // 振替の場合: 振替先とリンク
      if (status === '振替' && transferToDate) {
        const normalizedTo = transferToDate.replace(/-/g, '/');
        const fromSlot = { dateLabel, period, booth };
        // 振替先のコマ情報を印刷シートから検索（同じ生徒の別日コマ）
        const rows = PrintSheet.findByStudent(studentName);
        const c = CONFIG.PRINT_SHEET.COLS;
        const toRow = rows.find(r => {
          const d = r.data[c.DATE - 1];
          const dl = (d instanceof Date) ? SheetHelper.formatDate(d) : '';
          return dl === normalizedTo;
        });
        if (toRow) {
          const toSlot = {
            dateLabel: normalizedTo,
            period: Number(toRow.data[c.PERIOD - 1]),
            booth:  Number(toRow.data[c.BOOTH - 1]),
          };
          PrintSheet.linkTransfer(fromSlot, toSlot, studentName);
        }
      }

      return { success: true, message: `${studentName} の出欠を「${status}」に更新しました` };
    } catch (e) {
      return { success: false, message: 'エラー: ' + e.message };
    }
  },

  /**
   * 配置結果メッセージを構築する。
   * @param {string[]} placed  成功リスト
   * @param {string[]} skipped スキップリスト
   * @returns {string}
   */
  _buildResultMessage(placed, skipped) {
    if (placed.length > 0 && skipped.length === 0) {
      return `${placed.length}コマを登録しました`;
    }
    if (placed.length === 0 && skipped.length > 0) {
      return `全${skipped.length}コマが既存データのため配置できませんでした`;
    }
    return `${placed.length}コマ登録、${skipped.length}コマスキップ（既存データあり）`;
  },

  // --- プライベートヘルパー ---

  /**
   * アクティブセルからコマ情報を取得する。
   * @returns {{ dateLabel:string, period:number, booth:number } | null}
   */
  _getActiveSlot() {
    try {
      const sheet = SpreadsheetApp.getActiveSheet();
      if (sheet.getName() !== CONFIG.SHEETS.BOOTH) return null;
      const cell = sheet.getActiveCell();
      return BoothGrid.getSlotContext(sheet, cell.getRow(), cell.getColumn());
    } catch (e) {
      return null;
    }
  },

  /**
   * 日付リストを生成する。
   * @param {string} startDate 'YYYY/MM/DD'
   * @param {string} endDate   'YYYY/MM/DD'
   * @param {string} repeat    'weekly' | 'daily'
   * @returns {string[]}
   */
  _generateDates(startDate, endDate, repeat) {
    const start = (startDate instanceof Date) ? new Date(startDate) : SheetHelper.parseDate(startDate);
    const end   = (endDate instanceof Date) ? new Date(endDate) : SheetHelper.parseDate(endDate);
    start.setHours(12, 0, 0, 0);
    end.setHours(12, 0, 0, 0);

    const dates = [];
    const cursor = new Date(start);
    const targetDow = start.getDay();

    while (cursor <= end) {
      if (repeat === 'weekly') {
        if (cursor.getDay() === targetDow) {
          dates.push(SheetHelper.formatDate(cursor));
        }
      } else {
        dates.push(SheetHelper.formatDate(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // ブース表に存在する日付のみ残す
    const boothSheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    const dateRowMap = BoothGrid.buildDateRowMap(boothSheet);
    return dates.filter((d) => dateRowMap.has(d));
  },

  /**
   * ヘッダー行からフィールド名で列位置を解決する。
   * @param {Array} headerRow ヘッダー行の値配列（0-indexed）
   * @param {Object} fieldNames { ID: 'Id', NAME: 'Name', ... }
   * @param {Object} fallbackCols { ID: 1, NAME: 2, ... } (1-indexed)
   * @returns {Object} { ID: 0, NAME: 1, ... } (0-indexed)
   */
  _resolveColumns(headerRow, fieldNames, fallbackCols) {
    const colMap = {};
    for (const key of Object.keys(fieldNames)) {
      const idx = headerRow.findIndex((h) => String(h).trim() === fieldNames[key]);
      colMap[key] = idx !== -1 ? idx : (fallbackCols[key] - 1);
    }
    return colMap;
  },

  /**
   * マスタシートから名前リストを取得する。
   * FIELD_NAMES があればヘッダー行から列位置を動的に解決する。
   * @param {string} sheetName
   * @param {Object} config
   * @returns {Array<{ id:string, name:string, grade?:string }>}
   */
  _getMasterList(sheetName, config) {
    try {
      const sheet = SheetHelper.getSheet(sheetName);
      const lastRow = sheet.getLastRow();
      if (lastRow < config.DATA_START_ROW) return [];

      // 列マップを構築（ヘッダーから動的に、またはフォールバック）
      let colMap;
      const lastCol = sheet.getLastColumn();
      if (config.FIELD_NAMES) {
        const headerValues = sheet.getRange(config.HEADER_ROW, 1, 1, lastCol).getValues()[0];
        colMap = this._resolveColumns(headerValues, config.FIELD_NAMES, config.COLS);
      } else {
        colMap = {};
        for (const key of Object.keys(config.COLS)) {
          colMap[key] = config.COLS[key] - 1;
        }
      }

      const numRows = lastRow - config.DATA_START_ROW + 1;
      const values = SheetHelper.batchGetValues(
        sheet, config.DATA_START_ROW, 1, numRows, lastCol
      );
      return values
        .filter((row) => row[colMap.NAME])
        .map((row) => ({
          id:    String(row[colMap.ID] || ''),
          name:  String(row[colMap.NAME]),
          grade: colMap.GRADE !== undefined ? String(row[colMap.GRADE] || '') : undefined,
        }));
    } catch (e) {
      console.error('_getMasterList(' + sheetName + ') error:', e.message);
      return [];
    }
  },

  /**
   * 教科マスタリストを取得する。
   * @returns {string[]}
   */
  _getSubjectList() {
    try {
      const sheet = SheetHelper.getSheet(CONFIG.SHEETS.SUBJECTS);
      const c = CONFIG.MASTER.SUBJECTS;
      const lastRow = sheet.getLastRow();
      if (lastRow < c.DATA_START_ROW) return [];
      const numRows = lastRow - c.DATA_START_ROW + 1;
      const values = SheetHelper.batchGetValues(sheet, c.DATA_START_ROW, 1, numRows, 1);
      return values.map((r) => String(r[0])).filter(Boolean);
    } catch (e) {
      return [];
    }
  },
};
