/**
 * 13_SfdcApi.gs
 * Salesforce REST API 連携。
 * Client Credentials 認証 → SOQL クエリ → PATCH 書き戻し。
 */

const SfdcApi = {

  // ─── 認証情報の管理 ───

  /**
   * ScriptProperties から認証情報を取得する。
   * @returns {{ clientId:string, clientSecret:string, instanceUrl:string } | null}
   */
  getCredentials() {
    const props = PropertiesService.getScriptProperties();
    const pk = CONFIG.SFDC.PROP_KEYS;
    const clientId     = props.getProperty(pk.CLIENT_ID);
    const clientSecret = props.getProperty(pk.CLIENT_SECRET);
    const instanceUrl  = props.getProperty(pk.INSTANCE_URL);
    if (!clientId || !clientSecret || !instanceUrl) return null;
    return { clientId, clientSecret, instanceUrl };
  },

  /**
   * 認証情報を ScriptProperties に保存する。
   * @param {{ clientId:string, clientSecret:string, instanceUrl:string }} creds
   */
  saveCredentials(creds) {
    const props = PropertiesService.getScriptProperties();
    const pk = CONFIG.SFDC.PROP_KEYS;
    props.setProperty(pk.CLIENT_ID,     creds.clientId);
    props.setProperty(pk.CLIENT_SECRET, creds.clientSecret);
    props.setProperty(pk.INSTANCE_URL,  creds.instanceUrl);
  },

  /**
   * 認証情報が設定済みかどうかを返す。
   * @returns {boolean}
   */
  hasCredentials() {
    return this.getCredentials() !== null;
  },

  // ─── OAuth 認証 ───

  /**
   * Client Credentials で Access Token を取得し、ScriptProperties に保存する。
   * @returns {string} accessToken
   */
  authenticate() {
    const creds = this.getCredentials();
    if (!creds) throw new Error('SF 認証情報が未設定です。管理メニュー → SF 接続設定 を実行してください。');

    const tokenUrl = creds.instanceUrl + CONFIG.SFDC.PATHS.TOKEN;
    const payload = {
      grant_type:    'client_credentials',
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
    };

    const resp = UrlFetchApp.fetch(tokenUrl, {
      method: 'post',
      payload: payload,
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    const body = JSON.parse(resp.getContentText());

    if (code !== 200) {
      throw new Error('SF 認証失敗: ' + (body.error_description || body.error || resp.getContentText()));
    }

    const props = PropertiesService.getScriptProperties();
    const pk = CONFIG.SFDC.PROP_KEYS;
    props.setProperty(pk.ACCESS_TOKEN, body.access_token);
    // issued_at はミリ秒文字列。1時間有効と仮定して期限を保存
    const expiry = (Number(body.issued_at) || Date.now()) + 3600 * 1000;
    props.setProperty(pk.TOKEN_EXPIRY, String(expiry));

    return body.access_token;
  },

  /**
   * キャッシュ済みトークンを返す。期限切れなら再認証する。
   * @returns {string} accessToken
   */
  _getAccessToken() {
    const props = PropertiesService.getScriptProperties();
    const pk = CONFIG.SFDC.PROP_KEYS;
    const token  = props.getProperty(pk.ACCESS_TOKEN);
    const expiry = Number(props.getProperty(pk.TOKEN_EXPIRY) || '0');

    if (token && Date.now() < expiry - CONFIG.SFDC.TOKEN_MARGIN_MS) {
      return token;
    }
    return this.authenticate();
  },

  // ─── REST リクエスト ───

  /**
   * 汎用 REST リクエスト。401 時に 1 回だけリトライする。
   * @param {string} method  'get' | 'post' | 'patch' | 'delete'
   * @param {string} path    '/services/data/...' 形式
   * @param {Object} [body]  リクエストボディ（JSON）
   * @returns {Object} パース済みレスポンス
   */
  _request(method, path, body) {
    const creds = this.getCredentials();
    if (!creds) throw new Error('SF 認証情報が未設定です。');

    const doFetch = (token) => {
      const options = {
        method: method,
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type':  'application/json',
        },
        muteHttpExceptions: true,
      };
      if (body) options.payload = JSON.stringify(body);
      return UrlFetchApp.fetch(creds.instanceUrl + path, options);
    };

    let token = this._getAccessToken();
    let resp = doFetch(token);

    // 401 → トークン再取得して 1 回リトライ
    if (resp.getResponseCode() === 401) {
      token = this.authenticate();
      resp = doFetch(token);
    }

    const code = resp.getResponseCode();
    const text = resp.getContentText();

    // 204 No Content（PATCH 成功時など）
    if (code === 204) return { success: true };

    const result = text ? JSON.parse(text) : {};

    if (code >= 200 && code < 300) return result;

    const errMsg = Array.isArray(result) ? result.map(e => e.message).join('; ') : (result.message || text);
    throw new Error('SF API エラー (' + code + '): ' + errMsg);
  },

  /**
   * SOQL クエリを実行する。nextRecordsUrl でページネーションを処理。
   * @param {string} soql
   * @returns {Object[]} レコード配列
   */
  _query(soql) {
    const path = CONFIG.SFDC.PATHS.QUERY + '?q=' + encodeURIComponent(soql);
    let result = this._request('get', path);
    let records = result.records || [];

    while (result.nextRecordsUrl) {
      result = this._request('get', result.nextRecordsUrl);
      records = records.concat(result.records || []);
    }

    return records;
  },

  // ─── 教室データ取得 (4.2) ───

  /**
   * SF から教室（Account/Location）一覧を取得する。
   * @returns {Object[]} 教室データ配列
   */
  getClassrooms() {
    const soql = [
      'SELECT Id, Name, SchoolManager__c, SchoolManager__r.Name,',
      '       MANAERP__Status__c, Spreadsheet_URL__c, TRG_BoothCount__c',
      'FROM Account',
      "WHERE RecordType.DeveloperName = 'Location'",
      "  AND MANAERP__Status__c = 'Operating'",
    ].join(' ');

    return this._query(soql);
  },

  /**
   * SF の教室データを Admin_Classrooms にアップサートする。
   */
  syncClassroomsToSheet() {
    const classrooms = this.getClassrooms();
    let count = 0;

    classrooms.forEach(acc => {
      AdminSheet.upsertClassroom({
        classroomId:   acc.Id,
        classroomName: acc.Name || '',
        managerId:     acc.SchoolManager__c || '',
        managerName:   (acc.SchoolManager__r && acc.SchoolManager__r.Name) || '',
        ssUrl:         acc.Spreadsheet_URL__c || '',
      });
      count++;
    });

    SpreadsheetApp.getActiveSpreadsheet().toast(count + ' 件の教室を同期しました');
    return count;
  },

  // ─── URL 書き戻し (4.3) ───

  /**
   * Account の Spreadsheet_URL__c を更新する。
   * @param {string} accountId  SF Account ID
   * @param {string} url        スプレッドシート URL
   */
  updateSpreadsheetUrl(accountId, url) {
    const path = CONFIG.SFDC.PATHS.SOBJECTS + '/' + CONFIG.SFDC.OBJECTS.ACCOUNT + '/' + accountId;
    this._request('patch', path, { Spreadsheet_URL__c: url });
  },

  /**
   * Admin_Classrooms の全教室について、SS URL を SF に書き戻す。
   */
  writebackAllUrls() {
    const classrooms = AdminSheet.getClassrooms();
    let count = 0;

    classrooms.forEach(c => {
      if (c.classroomId && c.ssUrl) {
        this.updateSpreadsheetUrl(c.classroomId, c.ssUrl);
        count++;
      }
    });

    SpreadsheetApp.getActiveSpreadsheet().toast(count + ' 件の URL を SF に書き戻しました');
    return count;
  },

  // ─── tran シート同期 (4.4) ───

  /**
   * SF から請求データ（Invoice）を取得する。
   * @param {string} yearMonth 'YYYY/MM' 形式
   * @returns {Object[]} レコード配列
   */
  getTranData(yearMonth) {
    const soql = [
      'SELECT MANAERP__Contact__c, MANAERP__Contact__r.Name,',
      '       TRG_IF_RevenueMonth__c, Name,',
      '       MANAERP__Total__c, MANAERP__Amount_Paid__c',
      'FROM MANAERP__Invoice__c',
      "WHERE TRG_IF_RevenueMonth__c = '" + yearMonth + "'",
    ].join(' ');

    return this._query(soql);
  },

  /**
   * SF の請求データを tran シートに書き込む。
   * @param {string} yearMonth 'YYYY/MM' 形式
   */
  syncTranSheet(yearMonth) {
    const invoices = this.getTranData(yearMonth);

    const records = invoices.map(inv => ({
      studentId:   inv.MANAERP__Contact__c || '',
      studentName: (inv.MANAERP__Contact__r && inv.MANAERP__Contact__r.Name) || '',
      yearMonth:   inv.TRG_IF_RevenueMonth__c || '',
      item:        inv.Name || '',
      billed:      inv.MANAERP__Total__c || 0,
      paid:        inv.MANAERP__Amount_Paid__c || 0,
    }));

    TranSheet.bulkWrite(records);
    SpreadsheetApp.getActiveSpreadsheet().toast(records.length + ' 件の請求データを tran シートに同期しました');
    return records.length;
  },

  // ─── 設定 UI ───

  /**
   * UI prompt で SF 接続情報を入力させ、ScriptProperties に保存する。
   */
  promptCredentials() {
    const ui = SpreadsheetApp.getUi();

    const urlResp = ui.prompt('SF 接続設定 (1/3)', 'Instance URL を入力してください\n例: https://your-domain.my.salesforce.com', ui.ButtonSet.OK_CANCEL);
    if (urlResp.getSelectedButton() !== ui.Button.OK) return;

    const idResp = ui.prompt('SF 接続設定 (2/3)', 'Client ID を入力してください', ui.ButtonSet.OK_CANCEL);
    if (idResp.getSelectedButton() !== ui.Button.OK) return;

    const secretResp = ui.prompt('SF 接続設定 (3/3)', 'Client Secret を入力してください', ui.ButtonSet.OK_CANCEL);
    if (secretResp.getSelectedButton() !== ui.Button.OK) return;

    let instanceUrl = urlResp.getResponseText().trim();
    // 末尾スラッシュを除去
    if (instanceUrl.endsWith('/')) instanceUrl = instanceUrl.slice(0, -1);

    this.saveCredentials({
      clientId:     idResp.getResponseText().trim(),
      clientSecret: secretResp.getResponseText().trim(),
      instanceUrl:  instanceUrl,
    });

    ui.alert('SF 接続情報を保存しました。「SF 接続テスト」で接続を確認してください。');
  },

  /**
   * SF への接続をテストする。
   */
  testConnection() {
    const ui = SpreadsheetApp.getUi();
    try {
      const records = this._query('SELECT Id FROM Organization LIMIT 1');
      if (records.length > 0) {
        ui.alert('SF 接続テスト', '接続成功！ Organization ID: ' + records[0].Id, ui.ButtonSet.OK);
      } else {
        ui.alert('SF 接続テスト', '接続成功（レコード取得なし）', ui.ButtonSet.OK);
      }
    } catch (e) {
      ui.alert('SF 接続テスト', '接続失敗: ' + e.message, ui.ButtonSet.OK);
    }
  },
};
