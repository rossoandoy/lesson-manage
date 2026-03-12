# lesson-manage

教室用スプレッドシートの自動プロビジョニングと統合管理を行うシステム。親スプレッドシート（マスター）を正とし、Salesforce の教室・教室長データに連動して各教室専用シートを自動生成・更新・URL 紐付けする。GAS は `clasp` でバージョン管理する。

---

## リポジトリ構成

| パス | 内容 |
|------|------|
| `gas/` | Google Apps Script ソース（`clasp push` で親シートにデプロイ） |
| `tasks/` | タスク管理・仕様・計画・知見（PLAN, SPEC, TODO, KNOWLEDGE） |
| ルートの `.md` | 設計・要件ドキュメント（一覧は下記） |

---

## ドキュメント一覧

| ファイル | 役割 |
|----------|------|
| [BigPicture.md](BigPicture.md) | 全体像・親シート構造・SF 連携・プロビジョニングの仕様 |
| [Feedback.md](Feedback.md) | ブース表操作・印刷・集計・期間指定の要件（ヒアリングベース） |
| [DistributionDesign.md](DistributionDesign.md) | Salesforce 側 LWC による教室シート iframe 表示の仕様 |
| [CLAUDE.md](CLAUDE.md) | AI ワークフロー・タスク管理・サブエージェント戦略 |
| [DIAGNOSTIC_REPORT.md](DIAGNOSTIC_REPORT.md) | 調査用レポート（サイドバー〜サービス層のデータフロー分析） |

---

## BigPicture と Feedback の対応状況

| 文書 | 役割 | tasks との対応 |
|------|------|----------------|
| **BigPicture.md** | 親スプレッドシートを正とした自動プロビジョニング・SF 連携・テンプレート一括更新 | Phase 4（SF 連携）・Phase 5（マルチ教室プロビジョニング） |
| **Feedback.md** | 間瀬さんヒアリングに基づくブース表操作・印刷・集計・期間指定の要件 | Phase 1（UX）・Phase 2（印刷）・Phase 3（集計） |

- **親スプレッドシート構造**（BigPicture §3 の `Template_Main` / `Template_Cover` / `Admin_Version` / `Admin_Classrooms`）は、現時点では未実装。最初の着手は「親シート構造の定義」から（SPEC への落とし込み → 親シート側のシート整備）。

---

## セットアップ

1. リポジトリをクローンする。
2. `gas/` で GAS プロジェクトと紐付ける:
   - 既存プロジェクト: `cd gas && clasp clone --rootDir src <scriptId>`
   - 新規は `clasp create` 後、`rootDir` を `src` に設定。
3. `clasp push` でスクリプトをアップロードする。

`.clasp.json` の scriptId はリポに含めてよい。秘密情報（トークン等）は含めないこと。

---

## 開発フロー

- **tasks の 4 ファイル**を single source of truth とする:
  - **PLAN.md** … フェーズ定義・依存・意思決定ログ
  - **SPEC.md** … 機能単位の詳細仕様（実装前に記述）
  - **TODO.md** … チェック可能なタスクリスト
  - **KNOWLEDGE.md** … 技術的知見・パターン・注意事項

- **流れ**: 仕様を SPEC に書く → TODO でタスク化 → 実装 → 検証 → 必要に応じて KNOWLEDGE に学びを記録。

- **サブエージェント（Claude Code MCP の Task）利用時**:
  - タスク投入前に `tasks/` の PLAN.md・SPEC.md・TODO.md を読んでから着手する。
  - 実装は SPEC の 1 機能単位で Task に渡し、完了時に TODO を更新する。
  - 3 ステップ以上またはアーキテクチャに関わるタスクは Plan モードで開始する（CLAUDE.md に準拠）。
