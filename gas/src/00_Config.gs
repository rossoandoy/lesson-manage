/**
 * 00_Config.gs
 * 全定数の中央管理。他ファイルは CONFIG を参照する。
 */

const CONFIG = {
  SHEETS: {
    BOOTH:    'ブース表',
    PRINT:    '印刷シート',
    REPORT:   '回数報告',
    TRAN:     'tran',
    STUDENTS: 'master_students',
    STAFFS:   'master_staffs',
    SUBJECTS: 'master_subjects',
    DATA_OUTPUT: 'データ出力',
  },

  BOOTH_GRID: {
    HEADER_ROW:     7,
    DATA_START_ROW: 8,
    DATE_COL:       1,   // A列 (1-indexed)
    ROWS_PER_DAY:   10,
    ROWS_PER_BOOTH: 2,
    BOOTH_COUNT:    5,
    PERIOD_COUNT:   10,
    // 各時限の開始列 (1-indexed: A=1, B=2, ...)
    PERIOD_START_COLS: [2, 7, 12, 17, 22, 27, 32, 37, 42, 47],
    BLOCK_WIDTH: 5,
    // 時限ブロック内列オフセット
    COL_OFFSET: {
      BOOTH_NUM: 0,
      TEACHER:   1,
      STUDENT:   2,
      GRADE:     3,
      SUBJECT:   4,
    },
  },

  PRINT_SHEET: {
    HEADER_ROW:    8,
    DATA_START_ROW: 9,
    // 各列番号 (1-indexed)
    COLS: {
      DATE:       1,
      WEEKDAY:    2,
      PERIOD:     3,
      BOOTH:      4,
      TEACHER:    5,
      STUDENT:    6,
      GRADE:      7,
      SUBJECT:    8,
      CAPACITY:   9,
      ATTENDANCE: 10,
      TRANSFER_FROM: 11,
      TRANSFER_TO:   12,
    },
    ATTENDANCE_VALUES: ['出席', '欠席', '振替'],
  },

  REPORT_SHEET: {
    HEADER_ROW:    8,
    DATA_START_ROW: 9,
    PREV_YEAR_ROW:  8,   // 前年度末合計行
    TOTAL_ROW:     24,   // 今年度末合計行
    GRAND_TOTAL_ROW: 25, // 総合計行
    MONTH_COUNT:   12,
    // 左半分: tranシート参照用
    COLS_LEFT: { STUDENT_ID:1, STUDENT_NAME:2, YEAR_MONTH:3, ITEM:4, BILLED:5 },
    // 右半分: 集計値
    COLS_RIGHT: { PLAN:6, ATTENDED:7, ABSENT:8, TRANSFER:9, BALANCE:10 },
  },

  TRAN_SHEET: {
    COLS: {
      STUDENT_ID:  1,
      STUDENT_NAME: 2,
      YEAR_MONTH:  3,
      ITEM:        4,
      BILLED:      5,
      PAID:        6,
    },
  },

  DATA_OUTPUT_SHEET: {
    HEADER_ROW: 1,
    DATA_START_ROW: 2,
    COLS: {
      DATE:     1,
      WEEKDAY:  2,
      PERIOD:   3,
      BOOTH:    4,
      TEACHER:  5,
      STUDENT:  6,
      GRADE:    7,
      SUBJECT:  8,
      CAPACITY: 9,
    },
  },

  PARENT: {
    SHEETS: {
      ADMIN_CLASSROOMS: 'Admin_Classrooms',
      ADMIN_VERSION:    'Admin_Version',
      TEMPLATE_COVER:   'Template_Cover',
    },
    ADMIN_CLASSROOMS: {
      HEADER_ROW: 1,
      DATA_START_ROW: 2,
      COLS: {
        CLASSROOM_ID:    1,
        CLASSROOM_NAME:  2,
        MANAGER_ID:      3,
        MANAGER_NAME:    4,
        SS_URL:          5,
        SS_ID:           6,
        CURRENT_VERSION: 7,
        SYNC_STATUS:     8,
      },
    },
    ADMIN_VERSION: {
      HEADER_ROW: 1,
      DATA_START_ROW: 2,
      COLS: {
        VERSION:      1,
        RELEASE_DATE: 2,
        DESCRIPTION:  3,
        COMMIT_HASH:  4,
      },
    },
    TEMPLATE_COVER: {
      CELLS: {
        CLASSROOM_NAME: 'B3',
        MANAGER_NAME:   'B4',
        VERSION:        'B5',
        UPDATE_DATE:    'B6',
      },
    },
  },

  SFDC: {
    PROP_KEYS: {
      CLIENT_ID:     'SFDC_CLIENT_ID',
      CLIENT_SECRET: 'SFDC_CLIENT_SECRET',
      INSTANCE_URL:  'SFDC_INSTANCE_URL',
      ACCESS_TOKEN:  'SFDC_ACCESS_TOKEN',
      TOKEN_EXPIRY:  'SFDC_TOKEN_EXPIRY',
    },
    PATHS: {
      TOKEN:    '/services/oauth2/token',
      QUERY:    '/services/data/v62.0/query',
      SOBJECTS: '/services/data/v62.0/sobjects',
    },
    OBJECTS: {
      ACCOUNT: 'Account',
    },
    FIELDS: {
      CLASSROOM_NAME:   'Name',
      SCHOOL_MANAGER:   'SchoolManager__c',
      SCHOOL_MANAGER_R: 'SchoolManager__r.Name',
      STATUS:           'MANAERP__Status__c',
      SS_URL:           'Spreadsheet_URL__c',
      BOOTH_COUNT:      'TRG_BoothCount__c',
      INV_STUDENT:      'MANAERP__Contact__c',
      INV_STUDENT_NAME: 'MANAERP__Contact__r.Name',
      INV_YEAR_MONTH:   'TRG_IF_RevenueMonth__c',
      INV_TOTAL:        'MANAERP__Total__c',
      INV_PAID:         'MANAERP__Amount_Paid__c',
    },
    RECORD_TYPES: {
      LOCATION: 'Location',
    },
    TOKEN_MARGIN_MS: 5 * 60 * 1000,
  },

  MASTER: {
    STUDENTS: {
      HEADER_ROW: 1,
      DATA_START_ROW: 2,
      FIELD_NAMES: { ID: 'Id', NAME: 'Name', GRADE: 'MANAERP__Grade__r.Name' },
      COLS: { ID:1, NAME:2, GRADE:3 },  // フォールバック
    },
    STAFFS: {
      HEADER_ROW: 1,
      DATA_START_ROW: 2,
      FIELD_NAMES: { ID: 'Id', NAME: 'Name' },
      COLS: { ID:1, NAME:2 },  // フォールバック
    },
    SUBJECTS: {
      HEADER_ROW: 1,
      DATA_START_ROW: 2,
      COLS: { NAME:1 },
    },
  },
};
