# Time Counter - Chrome Extension

Tiện ích Chrome đếm thời gian chuyên nghiệp với khả năng đếm ngày từ quá khứ và đếm ngược tương lai.

## Tính năng chính

### 🎯 Đếm ngược (Countdown)
- Đếm ngược từ ngày hiện tại đến một ngày trong tương lai
- Hiển thị số ngày còn lại
- Thông báo tự động khi đến các mốc quan trọng (1, 7, 30 ngày)

### 📅 Đếm từ ngày (Count Up)
- Đếm số ngày đã trôi qua từ một ngày trong quá khứ
- Hiển thị số ngày đã trải qua
- Thông báo tự động khi đến các mốc quan trọng (7, 30, 100, 365 ngày)

### ⚙️ Tùy chọn nâng cao
- **Bỏ đếm ngày trong tuần**: Có thể chọn không đếm các ngày cụ thể (Thứ 2-7, Chủ nhật)
- **Quản lý nhiều sự kiện**: Thêm, sửa, xóa nhiều sự kiện khác nhau
- **Giao diện chuyên nghiệp**: Hỗ trợ chế độ sáng/tối tự động
- **Lưu trữ đồng bộ**: Dữ liệu được lưu trữ online và đồng bộ giữa các thiết bị

### 🖥️ Giao diện người dùng
- **Popup chính**: Hiển thị danh sách tất cả sự kiện
- **Form tạo/sửa**: Giao diện thân thiện để quản lý sự kiện
- **Cửa sổ đếm**: Hiển thị chi tiết thời gian đếm khi click vào sự kiện
- **Chế độ sáng/tối**: Tự động theo hệ thống hoặc chọn thủ công

## Cài đặt

### Cách 1: Cài đặt từ Chrome Web Store (Khuyến nghị)
*Sẽ có sẵn sau khi extension được phê duyệt*

### Cách 2: Cài đặt thủ công (Developer Mode)

1. **Tải xuống extension**
   - Tải về file .zip hoặc clone repository
   - Giải nén vào thư mục trên máy tính

2. **Bật Developer Mode**
   - Mở Chrome và truy cập `chrome://extensions/`
   - Bật "Developer mode" ở góc trên bên phải

3. **Load extension**
   - Click "Load unpacked"
   - Chọn thư mục chứa extension (thư mục có file manifest.json)
   - Extension sẽ xuất hiện trong danh sách

4. **Ghim extension** (Tùy chọn)
   - Click vào icon puzzle piece trên thanh công cụ
   - Click vào icon pin bên cạnh "Time Counter"

## Hướng dẫn sử dụng

### Tạo sự kiện mới

1. Click vào icon Time Counter trên thanh công cụ
2. Click nút "➕ Thêm sự kiện"
3. Điền thông tin:
   - **Tên sự kiện**: Tên mô tả cho sự kiện
   - **Loại đếm**: Chọn "Đếm ngược" hoặc "Đếm từ ngày"
   - **Ngày**: Chọn ngày bắt đầu/kết thúc
   - **Bỏ đếm các ngày**: Tích chọn các ngày không muốn đếm
4. Click "💾 Lưu"

### Xem thời gian đếm

1. Trong popup chính, click vào bất kỳ sự kiện nào
2. Cửa sổ hiển thị chi tiết sẽ xuất hiện
3. Cửa sổ sẽ tự động đóng sau 10 giây hoặc click ra ngoài để đóng

### Chỉnh sửa sự kiện

1. Hover chuột vào sự kiện trong danh sách
2. Click vào icon "✏️" để chỉnh sửa
3. Thay đổi thông tin và click "💾 Lưu"

### Xóa sự kiện

1. Hover chuột vào sự kiện trong danh sách
2. Click vào icon "🗑️" để xóa
3. Xác nhận xóa trong hộp thoại

### Chuyển đổi chế độ sáng/tối

1. Click vào icon "🌙" ở góc trên bên phải
2. Chế độ sẽ chuyển đổi: Auto → Light → Dark → Auto

## Tính năng kỹ thuật

### Lưu trữ dữ liệu
- **Chrome Sync Storage**: Dữ liệu được đồng bộ giữa các thiết bị khi đăng nhập Chrome
- **Local Storage Fallback**: Tự động chuyển sang lưu trữ cục bộ nếu sync storage đầy
- **Backup tự động**: Dữ liệu được sao lưu định kỳ

### Thông báo
- **Milestone notifications**: Thông báo tự động tại các mốc quan trọng
- **Background processing**: Chạy ngầm để cập nhật thời gian và gửi thông báo
- **Customizable**: Có thể bật/tắt thông báo trong cài đặt

### Hiệu suất
- **Real-time updates**: Cập nhật thời gian đếm mỗi giây
- **Efficient calculations**: Thuật toán tối ưu cho việc tính toán ngày
- **Memory management**: Quản lý bộ nhớ hiệu quả

## Cấu trúc dự án

```
time-counter-extension/
├── manifest.json              # Chrome extension manifest
├── src/
│   ├── shared/
│   │   ├── counting.js       # Logic đếm dùng chung (popup + background)
│   │   └── lunar.js          # Đổi ngày Dương sang Âm (Intl, múi giờ VN)
│   ├── popup/
│   │   ├── popup.html        # Giao diện popup chính
│   │   ├── popup.css         # Styles cho popup
│   │   └── popup.js          # Logic popup
│   └── background/
│       └── background.js     # Background service worker
├── assets/
│   ├── icon16.png           # Icon 16x16
│   ├── icon32.png           # Icon 32x32
│   ├── icon48.png           # Icon 48x48
│   └── icon128.png          # Icon 128x128
├── DESIGN.md                # Tài liệu thiết kế
└── README.md               # Hướng dẫn này
```

## Hỗ trợ

### Yêu cầu hệ thống
- Chrome 88+ hoặc Edge 88+
- Manifest V3 support

### Báo lỗi
Nếu gặp lỗi, vui lòng cung cấp:
1. Phiên bản Chrome/Edge
2. Mô tả chi tiết lỗi
3. Các bước tái hiện lỗi
4. Screenshot nếu có thể

### Góp ý tính năng
Chúng tôi luôn chào đón ý kiến đóng góp để cải thiện extension!

## Phiên bản

### v1.2.0 — Ghim + live + lịch Dương/Âm (27/10/2026)
- **Nền nhẹ:** nền chuyển pastel nhạt + mảng màu mờ phía sau, thẻ vẫn đủ tương phản để đọc rõ.
- **Ghim sự kiện:** bấm vào thẻ (hoặc nút 📌) để đưa sự kiện đó lên hero ghim ở trên; bấm thẻ khác để đổi ghim, bấm "Bỏ ghim" để quay về sự kiện sắp tới nhất. Ghim được lưu trong cài đặt đồng bộ nên mở tab mới vẫn giữ.
- **Thời gian chi tiết ở chỗ ghim:** hero hiện số lớn theo lịch thật, ô đếm live chạy mỗi giây (ngày + giờ:phút:giây tới giờ sự kiện, hoặc đếm lên với sự kiện đã bắt đầu) và thanh % tiến trình. Đếm ngược tính % từ ngày tạo tới ngày đích; đếm từ ngày tính % tới kỷ niệm tiếp theo.
- **Lịch Dương + Âm hoàn chỉnh ở góc phải:** lịch tháng đầy đủ, số lớn là ngày Dương, số nhỏ là ngày Âm, ngày hôm nay tô đậm, ngày có sự kiện có chấm đánh dấu. Bấm ‹ › để tiến/lùi tháng, bấm vào một ngày để xem ngày đó (Dương + Âm + can chi năm + sự kiện trong ngày), hoặc nhập ngày vào ô ngày rồi bấm "Đi tới" để nhảy tới quá khứ/tương lai, bấm "Hôm nay" để quay về.
- **Ẩn sự kiện đã qua:** sự kiện đếm ngược đã kết thúc có thêm nút 🙈 để ẩn khỏi danh sách chính; các sự kiện đã ẩn nằm trong mục riêng và bấm "Hiện lại" để khôi phục.
- **Giờ tùy chọn:** form thêm giờ, dùng cho đồng hồ live ở hero. Không nhập giờ thì tính tới 00:00 ngày sự kiện.
- **Sửa kèm:** cài đặt giờ được hợp nhất thay vì ghi đè (sửa lỗi v1.1.x làm mất cờ thông báo khi đổi theme/ghim); nút sửa/xóa luôn hiện, không còn chỉ hiện khi hover; đã bỏ các dòng chú thích hướng dẫn trong giao diện.
- **Lưu ý về lịch Âm:** đổi Âm dùng lịch có sẵn của trình duyệt ở múi giờ Việt Nam, đã kiểm chứng Tết 2023–2026 và 27/10/2026 = 18/9 âm lịch. Lịch Âm Việt Nam và Trung Hoa dùng chung quy tắc nhưng khác kinh tuyến, nên vào ngày hiếm hoi trăng non rơi sát nửa đêm có thể lệch 1 ngày.

### v1.1.1 — Sửa phép đếm cho chính xác (27/10/2026)
- **Đếm trừ ngày, không đếm cả hai đầu:** cùng ngày = 0 ngày, hôm nay → ngày mai = 1 ngày. Trước đây cùng ngày tính 1 ngày, ngày mai tính 2 ngày.
- **Tách năm/tháng theo lịch thật:** không còn chia 365 ngày = 1 năm, 30 ngày = 1 tháng. Ví dụ 29/02/2024 → 28/02/2025 = 1 năm; 31/01/2026 → 31/03/2026 = 2 tháng.
- **Hiển thị rõ trạng thái:** đúng ngày sự kiện hiện "Hôm nay"; đếm ngược đã qua hiện "Đã kết thúc" kèm số ngày đã qua.
- **Khi bỏ ngày trong tuần:** thẻ hiện số "ngày tính" (chỉ đếm các ngày sau ngày bắt đầu, tới hết ngày đích, bỏ qua ngày đã chọn) kèm dòng "Lịch: X ngày" để không nhầm ngày tính với ngày lịch. Ví dụ Thứ 6 30/10/2026 → Thứ 2 02/11/2026, bỏ Thứ 7 + Chủ nhật = 1 ngày tính, 3 ngày lịch.
- **Thông báo mốc chạy đúng ngày:** mốc "còn 1 ngày" giờ báo đúng ngày hôm trước, không còn báo vào chính ngày sự kiện. Logic đếm dùng chung cho popup và background tại `src/shared/counting.js`, tránh hai nơi tính lệch nhau.
- Chưa đổi trong bản này: form vẫn chỉ có ngày (chưa có giờ), tần suất cập nhật vẫn mỗi phút, các lỗi đã biết khác (ghi đè cài đặt thông báo, code message chưa được gọi, nút sửa/xóa chỉ hiện khi hover) sẽ làm ở các cải tiến sau.

### v1.0.0
- ✅ Đếm ngược và đếm từ ngày
- ✅ Bỏ đếm ngày trong tuần
- ✅ Quản lý nhiều sự kiện
- ✅ Giao diện chế độ sáng/tối
- ✅ Lưu trữ đồng bộ
- ✅ Thông báo tự động

### Kế hoạch tương lai
- 📊 Thống kê và báo cáo
- 🎨 Themes tùy chỉnh
- 📱 Ứng dụng mobile companion
- 🔗 Tích hợp calendar
- 🌍 Đa ngôn ngữ

## Giấy phép

MIT License - Xem file LICENSE để biết chi tiết.

---

**Time Counter** - Đếm thời gian một cách chuyên nghiệp và hiệu quả! ⏰

