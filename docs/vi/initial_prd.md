# Tài liệu phạm vi nguyên mẫu: Cursor Web Controller (MVP)

## 1. Mục tiêu

Xây server relay Node.js kết nối tới instance Cursor IDE chạy cục bộ qua Chromium DevTools Protocol (CDP). Server trích xuất DOM panel AI Chat, phát tới web client nhẹ qua WebSocket, và proxy tương tác người dùng từ xa về IDE.

## 2. Kiến trúc hệ thống

**Tiến trình host:** Cursor IDE chuẩn khởi chạy với `--remote-debugging-port=9222`.

**Relay Server (Node.js):** Chạy cục bộ cùng máy với Cursor.

- Duy trì kết nối CDP tới Cursor bằng puppeteer-core.
- Phục vụ file HTML/JS tĩnh cho UI frontend.
- Chạy WebSocket server (ví dụ socket.io hoặc ws) để duy trì liên kết hai chiều thời gian thực với web client.

**Web Client (trình duyệt):**

- Nhận HTML thô hoặc cập nhật trạng thái qua WebSocket và render giao diện chat.
- Bắt phím và nút, gửi payload JSON có cấu trúc qua WebSocket về Relay Server.

## 3. Yêu cầu cốt lõi (MVP)

**Yêu cầu 1: Khởi tạo server**

Server Node phải bind thành công tới `http://localhost:9222/json`, tìm workspace Cursor và gắn Puppeteer.

Đồng thời khởi động Express (ví dụ cổng 3000) để phục vụ giao diện client.

**Yêu cầu 2: Phát trạng thái**

Backend theo dõi DOM Cursor.

Khi phát hiện thay đổi ở Secondary Side Bar, serialize HTML liên quan và phát tới mọi client WebSocket.

**Yêu cầu 3: Định tuyến lệnh**

Backend lắng nghe sự kiện WebSocket cụ thể từ client:

- `chat_input`: Chuỗi. Backend thực thi `page.keyboard.type()` trong target Cursor.
- `trigger_click`: Định danh mục tiêu (ví dụ "submit" hoặc "approve"). Backend ánh xạ tới selector DOM tương ứng và `page.click()`.

**Yêu cầu 4: Render phía client**

Web client thay `innerHTML` container bằng chuỗi HTML nhận được.

Inject CSS cơ bản để HTML Cursor không style vẫn đọc được trên mobile hoặc trình duyệt từ xa.

## 4. Các giai đoạn triển khai

**Giai đoạn 1: Relay Hub**

Khởi tạo project Node.js. Express phục vụ `index.html` cơ bản và thiết lập WebSocket server.

**Giai đoạn 2: Cầu CDP**

Tích hợp puppeteer-core. Viết logic poll lấy HTML container chat mỗi giây (hoặc MutationObserver) và phát qua WebSocket.

**Giai đoạn 3: Web Client**

Viết JavaScript frontend lắng tin WebSocket và render HTML inject.

Thêm ô nhập và nút gửi phát sự kiện `chat_input` về server.

**Giai đoạn 4: Vòng thực thi**

Viết handler backend nhận sự kiện WebSocket và dịch sang tương tác Puppeteer trong Cursor.

## 5. Rủi ro kỹ thuật & Giảm thiểu

**Rủi ro:** Cập nhật DOM tần suất cao. Cursor stream text từng token. Phát toàn bộ HTML container mỗi token gây tải mạng nặng và nhấp nháy phía client.

**Giảm thiểu:** Debounce phía backend trên observer DOM. Chỉ phát thay đổi trạng thái mỗi 300–500ms, hoặc parse DOM và chỉ gửi diff text mới nhất thay vì cả blob HTML.

**Rủi ro:** Mất listener sự kiện. Khi trích HTML bằng `innerHTML`, listener JS gắn với React state của Cursor bị mất.

**Giảm thiểu:** Web client không thể click trực tiếp nút HTML clone. UI web phải render nút điều khiển tĩnh riêng (ví dụ nút "Approve" nổi đáy màn hình) kích hoạt sự kiện WebSocket, thay vì làm DOM clone tương tác.
