// Danh sách ID thư mục và tên tùy chỉnh
const TELEGRAM_BOT_TOKEN = '7851579734:AAG0xxxxxxxxxxxxxx'; // Token của Telegram Bot
const TELEGRAM_CHAT_ID = 'XXXX'; // Chat ID của bạn
const SCRIPT_PROPERTIES = PropertiesService.getScriptProperties();

// ID Google Sheets
const SPRUNKI_TNV_OS_SHEET_ID = '1YqaEK6wyD5GiJaJ7RWkRYBybuK0g5AXSMH7x9_e2Jgg'; // Sheet cho Thô Gốc, TNV, OS
const HORROR_SHEET_ID = '1UA7ZqX-c5XmSjYAkNAsNdtK4rZfEVDWhn0CdlUsk5Ns'; // Sheet cho Thô Horror

// Ngày bắt đầu kiểm tra (1/3/2025)
const CHECK_START_DATE = new Date('2025-03-01T00:00:00+07:00');

// Giới hạn số file xử lý mỗi lần chạy
const MAX_FILES_PER_RUN = 500;

// Hàm kiểm tra thư mục OS
function check_OS_Folder() {
  const folderId = '1hyo6aE8fvJ71SPPkQW0zG5Dt7mDuBjZw';
  checkFolder(folderId, 'OS');
}

// Hàm kiểm tra thư mục Thô Gốc
function Bao_cao_video_GOC() {
  const folderId = '16zNr6vY-7tip1D_tAfhAJICrLvZWQPrD';
  checkFolder(folderId, 'Thô Gốc SPRUNKI');
}

// Hàm kiểm tra thư mục Thô Horror
function check_Tho_Horror_Folder() {
  const folderId = '1LbMLie_bAf2EWgW9SUSi3iGcrtzVa0OC';
  checkFolder(folderId, 'Thô Horror');
}

// Hàm kiểm tra thư mục TNV
function check_TNV_Folder() {
  const folderId = '170qnvzDM06IAzkFJKuQKs2iY0njRQf0V';
  checkFolder(folderId, 'TNV');
}

// Hàm chuẩn hóa tên để so sánh
function normalizeString(str) {
  return str.toLowerCase()
            .replace(/tập\s*/gi, '') // Xóa "TẬP" hoặc "tập" và khoảng trắng
            .replace(/[^\w\s]/g, '') // Xóa ký tự đặc biệt
            .trim(); // Xóa khoảng trắng thừa
}

// Hàm lấy ánh xạ từ Google Sheets
function getMappingFromSheet(folderId, fileName) {
  try {
    const normalizedFileName = normalizeString(fileName);
    
    if (['16zNr6vY-7tip1D_tAfhAJICrLvZWQPrD', '170qnvzDM06IAzkFJKuQKs2iY0njRQf0V', '1hyo6aE8fvJ71SPPkQW0zG5Dt7mDuBjZw'].includes(folderId)) {
      // Ánh xạ cho Thô Gốc SPRUNKI, TNV, và OS
      const spreadsheet = SpreadsheetApp.openById(SPRUNKI_TNV_OS_SHEET_ID);
      const sheet = spreadsheet.getSheetByName('Diễn hoạt');
      const data = sheet.getRange('A4:K' + sheet.getLastRow()).getValues();
      
      for (let row of data) {
        const episode = normalizeString(row[0].toString()); // Cột A (Tập)
        const performer = row[10].toString().trim(); // Cột K (Người thực hiện)
        if (normalizedFileName.includes(episode) && performer) {
          return performer;
        }
      }
    } else if (folderId === '1LbMLie_bAf2EWgW9SUSi3iGcrtzVa0OC') {
      // Ánh xạ cho Thô Horror
      const spreadsheet = SpreadsheetApp.openById(HORROR_SHEET_ID);
      const sheet = spreadsheet.getActiveSheet();
      const data = sheet.getRange('A4:O' + sheet.getLastRow()).getValues();
      
      for (let row of data) {
        const episode = normalizeString(row[0].toString()); // Cột A (Số tập: 4, 5, 6...)
        const performer = row[14].toString().trim(); // Cột O (Người thực hiện)
        if (normalizedFileName.includes(episode) && performer) {
          return performer;
        }
      }
    }
    return null; // Không tìm thấy ánh xạ
  } catch (e) {
    Logger.log(`Lỗi khi lấy ánh xạ từ sheet: ${e.message}`);
    return null;
  }
}

// Hàm kiểm tra và gửi thông báo cho thư mục
function checkFolder(folderId, folderName) {
  Logger.log(`[${new Date().toLocaleString('vi-VN')}] Bắt đầu kiểm tra thư mục: ${folderName}`);
  
  try {
    const folder = DriveApp.getFolderById(folderId);
    
    // Lấy danh sách file đã xử lý từ Script Properties
    const processedKey = `processedFiles_${folderId}`;
    let processedFiles = SCRIPT_PROPERTIES.getProperty(processedKey);
    processedFiles = processedFiles ? JSON.parse(processedFiles) : {}; // Khởi tạo nếu chưa có
    
    const files = folder.getFiles();
    let fileCount = 0;
    let fileList = [];
    
    // Kiểm tra xem thư mục có file hay không
    if (!files.hasNext()) {
      Logger.log(`Không tìm thấy file nào trong thư mục: ${folderName}`);
    }
    
    // Duyệt qua các file trong thư mục
    while (files.hasNext() && fileCount < MAX_FILES_PER_RUN) {
      const file = files.next();
      const createdDate = file.getDateCreated();
      
      // Log tiến trình: hiển thị tên file đang kiểm tra
      Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đang kiểm tra file: ${file.getName()} (File thứ ${fileCount + 1})`);
      
      // Chỉ xử lý file được tạo từ 1/3/2025 trở lại đây
      if (createdDate >= CHECK_START_DATE) {
        fileCount++;
        const fileId = file.getId();
        const lastModified = Utilities.formatDate(createdDate, 'GMT+7', 'dd/MM/yyyy HH:mm:ss'); // Thời gian tải lên
        
        // Nếu file chưa được xử lý hoặc có thay đổi, thêm vào danh sách
        if (!processedFiles[fileId] || processedFiles[fileId].lastModified !== lastModified) {
          const performer = getMappingFromSheet(folderId, file.getName()); // Lấy tên người thực hiện
          const finalPerformer = performer || 'Không rõ'; // Gán tên hoặc mặc định
          const fileData = {
            id: fileId,
            name: file.getName(),
            url: file.getUrl(),
            folderName: folderName,
            lastModified: lastModified,
            performer: finalPerformer
          };

          // Chỉ lưu trạng thái đã xử lý nếu performer không phải "Không rõ"
          if (finalPerformer !== 'Không rõ') {
            processedFiles[fileId] = { notified: true, lastModified: lastModified };
            Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã đánh dấu file ${file.getName()} là đã xử lý`);
          } else {
            Logger.log(`[${new Date().toLocaleString('vi-VN')}] File ${file.getName()} có performer "Không rõ", không đánh dấu đã xử lý`);
          }
          
          fileList.push(fileData);
        } else {
          Logger.log(`[${new Date().toLocaleString('vi-VN')}] File ${file.getName()} đã được xử lý trước đó, bỏ qua`);
        }
      } else {
        Logger.log(`[${new Date().toLocaleString('vi-VN')}] File ${file.getName()} ngoài khoảng thời gian kiểm tra, bỏ qua`);
      }
      
      // Log tiến trình: báo cáo sau mỗi 100 file
      if (fileCount % 100 === 0 && fileCount > 0) {
        Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã kiểm tra ${fileCount} file trong thư mục ${folderName}`);
      }
    }

    // Log khi đạt giới hạn file
    if (fileCount >= MAX_FILES_PER_RUN) {
      Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đạt giới hạn ${MAX_FILES_PER_RUN} file, dừng kiểm tra thư mục ${folderName}`);
    }

    // Cập nhật lại danh sách đã xử lý vào Script Properties
    SCRIPT_PROPERTIES.setProperty(processedKey, JSON.stringify(processedFiles));
    
    // Nếu có file, tiếp tục gửi thông báo
    if (fileList.length > 0) {
      Logger.log(`[${new Date().toLocaleString('vi-VN')}] Chuẩn bị gửi thông báo cho ${fileList.length} file mới`);
      sendNotificationInBatches(fileList);
    } else {
      Logger.log(`Không có file mới hoặc thay đổi trong thư mục: ${folderName}`);
    }

    Logger.log(`Hoàn tất kiểm tra thư mục ${folderName}. Tìm thấy ${fileCount} file.`);
  } catch (e) {
    Logger.log(`Lỗi khi kiểm tra thư mục ${folderName}: ${e.message}`);
    sendTelegramMessage(`⚠️ Lỗi khi kiểm tra thư mục ${folderName}: ${e.message}`);
  }
}

// Hàm gửi thông báo cho các video theo nhóm tối đa 10 video
function sendNotificationInBatches(fileList) {
  const batchSize = 10;
  
  // Chia danh sách file thành các nhóm nhỏ
  for (let i = 0; i < fileList.length; i += batchSize) {
    const batch = fileList.slice(i, i + batchSize);
    let message = '<b>▶️ Video Mới Được Tải Lên:</b>\n\n';
    
    // Tạo thông điệp cho từng nhóm video
    batch.forEach(fileData => {
      message += `File: <b>${fileData.name}</b>\n` +
                 `Thư mục: ${fileData.folderName}\n` +
                 `Animator: ${fileData.performer}\n` +
                 `Thời gian: ${fileData.lastModified}\n` +
                 `Link: <a href="${fileData.url}">Xem Video</a>\n\n`;
    });

    // Gửi thông báo
    Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đang gửi thông báo cho ${batch.length} file`);
    sendTelegramMessage(message);
    Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã gửi thông báo cho ${batch.length} file`);
    
    // Đợi 2 giây trước khi gửi nhóm tiếp theo
    Utilities.sleep(2000);
  }
}

// Hàm gửi tin nhắn Telegram
function sendTelegramMessage(message) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: message,
    parse_mode: 'HTML'
  };
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());

    if (result.ok) {
      Logger.log('Gửi tin nhắn Telegram thành công.');
    } else if (result.error_code === 429) {
      // Nếu lỗi 429, đợi và thử lại
      const retryAfter = result.parameters.retry_after;
      Logger.log(`Lỗi 429: Quá nhiều yêu cầu. Đợi ${retryAfter} giây.`);
      Utilities.sleep(retryAfter * 1000); // Chờ theo thời gian Telegram yêu cầu
      sendTelegramMessage(message); // Thử gửi lại sau khi đợi
    }
  } catch (e) {
    Logger.log(`Lỗi gửi Telegram: ${e.message}`);
  }
}

// Hàm reset dữ liệu cho từng thư mục riêng
function Reset_OS() {
  const folderId = '1hyo6aE8fvJ71SPPkQW0zG5Dt7mDuBjZw'; // OS
  const processedKey = `processedFiles_${folderId}`;
  SCRIPT_PROPERTIES.deleteProperty(processedKey);
  Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã xóa dữ liệu đã xử lý cho thư mục OS (ID: ${folderId})`);
  sendTelegramMessage('✅ Đã reset dữ liệu đã xử lý cho thư mục OS.');
}

function Reset_Tho_Goc() {
  const folderId = '16zNr6vY-7tip1D_tAfhAJICrLvZWQPrD'; // Thô Gốc SPRUNKI
  const processedKey = `processedFiles_${folderId}`;
  SCRIPT_PROPERTIES.deleteProperty(processedKey);
  Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã xóa dữ liệu đã xử lý cho thư mục Thô Gốc SPRUNKI (ID: ${folderId})`);
  sendTelegramMessage('✅ Đã reset dữ liệu đã xử lý cho thư mục Thô Gốc SPRUNKI.');
}

function Reset_Tho_Horror() {
  const folderId = '1LbMLie_bAf2EWgW9SUSi3iGcrtzVa0OC'; // Thô Horror
  const processedKey = `processedFiles_${folderId}`;
  SCRIPT_PROPERTIES.deleteProperty(processedKey);
  Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã xóa dữ liệu đã xử lý cho thư mục Thô Horror (ID: ${folderId})`);
  sendTelegramMessage('✅ Đã reset dữ liệu đã xử lý cho thư mục Thô Horror.');
}

function Reset_TNV() {
  const folderId = '170qnvzDM06IAzkFJKuQKs2iY0njRQf0V'; // TNV
  const processedKey = `processedFiles_${folderId}`;
  SCRIPT_PROPERTIES.deleteProperty(processedKey);
  Logger.log(`[${new Date().toLocaleString('vi-VN')}] Đã xóa dữ liệu đã xử lý cho thư mục TNV (ID: ${folderId})`);
  sendTelegramMessage('✅ Đã reset dữ liệu đã xử lý cho thư mục TNV.');
}

// Hàm reset tất cả thư mục (tùy chọn, giữ lại để dùng nếu cần)
function Reset_Data_All() {
  Reset_OS();
  Reset_Tho_Goc();
  Reset_Tho_Horror();
  Reset_TNV();
  Logger.log(`[${new Date().toLocaleString('vi-VN')}] Reset dữ liệu tất cả thư mục hoàn tất.`);
  sendTelegramMessage('✅ Đã reset dữ liệu đã xử lý cho tất cả thư mục.');
}