# SPEC.md — 機能仕様

各機能の詳細仕様を実装前に記述する。

---

## 親スプレッドシート構造（BigPicture §3）

親スプレッドシート（マスター）は以下の 4 シートで構成する。GAS はこのスプレッドシートにバインドされ、テンプレート兼管理ファイルとして同一プロジェクトで運用する。

### シート一覧

| シート名 | 役割 | ヘッダー行 | データ開始行 |
|----------|------|------------|--------------|
| `Template_Main` | 各教室に配布する業務シートのひな形（現行のブース表等のテンプレート） | 既存のブース表に準拠 | 既存に準拠 |
| `Template_Cover` | 表紙。バージョン情報・更新日・教室名等 | 1 | 2 |
| `Admin_Version` | バージョン管理 | 1 | 2 |
| `Admin_Classrooms` | 連携管理用 DB（SF から取得した教室データのキャッシュ・生成状況） | 1 | 2 |

### Admin_Version 列定義

| 列 | ヘッダー名 | 型 | 説明 |
|----|------------|-----|------|
| A | Version | 文字列 | バージョン番号（例: 1.0.0） |
| B | ReleaseDate | 日付 | リリース日 |
| C | Description | 文字列 | 変更内容 |
| D | CommitHash | 文字列 | Git コミットハッシュ（任意） |

**GAS での参照**: ヘッダー行 1、データは 2 行目以降。最新バージョンは最終行または Version の最大値で判定。

### Admin_Classrooms 列定義

| 列 | ヘッダー名 | 型 | 説明 |
|----|------------|-----|------|
| A | ClassroomId | 文字列 | Salesforce 教室 ID |
| B | ClassroomName | 文字列 | 教室名 |
| C | ManagerId | 文字列 | 教室長（User）ID |
| D | ManagerName | 文字列 | 教室長名 |
| E | SpreadsheetURL | 文字列 | 生成したスプレッドシートの URL |
| F | SpreadsheetId | 文字列 | スプレッドシート ID |
| G | CurrentVersion | 文字列 | 配布中のテンプレートバージョン |
| H | SyncStatus | 文字列 | 同期状態（例: ok / pending / error） |

**GAS での参照**: ヘッダー行 1、データは 2 行目以降。ClassroomId または SpreadsheetId で行検索。

### Template_Main について（設計結論）

別途 `Template_Main` シートは作成しない。既存の業務シート群（ブース表, 印刷シート, 回数報告, master_*, tran）がそのままテンプレートとして機能する。Phase 5 の `DriveApp.makeCopy()` で親 SS 全体をコピーし、コピー先で Admin_* シートを削除する設計とする。

### Template_Cover

教室に配布する SS の先頭に置く表紙シート。`AdminSheet.initializeCoverSheet()` で初期化される。

**レイアウト**:
| セル | 内容 |
|------|------|
| A1 | タイトル「教室情報」（太字 14pt） |
| A3 | ラベル「教室名」 |
| B3 | 値（プロビジョニング時に `updateCover()` で書き込み） |
| A4 | ラベル「教室長名」 |
| B4 | 値 |
| A5 | ラベル「バージョン」 |
| B5 | 値（`getLatestVersion()` から取得） |
| A6 | ラベル「更新日」 |
| B6 | 値（現在日時） |

**CONFIG 定義**: `CONFIG.PARENT.TEMPLATE_COVER.CELLS` にセル位置を定義（CLASSROOM_NAME: B3, MANAGER_NAME: B4, VERSION: B5, UPDATE_DATE: B6）。

**関数**:
- `AdminSheet.initializeCoverSheet()` — シート作成 + ラベル配置 + 書式設定
- `AdminSheet.updateCover(classroomName, managerName)` — コピー生成後に教室固有の値を書き込み

---

## Phase 4: Salesforce 連携

### 認証方式
- **Client Credentials**（Connected App のクライアント ID / クライアントシークレット）。JWT Bearer は使用しない。
- トークンは ScriptProperties にキャッシュし、期限切れ（5分マージン）で自動再認証。
- 401 レスポンス時は 1 回だけリトライ。

### P4.1 認証モジュール (`13_SfdcApi.gs`)
- `getCredentials()` / `saveCredentials(creds)` / `hasCredentials()` — ScriptProperties に保存
- `authenticate()` — POST `/services/oauth2/token` (grant_type=client_credentials)
- `_getAccessToken()` — キャッシュ済みトークン or 再認証
- `_request(method, path, body)` — 汎用 REST。401 時 1 回リトライ
- `_query(soql)` — SOQL + nextRecordsUrl ページネーション

### P4.2 教室データ取得
```sql
SELECT Id, Name, SchoolManager__c, SchoolManager__r.Name,
       MANAERP__Status__c, Spreadsheet_URL__c, TRG_BoothCount__c
FROM Account
WHERE RecordType.DeveloperName = 'Location'
  AND MANAERP__Status__c = 'Operating'
```
- `getClassrooms()` → レコード配列
- `syncClassroomsToSheet()` → `AdminSheet.upsertClassroom()` でアップサート
  - classroomId = Account.Id, classroomName = Name
  - managerId = SchoolManager__c, managerName = SchoolManager__r.Name

### P4.3 URL 書き戻し
- `updateSpreadsheetUrl(accountId, url)` — PATCH `/sobjects/Account/{id}` で `Spreadsheet_URL__c` 更新
- `writebackAllUrls()` — Admin_Classrooms を巡回し SS URL を SF に書き戻し
- **前提**: SF 側に `Spreadsheet_URL__c` カスタム項目が作成済みであること

### P4.4 tran シート同期
```sql
SELECT MANAERP__Contact__c, MANAERP__Contact__r.Name,
       TRG_IF_RevenueMonth__c, Name,
       MANAERP__Total__c, MANAERP__Amount_Paid__c
FROM MANAERP__Invoice__c
WHERE TRG_IF_RevenueMonth__c = '{yearMonth}'
```
- `getTranData(yearMonth)` → レコード配列
- `syncTranSheet(yearMonth)` → `TranSheet.bulkWrite()` で一括書き込み

### P4.5 設定 UI
- `promptCredentials()` — `ui.prompt()` ×3 で Instance URL / Client ID / Client Secret 入力
- `testConnection()` — 認証 + `SELECT Id FROM Organization LIMIT 1`

### メニュー追加（管理メニュー）
| メニュー項目 | グローバル関数 |
|-------------|--------------|
| SF URL書き戻し | `writebackUrlsToSF()` |
| tran シート同期 (SF→シート) | `syncTranFromSF()` |
| SF 接続設定 | `setupSFCredentials()` |
| SF 接続テスト | `testSFConnection()` |

---

## Phase 0

### P0.1 initStudentMaster()

**要件源**: 既存 initStaffMaster() との対称性
**変更ファイル**: `01_Main.gs`
**関数シグネチャ**:
```javascript
function initStudentMaster() → void
```
**動作**:
1. `master_students` シートを getOrCreateSheet で取得/作成
2. ヘッダー行（行1）に `ID | 氏名 | 学年` を設定（太字）
3. toast で完了通知
4. onOpen メニューに追加

**テスト**: GAS エディタから手動実行 → シート作成・ヘッダー確認

---

## Phase 3: 集計・レポート強化

### P3.1 振替追跡（元/先ペアリング）
**要件源**: Feedback — 振替元と振替先の紐付けが必要
**変更ファイル**: `00_Config.gs`, `05_PrintSheet.gs`, `04_ScheduleService.gs`, `01_Main.gs`

**印刷シート列追加**:
- K列 (11): `振替元日付` — この行が振替先の場合、元の授業日
- L列 (12): `振替先日付` — この行が振替元の場合、振替先の授業日

**関数**:
- `PrintSheet.linkTransfer(fromSlot, toSlot, studentName)` — 印刷シートで両方の行を検索し、K/L列を相互記録
- `PrintSheet.findBySlotAndStudent(dateLabel, period, booth, studentName)` — 印刷シートの行を特定するヘルパー

**振替フロー**:
1. サイドバーで出欠を「振替」にマーク → 振替先日付を入力
2. 印刷シートの元行の L列（振替先日付）に振替先日を記録
3. 振替先コマが配置済みなら、先行の K列（振替元日付）に元日を記録

**テスト**: 振替マーク後、印刷シートのK/L列に日付が相互記録されていること

---

### P3.2 前年度累計保持
**要件源**: 年度跨ぎでの累計管理
**変更ファイル**: `06_ReportSheet.gs`, `01_Main.gs`

**方式**: ScriptProperties に JSON 保存（行番号変更なし）
- キー: `PREV_YEAR_TOTALS_{studentName}`
- 値: `{ plan:number, attended:number, absent:number, transfer:number }`

**関数**:
- `ReportSheet.setPrevYearTotals(studentName, totals)` — prompt で手動入力 → ScriptProperties に保存
- `ReportSheet.getPrevYearTotals(studentName)` — 取得（なければゼロ）
- `writeRightHalf()` 変更 — GRAND_TOTAL_ROW に前年度分を加算

**テスト**: 前年度累計を設定後、レポート生成で GRAND_TOTAL_ROW に加算されること

---

### P3.3 全生徒一括レポート生成
**要件源**: 1生徒ずつ prompt 入力が煩雑
**変更ファイル**: `06_ReportSheet.gs`, `01_Main.gs`

**関数**:
- `ReportSheet.generateAllReports()` — 全生徒を取得し、生徒ごとに `回数報告_生徒名` シートを作成して集計を書き込み

**出力**: 生徒ごとに別シート（`回数報告_生徒名`）
**テスト**: メニュー実行で全生徒分のシートが生成されること

---

### P3.4 出欠コマンド（ブース表から）
**要件源**: ブース表からの出欠操作
**変更ファイル**: `04_ScheduleService.gs`, `01_Main.gs`, `sidebar_schedule.html`

**UI**: サイドバーの「選択中のコマ」セクションに出欠ボタン3個を追加
- [出席] [欠席] [振替]
- 振替選択時: 振替先日付の入力フィールドを表示

**関数**:
- `ScheduleService.markAttendance(dateLabel, period, booth, studentName, status, transferToDate?)`
  1. 印刷シートで該当行を検索
  2. 出欠列に値をセット
  3. status === '振替' の場合: `PrintSheet.linkTransfer()` を呼出

**テスト**: サイドバーで出席/欠席/振替を選択 → 印刷シートの出欠列に反映されること

---

## Phase 1（仕様は実装開始前に記述）

### P1.1 週表示ナビ
**要件源**: Feedback.md — 「週単位表示をデフォルトとし、翌週・翌々週へのナビゲーションが必要」
**状態**: 完了

### P1.2 生徒名検索 + ハイライト
**要件源**: Feedback.md — 「生徒名を検索した際に該当セルがハイライト表示される機能が必要」
**状態**: 完了

### P1.3 途中解約 — 一括削除
**要件源**: Feedback.md — 「途中解約時など、特定生徒の指定日以降のコマを一括削除できる機能が必要」
**状態**: 完了

### P1.4 休校日 — 一括削除
**要件源**: Feedback.md — 「休校日の全予定を一括削除できるコマンドも必要」
**状態**: 完了

### P1.5 コマ削除ボタン
**要件源**: サイドバーからのコマ操作の対称性（配置があるなら削除もあるべき）
**状態**: 完了
