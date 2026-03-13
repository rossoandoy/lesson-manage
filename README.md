# lesson-manage

塾向けのコマ組・出欠・回数報告を管理する Google スプレッドシート + GAS (Google Apps Script) システム。
スプレッドシートのカスタムメニューとサイドバーから、ブース表の作成・講師/生徒の配置・出欠記録・回数報告の生成までを一元管理できます。

---

## このシステムでできること

- **コマ組管理**: ブース × 時限のグリッドで講師・生徒を配置（1:1 / 1:2 対応）
- **繰り返し配置**: 毎週・隔週など繰り返しルールで一括配置
- **出欠管理**: 出席 / 欠席 / 振替を記録し、振替元と振替先を自動ペアリング
- **回数報告**: 生徒別・月別の出欠集計レポートを自動生成（一括生成も可）
- **検索・フィルタ**: 生徒名検索 + ハイライト、データ出力（フィルタ付き）
- **一括削除**: 途中解約・休校日の一括コマ削除
- **印刷ビュー**: 指定期間のブース表を印刷向けに整形表示
- **Salesforce 連携**: 教室データ取得・請求データ同期・URL 書き戻し
- **マルチ教室管理**: 親スプレッドシートから教室一覧を管理（プロビジョニングは将来実装）

---

## シート一覧

| シート名 | 役割 | 作成方法 |
|---------|------|---------|
| **ブース表** | コマ組グリッド（日付 × ブース × 時限） | サイドバーの年度グリッド生成 or メニュー |
| **印刷シート** | 授業データベース（1行 = 1コマ） | ブース表から自動同期 |
| **回数報告** | 生徒別・月別の出欠集計レポート | メニューから生成 |
| **回数報告_〇〇** | 全生徒一括レポート時の個別シート | 一括生成時に自動作成 |
| **データ出力** | フィルタ付きデータエクスポート | メニューから生成 |
| **tran** | SF 連携キャッシュ（請求データ） | メニュー「tran シートを初期化」or SF 同期 |
| **master_students** | 生徒マスタ（ID / 氏名 / 学年） | メニュー「生徒マスタを初期化」 |
| **master_staffs** | 講師マスタ（ID / 氏名） | メニュー「講師マスタを初期化」 |
| **master_subjects** | 教科マスタ（教科名一覧） | メニュー「教科マスタを初期化」 |
| **Template_Cover** | 表紙（教室名・教室長名・バージョン・更新日） | 管理メニュー「Admin シートを初期化」 |
| **Admin_Version** | バージョン管理（リリース履歴） | 管理メニュー「Admin シートを初期化」 |
| **Admin_Classrooms** | 教室一覧・プロビジョニング管理 | 管理メニュー「Admin シートを初期化」 |

---

## 基本的な使い方

1. **マスタを初期化する** — メニューから「教科マスタを初期化」「講師マスタを初期化」「生徒マスタを初期化」を実行し、データを入力
2. **教室設定をする** — サイドバーの設定タブで教室名・ブース数・時限数・時間帯を設定
3. **年度グリッドを生成する** — サイドバーの設定タブで年度を入力し「年度グリッド生成」を実行
4. **講師を配置する** — ブース表で配置先のセルを選択 → サイドバーのコマ組タブで講師を選択し配置（繰り返し設定も可）
5. **生徒を配置する** — 講師が配置済みのコマに対して生徒・教科を配置
6. **出欠を記録する** — サイドバーのコマ組タブで出席 / 欠席 / 振替を記録
7. **回数報告を生成する** — メニューから「回数報告を生成」で生徒別月別の集計レポートを作成

---

## 開発ガイド（共同開発メンバー向け）

### 前提条件

- Google アカウント（GAS エディタへのアクセス権）
- [Node.js](https://nodejs.org/) v18 以上 と npm
- [clasp](https://github.com/google/clasp)（`npm install -g @google/clasp`）
- Git

### セットアップ手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd lesson-manage

# 2. clasp にログイン（初回のみ）
clasp login

# 3. GAS にデプロイ
cd gas
clasp push --force
```

GAS エディタ URL: https://script.google.com/u/0/home/projects/1PbUgHJNDnKT7y09u-ZcF5DmzM6zeQilJYbN-2Sc8gkKa1rSLiyd93ZE6/edit

### 開発フロー

1. `main` から feature ブランチを作成: `git checkout -b feature/xxx`
2. `gas/src/` 配下のコードを変更
3. `cd gas && clasp push --force` でデプロイ・動作確認
4. `git add` → `git commit` → `git push` → PR を作成
5. レビュー → `main` にマージ

> **注意**
> - `clasp push` は同時に1人だけ実行してください（競合注意）
> - GAS エディタでの直接編集は禁止です（`clasp push` で上書きされます）

### プロジェクト構成

```
lesson-manage/
├── gas/
│   ├── .clasp.json            # clasp 設定（rootDir: "src"）
│   └── src/
│       ├── appsscript.json    # V8, Asia/Tokyo, OAuth スコープ
│       ├── 00_Config.gs       # 全定数の中央管理 (CONFIG)
│       ├── 01_Main.gs         # onOpen / onEdit・メニュー・グローバル関数
│       ├── 02_SheetHelper.gs  # スプレッドシート API ラッパー
│       ├── 03_BoothGrid.gs    # グリッド座標計算
│       ├── 04_ScheduleService.gs # コマ組ロジック
│       ├── 05_PrintSheet.gs   # 印刷シート CRUD・出欠管理
│       ├── 06_ReportSheet.gs  # 回数報告集計
│       ├── 07_TranSheet.gs    # tran シート（SF 連携構造）
│       ├── 08_SettingsService.gs # 教室設定の読み書き
│       ├── 09_Tests.gs        # テスト用
│       ├── 10_AdminSheet.gs   # 親シート管理（Admin）
│       ├── 11_DataOutput.gs   # データ出力
│       ├── 12_PrintView.gs    # 印刷ビュー
│       ├── 13_SfdcApi.gs      # Salesforce REST API 連携
│       ├── sidebar_schedule.html # コマ組サイドバー
│       └── dialog_schedule.html  # コマ組ダイアログ
├── docs/                      # 設計ドキュメント
├── tasks/                     # タスク管理（PLAN, SPEC, TODO, KNOWLEDGE）
└── CLAUDE.md                  # プロジェクトルール・AI ワークフロー
```

ファイル番号プレフィックス（`00_`〜`13_`）で GAS の読み込み順を保証しています。新規ファイルは `14_` 以降を使用してください。

### コーディング規約

- **ES モジュール非対応** → `const ServiceName = { method() {}, ... }` パターンで定義
- **CONFIG 中央管理** → シート名・列番号・行番号は `00_Config.gs` の CONFIG 経由で参照
- **グローバル関数は `01_Main.gs` に集約** → `google.script.run` のエントリーポイント
- **日付は `'YYYY/MM/DD'` 文字列** → GAS の Date → UTC ズレ問題を回避

### テスト方法

GAS エディタから `09_Tests.gs` の関数を手動実行します。実行ログは GAS エディタの「実行ログ」で確認できます。

---

## Salesforce 連携

管理メニューから Salesforce と連携できます。初回は接続設定が必要です。

### 接続設定手順

1. **管理メニュー → SF 接続設定** を実行
2. Instance URL を入力（例: `https://your-domain.my.salesforce.com`）
3. Connected App の Client ID を入力
4. Client Secret を入力
5. **管理メニュー → SF 接続テスト** で接続を確認

### 連携機能

| 機能 | 説明 |
|------|------|
| 教室一覧を同期 | SF の Account (Location) から教室データを取得し Admin_Classrooms にアップサート |
| SF URL書き戻し | Admin_Classrooms の SS URL を SF の Account.Spreadsheet_URL__c に書き戻し |
| tran シート同期 | 指定年月の MANAERP__Invoice__c データを tran シートに一括書き込み |

**前提条件**:
- SF 側に Connected App が設定済み（Client Credentials フロー）
- `Spreadsheet_URL__c` は SF Account に作成が必要（URL 書き戻し時）

---

## ドキュメント一覧

| ファイル | 内容 |
|---------|------|
| [docs/BigPicture.md](docs/BigPicture.md) | 全体像・親シート構造・SF 連携の仕様 |
| [docs/Feedback.md](docs/Feedback.md) | ブース表操作・印刷・集計の要件メモ |
| [docs/DistributionDesign.md](docs/DistributionDesign.md) | SF 側 LWC による iframe 表示仕様 |
| [CLAUDE.md](CLAUDE.md) | プロジェクトルール・AI ワークフロー |
| [tasks/PLAN.md](tasks/PLAN.md) | 意思決定ログ |
| [tasks/SPEC.md](tasks/SPEC.md) | 機能仕様 |
| [tasks/TODO.md](tasks/TODO.md) | タスクリスト・進捗 |
| [tasks/KNOWLEDGE.md](tasks/KNOWLEDGE.md) | 技術的知見・パターン |
