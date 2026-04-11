# Xử lý sự cố kết nối Telegram

Nếu bot Telegram không kết nối hoặc treo khi khởi động, làm lần lượt các mục dưới đây.

---

## 1. Kiểm tra log

Sau khi khởi động CursorRemote, tìm các dòng log sau:

| Dòng log | Ý nghĩa |
|---|---|
| `[telegram] API reachable — bot: @yourbot` | API Telegram truy cập được và token hợp lệ |
| `[telegram] Bot connected (sync: on/off)` | Bot chạy đầy đủ — mọi thứ ổn |
| `[telegram] bot.init() failed: timed out after 15s` | Tầng HTTP của Grammy timeout khi gọi `getMe` |
| `[telegram] 409 Conflict — another bot instance…` | Hai tiến trình dùng cùng bot token |
| `[telegram] Invalid bot token (401 Unauthorized)` | Token từ BotFather sai hoặc đã thu hồi |

Nếu log dừng **sau** `"API reachable"` nhưng **trước** `"Bot connected"`, vấn đề nằm ở khởi động framework bot. Xem mục 3.

---

## 2. Vấn đề thường gặp

### Token bot không hợp lệ

- Mở [@BotFather](https://t.me/BotFather) trên Telegram.
- Gửi `/mybots` → chọn bot → **API Token** để xem token hiện tại.
- Nếu đã thu hồi và tạo token mới, cập nhật trong VS Code Settings → `cursorRemote.telegram.botToken` hoặc qua Setup Panel.

### Một instance khác đang polling

Telegram chỉ cho **một** kết nối long-polling cho mỗi bot token. Nếu thấy `409 Conflict`:

- Dừng mọi server CursorRemote khác dùng cùng token.
- Nếu vừa restart và tiến trình cũ chưa tắt sạch, đợi 30–60 giây để Telegram nhả session, rồi thử lại.
- macOS: kiểm tra Activity Monitor tiến trình `node` mồ côi.
- Linux/WSL: `ps aux | grep cursor-remote` hoặc `lsof -i :3000`.

### Mạng / tường lửa

Nếu `getMe` thất bại liên tục do timeout:

- Xác nhận HTTPS ra ngoài: `curl https://api.telegram.org/bot<TOKEN>/getMe`
- Proxy doanh nghiệp và VPN đôi khi chặn domain API Telegram. Thử mạng khác.
- WSL2: mạng ảo dùng NAT; HTTPS ra ngoài thường ổn nhưng tường lửa doanh nghiệp có thể lọc khác.

### Giới hạn tốc độ

Nếu bot bật/tắt nhiều lần liên tiếp, Telegram có thể rate-limit token. Đợi 1–2 phút trước khi thử lại.

---

## 3. Grammy treo khi khởi động

**Triệu chứng:** Log hiển thị `"Initializing bot (getMe via Grammy)…"` rồi timeout sau 15 giây hoặc treo vô hạn.

**Nguyên nhân:** Client HTTP nội bộ của Grammy có thể kẹt trên một số hệ thống (quan sát trên macOS). Bản build mặc định của CursorRemote bọc `fetch` của Grammy với timeout 30 giây, nên cuối cùng vẫn timeout thay vì treo mãi. Nếu vẫn timeout liên tục:

### Chuyển sang transport Raw

**Raw** bỏ qua Grammy, gọi Telegram Bot API bằng `fetch` có sẵn của Node.js. Chức năng tương đương nhưng tránh stack HTTP của Grammy.

**Cách A — Setup Panel:**

1. Mở Setup Panel CursorRemote (`Cmd/Ctrl+Shift+P` → "CursorRemote: Open Setup").
2. Vào tab **Telegram**.
3. Cuộn xuống **Transport Engine**.
4. Chọn **Raw (lightweight fallback)** và bấm **Save & Restart**.

**Cách B — VS Code Settings:**

1. Mở Settings (`Cmd/Ctrl+,`).
2. Tìm `cursorRemote.telegram.impl`.
3. Đổi giá trị thành `raw`.
4. Khởi động lại server (CursorRemote: Restart Server).

**Cách C — Biến môi trường:**

Thêm vào `.env`:

```
TELEGRAM_IMPL=raw
```

Sau khi chuyển, log nên có:

```
[telegram] Using raw Bot API transport (no Grammy)
[telegram-raw] Bot: @yourbot (id 123456789)
[telegram-raw] Bot connected (sync: on)
```

---

## 4. Bot kết nối nhưng không phản hồi lệnh

- Đảm bảo đã **đăng ký**. Gửi `/register <token>` trong nhóm Telegram trước.
- Bot bỏ qua tin nhắn từ người chưa đăng ký (không lỗi, không trả lời — cố ý vì bảo mật).
- Bot phải là **quản trị viên** nhóm với quyền **Manage Topics**.
- Supergroup bật Topics: bot cần quyền admin để đăng trong chủ đề.

---

## 5. Không tạo chủ đề sau `/sync`

- Nhóm phải **bật Topics** (Cài đặt nhóm → Topics).
- Bot phải là **admin** với quyền **Manage Topics**.
- Sau `/sync`, đợi vài giây. Tạo chủ đề có độ trễ để tránh rate limit.
- Nếu vẫn không có chủ đề, thử `/purge` để xóa trạng thái cũ, rồi `/sync` lại.

---

## 6. Vẫn kẹt?

1. Đặt `TELEGRAM_IMPL=raw` để loại trừ lỗi Grammy.
2. Xem toàn bộ output server có dòng `[ERROR]` không.
3. Thử token bot mới từ BotFather.
4. Mở issue tại [github.com/len5ky/CursorRemote](https://github.com/len5ky/CursorRemote/issues) kèm log liên quan.
