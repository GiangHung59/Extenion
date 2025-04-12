// Phiên bản: Hậu Kỳ 1 (Thêm hàm Reset_Data_All)
// Mô tả: Kiểm tra thư mục Google Drive, ánh xạ số tập từ Sheet, gửi thông báo video đến nhóm Telegram, lỗi đến cá nhân, log ngày lọc từ DATE_FILTER, thêm hàm xóa ScriptProperties

// Biến toàn cục
const TELEGRAM_BOT_TOKEN = '7851579734:AAG0ftBZRG5MbQTDw8vGzxtJoB4CxjyLIrU';
const TELEGRAM_CHAT_ID = '5675429766'; // ID cá nhân để gửi lỗi
const TELEGRAM_GROUP_CHAT_ID = '-123456789'; // TODO: Thay bằng ID nhóm Telegram thực tế
const SPREADSHEET_ID = '1NJmpMwhSgFG3C2PlWgtZaCPUVFTAXrirj-CBM6N1xS4';
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();
const MAX_FILES_PER_RUN = 300;
const DATE_FILTER = new Date('2025-02-01T00:00:00+07:00');

// Hàm kiểm tra thư mục chính
function checkMainFolder() {
  const folderId = '1bjMEe7IdfNQVHvjUIqtUZSJM3P8DhycX';
  Logger.log(`[START] Bắt đầu kiểm tra toàn bộ tiến trình cho thư mục ID: Tiếng Anh ${folderId}`);
  checkFolderAndSubfolders(folderId, 'Tiếng Anh');
  Logger.log(`[END] Hoàn tất kiểm tra toàn bộ tiến trình`);
}

// Hàm lấy ánh xạ từ Google Sheet
function getMappingFromSheet() {
  Logger.log(`[SHEET] Đang lấy dữ liệu ánh xạ từ Google Sheet: Hậu Kỳ ${SPREADSHEET_ID}`);
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Hậu Kỳ');
    const data = sheet.getRange('A4:L' + sheet.getLastRow()).getValues();
    const mapping = {};

    Logger.log(`[SHEET] Tìm thấy ${data.length} dòng dữ liệu từ A4`);
    for (let i = 0; i < data.length; i++) {
      let episodeNumber = data[i][0] ? data[i][0].toString().trim() : '';
      const performer = data[i][11] ? data[i][11].toString().trim() : '';
      
      // Chuẩn hóa số tập: lấy số từ "Tập X"
      if (episodeNumber) {
        const match = episodeNumber.match(/(\d+)/);
        episodeNumber = match ? match[1] : '';
      }
      
      Logger.log(`[SHEET] Dòng ${i + 4}: Số tập gốc = "${data[i][0]}", Số tập chuẩn hóa = "${episodeNumber}", Người thực hiện = "${performer}"`);
      
      if (episodeNumber) {
        mapping[episodeNumber] = performer || 'Không rõ';
      }
    }

    Logger.log(`[SHEET] Lấy thành công ${Object.keys(mapping).length} ánh xạ số tập`);
    return mapping;
  } catch (e) {
    Logger.log(`[SHEET] Lỗi khi lấy dữ liệu từ Sheet: ${e.message}`);
    sendTelegramMessage(`⚠️ Lỗi khi lấy dữ liệu từ Sheet: ${e.message}`, TELEGRAM_CHAT_ID);
    return {};
  }
}

// Hàm trích xuất số tập từ tên file
function extractEpisodeNumber(fileName) {
  const nameWithoutExtension = fileName.replace(/\.mp4$/i, '');
  const match = nameWithoutExtension.match(/^(Tập|Tạp|TẠP|TẬP|tẠp|Tap|TAP|tập|tạp|tap|TặP|TÂP)\s*(\d+)/i);
  const episodeNumber = match ? match[2] : null;
  Logger.log(`[FILE] Trích xuất số tập từ "${fileName}": ${episodeNumber || 'Không có'}`);
  return episodeNumber;
}

// Hàm kiểm tra thư mục chính và thư mục con cấp 1
function checkFolderAndSubfolders(folderId, folderName) {
  Logger.log(`[FOLDER] Bắt đầu kiểm tra thư mục: ${folderName} (ID: ${folderId})`);
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    const processedKey = `processedFiles_${folderId}`;
    let processedFiles = SCRIPT_PROPERTIES.getProperty(processedKey);
    processedFiles = processedFiles ? JSON.parse(processedFiles) : {};
    
    const episodeToPerformerMap = getMappingFromSheet();
    let fileCount = 0;
    let fileList = [];
    
    Logger.log(`[FOLDER] Đang xử lý file trong thư mục chính: ${folderName}`);
    fileCount += processFolder(folder, folderName, processedFiles, episodeToPerformerMap, fileList);
    
    if (fileCount < MAX_FILES_PER_RUN) {
      Logger.log(`[FOLDER] Đang duyệt các thư mục con cấp 1 của: ${folderName}`);
      const subfolders = folder.getFolders();
      while (subfolders.hasNext() && fileCount < MAX_FILES_PER_RUN) {
        const subfolder = subfolders.next();
        const subfolderName = `${folderName}/${subfolder.getName()}`;
        Logger.log(`[FOLDER] Đang xử lý thư mục con: ${subfolderName}`);
        fileCount += processFolder(subfolder, subfolderName, processedFiles, episodeToPerformerMap, fileList);
      }
    } else {
      Logger.log(`[FOLDER] Đạt giới hạn ${MAX_FILES_PER_RUN} file, không kiểm tra thêm thư mục con`);
    }
    
    Logger.log(`[STORAGE] Đang cập nhật Script Properties cho ${fileCount} file đã xử lý`);
    SCRIPT_PROPERTIES.setProperty(processedKey, JSON.stringify(processedFiles));
    
    if (fileList.length > 0) {
      Logger.log(`[NOTIFY] Chuẩn bị gửi thông báo cho ${fileList.length} file mới đến nhóm Telegram`);
      sendNotificationInBatches(fileList);
    } else {
      const filterDateStr = Utilities.formatDate(DATE_FILTER, 'GMT+7', 'dd/MM/yyyy');
      Logger.log(`[NOTIFY] Không có file .mp4 mới từ ${filterDateStr} để gửi thông báo`);
    }

    Logger.log(`[FOLDER] Hoàn tất kiểm tra thư mục ${folderName}. Tổng cộng ${fileCount} file .mp4.`);
  } catch (e) {
    Logger.log(`[ERROR] Lỗi khi kiểm tra thư mục ${folderName}: ${e.message}`);
    sendTelegramMessage(`⚠️ Lỗi khi kiểm tra thư mục ${folderName}: ${e.message}`, TELEGRAM_CHAT_ID);
  }
}

// Hàm xử lý file trong một thư mục
function processFolder(folder, folderName, processedFiles, episodeToPerformerMap, fileList) {
  let fileCount = 0;
  
  const files = folder.getFiles();
  Logger.log(`[FILE] Bắt đầu duyệt file trong thư mục: ${folderName}`);
  while (files.hasNext() && fileCount < MAX_FILES_PER_RUN) {
    const file = files.next();
    const fileName = file.getName();
    
    if (fileName.toLowerCase().endsWith('.mp4')) {
      const createdDate = file.getDateCreated();
      const createdDateStr = Utilities.formatDate(createdDate, 'GMT+7', 'dd/MM/yyyy HH:mm:ss');
      
      if (createdDate >= DATE_FILTER) {
        fileCount++;
        Logger.log(`[FILE] Đang xử lý file: ${fileName} (Tạo: ${createdDateStr})`);
        
        const fileId = file.getId();
        const lastModified = createdDateStr;
        
        const episodeNumber = extractEpisodeNumber(fileName);
        
        if (!processedFiles[fileId] || processedFiles[fileId].lastModified !== lastModified) {
          const performer = episodeNumber && episodeToPerformerMap[episodeNumber]
            ? episodeToPerformerMap[episodeNumber]
            : 'Không rõ';
          
          Logger.log(`[FILE] Ánh xạ hoàn tất: ${fileName}, Số tập: ${episodeNumber || 'Không có'}, Editor: ${performer}`);
          
          const fileData = {
            id: fileId,
            name: fileName,
            url: file.getUrl(),
            folderName: folderName,
            lastModified: lastModified,
            performer: performer
          };

          processedFiles[fileId] = { notified: true, lastModified: lastModified };
          fileList.push(fileData);
        } else {
          Logger.log(`[FILE] File đã xử lý trước đó: ${fileName}`);
        }
      } else {
        Logger.log(`[FILE] Bỏ qua file cũ: ${fileName} (Tạo: ${createdDateStr})`);
      }
    }
  }
  
  Logger.log(`[FILE] Hoàn tất duyệt file trong thư mục: ${folderName}. Tìm thấy ${fileCount} file .mp4`);
  return fileCount;
}

// Hàm gửi thông báo theo nhóm
function sendNotificationInBatches(fileList) {
  const batchSize = 20;
  
  Logger.log(`[NOTIFY] Bắt đầu gửi ${fileList.length} thông báo đến nhóm Telegram, chia thành các batch ${batchSize} video`);
  if (fileList.length === 0) {
    Logger.log(`[NOTIFY] Không có file nào để gửi, thoát hàm sendNotificationInBatches`);
    return;
  }

  for (let i = 0; i < fileList.length; i += batchSize) {
    const batch = fileList.slice(i, i + batchSize);
    Logger.log(`[NOTIFY] Đang chuẩn bị batch ${Math.floor(i / batchSize) + 1} với ${batch.length} video`);
    
    let message = '<b>▶️ Video Hậu Kỳ Hoàn Thành:</b>\n\n';
    
    batch.forEach(fileData => {
      message += `File: <b>${fileData.name}</b>\n` +
                 `Editor: ${fileData.performer}\n` +
                 `Thời gian: ${fileData.lastModified}\n` +
                 `Link: <a href="${fileData.url}">Xem Video</a>\n\n`;
    });

    Logger.log(`[NOTIFY] Độ dài tin nhắn batch ${Math.floor(i / batchSize) + 1}: ${message.length} ký tự`);
    
    try {
      Logger.log(`[NOTIFY] Gửi batch ${Math.floor(i / batchSize) + 1} tới nhóm Telegram`);
      sendTelegramMessage(message, TELEGRAM_GROUP_CHAT_ID);
      Logger.log(`[NOTIFY] Đã gửi thành công batch ${Math.floor(i / batchSize) + 1} với ${batch.length} video`);
    } catch (e) {
      Logger.log(`[NOTIFY] Lỗi gửi batch ${Math.floor(i / batchSize) + 1} tới nhóm Telegram: ${e.message}`);
      sendTelegramMessage(`⚠️ Lỗi gửi thông báo video tới nhóm: ${e.message}`, TELEGRAM_CHAT_ID);
    }
    
    Utilities.sleep(3000);
  }
  Logger.log(`[NOTIFY] Hoàn tất gửi tất cả batch thông báo đến nhóm Telegram`);
}

// Hàm gửi tin nhắn Telegram (hỗ trợ chatId linh hoạt)
function sendTelegramMessage(message, chatId) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML'
  };
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };
  
  try {
    Logger.log(`[TELEGRAM] Bắt đầu gửi tin nhắn tới chat ID: ${chatId}`);
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      Logger.log(`[TELEGRAM] Gửi tin nhắn thành công tới chat ID: ${chatId}`);
    } else if (result.error_code === 429) {
      const retryAfter = result.parameters.retry_after || 5;
      Logger.log(`[TELEGRAM] Lỗi 429 tại chat ID ${chatId}: Đợi ${retryAfter} giây`);
      Utilities.sleep(retryAfter * 1000);
      sendTelegramMessage(message, chatId);
    } else {
      Logger.log(`[TELEGRAM] Lỗi Telegram không xác định tại chat ID ${chatId}: ${JSON.stringify(result)}`);
    }
  } catch (e) {
    Logger.log(`[TELEGRAM] Lỗi gửi Telegram tới chat ID ${chatId}: ${e.message}`);
    throw e;
  }
}

// Hàm xóa toàn bộ ScriptProperties để chạy lại từ đầu
function Reset_Data_All() {
  try {
    Logger.log(`[RESET] Bắt đầu xóa toàn bộ ScriptProperties`);
    SCRIPT_PROPERTIES.deleteAllProperties();
    Logger.log(`[RESET] Đã xóa thành công tất cả ScriptProperties`);
    sendTelegramMessage(`✅ Đã xóa toàn bộ dữ liệu ScriptProperties để chạy lại từ đầu`, TELEGRAM_CHAT_ID);
  } catch (e) {
    Logger.log(`[RESET] Lỗi khi xóa ScriptProperties: ${e.message}`);
    sendTelegramMessage(`⚠️ Lỗi khi xóa ScriptProperties: ${e.message}`, TELEGRAM_CHAT_ID);
  }
}