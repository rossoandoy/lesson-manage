/**
 * 09_Tests.gs
 * ユニットテスト・デバッグ用関数。
 * 本番デプロイ時は clasp の exclude 設定で除外すること。
 *
 * GASエディタから個別に実行して動作確認する。
 */

// ─────────────────────────────────────────
// BoothGrid 座標計算テスト
// ─────────────────────────────────────────

/**
 * BoothGrid.decodeCell のテスト。
 * GASエディタのログ（Ctrl+Enter）で確認する。
 */
function testDecodeCell() {
  const cases = [
    // [row, col, expectedPeriod, expectedBooth, description]
    [8,  2,  1, 1, '1限 ブース1 (行8,B列)'],
    [10, 2,  1, 2, '1限 ブース2 (行10,B列)'],
    [12, 2,  1, 3, '1限 ブース3 (行12,B列)'],
    [14, 2,  1, 4, '1限 ブース4 (行14,B列)'],
    [16, 2,  1, 5, '1限 ブース5 (行16,B列)'],
    [8,  7,  2, 1, '2限 ブース1 (行8,G列)'],
    [8,  47, 10,1, '10限 ブース1 (行8,AU列)'],
    [18, 2,  1, 1, '翌日 1限 ブース1 (行18)'],
    [47, 42, 9, 5, '9限 ブース5 (行47,AP列)'],
  ];

  let passed = 0;
  let failed = 0;

  cases.forEach(([row, col, expPeriod, expBooth, desc]) => {
    const result = BoothGrid.decodeCell(row, col);
    if (result && result.period === expPeriod && result.booth === expBooth) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(
        `❌ FAIL: ${desc} → expected period=${expPeriod}, booth=${expBooth}, ` +
        `got: ${JSON.stringify(result)}`
      );
      failed++;
    }
  });

  console.log(`\n結果: ${passed} passed, ${failed} failed`);
}

/**
 * BoothGrid.encodeCell のテスト。
 */
function testEncodeCell() {
  const cases = [
    [0, 1, 0, { dayStartRow:8, boothStartRow:8, periodStartCol:2 },  '日0 1限 ブース0'],
    [0, 2, 1, { dayStartRow:8, boothStartRow:10, periodStartCol:7 }, '日0 2限 ブース1'],
    [1, 1, 0, { dayStartRow:18,boothStartRow:18, periodStartCol:2 }, '日1 1限 ブース0'],
  ];

  let passed = 0, failed = 0;
  cases.forEach(([di, period, bi, expected, desc]) => {
    const result = BoothGrid.encodeCell(di, period, bi);
    if (
      result.dayStartRow    === expected.dayStartRow &&
      result.boothStartRow  === expected.boothStartRow &&
      result.periodStartCol === expected.periodStartCol
    ) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} → expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`);
      failed++;
    }
  });
  console.log(`\n結果: ${passed} passed, ${failed} failed`);
}

// ─────────────────────────────────────────
// ScheduleService 繰り返し展開テスト
// ─────────────────────────────────────────

/**
 * 週次繰り返しのテスト（ブース表がないと日付フィルタで0件になる）。
 */
function testExpandWeekly() {
  const formData = {
    period:    1,
    booth:     1,
    teacherName:   'テスト講師',
    student1Name:  'テスト生徒',
    student1Grade: '中1',
    subject1:      '英語',
    capacity:  '1：1',
    startDate: '2025/04/07',
    endDate:   '2025/04/28',
    repeat:    'weekly',
  };

  // 日付生成ロジックのみテスト（ブース表フィルタなし）
  const start = new Date('2025/04/07');
  const end   = new Date('2025/04/28');
  const targetDow = start.getDay();
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    if (cursor.getDay() === targetDow) {
      dates.push(SheetHelper.formatDate(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  console.log('週次展開 (2025/04/07〜04/28, 月曜):', dates);
  console.log('期待値: ["2025/04/07","2025/04/14","2025/04/21","2025/04/28"]');

  const expected = ['2025/04/07', '2025/04/14', '2025/04/21', '2025/04/28'];
  const pass = JSON.stringify(dates) === JSON.stringify(expected);
  console.log(pass ? '✅ PASS' : '❌ FAIL');
}

// ─────────────────────────────────────────
// E2E: ブース表 → 印刷シート書き込みテスト
// ─────────────────────────────────────────

/**
 * ブース表に1コマ書き込み + 印刷シート追記のテスト。
 * 事前にブース表のグリッドが初期化されていること（setDisplayRange を実行）。
 */
function testWriteSlot() {
  const entry = {
    dateLabel:     '2025/04/07',
    period:        1,
    booth:         1,
    teacherName:   'テスト講師',
    student1Name:  'テスト生徒A',
    student1Grade: '中1',
    subject1:      '英語',
    student2Name:  'テスト生徒B',
    student2Grade: '高2',
    subject2:      '数学',
    capacity:      '1：2',
  };

  try {
    const boothSheet = SheetHelper.getSheet(CONFIG.SHEETS.BOOTH);
    BoothGrid.writeSlot(boothSheet, entry);
    console.log('✅ BoothGrid.writeSlot 完了');

    PrintSheet.appendEntry(entry);
    console.log('✅ PrintSheet.appendEntry 完了');
  } catch (e) {
    console.error('❌ エラー:', e.message);
  }
}

// ─────────────────────────────────────────
// CONFIG 検証
// ─────────────────────────────────────────

/**
 * CONFIG の基本値を確認する。
 */
function testConfig() {
  console.log('PERIOD_START_COLS[0]:', CONFIG.BOOTH_GRID.PERIOD_START_COLS[0]); // 2
  console.log('PERIOD_START_COLS[9]:', CONFIG.BOOTH_GRID.PERIOD_START_COLS[9]); // 47
  console.log('DATA_START_ROW:',      CONFIG.BOOTH_GRID.DATA_START_ROW);        // 8
  console.log('ROWS_PER_DAY:',        CONFIG.BOOTH_GRID.ROWS_PER_DAY);          // 10
  console.log('BOOTH_COUNT:',         CONFIG.BOOTH_GRID.BOOTH_COUNT);           // 5

  const ok =
    CONFIG.BOOTH_GRID.PERIOD_START_COLS[0] === 2  &&
    CONFIG.BOOTH_GRID.PERIOD_START_COLS[9] === 47 &&
    CONFIG.BOOTH_GRID.DATA_START_ROW       === 8  &&
    CONFIG.BOOTH_GRID.ROWS_PER_DAY         === 10;

  console.log(ok ? '✅ CONFIG OK' : '❌ CONFIG 異常');
}

// ─────────────────────────────────────────
// Spreadsheet API タイムゾーン検証テスト
// ─────────────────────────────────────────

/**
 * Spreadsheet API のタイムゾーン処理を検証する。
 * 4月1日 2025 (JST) を書き込み→読み取りして、
 * APIが UTC/JST どちらで解釈しているかを確認する。
 */
function testSpreadsheetDateTimezone() {
  try {
    const testSheet = SheetHelper.getOrCreateSheet('__TEST_TIMEZONE__');
    
    // April 1, 2025 at midnight JST
    // 3-parameter Date constructor: new Date(year, monthIndex, day)
    // monthIndex is 0-indexed, so month 3 = April
    const testDate = new Date(2025, 3, 1);
    const testDateISO = testDate.toISOString(); // for debugging
    const testDateLocal = testDate.toString();  // for debugging
    
    console.log('=== TIMEZONE TEST START ===');
    console.log('Created Date object: new Date(2025, 3, 1)');
    console.log('  toISOString():  ' + testDateISO);
    console.log('  toString():     ' + testDateLocal);
    console.log('  getFullYear():  ' + testDate.getFullYear());
    console.log('  getMonth():     ' + testDate.getMonth() + ' (0-indexed, so 3=April)');
    console.log('  getDate():      ' + testDate.getDate());
    console.log('  getHours():     ' + testDate.getHours());
    console.log('  getMinutes():   ' + testDate.getMinutes());
    console.log('');
    
    // Write to cell A1 via batchSetValues
    console.log('Writing to test cell via batchSetValues...');
    SheetHelper.batchSetValues(testSheet, 1, 1, [[testDate]]);
    
    // Immediately read back
    console.log('Reading back from test cell via batchGetValues...');
    const readBack = SheetHelper.batchGetValues(testSheet, 1, 1, 1, 1);
    const retrievedValue = readBack[0][0];
    
    console.log('Retrieved value type: ' + typeof retrievedValue);
    console.log('Retrieved value: ' + retrievedValue);
    
    // If it's a Date, check components
    if (retrievedValue instanceof Date) {
      console.log('  toISOString():  ' + retrievedValue.toISOString());
      console.log('  toString():     ' + retrievedValue.toString());
      console.log('  getFullYear():  ' + retrievedValue.getFullYear());
      console.log('  getMonth():     ' + retrievedValue.getMonth() + ' (0-indexed)');
      console.log('  getDate():      ' + retrievedValue.getDate());
      console.log('  getHours():     ' + retrievedValue.getHours());
    } else if (typeof retrievedValue === 'number') {
      console.log('  Retrieved as number (serial): ' + retrievedValue);
      console.log('  Attempting to interpret as Excel date...');
      const excelEpoch = new Date(1899, 11, 30); // Excel serial epoch
      const reconstructed = new Date(excelEpoch.getTime() + retrievedValue * 86400000);
      console.log('  Reconstructed as: ' + reconstructed.toString());
    }
    
    console.log('');
    
    // Comparison
    console.log('=== COMPARISON ===');
    console.log('Written:  ' + SheetHelper.formatDate(testDate));
    if (retrievedValue instanceof Date) {
      console.log('Retrieved: ' + SheetHelper.formatDate(retrievedValue));
      const dayDiff = (testDate - retrievedValue) / (1000 * 60 * 60 * 24);
      console.log('Day difference: ' + dayDiff + ' days');
      const hourDiff = (testDate - retrievedValue) / (1000 * 60 * 60);
      console.log('Hour difference: ' + hourDiff + ' hours');
    }
    
    console.log('');
    console.log('=== TIMEZONE TEST END ===');
    
    // Clean up
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetToDelete = ss.getSheetByName('__TEST_TIMEZONE__');
    if (sheetToDelete) {
      ss.deleteSheet(sheetToDelete);
    }
    
  } catch (e) {
    console.error('❌ Test error:', e.message);
  }
}
