# KNOWLEDGE.md — 技術的知見・パターン・注意事項

## アーキテクチャ決定

### ファイル構成規約
- ファイル番号プレフィックス `00_` 〜 `09_` で GAS の読み込み順を保証
- 新規ファイルは `10_` 以降を使用（`10_PrintView.gs`, `11_SalesforceAuth.gs` 等）
- GAS は ES モジュール非対応 → `const ServiceName = { ... }` オブジェクトリテラルパターンを使用
- グローバル関数は `01_Main.gs` に集約（google.script.run のエントリーポイント）

### CONFIG 中央管理
- `00_Config.gs` の `CONFIG` オブジェクトに全定数を集約
- シート名、列番号、行番号はすべて CONFIG 経由で参照
- `SettingsService` が動的設定（ブース数・時限数）を ScriptProperties で永続化
- `getBoothGridConfig()` が CONFIG.BOOTH_GRID をベースに動的値をマージして返す

### データモデル
- `ScheduleEntry` 型: コマ組の中心データ構造（dateLabel, period, booth, teacher, students, capacity）
- 日付は `'YYYY/MM/DD'` 文字列で管理（GAS の Date → UTC ズレ問題を回避）
- 1-indexed: 行番号・列番号はすべて 1-indexed（GAS の Range API に合わせる）

---

## GAS 固有の注意点

### タイムゾーン
- `appsscript.json` で `Asia/Tokyo` 指定済み
- `new Date('YYYY-MM-DD')` は UTC 解釈で1日ズレる → `SheetHelper.parseDate()` で年月日分解して構築
- セルに Date を書き込むと GAS がシートのタイムゾーンで解釈する（問題なし）

### トリガー制限
- `onEdit` は simple trigger → UI 操作（ダイアログ表示等）不可
- UI 操作が必要なら installable trigger を使用
- simple trigger の実行時間制限: 30秒

### 実行時間
- GAS 実行時間制限: 6分（無料）/ 30分（Workspace）
- `initializeGrid` は 50日ごとに `SpreadsheetApp.flush()` でバッファ確定
- 年度分（365日）のグリッド生成は 3〜4分で完了

### マージセル
- `merge()` 後に `setValue()` は左上セルにのみ書き込まれる
- `breakApart()` + `clearContent()` でマージ解除 → 再マージの手順
- `clearSlot` はブース番号・講師セルの merge を再構築する

### OAuthスコープ
- 現在: `spreadsheets`, `drive.readonly`, `script.container.ui`
- SF連携時に追加予定: `script.external_request`（UrlFetchApp 用）

---

## パフォーマンスパターン

### バッチ操作
- 個別 `getValue()`/`setValue()` は避ける → `getRange().getValues()` / `setValues()` で一括
- `SheetHelper.batchGetValues()` / `batchSetValues()` を使用
- `readAllSlots()` は日単位でバッチ取得してメモリ上で解析

### キャッシュ
- `BoothGrid._dateRowCache`: A列の日付→行番号マップ（`buildDateRowMap`）
- `SettingsService._cachedConfig`: 動的グリッド設定
- キャッシュは `clearCache()` / 設定保存時に無効化

### flush 戦略
- グリッド初期化時: 50日ごとに `SpreadsheetApp.flush()`
- 通常の読み書きでは不要（GAS が自動バッファリング）

---

## デバッグガイド

### テスト実行
- `09_Tests.gs` の関数を GAS エディタから個別実行
- `console.log` → GAS エディタの「実行ログ」で確認
- Stackdriver ログ: `console.error` で記録される

### clasp デプロイ
- `cd gas && clasp push --force`
- `--force` は appsscript.json の上書きに必要
- `.clasp.json` の `rootDir: "src"` で src/ 配下のみ push

### よくあるエラー
- 「シート "X" が見つかりません」→ `SheetHelper.getSheet()` はシート名不一致で throw
- 日付が1日ズレる → `SheetHelper.parseDate()` を使っているか確認
- merge 崩れ → `clearSlot` が merge 再構築しているか確認

---

## シート構造サマリ

| シート | ヘッダー行 | データ開始行 | 主要列 |
|--------|-----------|-------------|--------|
| ブース表 | 7 | 8 | A:日付, B〜:時限ブロック(5列×N) |
| 印刷シート | 8 | 9 | A:日付〜J:出欠 (10列) |
| 回数報告 | 8 | 9 | A〜E:tran参照, F〜J:集計値 |
| tran | 1 | 2 | A:生徒ID〜F:支払済 (6列) |
| master_students | 1 | 2 | A:ID, B:氏名, C:学年 |
| master_staffs | 1 | 2 | A:ID, B:氏名 |
| master_subjects | 1 | 2 | A:教科名 |
