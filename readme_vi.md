# CursorRemote

Điều khiển từ xa agent AI Cursor trên máy bạn — theo dõi phiên, phê duyệt từng bước, xem toàn bộ kế hoạch và gửi tác vụ từ điện thoại, máy tính bảng hoặc trình duyệt máy khác, hoặc qua Telegram, trong khi Cursor chạy trên máy của bạn.

<div align="center">

| Ứng dụng web trên mobile | Telegram |
|:-:|:-:|
| <img src="media/web-app.gif" alt="Ứng dụng web mobile" width="300"> | <img src="media/telegram.gif" alt="Tích hợp Telegram" width="300"> |

<p><b>Giao diện Extension</b> — Thanh bên CursorRemote: trạng thái server, kết nối CDP, trạng thái agent và nút bật/tắt</p>
<img src="media/extension_tab.png" alt="Thanh bên extension CursorRemote với điều khiển và trạng thái server" width="380">

</div>

## Tính năng

- **Web client trên mobile** — khung chat theo thời gian thực với giao diện tối của Cursor, nút phê duyệt/từ chối, modal kế hoạch đầy đủ, chọn model cho plan, thẻ lệnh chạy, chuyển mode/model
- **Tích hợp Telegram** — đồng bộ hội thoại vào chủ đề diễn đàn, phê duyệt qua nút inline, gửi prompt từ mọi thiết bị
- **Theo dõi nhiều cửa sổ** — tất cả cửa sổ Cursor được poll song song qua các kết nối CDP riêng (không cần chuyển UI)
- **Tự tạo chủ đề** — tab chat mới tự động có chủ đề Telegram tương ứng
- **Extension VS Code** — thanh bên tích hợp với trạng thái server, điều khiển bật/tắt, trình hướng dẫn cài đặt và cài đặt
- **Trạng thái bền** — tin nhắn, chủ đề, đồng bộ và xác thực vẫn giữ sau khi khởi động lại server

## Cách hoạt động

```
┌─────────────────────────────────────────────────────────────────┐
│  Extension Cursor (tùy chọn)                                    │
│  Khởi chạy server, cung cấp UI, quản lý vòng đời               │
│                                                                 │
│  Cursor IDE  ──CDP──>  Relay Server  ──socket.io──>  Browser   │
│  (Windows/Mac)          (Node.js)     ──Bot API───>  Telegram  │
└─────────────────────────────────────────────────────────────────┘
```

1. **Cursor IDE** chạy với Chrome DevTools Protocol bật (`--remote-debugging-port=9222`)
2. **Relay Server** kết nối qua CDP, lấy trạng thái chat agent từ DOM
3. **Window Monitor** poll tất cả cửa sổ song song bằng các kết nối CDP riêng
4. **Browser Client** hiển thị hội thoại theo thời gian thực trên mọi thiết bị
5. **Telegram Bot** (tùy chọn) phản chiếu dữ liệu vào chủ đề diễn đàn được tạo tự động

## Nên dùng cách cài nào?

| | Extension (khuyến nghị) | Độc lập (standalone) |
|---|---|---|
| **Phù hợp nhất** | Dùng hằng ngày trên máy dev | Máy headless, CI hoặc cấu hình thủ công |
| **Cài đặt** | Một file `.vsix` | Clone repo + `npm install` |
| **Cấu hình** | VS Code Settings + bảng Setup | File `.env` |
| **Vòng đời server** | Tự khởi động, Bật/Tắt trên thanh bên | Thủ công `npm run dev` hoặc `npm start` |
| **Giao diện trạng thái** | Thanh bên với trạng thái trực tiếp | Log terminal + endpoint `/health` |
| **Mật khẩu** | Tự sinh lần đầu cài | Thủ công trong `.env` |
| **Nhiều cửa sổ** | Singleton — một server cho mọi cửa sổ | Một tiến trình |

---

## Cài đặt A: Extension (khuyến nghị)

### 1. Cài Extension

Tải file `.vsix` mới nhất từ [releases](https://github.com/len5ky/CursorRemote/releases), rồi cài:

```bash
# Từ dòng lệnh
cursor --install-extension cursor-remote-0.1.45.vsix
```

Hoặc trong Cursor: mở Command Palette (`Ctrl+Shift+P`), chạy **Extensions: Install from VSIX...** và chọn file.

### 2. Nhập license key

Mở panel **CursorRemote** trên thanh hoạt động (sidebar trái). Bạn sẽ thấy nhắc "License Key Required" — bấm vào để nhập key. Key được lưu an toàn trong kho credential của OS qua Secrets API của VS Code.

Chưa có key? Mua tại [store](https://cursor-remote.com/buy?utm_source=github&utm_medium=readme&utm_campaign=license).

### 3. Khởi chạy Cursor với CDP bật

Thêm `--remote-debugging-port=9222` vào shortcut Cursor, hoặc chạy:

```powershell
# Windows
& "$env:LOCALAPPDATA\Programs\cursor\Cursor.exe" --remote-debugging-port=9222
```

```bash
# macOS
open -a Cursor --args --remote-debugging-port=9222
```

```bash
# Linux
cursor --remote-debugging-port=9222
```

**Quan trọng:** Thoát hoàn toàn và khởi động lại Cursor sau khi thêm cờ. Trên macOS dùng Cmd+Q (không chỉ đóng cửa sổ). Kiểm tra: `http://localhost:9222/json` phải trả về JSON.

### 4. Server tự khởi động

Extension tự khởi động relay server khi Cursor mở. Xem panel **CursorRemote** trên thanh bên để biết trạng thái trực tiếp:

- **Trạng thái server** — Đang chạy / Đã dừng / Mất kết nối
- **Kết nối CDP** — Đã kết nối / Mất kết nối kèm tên workspace đang hoạt động
- **Trạng thái agent** — rảnh, đang chạy tool, v.v. kèm mode và model hiện tại
- **Client đã kết nối** — số phiên trình duyệt
- **Nút Bật / Tắt** — điều khiển server ngay trên thanh bên

Nếu không tự khởi động, bấm **Start Server** trên thanh bên hoặc chạy **CursorRemote: Start Server** từ Command Palette.

### 5. Cấu hình mạng và kết nối

Chạy **CursorRemote: Open Setup Panel** (hoặc bấm **Open Setup Panel** trên thanh bên) để cấu hình:

- **Mạng** — chọn Localhost (mặc định), LAN (mọi interface) hoặc một IP cụ thể (Tailscale)
- **Mật khẩu Web Client** — tự sinh lần đầu cài; sao chép hoặc đặt mật khẩu riêng
- **Telegram** — trình hướng dẫn từng bước: nhập bot token, hiển thị token đăng ký và trạng thái người dùng

Mở `http://<server-ip>:<port>` trên trình duyệt điện thoại, máy tính bảng hoặc máy khác và nhập mật khẩu.

> **Nhiều cửa sổ:** Chỉ một instance server chạy cho mọi cửa sổ Cursor. Cửa sổ khởi động trước là owner; cửa sổ khác gắn vai trò quan sát và tự phục hồi nếu owner đóng.

### Lệnh Extension

| Lệnh | Mô tả |
|---------|-------------|
| `CursorRemote: Start Server` | Khởi động relay server |
| `CursorRemote: Stop Server` | Dừng relay server |
| `CursorRemote: Restart Server` | Khởi động lại relay server |
| `CursorRemote: Open Web Client` | Mở URL web client |
| `CursorRemote: Open Setup Panel` | Mở trình hướng dẫn mạng và Telegram |
| `CursorRemote: Show Logs` | Hiển thị log server trong panel Output |
| `CursorRemote: Enter License Key` | Nhập và lưu license key |
| `CursorRemote: Buy License` | Mở URL cửa hàng |

### Cài đặt Extension

Mọi cài đặt nằm dưới `cursorRemote.*` trong VS Code Settings. Mỗi mục có mô tả kèm link hướng dẫn.

| Cài đặt | Mặc định | Mô tả |
|---------|---------|-------------|
| `autoStart` | `true` | Tự khởi động server khi mở |
| `cdpUrl` | `http://127.0.0.1:9222` | Endpoint CDP của Cursor |
| `serverPort` | `3000` | Cổng web server |
| `serverHost` | `127.0.0.1` | Địa chỉ bind (mặc định chỉ localhost) |
| `pollIntervalMs` | `500` | Tần suất poll DOM (ms) |
| `debounceMs` | `300` | Khoảng broadcast (ms) |
| `logLevel` | `info` | Mức log server |
| `webappPassword` | *(tự sinh)* | Mật khẩu cho web client |
| `windowTitleQualifier` | `true` | Thêm hậu tố remote vào tiêu đề |
| `telegram.enabled` | `false` | Bật bot Telegram |
| `telegram.botToken` | -- | Bot token từ @BotFather |
| `telegram.allowedUsers` | -- | ID người dùng được phép, cách nhau bởi dấu phẩy |

---

## Cài đặt B: Server độc lập (không dùng Extension)

Chạy relay server trực tiếp từ dòng lệnh — hữu ích cho máy headless, server từ xa hoặc khi bạn muốn quản lý cấu hình qua file `.env`.

### Yêu cầu

- Node.js 20+
- Cursor IDE với `--remote-debugging-port=9222`
- Trình duyệt trên cùng mạng (cho web client)

### Cài và chạy

```bash
git clone https://github.com/len5ky/CursorRemote.git cursor-ide-remote
cd cursor-ide-remote
npm install
cp .env.example .env
npm run dev
```

Lần chạy đầu, bạn sẽ được nhập **license key**. Mua tại [store](https://cursor-remote.com/buy?utm_source=github&utm_medium=readme_standalone&utm_campaign=license). Key được lưu vào `data/license.key`.

Chỉnh `.env` để cấu hình server. Với Telegram, đặt `TELEGRAM_ENABLED=true` và `TELEGRAM_BOT_TOKEN`.

### Cấu hình standalone

| Biến | Mặc định | Mô tả |
|----------|---------|-------------|
| `CDP_URL` | `http://127.0.0.1:9222` | Endpoint CDP của Cursor |
| `SERVER_PORT` | `3000` | Cổng web server |
| `SERVER_HOST` | `127.0.0.1` | Địa chỉ bind |
| `POLL_INTERVAL_MS` | `500` | Tần suất poll DOM (ms) |
| `DEBOUNCE_MS` | `300` | Khoảng broadcast (ms) |
| `LOG_LEVEL` | `info` | Mức log |
| `WEBAPP_PASSWORD` | -- | Mật khẩu cho giao diện web |
| `TELEGRAM_ENABLED` | `false` | Bật bot Telegram |
| `TELEGRAM_BOT_TOKEN` | -- | Bot token từ @BotFather |
| `TELEGRAM_ALLOWED_USERS` | -- | ID người dùng được phép, cách nhau bởi dấu phẩy |
| `LICENSE_KEY` | -- | License qua biến môi trường (ghi đè file) |
| `DATA_DIR` | `./data` | Thư mục dữ liệu cho trạng thái bền |
| `LOG_FORMAT` | `text` | Đặt `json` cho log có cấu trúc |

### Production

```bash
npm run build
npm start
```

Đảm bảo `data/license.key` tồn tại trước khi chạy `npm start` (không có nhắc tương tác trong chế độ production).

> **Người dùng WSL2**: xem [Hướng dẫn cài đặt](docs/vi/setup-guide.md) về chuyển tiếp cổng.

---

## Bảo mật

CursorRemote mặc định đã an toàn:

- **Chỉ localhost** — server bind `127.0.0.1` mặc định, không lộ ra mạng cho đến khi bạn chủ động cấu hình.
- **Mật khẩu tự sinh** (extension) — mật khẩu ngẫu nhiên mật mã được tạo lần đầu cài để bảo vệ web client.
- **Lưu key mã hóa** (extension) — license key và mật khẩu lưu trong kho credential OS qua Secrets API của VS Code.

### Truy cập từ thiết bị khác

**Phương án A: Tailscale (khuyến nghị)** — cài [Tailscale](https://tailscale.com/) trên máy tính và điện thoại. Server truy cập qua mạng WireGuard riêng, không cần mở cổng. Xem [hướng dẫn Tailscale](docs/vi/tailscale-setup.md).

**Phương án B: LAN** — mở **Setup Panel** (extension) hoặc đặt `SERVER_HOST=0.0.0.0` (standalone). Server bind mọi interface và yêu cầu mật khẩu.

Có thể kết hợp cả hai để tăng lớp phòng thủ.

## Quyền riêng tư

CursorRemote **100% tự host**. Không có phone-home, không telemetry, không analytics, không theo dõi sử dụng. Phần mềm không kết nối tới server của chúng tôi — không lúc khởi động, không khi dùng, không bao giờ. Xác thực license hoàn toàn offline với key cục bộ. Code, hội thoại và hoạt động agent đều ở trên máy và mạng của bạn. Chúng tôi không thấy bất kỳ dữ liệu nào trong đó.

## Cài đặt Telegram

Cách dễ nhất là qua **Setup Panel** — chạy **CursorRemote: Open Setup Panel** và chuyển sang tab Telegram để có trình hướng dẫn từng bước, hiển thị token đăng ký và người dùng đã đăng ký.

### Cài đặt thủ công

1. **Tạo bot**: Nhắn `@BotFather` > `/newbot` > sao chép token
2. **Cấu hình**: Đặt `cursorRemote.telegram.botToken` trong VS Code Settings (extension) hoặc `TELEGRAM_BOT_TOKEN` trong `.env` (standalone), và bật Telegram
3. **Tạo nhóm**: Tạo supergroup Telegram bật Topics, thêm bot làm admin với quyền Manage Topics
4. **Đăng ký**: Khởi động server, xem token đăng ký trong panel Output (extension) hoặc terminal (standalone), gửi `/register <token>` trong nhóm
5. **Đồng bộ**: Gửi `/sync` để bật tự động đồng bộ. Chủ đề được tạo cho mỗi cửa sổ + tab chat.

### Lệnh Bot

| Lệnh | Mô tả |
|---------|-------------|
| `/register <token>` | Đăng ký bản thân (token hiển thị trong output server) |
| `/sync` | Bật tự động đồng bộ (tab đang hoạt động có chủ đề + 5 tin nhắn gần nhất) |
| `/sync_all` | Tạo chủ đề cho MỌI tab trong mọi cửa sổ |
| `/unsync` | Tắt đồng bộ, xóa chủ đề đang theo dõi |
| `/cleanup` | Xóa chủ đề cũ/không theo dõi |
| `/purge` | Xóa TẤT CẢ chủ đề (mạnh, chạy nền) |
| `/status` | Kết nối, đồng bộ, group ID, thông tin agent |
| `/history [N]` | N tin nhắn gần nhất (mặc định 30), cuộn chat để tải thêm |
| `/mode` | Xem/đổi mode agent (chuyển sang cửa sổ của chủ đề) |
| `/model` | Xem model hiện tại |
| `/plan <text>` | Prompt ở chế độ Plan |
| `/agent <text>` | Prompt ở chế độ Agent |

Văn bản thường trong bất kỳ chủ đề nào được gửi như prompt tới agent Cursor tương ứng.

## Scripts

| Lệnh | Mô tả |
|---------|-------------|
| `npm run dev` | Phát triển với hot-reload (nhắc license nếu thiếu) |
| `npm run build` | Biên dịch TS + copy client |
| `npm run build:ext` | Đóng gói extension VS Code |
| `npm run watch:ext` | Chế độ watch khi phát triển extension |
| `npm run package` | Tăng patch version và đóng gói .vsix vào `releases/` |
| `npm run release -- patch\|minor\|major` | Tăng version, cập nhật changelog, tạo git tag |
| `npm start` | Chạy server đã biên dịch |
| `npm run discover` | Công cụ khám phá DOM |

## Tài liệu

*Bản tiếng Việt nằm trong [`docs/vi/`](docs/vi/README.md); bản tiếng Anh gốc trong [`docs/`](docs/).*

- [Hướng dẫn cài đặt](docs/vi/setup-guide.md) — cài đặt, mạng, Telegram, xử lý sự cố
- [Cài đặt Tailscale](docs/vi/tailscale-setup.md) — truy cập từ xa an toàn không lộ ra internet
- [Yêu cầu sản phẩm (PRD)](docs/vi/prd.md) — tính năng, mô hình trạng thái, giao thức
- [Kiến trúc](docs/vi/architecture.md) — thành phần, luồng dữ liệu, quyết định thiết kế
- [PRD Telegram](docs/vi/telegram_prd.md) — định dạng tin nhắn, lệnh
- [Kiến trúc Telegram](docs/vi/telegram_architecture.md) — nhiều cửa sổ, hàng đợi, vòng đời
- [PRD Extension](docs/vi/extension_prd.md) — tính năng extension VS Code, cài đặt, build
- [Ghi/phát CDP](docs/vi/cdp-record-replay.md) — công cụ debug Telegram
- [Xử lý sự cố Telegram](docs/vi/telegram-troubleshooting.md)
- [Checklist smoke trước release](docs/vi/smoke-checklist.md)
- [PRD ban đầu (MVP)](docs/vi/initial_prd.md) — tài liệu lịch sử
- [Phân tích định tuyến chủ đề](docs/vi/topic-routing-analysis.md)
