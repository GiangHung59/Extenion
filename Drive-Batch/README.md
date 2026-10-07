# Drive Batch 0.4.2

Tiện ích Chrome Manifest V3 tải hàng loạt link Google Drive, giao diện tiếng Việt. Không có bước cấu hình OAuth, API key hoặc máy chủ trung gian.

## Cài vào Chrome

1. Giải nén nếu dùng bản ZIP.
2. Mở `chrome://extensions` trong Chrome.
3. Bật **Chế độ dành cho nhà phát triển / Developer mode**.
4. Chọn **Tải tiện ích đã giải nén / Load unpacked**, chọn thư mục chứa `manifest.json` (thư mục **Driver Download** nếu dùng mã nguồn này).
5. Ghim **Drive Batch** và bấm biểu tượng để mở khung công cụ nổi ngay trên tab hiện tại. Nếu đã cài thư mục mã nguồn này, chỉ cần bấm **Tải lại / Reload** trên thẻ tiện ích tại `chrome://extensions`. Nếu cài bản ZIP trước, thay nội dung thư mục cũ bằng bản mới rồi Reload.

Xem `help.html` trong tiện ích để biết cách dùng. Không cần npm hoặc build để cài.

## Chức năng và giới hạn

- Khung công cụ nổi trong tab hiện tại, không mở cửa sổ hoặc tab mới: không tự đóng khi bấm sang trang để copy tiền tố. Sau 20 giây không di chuột, bấm, cuộn hoặc nhập trong công cụ, khung tự ẩn; bấm biểu tượng để mở lại. Hàng đợi và tiền tố vẫn lưu. Phần nhập link được thu gọn; danh sách tải chiếm chiều cao còn lại, cuộn độc lập với tiêu đề bảng cố định. Hướng dẫn phụ có thể mở bằng mục “Hướng dẫn”. Link đang dán và lựa chọn thư mục được lưu khi đóng/mở popup; hàng đợi chạy ở service worker.
- Dán nhiều link; lọc host/protocol, báo link lỗi và bỏ trùng theo ID.
- Kiểm tra khả năng tải không cookie, rồi thử với phiên Google trên Chrome nếu cần. Có quyền host `accounts.google.com` để nhận diện chuyển hướng đăng nhập, tránh lỗi CORS; chỉ kiểm tra URL và hủy luồng, không đọc nội dung trang tài khoản. Sau khi cập nhật cần Reload tiện ích và cho phép miền mới nếu Chrome yêu cầu.
- Mỗi dòng file/link có ô “Thêm trước tên file” riêng: ghép tiền tố + một dấu cách + tên gốc (giữ phần mở rộng), để trống giữ tên gốc. Lưu từng ô nhập khi đóng popup; mỗi file dùng tiền tố riêng và chốt giá trị khi bấm tải hoặc thử lại.
- Mỗi lần bấm tải/thử lại chỉ hỏi lưu ở file đầu tiên tải được; các file sau dùng `saveAs: false` và thư mục tải xuống mặc định của Chrome. Hủy hộp thoại sẽ dừng các file còn chờ trong lượt đó. Chrome Downloads không cho ghi vào đường dẫn tuyệt đối tùy chọn, nên thư mục chọn cho file đầu không được áp dụng tự động cho các file sau.
- Tải hai file cùng lúc; lưu hàng đợi, kiểm tra trạng thái bằng Chrome Downloads, dừng bắt đầu file mới, thử lại lỗi đã chọn.
- Xuất Docs → DOCX, Sheets → XLSX, Slides → PPTX; file thông thường giữ định dạng gốc. Với link `/file/d`, thử nhận diện tài liệu qua trang đích; nếu không được hãy dán link từ ứng dụng Docs/Sheets/Slides.
- Thư mục: hộp lựa chọn tự mở khi phát hiện; thử đọc embedded folder view, hiển thị checkbox chọn từng mục/tất cả. Có thể đọc các mục đang hiển thị trong tab Drive và tích lũy qua nhiều lần quét sau khi cuộn. Thư mục con cần quét riêng.
- **Không bảo đảm quét đủ mọi mục hoặc toàn bộ cây thư mục** trong chế độ không API. Nút tải cả thư mục mở Drive; người dùng bấm menu thư mục → Tải xuống để Google tạo ZIP. Đây là thao tác tải ZIP thủ công, không phải tự động tải cả thư mục.
- Nhận cả link `drive.usercontent.google.com/open?id=…` và giữ tham số `authuser`. Không cấu hình đăng nhập riêng. Có thể cần mở Google, đăng nhập đúng tài khoản, xử lý quyền/xác nhận rồi thử lại. Không có bộ chọn nhiều tài khoản.
- Không khẳng định thiếu quyền khi Google chỉ trả 404/403 mơ hồ. Không vượt chặn tải hoặc quota; với cảnh báo file quá lớn nên không quét được vi-rút, tiện ích tự đọc biểu mẫu xác nhận chính thức của Google (ID, confirm, uuid và tài khoản), kiểm tra endpoint trả nội dung file rồi chuyển URL đã xác nhận cho Chrome Downloads. Không tự xử lý CAPTCHA hoặc trang báo phát hiện mã độc.
- Kiểm tra tải dùng GET nhưng hủy response stream sau khi đọc header (hoặc một phần HTML lỗi); không giữ file lớn trong RAM. File thực tế do Chrome Downloads tải, không qua blob URL.
- Không tự tiếp tục lượt tải ở trạng thái không chắc chắn khi worker bị dừng giữa chừng, tránh tải trùng. Các lượt tải đã ghi nhận được đối chiếu với Chrome.

## Kiểm tra

`node --test tests/*.test.mjs` (Node 18+).

Các kiểm thử hiện có mô phỏng Google/Chrome để xác minh tiền tố, giữ phần mở rộng, một hộp thoại mỗi lượt bấm, lỗi file đầu, hủy lưu, kiểm tra không tải và khôi phục worker. Chúng không thay thế thử nghiệm với Google Drive thật.

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
- `tool-panel.js`, `idle-hide.js`: gắn khung nổi vào tab hiện tại và tự ẩn sau 20 giây không thao tác.
- `network.js`: đọc phản hồi và giải quyết trang xác nhận file lớn; giới hạn số lần xác nhận.
- `layout.js`, `popup.css`: kích thước và bố cục popup.
- `index.html`, `app.js`, `style.css`: giao diện.
- `help.html`: hướng dẫn trong tiện ích.
- `tests/`: kiểm thử logic và Chrome/Google mock.

Tài liệu nền: [Chrome Downloads](https://developer.chrome.com/docs/extensions/reference/api/downloads), [Google Drive downloads](https://developers.google.com/workspace/drive/api/guides/manage-downloads). Muốn liệt kê thư mục đầy đủ, ổn định hơn cần tích hợp Drive API với API key cho thư mục công khai và OAuth cho dữ liệu riêng tư; bản này chưa triển khai.

## Xác minh bản 0.2.0

20 kiểm thử tự động đã qua, gồm URL xác nhận, UUID, tài khoản, chặn URL ngoài Google/sai ID và giới hạn vòng lặp. Đã chạy mã xử lý tải trực tiếp với link PSD mẫu người dùng cung cấp: sau bước xác nhận, Google trả `application/octet-stream` và đúng tên file PSD. Kiểm tra này đọc header rồi đóng luồng, chưa xác minh tải đủ 120 MB trong Chrome.

Khung nổi dùng quyền `activeTab` để chèn giao diện khi bạn bấm biểu tượng, không cần quyền host trên tất cả website. Không hỗ trợ các trang nội bộ Chrome như `chrome://extensions`; hãy mở công cụ trên trang web thông thường. Nút ✕ ẩn khung ngay. Tải nền và tiền tố vẫn giữ khi khung ẩn.

Tải file dùng cùng phiên Google với Chrome Downloads và chuyển URL cuối đã trả nội dung file cho Chrome. Nếu Chrome nhận HTML thay vì file, tiện ích hủy/xóa riêng lượt tải HTML của mình rồi lấy lại URL và thử lại tối đa một lần; không hỏi lưu lại trong cùng lượt bấm. Nếu vẫn nhận HTML, hiển thị yêu cầu kiểm tra đăng nhập, quyền hoặc quota.
