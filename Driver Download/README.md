# Drive Batch 0.3.0

Tiện ích Chrome Manifest V3 tải hàng loạt link Google Drive, giao diện tiếng Việt. Không có bước cấu hình OAuth, API key hoặc máy chủ trung gian.

## Cài vào Chrome

1. Giải nén nếu dùng bản ZIP.
2. Mở `chrome://extensions` trong Chrome.
3. Bật **Chế độ dành cho nhà phát triển / Developer mode**.
4. Chọn **Tải tiện ích đã giải nén / Load unpacked**, chọn thư mục chứa `manifest.json` (thư mục **Driver Download** nếu dùng mã nguồn này).
5. Ghim **Drive Batch** và bấm biểu tượng để mở popup ngay trên trang hiện tại. Nếu đã cài thư mục mã nguồn này, chỉ cần bấm **Tải lại / Reload** trên thẻ tiện ích tại `chrome://extensions`. Nếu cài bản ZIP trước, thay nội dung thư mục cũ bằng bản mới rồi Reload.

## Nơi lưu mặc định

Lần đầu bấm tải, tiện ích hỏi nơi lưu. Nhập tên thư mục con (ví dụ `Du an/Thang 9`) hoặc để trống để dùng thư mục tải xuống Chrome, rồi bấm **Lưu & bắt đầu tải**. Các file của đợt đó tự vào cùng nơi; thư mục con được tạo khi có file tải xuống. Lựa chọn được nhớ cho lần sau. Bấm **Thay đổi** trong popup để đổi thư mục con cho đợt mới; file đã xếp hàng giữ lựa chọn của đợt cũ.

**Giới hạn quan trọng:** tiện ích Chrome không thể dùng `chrome.downloads` để tự ghi vào đường dẫn tuyệt đối bất kỳ. Nút **Đổi thư mục gốc trong Chrome** mở `chrome://settings/downloads`; người dùng bấm **Thay đổi** tại đó để chọn thư mục/ổ đĩa khác. Thay đổi thư mục gốc ảnh hưởng đến mọi lượt tải Chrome. Sau đó mở lại popup để tiếp tục; lựa chọn đang nhập vẫn được giữ. Không có bộ chọn thư mục hệ điều hành độc lập trong tiện ích, không thay cài đặt Chrome ngầm và không cần cài ứng dụng phụ trợ.

Nếu Chrome hỏi nơi lưu cho từng file, tắt “Hỏi vị trí lưu từng tệp trước khi tải xuống” trong cài đặt tải xuống. File vẫn được Chrome quản lý, giữ tên gốc do máy chủ cung cấp và tự đánh số khi trùng.

Xem `help.html` trong tiện ích để biết cách dùng. Không cần npm hoặc build để cài.

## Chức năng và giới hạn

- Popup 760 × 580 px; không tự mở tab mới. Link đang dán và lựa chọn thư mục được lưu khi đóng/mở popup; hàng đợi chạy ở service worker.
- Dán nhiều link; lọc host/protocol, báo link lỗi và bỏ trùng theo ID.
- Kiểm tra khả năng tải không cookie, rồi thử với phiên Google trên Chrome nếu cần.
- Tải hai file cùng lúc; lưu hàng đợi, kiểm tra trạng thái bằng Chrome Downloads, dừng bắt đầu file mới, thử lại lỗi đã chọn.
- Xuất Docs → DOCX, Sheets → XLSX, Slides → PPTX; file thông thường giữ định dạng gốc. Với link `/file/d`, thử nhận diện tài liệu qua trang đích; nếu không được hãy dán link từ ứng dụng Docs/Sheets/Slides.
- Thư mục: hộp lựa chọn tự mở khi phát hiện; thử đọc embedded folder view, hiển thị checkbox chọn từng mục/tất cả. Có thể đọc các mục đang hiển thị trong tab Drive và tích lũy qua nhiều lần quét sau khi cuộn. Thư mục con cần quét riêng.
- **Không bảo đảm quét đủ mọi mục hoặc toàn bộ cây thư mục** trong chế độ không API. Nút tải cả thư mục mở Drive; người dùng bấm menu thư mục → Tải xuống để Google tạo ZIP. Đây là thao tác tải ZIP thủ công, không phải tự động tải cả thư mục.
- Nhận cả link `drive.usercontent.google.com/open?id=…` và giữ tham số `authuser`. Không cấu hình đăng nhập riêng. Có thể cần mở Google, đăng nhập đúng tài khoản, xử lý quyền/xác nhận rồi thử lại. Không có bộ chọn nhiều tài khoản.
- Không khẳng định thiếu quyền khi Google chỉ trả 404/403 mơ hồ. Không vượt chặn tải hoặc quota; với cảnh báo file quá lớn nên không quét được vi-rút, tiện ích tự đọc biểu mẫu xác nhận chính thức của Google (ID, confirm, uuid và tài khoản), kiểm tra endpoint trả nội dung file rồi chuyển URL đã xác nhận cho Chrome Downloads. Không tự xử lý CAPTCHA hoặc trang báo phát hiện mã độc.
- Kiểm tra tải dùng GET nhưng hủy response stream sau khi đọc header (hoặc một phần HTML lỗi); không giữ file lớn trong RAM. File thực tế do Chrome Downloads tải, không qua blob URL.
- Không tự tiếp tục lượt tải ở trạng thái không chắc chắn khi worker bị dừng giữa chừng, tránh tải trùng. Các lượt tải đã ghi nhận được đối chiếu với Chrome.

## Kiểm tra

Trong thư mục mã nguồn: `npm test` hoặc `node --test tests/*.test.js` (Node 18+). Bản ZIP chỉ chứa tiện ích chạy được, không kèm bộ kiểm thử.

Kiểm thử mô phỏng Google/Chrome để xác minh parser, xuất định dạng, phân loại lỗi, giới hạn hàng đợi, dừng và khôi phục worker. Chúng không thay thế thử nghiệm với Google Drive thật.

Kiểm tra thủ công khi cài:

- File công khai nhỏ, tên Unicode và file trùng tên.
- Một file Docs, Sheets, Slides công khai.
- File riêng tư có quyền, không có quyền, file bị xóa, nhiều tài khoản.
- File lớn có xác nhận Google, file có quota, chủ sở hữu cấm tải.
- Thư mục công khai, riêng tư, thư mục con, thư mục nhiều mục; cuộn rồi quét lại.
- Ba file để kiểm tra giới hạn hai lượt cùng lúc; dừng giữa bước kiểm tra; đóng tab tiện ích và khởi động lại Chrome.

## Cấu trúc

- `core.js`: xử lý link và phản hồi tải.
- `background.js`: service worker, hàng đợi lưu cục bộ, Chrome Downloads, quét tab Drive.
- `network.js`: đọc phản hồi và giải quyết trang xác nhận file lớn; giới hạn số lần xác nhận.
- `layout.js`, `popup.css`: kích thước và bố cục popup.
- `index.html`, `app.js`, `style.css`: giao diện.
- `help.html`: hướng dẫn trong tiện ích.
- `tests/`: kiểm thử logic và Chrome/Google mock.

Tài liệu nền: [Chrome Downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads), [Google Drive downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Muốn liệt kê thư mục đầy đủ, ổn định hơn cần tích hợp Drive API với API key cho thư mục công khai và OAuth cho dữ liệu riêng tư; bản này chưa triển khai.

## Xác minh bản 0.2.0

20 kiểm thử tự động đã qua, gồm URL xác nhận, UUID, tài khoản, chặn URL ngoài Google/sai ID và giới hạn vòng lặp. Đã chạy mã xử lý tải trực tiếp với link PSD mẫu người dùng cung cấp: sau bước xác nhận, Google trả `application/octet-stream` và đúng tên file PSD. Kiểm tra này đọc header rồi đóng luồng, chưa xác minh tải đủ 120 MB trong Chrome.

## Xác minh bản 0.3.0

26 kiểm thử tự động đã qua, bổ sung chọn nơi lưu lần đầu, nhớ lựa chọn qua worker restart, giữ thư mục của đợt đã xếp hàng, giữ tên file và từ chối đường dẫn tuyệt đối/traversal. Logo có PNG 16/32/48/128 px và SVG nguồn; tạo lại bằng `python3 tools/make_icons.py`. Chưa kiểm tra lưu file thực tế sau khi thay thư mục gốc trong Chrome.
