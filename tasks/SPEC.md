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

### Template_Cover（案）

- 教室名・教室長名・現在のバージョン番号・更新日を表示する表紙シート。コピー生成時に GAS でセルを書き込む。列レイアウトは実装時に確定。

---

## Phase 4: Salesforce 連携（認証方式）

- **認証方式**: **Client Credentials**（Connected App のクライアント ID / クライアントシークレット）。JWT Bearer は使用しない。
- トークン取得後、REST API で SOQL 実行・PATCH 書き戻しを行う。詳細は Phase 4 実装時に SPEC 追記。

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

## Phase 1（仕様は実装開始前に記述）

### P1.1 週表示ナビ
**要件源**: Feedback.md — 「週単位表示をデフォルトとし、翌週・翌々週へのナビゲーションが必要」
**状態**: 未着手

### P1.2 生徒名検索 + ハイライト
**要件源**: Feedback.md — 「生徒名を検索した際に該当セルがハイライト表示される機能が必要」
**状態**: 未着手

### P1.3 途中解約 — 一括削除
**要件源**: Feedback.md — 「途中解約時など、特定生徒の指定日以降のコマを一括削除できる機能が必要」
**状態**: 未着手

### P1.4 休校日 — 一括削除
**要件源**: Feedback.md — 「休校日の全予定を一括削除できるコマンドも必要」
**状態**: 未着手

### P1.5 コマ削除ボタン
**要件源**: サイドバーからのコマ操作の対称性（配置があるなら削除もあるべき）
**状態**: 未着手
