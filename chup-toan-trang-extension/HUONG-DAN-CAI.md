# Hướng dẫn cài extension "Chụp Toàn Trang" — bản 3.5.1

Extension chạy trên **Google Chrome** và **Cốc Cốc** (cùng nhân Chromium, cách cài giống hệt nhau).

## Có gì mới ở bản 3.5.1
- **Sửa lỗi "chụp toàn trang khi đang bật Vẽ chú thích trước":** trước đây nếu công tắc "Vẽ chú thích trước khi chụp" đang bật mà bấm **Chụp toàn bộ trang**, extension chỉ mở lớp vẽ trên khung đang xem — không chụp được toàn trang. Nay công tắc đó **chỉ áp dụng cho "Phần đang hiển thị"**; chụp toàn trang luôn chụp đủ cả trang (xong bấm **Sửa** ở panel góc phải dưới để vẽ chú thích lên ảnh toàn trang trong trình sửa như bình thường).

## Có gì mới ở bản 3.5.0
- **Chụp vùng chọn làm lại kiểu Lightshot (sửa lỗi "chọn vùng lại ra ảnh toàn khung"):** trước đây nếu đang bật "Vẽ chú thích trước khi chụp" thì bấm chụp vùng chọn bị chế độ vẽ nuốt mất. Nay bấm **Chụp vùng chọn** là extension **chụp màn hình trước rồi đóng băng nguyên khung hình tại chỗ, phủ tối xung quanh** — sếp **kéo khoanh vùng ngay trên ảnh đóng băng** (vùng chọn sáng lên, có nhãn kích thước, kéo các ô vuông ở viền để dãn/thu hoặc kéo viền để dời vùng). Cạnh vùng chọn hiện **thanh công cụ dọc** để vẽ mũi tên, khoanh khung, gõ chữ, che mờ... ngay trong vùng; dưới góc phải vùng chọn là **3 nút ICON: 💾 lưu (đĩa mềm xanh lá), sao chép (2 tờ giấy xanh dương), ✕ đóng (đỏ)** — không còn nút chữ. Phím tắt trong khung: Ctrl+S lưu, Ctrl+C sao chép, Ctrl+Z hoàn tác, Esc đóng.
- **Nút hành động của chế độ vẽ-trên-trang cũng chuyển sang icon** (lưu / sao chép / ✕) cho đồng bộ, rê chuột lên nút vẫn có chú thích chữ.

## Có gì mới ở bản 3.4.1
- **Vùng mờ che ngay trong lúc kéo, không phải chờ lưu mới thấy:** bản 3.4 nạp ảnh nền qua kho lưu nên màn hình lớn (Retina) phải chờ một lúc; ai vẽ ngay trong lúc chờ đó sẽ không thấy vùng mờ che. Bản 3.4.1 gửi ảnh nền kèm ngay khi mở lớp vẽ (nạp nhanh hơn hẳn) và hiện nhãn **"Đang nạp ảnh chụp…"** — trong lúc nhãn còn hiện, chưa vẽ được và nút Lưu/Sao chép bị khoá; nhãn tắt là nền đã sẵn sàng, từ đó **kéo tới đâu vùng mờ che pixelate thật tới đó**.
- **Popup hiện số phiên bản** ở dòng chân trang (ví dụ "v3.4.1") để đối chiếu bản đang chạy. Nếu đã chép file mới mà popup chưa hiện đúng số này, vào trang quản lý extension bấm nút **nạp lại (↻)** trên thẻ "Chụp Toàn Trang".

## Có gì mới ở bản 3.4
- **Chế độ vẽ-trên-trang làm lại theo đúng trình sửa bản đầu:** extension **chụp khung đang xem trước, lấy chính ảnh đó làm nền đóng băng** rồi hiện thanh công cụ — sếp vẽ trực tiếp lên ảnh, **thấy sao ra vậy**: khoanh vùng làm mờ là **hiện pixelate thật ngay trên màn hình** (không còn hộp mờ trong suốt như bản 3.2/3.3), mũi tên/chữ/khung đều hiện đúng như ảnh cuối. Bấm **Lưu…** / **Sao chép** thì ảnh nền được thay bằng bản đã vẽ. Bấm **Huỷ** là bỏ hẳn, không lưu lại gì.

## Có gì mới ở bản 3.3

- **Mũi tên chuẩn lại:** thân tên dừng đúng ở chân đầu tên — đầu tam giác là phần nhô xa nhất, không còn đoạn thân thò qua đầu tên như trước.
- **Kéo uốn cong đường thẳng / mũi tên:** vẽ xong một đường thẳng hoặc mũi tên, nó hiện **3 chấm** (đầu – giữa – cuối). Kéo **chấm cam ở giữa** để uốn cong thành mũi tên cong / đường cong; kéo 2 chấm trắng ở 2 đầu để dời đầu. Muốn sửa lại sau: ở trình sửa dùng công cụ Chọn rồi bấm vào đường/mũi tên; ở chế độ vẽ-trên-trang, bấm trúng đường/mũi tên (khi đang chọn công cụ đường thẳng/mũi tên) là 3 chấm hiện lại.
- (Bản 3.4 đã thay cách làm này bằng vẽ trực tiếp lên ảnh nền — xem mục 3.4 ở trên. Thuật toán làm mờ vẫn là bản gốc của trình sửa: thu vùng xuống 7% rồi phóng lại thành các ô mosaic.)

## Có gì mới ở bản 3.2

- **Vẽ chú thích trước khi chụp (tuỳ chọn mới trong popup):** bật công tắc **"Vẽ chú thích trước khi chụp"** thì mỗi lần bấm chụp, extension chụp khung đang xem làm nền rồi hiện **thanh công cụ vẽ ngay trên trang** — vẽ mũi tên, khoanh khung, gõ chữ, che mờ... trực tiếp lên ảnh nền đó, thấy sao ra vậy. Vẽ xong bấm ở thanh dưới: **Lưu…** (chụp rồi mở trang ảnh, bấm tiếp **"Chọn nơi lưu & Lưu file"** để tự chọn thư mục/ổ đĩa), **Sao chép** (chụp rồi chép thẳng vào clipboard), hoặc **Huỷ**. Chế độ này chụp **khung đang xem** kèm nét vẽ.
- **Mũi tên đậm và rõ hơn:** đầu mũi tên to hơn hẳn, thân dày hơn — chỉ đâu ra đó ngay.
- **Chữ gõ lên ảnh có bóng đổ** — nổi rõ trên mọi nền.
- **Panel sau khi chụp tự thu nhỏ sau 3 giây** (trước là 15 giây); di chuột vào panel thì dừng đếm ngược.
- Sửa luôn một lỗi tiềm ẩn: nút **Tải xuống** trong trang ảnh/trình sửa có môi trường bị lưu thành tên file lạ (dạng mã GUID) — đã chuyển sang cơ chế tải chắc chắn đúng tên như panel.

## Có gì mới ở bản 3.1

- **3.1.1 — sửa lỗi "Chép vào clipboard chưa được":** khi bấm chụp từ popup, popup đang mở làm trang web tạm mất "focus" mà Chrome chỉ cho chép khi trang có focus. Nay panel tự **chờ trang nhận lại focus rồi mới chép** (popup cũng tự đóng sớm ở chế độ Clipboard); trang nào chặn chép thẳng thì extension **tự mở trang ảnh để chép hộ** và báo ngược về panel "Đã chép vào clipboard".

- **Thêm lựa chọn Clipboard ở mục "Sau khi chụp":** chụp xong ảnh tự chép vào clipboard — dán `Cmd+V` / `Ctrl+V` vào Zalo, Word, Facebook… là xong, không phải lưu file. Panel góc phải dưới báo **"Đã chép vào clipboard"** kèm nút **Lưu file** (đổi ý thì vẫn lưu được), **Sửa** và **Xoá**. Tuỳ chọn này áp dụng cho **cả 3 kiểu chụp** (toàn trang / phần đang hiển thị / chọn vùng) — một tuỳ chọn dùng chung, không kiểu nào bị lệch.
- **Trình sửa ảnh sau khi chụp** (giống app chụp chuyên nghiệp): bấm nút **Sửa** trong panel (nút Xem cũ đã gộp vào đây) để mở trình sửa khổ lớn:
  - **Thanh công cụ phía trên:** chọn/di chuyển, bút vẽ, đánh dấu, đường thẳng, **mũi tên**, khung chữ nhật, khung tròn, **gõ chữ**, **làm mờ** (che tên, email, số điện thoại…), cắt ảnh; 6 màu, 3 cỡ nét; hoàn tác / làm lại từng bước (`Cmd/Ctrl + Z`).
  - **Thanh dọc bên phải:** ✓ **Áp dụng** (ghi bản đã sửa rồi quay về trang web — panel vẫn chờ để Lưu), **Sao chép** ảnh đã sửa vào clipboard, **Tải xuống** thẳng, **Bản gốc** (bỏ hết sửa, làm lại từ ảnh gốc — ảnh gốc luôn được giữ riêng), **Đóng**.
- **Tự đặt phím tắt:** các nút chụp trong popup giờ hiện **phím thật đang dùng** (đọc trực tiếp từ trình duyệt). Muốn đổi: bấm nút **Đổi phím tắt** trong popup → mở trang phím tắt của trình duyệt → gõ phím mới. Cả 3 kiểu đều gán phím được; **Chọn vùng chụp** có phím sẵn `Cmd/Ctrl + Shift + E`. (Bản cũ dùng chữ R cho vùng chọn nhưng Chrome giữ phím đó cho việc tải lại trang nên không gán được — đã đổi sang E.)

Các điểm của bản 3.0 giữ nguyên: tự nhận diện Mac/Windows (hiện Cmd hay Ctrl đúng máy); panel ảnh nhỏ góc phải dưới sau khi chụp (tự thu thành nút tròn sau 15 giây); tên file hiển thị sao tải về đúng vậy từng ký tự; mục "Tên file gồm" tự tick thành phần tên.

## Cách cài / cập nhật

Nếu đã cài bản cũ: **gỡ bản cũ rồi cài thư mục mới** (hoặc trỏ lại vào thư mục này rồi bấm nút tải lại ↻ trong `chrome://extensions`).

1. Giải nén file ZIP — được thư mục `chup-toan-trang-extension`.
2. Mở trình duyệt, gõ vào thanh địa chỉ:
   - Chrome: `chrome://extensions`
   - Cốc Cốc: `coccoc://extensions` (không vào được thì dùng `chrome://extensions`)
3. Bật **Chế độ dành cho nhà phát triển / Developer mode** ở góc trên bên phải.
4. Bấm **Tải tiện ích đã giải nén / Load unpacked** → chọn thư mục `chup-toan-trang-extension`.
5. Bấm biểu tượng **mảnh ghép 🧩** → ghim **Chụp Toàn Trang** để icon luôn hiện.

## Cách dùng

Bấm icon extension, chọn 1 trong 3 kiểu chụp:

| Kiểu | Phím tắt mặc định | Công dụng |
|---|---|---|
| **Toàn bộ trang** | `Cmd/Ctrl + Shift + Y` | Máy tự cuộn & ghép — chụp hết chiều dài trang thành 1 ảnh dài |
| **Phần đang hiển thị** | `Cmd/Ctrl + Shift + X` | Chụp đúng khung đang nhìn thấy |
| **Chọn vùng chụp** | `Cmd/Ctrl + Shift + E` | Kéo chuột khoanh vùng tuỳ ý, Esc để huỷ |

(Phím tắt tự đổi được bằng nút **Đổi phím tắt** trong popup — bảng trên là mặc định.)

Sau khi chụp, tuỳ mục **Sau khi chụp** đã chọn:

- **Hỏi** (mặc định): panel góc phải dưới hiện ảnh thu nhỏ + **Lưu / Sửa / Xoá**.
- **Lưu luôn**: tải về Downloads ngay, panel chỉ báo "Đã lưu".
- **Clipboard**: ảnh tự chép vào clipboard, panel báo "Đã chép vào clipboard" + vẫn có **Lưu file / Sửa / Xoá** nếu đổi ý.

Tuỳ chọn khác (được nhớ cho lần sau): **Định dạng** PNG/JPG • **Hẹn giờ** ngay/3s/5s • **Chụp thông minh chống lặp** • **Cuộn tải ảnh trước khi chụp** • **Đầu tên file** • **Tên file gồm** (tick thành phần tên).

Đường tắt khác: **chuột phải trên trang web** → menu "📸 Chụp Toàn Trang".

## Lưu ý

- Trong lúc chụp toàn trang, **đừng chuyển tab và đừng cuộn tay** — extension đang tự cuộn trang, chụp xong trang tự trở về vị trí cũ.
- Trang hệ thống (`chrome://`, trang cài đặt, Chrome Web Store) thì trình duyệt cấm mọi extension chụp; trên các trang đó panel không hiện được — extension sẽ mở trang xem trước thay thế để anh vẫn tải/xoá được.
- Trang cực dài (ảnh ghép vượt ~16.000 px) extension sẽ báo trước — thu nhỏ trang bằng `Cmd/Ctrl + "-"` rồi chụp lại.
- Trang cuộn vô hạn (feed kéo mãi không hết) thì ảnh sẽ dừng ở giới hạn 60 đoạn chụp.

## Gỡ cài đặt

Vào `chrome://extensions` → extension **Chụp Toàn Trang** → **Xoá**.
