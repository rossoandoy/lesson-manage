# TODO.md — タスクリスト

ステータス: `[ ]` 未着手 / `[x]` 完了 / `[~]` ブロック中

---

## Phase 0: 基盤整備

- [x] tasks/ ディレクトリ作成
- [x] PLAN.md 作成
- [x] SPEC.md 作成
- [x] TODO.md 作成
- [x] KNOWLEDGE.md 作成
- [x] initStudentMaster() 追加 — `01_Main.gs`
- [x] onOpen メニューに生徒マスタ初期化を追加
- [x] clasp push → GAS エディタで動作確認（13ファイル push 成功）

完了率: 8/8 ✅

---

## Phase 1: UX改善 — ブース表操作

- [x] 1.1 週表示ナビ（前週/今週/翌週）— SPEC 記述 → 実装 → テスト
- [x] 1.2 生徒名検索 + ハイライト — SPEC 記述 → 実装 → テスト
- [x] 1.3 途中解約一括削除 — SPEC 記述 → 実装 → テスト
- [x] 1.4 休校日一括削除 — SPEC 記述 → 実装 → テスト
- [x] 1.5 コマ削除ボタン — SPEC 記述 → 実装 → テスト

完了率: 5/5 ✅

---

## Phase 2: 印刷・出力機能

- [x] 2.1 日付範囲のブース表印刷ビュー
- [x] 2.2 データ出力シート（フィルタ付き）
- [x] 2.3 印刷シートヘッダー初期化

完了率: 3/3 ✅

---

## Phase 3: 集計・レポート強化

- [x] 3.1 振替追跡（元/先ペアリング）
- [x] 3.2 前年度累計保持（ScriptProperties方式）
- [x] 3.3 全生徒一括レポート生成
- [x] 3.4 出欠コマンド（ブース表から）

完了率: 4/4 ✅

---

## 親スプレッドシート構造化（Phase 4 より先行）

- [x] 親シート構造 SPEC 確定 — SPEC の「親スプレッドシート構造」を実装可能なレベルまで確定
- [x] 同一プロジェクト評価 — 現在のテンプレートを親シート（テンプレート兼管理）として運用する適切性を評価し、PLAN/SPEC に結論を記載
- [x] 親シート 4 シート作成 — Template_Cover / Admin_Version / Admin_Classrooms を作成。Template_Main は不要（既存業務シート群がそのままテンプレート）

完了率: 3/3 ✅

---

## Phase 4: Salesforce連携

- [x] 4.1 Salesforce Client Credentials 認証
- [x] 4.2 SOQLクエリ（教室データ取得）
- [x] 4.3 URL書き戻し（PATCH）
- [x] 4.4 tranシート同期
- [x] 4.5 appsscript.json スコープ確認（設定済み）

完了率: 5/5 ✅

---

## Phase 5: マルチ教室プロビジョニング

- [ ] 5.1 Admin_Classrooms / Admin_Version シート
- [ ] 5.2 DriveApp.makeCopy + 権限設定
- [ ] 5.3 テンプレート一括更新
- [ ] 5.4 定期実行トリガー
- [ ] 5.5 Webhook (doPost) — オプション

完了率: 0/5
