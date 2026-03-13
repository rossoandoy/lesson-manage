# PLAN.md — ロードマップ & 意思決定ログ

## フェーズ定義

### Phase 0: 基盤整備 ✅
- tasks/ ドキュメント体制構築
- 既存パターンの KNOWLEDGE.md 記録
- initStudentMaster() 追加
- 全マスタシートの動作確認

### Phase 1: UX改善 — ブース表操作 (Feedback.md対応)
依存: Phase 0
完了基準: 全5機能が GAS エディタで動作確認済み

- 1.1 週表示ナビ（前週/今週/翌週ボタン）
- 1.2 生徒名検索 + ハイライト
- 1.3 途中解約 — 指定日以降の一括削除
- 1.4 休校日 — 指定日の全コマ削除
- 1.5 コマ削除ボタン（サイドバー）

### Phase 2: 印刷・出力機能
依存: Phase 1.1（週表示）
完了基準: 印刷ビュー生成 + データ出力シートが動作

- 2.1 日付範囲のブース表印刷ビュー
- 2.2 データ出力シート（フィルタ付き）
- 2.3 印刷シートヘッダー初期化

### Phase 3: 集計・レポート強化
依存: Phase 0
完了基準: 振替追跡・累計保持・一括レポートが動作

- 3.1 振替追跡（元/先ペアリング）
- 3.2 前年度累計保持シート
- 3.3 全生徒一括レポート生成
- 3.4 出欠コマンド（ブース表から）

### 親スプレッドシート構造化（Phase 4 より先行して着手）

**着手順序**: 親シート構造の定義から開始する。

1. **構造定義** — SPEC に「親スプレッドシート構造」を記述（Template_* / Admin_* のシート名・列・GAS での参照）。
2. **同一プロジェクト評価** — 現在のテンプレートスプレッドシート（教室用）を親シートとして「テンプレート兼管理ファイル」にすることの適切性を評価し、結論を PLAN/SPEC に記載。
3. **親シート 4 シート整備** — Template_Main（既存ブース表のひな形）、Template_Cover、Admin_Version、Admin_Classrooms を親スプレッドシートに用意。
4. **Phase 4 接続** — SF 連携で取得した教室一覧を Admin_Classrooms にキャッシュする形で接続。

**設計上の結論（同一 GAS プロジェクト）**: 親シートの GAS プロジェクトと教室用は同一プロジェクト内で共存する。現在のテンプレートスプレッドシートを親シートとして、テンプレートかつ管理ファイルとして運用する。clasp の push 先は親シート 1 本。子シートは DriveApp.makeCopy で生成するため、コードは親にのみ存在する設計で問題ない。

### Phase 4: Salesforce連携 (BigPicture.md Phase 1)
依存: Phase 0、親スプレッドシート構造化（構造定義・4 シート整備）
完了基準: 認証 → SOQL取得 → PATCH書き戻しが E2E で動作

- **認証**: Client Credentials（Connected App のクライアントID/シークレット）
- 4.1 Salesforce Client Credentials 認証モジュール
- 4.2 SOQLクエリ — 教室データ取得
- 4.3 URL書き戻し（PATCH）
- 4.4 tranシート同期
- 4.5 appsscript.json スコープ追加

### Phase 5: マルチ教室プロビジョニング (BigPicture.md Phase 2-3)
依存: Phase 4
完了基準: テンプレートコピー → 権限設定 → URL書き戻しが自動で動作

- 5.1 Admin_Classrooms / Admin_Version シート（構造は親スプレッドシート構造化で先行定義済み）
- 5.2 DriveApp.makeCopy + 権限設定
- 5.3 テンプレート一括更新
- 5.4 定期実行トリガー
- 5.5 Webhook (doPost) — オプション

---

## 意思決定ログ

| 日付 | 決定 | 根拠 |
|------|------|------|
| 2026-03-11 | ドキュメント駆動4ファイル体制を採用 | CLAUDE.md のワークフロー設計に準拠。仕様→実装→検証の流れを明確化 |
| 2026-03-11 | Phase 1 を最優先 | Feedback.md の UX 要件が最もユーザー影響大。SF連携は後回し |
| 2026-03-11 | GAS オブジェクトリテラルパターンを継続 | ES モジュール非対応のため。ファイル番号プレフィックスで読み込み順保証 |
| 2026-03-12 | 親シートと教室用は同一 GAS プロジェクトで共存 | 現在のテンプレートスプレッドシートを親シートとしてテンプレート兼管理に。適切性は評価した上で実装 |
| 2026-03-12 | Salesforce 認証は Client Credentials を採用 | Connected App の設定に合わせる。JWT Bearer は使わない |
| 2026-03-12 | 最初の着手は親シート構造の定義から | プロビジョニング・SF 連携より先に SPEC でシート構成・列定義を確定する |
| 2026-03-12 | Template_Main は不要（既存業務シート群がテンプレート） | Phase 5 の makeCopy で親 SS 全体をコピーし、コピー先で Admin_* を削除する設計。別途テンプレートシートを作ると二重管理になるため |
| 2026-03-12 | 親スプレッドシート構造化 完了 | Template_Cover / Admin_Version / Admin_Classrooms の 3 シートを GAS で初期化。initAdminSheets() で一括作成 |
| 2026-03-13 | Phase 4 SF 連携 完了 | 13_SfdcApi.gs で Client Credentials 認証・SOQL・PATCH・tran 同期を実装。管理メニューに SF 操作を追加 |
| 2026-03-13 | Spreadsheet_URL__c は SF 側で未作成 | GAS コードは作成済み前提で実装。フィールド作成は SF 管理者作業 |
| 2026-03-13 | SchoolManager__c は Contact ルックアップ | User ではなく Contact への参照。Admin_Classrooms の managerId には Contact ID が入る |
