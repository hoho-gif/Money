// ==============================
// 設定項目（ここを書き換える）
// ==============================
const SPREADSHEET_ID = "ここにスプレッドシートのIDを入力"; // シートURLの /d/ と /edit の間の文字列
const SHEET_NAME = "家計簿";                                // シート（タブ）の名前
const MAPS_API_KEY = "ここにGoogle Maps APIキーを入力";     // Places APIを有効化したキー
const SEARCH_RADIUS_METERS = 300;                            // 店舗検索の半径

// ==============================
// エントリーポイント
// ==============================
function doPost(e) {
  let result;
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === "findShop") {
      result = findShop(data.latitude, data.longitude);
    } else if (data.action === "saveExpense") {
      result = saveExpense(data);
    } else {
      result = { success: false, message: "不明なactionです。" };
    }
  } catch (error) {
    result = { success: false, message: error.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==============================
// 現在地から近くの店舗を検索
// ==============================
function findShop(latitude, longitude) {
  const url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    + "?location=" + latitude + "," + longitude
    + "&radius=" + SEARCH_RADIUS_METERS
    + "&language=ja"
    + "&key=" + MAPS_API_KEY;

  const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(response.getContentText());

  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    return { success: false, message: "Places APIエラー: " + json.status };
  }

  const shops = (json.results || [])
    .map(place => ({
      name: place.name,
      distance: getDistanceMeters(
        latitude, longitude,
        place.geometry.location.lat, place.geometry.location.lng
      )
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 8);

  return { success: true, shops: shops };
}

// 2点間の距離をメートルで計算（ハーバサイン公式）
function getDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = deg => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ==============================
// スプレッドシートに1行追記
// ==============================
function saveExpense(data) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);

  if (!sheet) {
    return { success: false, message: "シート「" + SHEET_NAME + "」が見つかりません。" };
  }

  sheet.appendRow([
    new Date(data.date),
    data.type,
    Number(data.amount),
    data.payment,
    data.shop || "",
    data.category || "",
    data.memo || ""
  ]);

  return { success: true };
}
