# CursorRemote — PRD Extension

## 1. Tổng quan

Đóng gói relay server CursorRemote thành extension VS Code / Cursor. Extension bọc server như tiến trình con được quản lý và tích hợp editor: UI cài đặt, trình hướng dẫn setup, thanh trạng thái, output channel, tree view thanh bên, quản lý license và phối hợp nhiều cửa sổ. Mã server, web client và transport Telegram được bundle vào extension và chạy một tiến trình con duy nhất. **Web client** bundle render **`codeBlocks`** của assistant và **`diffBlock`** của tool thành UI mã/diff gốc (~7 dòng viewport cuộn, đọc toàn màn hình, điểm chạm mobile; xem `docs/prd.md` §6.11 và `docs/architecture.md` §2.6).

### 1.1 Vấn đề

Server độc lập cần cài thủ công: clone repo, cài dependency, tạo `.env`, chạy `npm run dev`. Người dùng tự quản lý vòng đời tiến trình. Không có visibility trong editor về trạng thái server, sức khỏe CDP hay hoạt động agent. Nhiều cửa sổ dễ xung đột cổng và trùng instance bot.

### 1.2 Mục tiêu

Phát hành extension VS Code / Cursor:

- Cài từ file `.vsix` (dự kiến lên marketplace)
- Quản lý vòng đời relay (start/stop/restart) tự động
- Toàn bộ cấu hình qua VS Code Settings (không cần `.env`)
- Setup Panel tương tác cho mạng, mật khẩu và Telegram
- Hiển thị trạng thái server và kết nối CDP trên status bar và thanh bên
- Đưa log server vào LogOutputChannel có lọc mức
- Hiển thị trạng thái agent, cửa sổ và thao tác nhanh trong tree view với nút Start/Stop
- Nhập license không làm gián đoạn qua thanh bên
- Tự sinh mật khẩu web client ngẫu nhiên mạnh lần đầu cài
- Một instance server cho mọi cửa sổ Cursor (singleton)
- Bundle mọi dependency server vào một file (không cần `node_modules` trong gói)
- Tương thích 100% với dùng độc lập `npm run dev`

### 1.3 Không nằm trong phạm vi

- Viết lại server chạy trực tiếp trong Extension Host
- Thay trích DOM bằng CDP bằng API extension VS Code
- Tự động phát hiện hoặc cấu hình cổng debug CDP

---

## 2. User story

### US-1: Cài và chạy
**Là** người dùng Cursor, **tôi muốn** cài extension từ `.vsix`, nhập license và có server chạy, **để** không cần clone repo, cài dependency hay sửa file cấu hình.

### US-2: Tự khởi động
**Là** developer, **tôi muốn** relay tự khởi động khi mở Cursor, **để** client điện thoại và bot Telegram luôn sẵn sàng.

### US-3: UI Settings
**Là** developer, **tôi muốn** cấu hình CDP URL, cổng server, Telegram trong VS Code Settings kèm link tài liệu, **để** không cần sửa `.env`.

### US-4: Trình hướng dẫn
**Là** người mới, **tôi muốn** Setup Panel tương tác dẫn qua mạng, mật khẩu và Telegram, **để** bắt đầu không cần đọc hết tài liệu.

### US-5: Hiển thị trạng thái
**Là** developer, **tôi muốn** thấy trạng thái server, CDP, hoạt động agent và client đã kết nối trên thanh bên và status bar, **để** biết hệ thống hoạt động một cái nhìn.

### US-6: Điều khiển server
**Là** developer, **tôi muốn** nút Start/Stop trên thanh bên, **để** điều khiển server không mở Command Palette.

### US-7: Quản lý license
**Là** người dùng, **tôi muốn** nhắc license không chen ngang — hiển thị trên thanh bên kèm link "Mua", **để** không bị popup mỗi lần khởi động.

### US-8: Mật khẩu tự sinh
**Là** người mới, **tôi muốn** mật khẩu mạnh tự tạo lần đầu, **để** web client an toàn mặc định không cấu hình thủ công.

### US-9: An toàn đa cửa sổ
**Là** developer mở nhiều cửa sổ Cursor, **tôi muốn** chỉ một server chạy với phục hồi tự động, **để** không xung đột cổng hay trùng bot Telegram.

### US-10: Log server
**Là** developer, **tôi muốn** xem log server trong Output với lọc mức, **để** debug không cần chuyển terminal.

---

## 3. Kiến trúc

Extension chạy trong VS Code Extension Host (Node.js). Spawn server là tiến trình con, giao tiếp qua:

1. **Biến môi trường** — cấu hình và license truyền lúc spawn
2. **HTTP poll** — `GET /health` mỗi 5 giây lấy dữ liệu trạng thái
3. **Parse stdout/stderr** — dòng log đưa vào LogOutputChannel

Server và mọi dependency Node được bundle một file ESM `dist/server/bundle.mjs` qua esbuild. Extension bundle thành `dist/extension.cjs` (CJS, external: `vscode`).

### 3.1 Mẫu singleton server

Chỉ một tiến trình server cho mọi cửa sổ Cursor:

1. Khi khởi động, `ServerManager` thử `GET /health` trên cổng đã cấu hình
2. Nếu server đã chạy, cửa sổ gắn vai trò **observer** (poll health, hiển thị trạng thái, không sở hữu tiến trình)
3. Nếu chưa chạy, cửa sổ spawn server và là **owner**
4. Nếu cửa sổ owner đóng, observer phát hiện 3 lần health thất bại, rồi một observer nhận quyền sau jitter ngẫu nhiên 0–3s tránh race
5. Race khi spawn đồng thời: bắt `EADDRINUSE` từ stderr và chuyển sang chế độ observer

---

## 4. Lệnh extension

| Command ID | Tiêu đề | Mô tả |
|---|---|---|
| `cursorRemote.start` | CursorRemote: Start Server | Khởi động relay server |
| `cursorRemote.stop` | CursorRemote: Stop Server | Dừng relay server |
| `cursorRemote.restart` | CursorRemote: Restart Server | Khởi động lại relay server |
| `cursorRemote.openWebClient` | CursorRemote: Open Web Client | Mở URL browser client |
| `cursorRemote.openSetup` | CursorRemote: Open Setup Panel | Mở trình hướng dẫn mạng và Telegram |
| `cursorRemote.showLogs` | CursorRemote: Show Logs | Mở Output Channel |
| `cursorRemote.enterLicenseKey` | CursorRemote: Enter License Key | Nhập license |
| `cursorRemote.buyLicense` | CursorRemote: Buy License | Mở URL cửa hàng (kèm UTM) |

---

## 5. Cài đặt extension

Mọi mục dưới namespace `cursorRemote`. Mỗi mục ánh xạ 1:1 tới biến env server. Dùng `markdownDescription` kèm link GitHub.

| Cài đặt | Kiểu | Mặc định | Env | Mô tả |
|---|---|---|---|---|
| `cursorRemote.autoStart` | boolean | `true` | — | Tự khởi động server khi mở |
| `cursorRemote.cdpUrl` | string | `http://127.0.0.1:9222` | `CDP_URL` | Endpoint CDP Cursor |
| `cursorRemote.serverPort` | number | `3000` | `SERVER_PORT` | Cổng web server |
| `cursorRemote.serverHost` | string | `127.0.0.1` | `SERVER_HOST` | Địa chỉ bind (mặc định chỉ localhost) |
| `cursorRemote.pollIntervalMs` | number | `500` | `POLL_INTERVAL_MS` | Tần suất poll DOM |
| `cursorRemote.debounceMs` | number | `300` | `DEBOUNCE_MS` | Debounce phát sóng |
| `cursorRemote.logLevel` | enum | `info` | `LOG_LEVEL` | Mức log |
| `cursorRemote.webappPassword` | string | *(tự sinh)* | `WEBAPP_PASSWORD` | Mật khẩu web client |
| `cursorRemote.windowTitleQualifier` | boolean | `true` | `WINDOW_TITLE_QUALIFIER` | Hiển thị hậu tố remote trong tiêu đề |
| `cursorRemote.telegram.enabled` | boolean | `false` | `TELEGRAM_ENABLED` | Bật Telegram |
| `cursorRemote.telegram.botToken` | string | `""` | `TELEGRAM_BOT_TOKEN` | Bot token |
| `cursorRemote.telegram.allowedUsers` | string | `""` | `TELEGRAM_ALLOWED_USERS` | ID cách nhau bởi dấu phẩy |

### 5.1 Mặc định bảo mật

- `serverHost` mặc định `127.0.0.1` (không phải `0.0.0.0`) để server không lộ mạng cho đến khi người dùng chủ động qua Setup Panel
- `webappPassword` tự sinh lần đầu kích hoạt bằng `crypto.randomBytes(24)` và lưu trong VS Code Settings. Thông báo không chặn kèm "Copy to Clipboard"

---

## 6. Status bar

Mục status bar căn trái hiển thị trạng thái server:

| Trạng thái | Chữ | Màu | Điều kiện |
|---|---|---|---|
| Running | `$(radio-tower) Remote: Running` | Xanh | Server khỏe + CDP kết nối |
| Disconnected | `$(radio-tower) Remote: Disconnected` | Vàng | Server chạy, CDP chưa kết nối |
| Stopped | `$(radio-tower) Remote: Stopped` | Mặc định | Server không chạy |
| Error | `$(radio-tower) Remote: Error` | Đỏ | Server crash hoặc không tới được |

Click mở panel thanh bên CursorRemote (không mở command palette).

---

## 7. Tree view thanh bên

View container activity bar `cursorRemote` với `TreeDataProvider`:

### Chưa có license:
- **License Key Required** (click để kích hoạt) — icon key màu lỗi
- **Buy License** — link cửa hàng kèm UTM
- **Open Setup Panel** — icon bánh răng

### Đã license, server chạy:
- **Server: Running** — icon check xanh, uptime trong mô tả, tag "observer" cho cửa sổ không phải owner
- **Stop Server** — nút dừng
- **CDP: Connected** — icon phích cắm, tên workspace đang hoạt động
- **Agent** — trạng thái (idle/running_tool/v.v.), mode/model
- **Clients** — số phiên trình duyệt
- **Pending Approvals** — badge (ẩn khi 0)
- **Windows** — số cửa sổ Cursor đã phát hiện kèm tên
- *(separator)*
- **Open Setup Panel**, **Open Web Client**, **Show Logs**

### Đã license, server dừng:
- **Server: Stopped** — "click to start"
- **Start Server** — nút play
- *(separator)*
- **Open Setup Panel**, **Open Web Client**, **Show Logs**

Làm mới theo sự kiện poll health và thay đổi trạng thái server.

---

## 8. Setup Panel (WebviewPanel)

Trình hướng dẫn cấu hình mở bằng `cursorRemote.openSetup`. Tạo ở `ViewColumn.One` với `retainContextWhenHidden: true`.

### Tab Mạng
- **Nhóm radio**: Localhost / LAN / Địa chỉ cụ thể (Tailscale/tùy chỉnh)
- Ô nhập địa chỉ tùy (khi chọn "Địa chỉ cụ thể")
- Nút **Save & Restart** — cập nhật cài đặt và khởi động lại server
- Link tài liệu Tailscale

### Phần mật khẩu
- Ô chỉnh sửa mật khẩu hiện tại
- Nút **Copy** và **Save**
- Hiển thị URL server để tham chiếu

### Tab Telegram
- **Bước 1: Tạo Bot** — link @BotFather, ô token (hoặc hiển thị che nếu đã đặt)
- **Bước 2: Tạo Supergroup** — hướng dẫn Topics và admin
- **Bước 3: Đăng ký** — hiển thị lệnh `/register <token>` thực tế từ `telegram-auth.json`, có thể copy. Hiển thị người dùng đã đăng ký và username.
- **Bước 4: Đồng bộ** — hướng dẫn gửi `/sync`

### Chân trang
- Nút **Open All Settings** — dispose webview trước, rồi mở VS Code Settings lọc `@ext:cursor-remote.cursor-remote` trên tick trễ (tránh treo renderer Cursor do xung đột webview giữ + editor settings)

---

## 9. Luồng license

1. Khi kích hoạt, extension đọc key từ `context.secrets`
2. Hợp lệ: khởi động server (nếu `autoStart` bật)
3. Thiếu/sai: thanh bên hiển thị "License Key Required" (không popup)
4. Người dùng click nhập qua `showInputBox` có kiểm định dạng
5. Key hợp lệ lưu `context.secrets.store('cursorRemote.licenseKey', key)`
6. Key truyền cho tiến trình con qua env `LICENSE_KEY`
7. Server `checkLicense()` xác thực độc lập (defense-in-depth)
8. "Buy License" mở URL cửa hàng kèm UTM (`?utm_source=extension&utm_medium=sidebar&utm_campaign=license`)

---

## 10. Walkthrough Getting Started

`contributes.walkthroughs` cung cấp onboarding từng bước:

1. **Nhập License Key** — link lệnh và mua (UTM)
2. **Xác minh kết nối CDP** — hướng dẫn `--remote-debugging-port=9222`, lệnh start server
3. **Cấu hình mạng** — lệnh mở Setup Panel
4. **Cài Telegram** — tùy chọn, lệnh mở Setup Panel
5. **Hoàn tất** — tóm tắt kèm link tài liệu

---

## 11. Cải tiến phía server

Thay đổi tương thích ngược để hỗ trợ extension:

### 11.1 `/health` phong phú hơn
Trả `windows`, `activeWindowId`, `mode`, `model`, `chatTabCount`, `pendingApprovalCount`, `generation`, `uptime`, `authRequired`. Client cũ bỏ qua trường không biết.

### 11.2 Biến `LICENSE_KEY`
Đọc license từ `process.env.LICENSE_KEY` trước khi fallback `data/license.key`.

### 11.3 Biến `DATA_DIR`
Thư mục dữ liệu (mặc định `./data`). Extension đặt thành `context.globalStorageUri.fsPath`.

### 11.4 Biến `LOG_FORMAT`
Khi `json`, in dòng JSON có cấu trúc ra stdout.

### 11.5 Phục vụ tĩnh chống cache
`GET /` đọc động `index.html` và inject `?v=<random>` cho thẻ `app.js` và `styles.css`. File tĩnh `Cache-Control: no-cache, must-revalidate`.

### 11.6 Thứ tự middleware auth
`/health` và file tĩnh phục vụ trước middleware auth, tránh vòng redirect khi client kiểm tra đăng nhập.

### 11.7 grammY native fetch
Bot Telegram khởi tạo với `{ client: { fetch } }` dùng `fetch` native Node.js. Client HTTP mặc của grammY (node:https / node-fetch) hỏng trong bundle ESM esbuild.

### 11.8 Tắt Telegram êm
`bot.stop()` được await tối đa 3 giây khi shutdown server, đảm bảo session long-poll đóng sạch và instance tiếp theo kết nối ngay.

### 11.9 Chẩn đoán kết nối Telegram
Khi khởi động, server thử HTTPS ra `api.telegram.org/bot<token>/getMe` và `deleteWebhook`. Nếu không tới được, thử `google.com` để phân biệt chặn Telegram vs mạng chung.

---

## 12. Build và phân phối

### 12.1 Build extension
- esbuild bundle `extension/src/extension.ts` → `dist/extension.cjs`
- Định dạng CommonJS, platform Node, external: `['vscode']`

### 12.2 Build server
- esbuild bundle `src/server/index.ts` + mọi dependency Node → `dist/server/bundle.mjs`
- Định dạng ESM, platform Node
- Banner inject shim CJS (`__dirname`, `__filename`, `createRequire`) cho package bundle (Express, v.v.)
- Không cần `node_modules` trong gói extension

### 12.3 Build client
- `tsc` biên dịch TypeScript
- `src/client/` copy sang `dist/client/`
- `socket.io.min.js` copy từ `node_modules` sang `dist/client/`

### 12.4 Đóng gói
- `npm run package` tăng patch version, rồi `vsce package --no-dependencies`
- Output: `releases/cursor-remote-X.Y.Z.vsix`
- `.vscodeignore` chỉ gồm: `dist/extension.cjs`, `dist/server/bundle.mjs`, `dist/client/`, `extension/media/walkthrough/`, `selectors.json`, `package.json`, `README.md`, `CHANGELOG`, `LICENSE`

### 12.5 Tăng version
- `npm run package` tự tăng patch qua `scripts/bump-build.ts`
- `npm run release -- patch|minor|major` tăng semver, cập nhật changelog, tạo git tag

---

## 13. Tương thích ngược

Mọi cải tiến đều có biến env mặc định giữ hành vi cũ:

| Biến env | Mặc định (standalone) | Extension đặt |
|---|---|---|
| `LICENSE_KEY` | không đặt → đọc `data/license.key` | key từ Secrets API |
| `DATA_DIR` | không đặt → `./data` | `context.globalStorageUri.fsPath` |
| `LOG_FORMAT` | không đặt → plain text | `json` |

`npm run dev` và `npm start` độc lập hoạt động như trước. File `.env`, thư mục `data/` và CLI không đổi.
