# SPEC_Distribution.md 仕様書：教室個別スプレッドシート表示機能 (Classroom Spreadsheet Viewer)

## 1. プロジェクト概要

### 1.1 目的

Salesforceを利用する各教室長が、別のタブやブラウザを開くことなく、自身の教室専用のGoogleスプレッドシート（授業管理ツール等）をSalesforce内で閲覧・編集できるようにする。

### 1.2 課題と解決策

*   **課題**: 本部は教室ごとに異なるスプレッドシートを配布しているが、Salesforceの標準機能では「ログインユーザーごとに異なる外部URLをホーム画面やタブに埋め込む」ことが難しい。現場の画面遷移の手間を減らしたい。
    
*   **解決策**: Userオブジェクトに各教室専用のURLを保持させ、Lightning Web Component (LWC) を用いて、ログインユーザーに紐づくURLをiframeで専用タブ内に動的に表示する。
    

## 2. システムアーキテクチャ

*   **バックエンド**: Apex Controller (SOQLを使用して現在のログインユーザーのカスタムURL項目を取得)
    
*   **フロントエンド**: Lightning Web Component (LWC) (取得したURLをiframeでレンダリング)
    
*   **表示場所**: Salesforce カスタムタブ (Lightning Component Tab)
    
*   **外部連携**: Google Spreadsheet (iframeによる埋め込み)
    

## 3. データモデル要件（事前準備）

開発前に、Salesforce組織にて以下のカスタム項目を作成すること。

*   **オブジェクト**: ユーザー (`User`)
    
*   **データ型**: URL
    
*   **項目の表示ラベル**: スプレッドシートURL
    
*   **API参照名**: `Spreadsheet_URL__c`
    
*   **権限**: 対象プロファイル（教室長、システム管理者等）に対して参照・更新権限を付与すること。
    

## 4. コンポーネント開発仕様

### 4.1 Apex コントローラー

*   **クラス名**: `ClassroomSheetController`
    
*   **共有設定**: `with sharing` (ユーザーのアクセス権限を厳格に適用)
    
*   **メソッド**:
    
    *   メソッド名: `getSheetUrl`
        
    *   アノテーション: `@AuraEnabled(cacheable=true)`
        
    *   処理内容:
        
        1.  `UserInfo.getUserId()` で実行ユーザーのIDを取得。
            
        2.  `User` オブジェクトから `Spreadsheet_URL__c` をSOQLで取得 (`WITH SECURITY_ENFORCED` を推奨)。
            
        3.  取得したURL文字列を返す。URLが空の場合は `null` を返す。
            

### 4.2 Lightning Web Component (LWC)

*   **コンポーネント名**: `embeddedSpreadsheet`
    
*   **JS仕様 (`embeddedSpreadsheet.js`)**:
    
    *   `@wire` を使用して `ClassroomSheetController.getSheetUrl` を呼び出す。
        
    *   取得したURLをリアクティブプロパティ（例: `sheetUrl`）に格納する。
        
    *   取得エラー時のハンドリングを実装し、エラーメッセージ用プロパティ（例: `error`）に格納する。
        
*   **HTML仕様 (`embeddedSpreadsheet.html`)**:
    
    *   `lightning-card` 等を使用してコンポーネントの枠組みを作成（タイトル例: "教室管理シート"）。
        
    *   **正常系（URLが存在する場合）**:
        
        *   `template if:true` で判定し、`<iframe>` タグを描画。
            
        *   `iframe` の `src` 属性に `sheetUrl` をバインド。
            
        *   `width="100%"`, `height="100vh"` (または固定ピクセル数 例:`800px`) 等で十分な表示領域を確保し、`border: none` を指定。
            
    *   **異常系・未設定時（URLが存在しない、またはエラーの場合）**:
        
        *   `template if:false` で判定し、ユーザー向けのエラーメッセージを表示。
            
        *   メッセージ例: 「※あなたの教室用のスプレッドシートURLが設定されていません。本部（システム管理者）にお問い合わせください。」
            
        *   SLDSクラス（例: `slds-text-color_error`, `slds-p-around_medium`）を使用して適切にスタイリングする。
            
*   **メタデータ仕様 (`embeddedSpreadsheet.js-meta.xml`)**:
    
    *   `isExposed`: `true`
        
    *   `targets`: `<target>lightning__Tab</target>` のみを指定（タブ専用コンポーネントとするため）。
        

## 5. UI/UX 要件

1.  **専用タブでの表示**: ユーザーはアプリケーションのナビゲーションバーから専用のカスタムタブ（例: 「教室シート」）をクリックしてアクセスする。
    
2.  **シームレスな表示**: Googleスプレッドシートのツールバーを非表示にし、SalesforceのUIと馴染ませるため、管理者がユーザーレコードにURLを登録する際は末尾に `?rm=minimal` パラメータを付与することを運用ルールとする。
    

## 6. Google Workspace 側 前提条件（運用制約）

iframeによる外部サイト埋め込みの性質上、以下の要件を満たす必要がある。

1.  **共有設定**:
    
    *   スプレッドシートの「一般的なアクセス」権限は、組織のセキュリティポリシーに応じて以下いずれかとする。
        
        *   **A. 自社ドメイン限定（推奨）**: ユーザーはブラウザでGoogleアカウントにログインしている必要がある。
            
        *   **B. リンクを知っている全員（閲覧/編集）**: Googleログイン不要だがURL漏洩リスクあり。
            
2.  **ブラウザ設定（サードパーティCookie）**:
    
    *   上記Aの運用を行う場合、Safari等のITP（Intelligent Tracking Prevention）機能により、iframe内のGoogle認証がブロックされる（アクセス権限エラーになる）可能性がある。
        
    *   **現場の推奨ブラウザは Google Chrome** とする。
        

## 7. 開発・デプロイ手順（AIエディタ向け指示）

1.  `sfdx` または `sf` コマンドラインツールが使用可能なプロジェクト環境であること。
    
2.  上記「4. コンポーネント開発仕様」に基づき、ApexクラスとLWCのファイルセットを生成すること。
    
3.  ローカルでの静的解析（ESLint, Apex PMD等）をパスするコードを出力すること。