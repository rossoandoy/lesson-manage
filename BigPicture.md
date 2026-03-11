# BigPicture.md
# 仕様書：教室用スプレッドシート自動プロビジョニング＆統合管理システム

## 1. システム概要

親スプレッドシート（マスター）を正とし、Salesforceの「教室/教室長」データに連動して、各教室専用のスプレッドシートを自動生成・更新・URL紐付けを行う自動化システム。ソースコードは `clasp` を用いてGit(mainブランチ)でバージョン管理する。

### 1.1 期待するワークフロー

1.  **初期構築**: 親シートからSalesforceの全教室データを取得し、全教室分のシートを一括生成。生成したURLをSalesforceに書き戻す。
    
2.  **新規追加**: Salesforceで新しい教室/教室長が登録されたら、GASが定期実行（またはSFDCからのWebhook）で検知し、新規シートを生成してURLを書き戻す。
    
3.  **一斉アップデート**: 親シートのテンプレートを改修した場合、GASを実行して全教室のシートフォーマットを最新バージョンに一括置換する。
    

## 2. システムアーキテクチャ

*   **プラットフォーム**: Google Apps Script (GAS) standalone or bound-script (親シートにバインド)
    
*   **バージョン管理**: `clasp` + Git (GitHub等)
    
*   **Salesforce連携**: Salesforce REST API (OAuth 2.0 JWT Bearer Flow または Connected App経由のClient Credentials)
    
    *   ※標準の「Salesforce Connector」アドオンは手動操作や定期バッチ前提のUIツールであるため、完全自動化・柔軟なURL書き戻しを行うためにGASの `UrlFetchApp` を用いたREST APIコールを採用する。
        

## 3. 親スプレッドシート (Master Sheet) の構造

親スプレッドシートは以下のシートで構成される。

1.  **`Template_Main`**: 各教室に配布する業務シートのひな形。
    
2.  **`Template_Cover`**: 表紙シート。バージョン情報、更新日、教室名などを記載。
    
3.  **`Admin_Version`**: バージョン管理シート。
    
    *   カラム: `Version`, `ReleaseDate`, `Description`, `CommitHash`
        
4.  **`Admin_Classrooms`**: 連携管理用DBシート（Salesforceから取得したデータをキャッシュし、生成状況を管理）。
    
    *   カラム: `ClassroomId`, `ClassroomName`, `ManagerId(User)`, `ManagerName`, `SpreadsheetURL`, `SpreadsheetId`, `CurrentVersion`, `SyncStatus`
        

## 4. GAS実装要件（主要モジュール）

### 4.1 Salesforce API 連携モジュール (`sfdcApi.js`)

*   **認証**: Salesforceの接続アプリケーション（Connected App）を作成し、クライアントID/シークレットを用いてアクセストークンを取得する。
    
*   **データ取得**:
    
    *   `getClassrooms()`: SOQLを発行し、教室オブジェクトと紐づく教室長(User)のリストを取得。
        
*   **データ更新**:
    
    *   `updateUserSpreadsheetUrl(userId, url)`: SalesforceのUserレコード（または教室レコード）の `Spreadsheet_URL__c` 項目に対して `PATCH` リクエストを送り、生成したURLを保存。
        

### 4.2 スプレッドシート生成・配布モジュール (`provisioning.js`)

*   **新規一括/個別生成**:
    
    1.  `Admin_Classrooms` シートとSalesforceのデータを突合し、URLが未発行の教室を抽出。
        
    2.  `DriveApp.getFileById(masterId).makeCopy(fileName, folderId)` で親シート全体をコピー、または新規スプレッドシートを作成して `Template_` 系のシートをコピー。
        
    3.  コピーしたシートの `Template_Cover` の特定セルに「教室名」「教室長名」「現在のバージョン番号」を書き込む。
        
    4.  生成したスプレッドシートの権限を設定（対象の教室長のGoogleアカウントに編集権限を付与、またはリンクを知っている全員に設定）。
        
    5.  生成されたURLとIDを `Admin_Classrooms` に記録。
        
    6.  `sfdcApi.updateUserSpreadsheetUrl` を呼び出し、Salesforceへ書き戻す。
        

### 4.3 テンプレート一括アップデートモジュール (`updater.js`)

*   **処理フロー**:
    
    1.  親シートの `Admin_Version` から最新バージョン番号を取得。
        
    2.  `Admin_Classrooms` から全対象スプレッドシートのIDリストを取得。
        
    3.  各スプレッドシートを開き、既存の業務シート（例: `Main`）の**「データ」のみを退避**（またはデータ領域とフォーマット領域を明確に分離する設計にしておく）。
        
    4.  親シートの新しい `Template_Main` を対象シートにコピーし、古いシートを削除（または非表示アーカイブ）。
        
    5.  退避したデータを新しいシートに流し込む。
        
    6.  `Cover` シートのバージョン番号と更新日を最新のものに上書き。
        
    7.  `Admin_Classrooms` の `CurrentVersion` を更新。
        
*   **⚠️注意点（要設計）**: ユーザーが入力したデータを壊さずにテンプレートを更新するため、**「入力用シート」と「閲覧/集計用（テンプレート）シート」を分ける**、あるいは**「行データはそのままに、見出しや条件付き書式、GASのロジックのみを更新する」**設計を強く推奨。
    

## 5. トリガーと実行方式

1.  **手動実行 (カスタムメニュー)**:
    
    *   親シートのメニューバーに `[Salesforce連携] > [新規教室のシート一括生成]`、`[全教室テンプレートアップデート]` を追加。
        
2.  **定期実行 (Time-driven Trigger)**:
    
    *   1日1回深夜にSalesforce側の新規追加を監視し、自動プロビジョニングを実行。
        
3.  **(オプション) Webhook実行**:
    
    *   `doPost(e)` でWebアプリとして公開し、Salesforce側で新規教室が作られた際のフロー（アウトバウンドメッセージまたはApexコールアウト）から即時キックさせる。
        

## 6. clasp / バージョン管理の運用フロー

1.  ローカルエディタ（VS Code / Cursor）で `.ts` または `.js` を記述。
    
2.  `clasp push` で親シートのバインドスクリプトに反映。
    
3.  テスト完了後、Git (mainブランチ) にコミット＆プッシュ。
    
4.  親シートの `Admin_Version` にコミット履歴と対応するバージョン名を追記。
    
5.  「全教室テンプレートアップデート」機能を発火させ、各教室へロジック/UI変更を反映。
    

## 7. 開発ステップ（フェーズ分け）

*   **Phase 1**: GAS ⇔ Salesforce の認証とデータ取得・更新処理の確立。
    
*   **Phase 2**: 親シートからのコピー生成、Coverシートへの変数埋め込み、URL書き戻し。
    
*   **Phase 3**: 既存シートに対する「テンプレート一括更新処理」のロジック構築（データ保護機構の設計）。