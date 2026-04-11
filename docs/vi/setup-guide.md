# Hướng dẫn cài đặt — CursorRemote

## 1. Bật CDP trên Cursor IDE

Cursor phải khởi chạy với cổng remote debugging của Chrome DevTools Protocol. Bắt buộc cho cả extension và standalone.

### Windows: Shortcut (khuyến nghị)

1. Chuột phải shortcut Cursor trên desktop > Properties
2. Trong "Target", thêm ` --remote-debugging-port=9222`
3. OK

### macOS

```bash
open -a Cursor --args --remote-debugging-port=9222
```

Hoặc tạo alias trong profile shell:

```bash
alias cursor='open -a Cursor --args --remote-debugging-port=9222'
```

### Linux

```bash
cursor --remote-debugging-port=9222
```

### Quan trọng

**Thoát hoàn toàn và khởi động lại Cursor** sau khi thêm cờ. Trên macOS dùng Cmd+Q (không chỉ đóng cửa sổ) — Cursor vẫn chạy nền.

### Kiểm tra

Mở `http://localhost:9222/json` trên trình duyệt. Phải thấy mảng JSON. Nếu không, đảm bảo Cursor đã restart đầy đủ.

---

## 2A. Cài đặt Extension (khuyến nghị)

Extension CursorRemote cho trải nghiệm cài đặt đơn giản nhất: UI trạng thái, tự khởi động và trình hướng dẫn.

### Cài đặt

Tải `.vsix` mới nhất từ [releases](https://github.com/len5ky/CursorRemote/releases) và cài:

```bash
cursor --install-extension cursor-remote-0.1.45.vsix
```

Hoặc trong Cursor: Command Palette (`Ctrl+Shift+P`) > **Extensions: Install from VSIX...** > chọn file.

### License key

Mở panel **CursorRemote** trên activity bar (thanh bên trái). Bấm "License Key Required" để nhập key. Lưu an toàn trong kho credential OS.

Mua key tại [store](https://cursor-remote.com/buy?utm_source=github&utm_medium=setup_guide&utm_campaign=license).

### Vòng đời server

Server tự khởi động khi mở Cursor (nếu `cursorRemote.autoStart` là `true`). Panel thanh bên hiển thị trạng thái trực tiếp:

- **Server: Running / Stopped** — kèm nút Start và Stop
- **CDP: Connected** — kèm tên workspace đang hoạt động
- **Agent status** — mode và model hiện tại
- **Clients** — số phiên trình duyệt

Hoặc dùng lệnh Command Palette: **CursorRemote: Start Server**, **CursorRemote: Stop Server**.

### Mạng và mật khẩu

Chạy **CursorRemote: Open Setup Panel** để cấu hình:

1. **Địa chỉ bind server** — Localhost (127.0.0.1), LAN (0.0.0.0), hoặc IP cụ thể cho Tailscale
2. **Mật khẩu Web Client** — tự sinh lần đầu cài. Sao chép từ Setup Panel hoặc trong Settings (`cursorRemote.webappPassword`). Có thể sửa trực tiếp.
3. Bấm **Save & Restart** để áp dụng.

Mở `http://<server-ip>:<port>` trên điện thoại, máy tính bảng hoặc máy khác.

### Web client — mã và diff

**Code** assistant và **diff** chỉnh sửa file không copy HTML Monaco của Cursor. Relay gửi **`codeBlocks`** / **`diffBlock`** có cấu trúc; UI hiển thị thẻ gọn (~**bảy dòng** cuộn trong thẻ, cuộn đà trên iOS). Bấm **mở rộng** để mở **toàn màn hình** (nút đóng lớn, bấm nền hoặc Escape để đóng). Giúp patch dài vẫn đọc được trên màn nhỏ mà không chiếm hết khung chat.

### Web client — widget plan và trạng thái kết nối

Widget plan trên web phản ánh luồng điều khiển từ xa sát hơn:

- **View Plan** mở modal web và tải file kế hoạch đầy đủ khi có, không chỉ tóm tắt widget.
- **Plan model** mở picker với tùy chọn model thật lấy từ Cursor, rồi áp dụng lựa chọn về Cursor.
- **Build** vẫn kích hoạt hành động Cursor trực tiếp.

Nhãn kết nối cụ thể hơn. Nếu điện thoại vẫn kết nối relay nhưng trích xuất Cursor/CDP bị kẹt, UI hiển thị trạng thái chờ/extractor thay vì chỉ "mất kết nối trình duyệt". Hữu ích trên macOS khi cửa sổ Cursor nền bị giới hạn đánh giá CDP.

### Telegram (Extension)

Chuyển sang tab **Telegram** trong Setup Panel để có trình hướng dẫn:

1. **Tạo bot** — dán token từ @BotFather
2. **Tạo supergroup** — bật Topics, thêm bot làm admin
3. **Đăng ký** — panel hiển thị lệnh `/register <token>` thực tế để copy
4. **Đồng bộ** — gửi `/sync` trong nhóm

Panel cũng hiển thị người dùng đã đăng ký và username.

### Hành vi đa cửa sổ

Chỉ một instance server cho mọi cửa sổ Cursor:

- Cửa sổ khởi động trước là **owner** và spawn tiến trình server.
- Cửa sổ khác phát hiện server qua poll health và gắn vai trò **observer**.
- Nếu cửa sổ owner đóng, observer tự nhận quyền và spawn server mới.
- Thanh bên hiển thị "observer" cạnh trạng thái server khi cửa sổ không phải owner.

---

## 2B. Cài đặt Standalone (không Extension)

Chạy relay server trực tiếp từ dòng lệnh. Hữu ích cho máy headless, server từ xa hoặc cấu hình thủ công qua `.env`.

### Cài đặt

```bash
git clone https://github.com/len5ky/CursorRemote.git cursor-ide-remote
cd cursor-ide-remote
npm install
cp .env.example .env
```

Sửa `.env` — mặc định đủ cho web client. Telegram: đặt `TELEGRAM_ENABLED=true` và `TELEGRAM_BOT_TOKEN` (xem mục 5).

### Khởi động server

```bash
npm run dev
```

**License (chỉ lần đầu):** Sẽ nhắc nhập license. Mua tại [store](https://cursor-remote.com/buy?utm_source=github&utm_medium=setup_guide&utm_campaign=license). Key lưu vào `data/license.key`, lần sau không hỏi. Production (`npm start`): đảm bảo file key tồn tại trước khi chạy.

```
[main] CDP URL: http://127.0.0.1:9222
[main] Server: http://127.0.0.1:3000
[telegram] Bot connected (sync: off, users: 0)
[telegram] To register, send: /register A1B2C3D4
```

---

## 3. Truy cập mạng

> **Người dùng extension:** Setup Panel xử lý mạng vài bước. Hướng dẫn thủ công dưới đây chủ yếu cho standalone hoặc cấu hình đặc biệt WSL2.

### Mặc định: chỉ Localhost

Mặc định server bind `127.0.0.1`, chỉ truy cập từ trình duyệt trên cùng máy.

### Truy cập LAN

Đặt địa chỉ bind thành `0.0.0.0`:

- **Extension:** Setup Panel > Mạng > chọn "LAN access (all interfaces)" > Save & Restart
- **Standalone:** `SERVER_HOST=0.0.0.0` trong `.env`

Rồi mở `http://<your-ip>:<port>` trên điện thoại. Cần mật khẩu.

### Riêng WSL2

Chạy trên WSL2 thì server tách biệt LAN. Cần một trong các cách:

#### Phương án A: Mirrored Networking (khuyến nghị)

Thêm vào `%UserProfile%\.wslconfig` trên Windows:

```ini
[wsl2]
networkingMode=mirrored
```

Khởi động lại WSL2: `wsl --shutdown`

#### Phương án B: Chuyển tiếp cổng

```powershell
# Tìm IP WSL2
wsl hostname -I
# Chuyển tiếp cổng (PowerShell Admin)
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=<WSL2-IP>
```

#### Windows Firewall

```powershell
New-NetFirewallRule -DisplayName "CursorRemote" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Truy cập từ xa an toàn

**Tailscale (khuyến nghị)** — qua VPN riêng, không cần chuyển tiếp cổng. Xem [Cài đặt Tailscale](tailscale-setup.md).

**Bảo vệ mật khẩu** — đặt mật khẩu trong Setup Panel (extension) hoặc `WEBAPP_PASSWORD` trong `.env` (standalone). Đăng nhập giới hạn 10 lần/phút/IP.

Có thể kết hợp cả hai. Chi tiết: [Cài đặt Tailscale](tailscale-setup.md).

---

## 4. Tích hợp Telegram (tùy chọn)

> **Người dùng extension:** Tab Telegram trong Setup Panel có trình hướng dẫn. Dưới đây là quy trình thủ công.

### 4.1 Tạo bot

1. Nhắn `@BotFather` trên Telegram > `/newbot` > làm theo
2. Sao chép **bot token**
3. **Tắt privacy**: `@BotFather` > `/mybots` > Bot Settings > Group Privacy > **Turn OFF**

### 4.2 Cấu hình

**Extension:** Setup Panel > tab Telegram > dán token > Save Token. Extension tự bật Telegram.

**Standalone:** Sửa `.env`:

```bash
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=7123456789:AAHxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 4.3 Khởi động server

Server in token đăng ký khi khởi động:

- **Extension:** Output panel (kênh CursorRemote) hoặc tab Telegram Setup Panel
- **Standalone:** Terminal

```
[telegram] To register, send in your Telegram group: /register A1B2C3D4
```

### 4.4 Thiết lập nhóm

1. Tạo nhóm Telegram
2. Thêm bot vào nhóm
3. **Bật Topics:** Cài đặt nhóm > Topics > Enable
4. **Bot làm admin:** Cài đặt nhóm > Administrators > Thêm bot đủ quyền (đặc biệt Manage Topics, Delete Messages, Pin Messages)

### 4.5 Đăng ký và đồng bộ

Trong nhóm Telegram:

1. `/register A1B2C3D4` — đăng ký bằng token từ output server
2. `/sync` — bật tự động đồng bộ cho nhóm này

Bot kiểm tra quyền và tạo chủ đề cho mọi cửa sổ hiện có. Từ đó tab chat mới tự có chủ đề.

### 4.6 Lệnh bot

| Lệnh | Mô tả |
|---------|-------------|
| `/register <token>` | Đăng ký bằng token trong output server |
| `/sync` | Bật tự động đồng bộ (tab đang hoạt động + 5 tin cuối) |
| `/sync_all` | Tạo chủ đề cho MỌI tab mọi cửa sổ |
| `/unsync` | Tắt đồng bộ, xóa chủ đề theo dõi, xóa state |
| `/cleanup` | Xóa chủ đề cũ/không theo dõi, giữ chủ đề đang sync |
| `/purge` | Xóa TẤT CẢ chủ đề (chạy nền) |
| `/status` | Trạng thái sync, group ID, kết nối, agent, mode, model |
| `/history [N]` | N tin cuối (mặc định 30). `/history 100` để lấy nhiều hơn |
| `/mode` | Xem/đổi mode (Agent/Plan/Ask/Debug) |
| `/model` | Xem model hiện tại |
| `/plan <text>` | Chuyển Plan mode và gửi text làm prompt |
| `/agent <text>` | Chuyển Agent mode và gửi text làm prompt |

**Văn bản thường** trong chủ đề được chuyển tới agent Cursor ánh xạ chủ đề đó.

### 4.7 Cách hoạt động

- **Window Monitor** poll mọi cửa sổ Cursor mỗi 10s bằng **kết nối CDP song song** (không chuyển UI)
- Tin nhắn mới/thay đổi format HTML Telegram và gửi vào chủ đề khớp
- Nếu HTML lỗi (thẻ không hỗ trợ), thử lại dạng plain text
- **Hàng đợi gửi** giới hạn tốc độ tránh 429 (~300ms giữa các lần gửi, 100ms giữa các lần sửa; xem `send-queue.ts` / cấu hình transport)
- **File dữ liệu** trong `data/` (đều gitignore):
  - `license.key` — license (bắt buộc lần đầu)
  - `telegram-auth.json` — token đăng ký + user đã đăng ký kèm username
  - `telegram-sync.json` — trạng thái sync và group ID
  - `telegram-topics.json` — ánh xạ chủ đề và mốc cao cho purge
  - `telegram-messages.json` — ID tin nhắn theo dõi

### 4.8 Xác thực

**Phương án A: Theo token (mặc định)**  
Chia sẻ token đăng ký (trong output server) với cộng tác viên. Mỗi người chạy `/register <token>` một lần. Username và ID lưu vào `data/telegram-auth.json`.

**Phương án B: Cố định (ghi đè)**  
`TELEGRAM_ALLOWED_USERS=123456789,987654321` trong `.env` (standalone) hoặc `cursorRemote.telegram.allowedUsers` trong Settings (extension). Khi đặt, **ghi đè** auth token — chỉ các ID này dùng được bot. Xóa cài đặt để quay lại auth token.

---

## 5. Production (Standalone)

### Phương án A: tmux

```bash
tmux new -s cursor-remote
npm run dev
# Ctrl+B D để detach
```

### Phương án B: Biên dịch

```bash
npm run build
npm start
```

Đảm bảo `data/license.key` tồn tại trước `npm start` (không nhắc tương tác trong production).

---

## 6. Xử lý sự cố

### Chung

#### "No valid license key" hoặc server thoát ngay
- **Extension:** Mở panel CursorRemote và bấm "License Key Required"
- **Standalone:** Chạy `npm run dev` (không phải `npm start`) để có nhắc tương tác
- Mua key hợp lệ tại [store](https://cursor-remote.com/buy?utm_source=github&utm_medium=setup_guide&utm_campaign=license)

#### "Disconnected" trên web UI
- Kiểm tra `http://<server>:<port>/health` từ điện thoại/máy tính bảng
- `connected: false` — relay chưa gắn Cursor/CDP
- `connected: true` + `extractorStatus: "waiting"` — đã gắn nhưng chờ snapshot DOM đầu tiên
- `connected: true` + `extractorStatus: "stale"` — CDP còn nhưng trích DOM lỗi hoặc bị giới hạn nền
- `lastExtractionError` — lý do lỗi trích xuất gần nhất

#### macOS: Cursor nền và điện thoại không cập nhật
- Electron/Chromium có thể giới hạn cửa sổ Cursor nền đủ để `Runtime.evaluate` timeout
- Nếu `/health` có `connected: true` và `extractorStatus: "stale"`, đưa Cursor lên foreground và đợi snapshot thành công
- Relay lùi lại khi timeout trích lặp thay vì spam CDP

#### Điện thoại/máy tính bảng không kết nối
- `curl http://<ip>:<port>/health` từ thiết bị khác
- Kiểm tra firewall, chuyển tiếp cổng, mạng WSL2
- Xác nhận server bind `0.0.0.0` hoặc IP cụ thể (không chỉ `127.0.0.1`)

#### Trình duyệt mobile cũ trắng hoặc UI hỏng
- Bản gần đây không còn bắt buộc `crypto.randomUUID()` trên trình duyệt
- Nếu vẫn lỗi, mở console và kiểm tra API Web khác không được hỗ trợ
- Nâng CursorRemote lên bản mới trước khi thử iOS/Android cũ

### Riêng Extension

#### Thanh bên hiển thị "Disconnected"
- Mở Output (**CursorRemote: Show Logs**) xem lỗi
- Thử Stop > Start trên thanh bên
- Xác minh CDP: `http://localhost:9222/json` trả JSON

#### Nhiều cửa sổ Cursor
- Chỉ một server. Cửa sổ đầu là owner; còn lại là observer.
- Thanh bên hiển thị "observer" cho cửa sổ không owner.
- Owner đóng thì observer tự phục hồi trong ~15 giây.

#### Bot Telegram không phản hồi
- Xem Output có thông báo kết nối
- Server thử HTTPS ra ngoài khi khởi động và báo nếu API Telegram hoặc toàn bộ HTTPS không tới được
- Không có instance bot khác cùng token
- Token đăng ký hiển thị trong Output và tab Telegram Setup Panel

### Riêng Standalone

#### Bot không phản hồi
- `TELEGRAM_ENABLED=true` trong `.env`?
- Bot là admin có Manage Topics?
- Privacy mode OFF? (`@BotFather` > Bot Settings > Group Privacy)
- Đã `/register` đúng token?
- Xem `temp/server.log`

#### /sync báo "not a supergroup" hoặc "not a forum"
- Bật Topics trong Cài đặt nhóm trước (tự nâng supergroup)
- Bot tự phát hiện group ID đúng từ `/sync`

#### /sync báo "missing permissions"
- Cài đặt nhóm > Administrators > Bot > bật mọi quyền liệt kê
- Cần: Manage Topics, Delete Messages, Pin Messages

#### Build không chạy trên macOS
- `npm run build` biên dịch TS và copy `src/client/` sang `dist/client/`
- `npm start` tự tạo thư mục `temp/`

#### Log server
Toàn bộ output có timestamp: `temp/server.log`
