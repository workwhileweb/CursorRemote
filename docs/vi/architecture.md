# Kiến trúc — CursorRemote

## 1. Tổng quan mức cao

Hệ thống có ba tầng nối bởi hai cầu giao thức:

```
Cursor IDE  ←──CDP──→  Relay Server  ←──socket.io──→  Client điện thoại
(Windows)               (WSL2/Node)                   (Trình duyệt)
```

- **Cursor IDE** là ứng dụng Electron chuẩn khởi chạy với `--remote-debugging-port=9222`. Expose Chrome DevTools Protocol qua WebSocket. Không sửa Cursor theo bất kỳ cách nào.
- **Relay Server** là tiến trình Node.js/TypeScript chạy trên WSL2. Nối CDP một phía và socket.io phía kia.
- **Client điện thoại** là trang HTML/CSS/JS tĩnh do relay phục vụ. Chỉ giao tiếp qua sự kiện socket.io.

---

## 2. Kiến trúc thành phần

```
┌──────────────────────────────────────────────────────────┐
│                     Relay Server                         │
│                                                          │
│  ┌─────────────┐    ┌───────────────┐    ┌───────────┐  │
│  │  CDP Bridge  │───→│ DOM Extractor │───→│   State   │  │
│  │              │    │               │    │  Manager  │  │
│  │  CdpClient   │    │ callFunction  │    │           │  │
│  │  WebSocket   │    │ data-attr     │    │  diff     │  │
│  │  lifecycle   │    │ extraction    │    │  events   │  │
│  └──────┬───────┘    └───────────────┘    └─────┬─────┘  │
│         │                                       │        │
│         │            ┌───────────────┐          │        │
│         │            │   Command     │          │        │
│         └───────────→│   Executor    │          │        │
│                      │               │          │        │
│                      │  CDP Input    │          │        │
│                      │  evaluate     │          │        │
│                      │  approve/deny │          │        │
│                      └───────┬───────┘          │        │
│                              │                  │        │
│                      ┌───────▼──────────────────▼─────┐  │
│                      │         Relay                  │  │
│                      │  Express (tệp tĩnh)           │  │
│                      │  socket.io (state + lệnh)    │  │
│                      └────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.1 CDP Client (`cdp-client.ts`)

**Nhiệm vụ:** Client Chrome DevTools Protocol nhẹ dùng WebSocket thô.

**Vì sao không Puppeteer:** Electron/Cursor chặn `Target.getBrowserContexts` mà `puppeteer-core` cần khi kết nối. Client kết nối trực tiếp tới WebSocket URL của target trang.

**API:**
- `connect(wsUrl)` — kết nối WebSocket của target trang
- `evaluate(expression)` — `Runtime.evaluate` trả về theo giá trị
- `callFunction(fn, ...args)` — serialize hàm + tham số, evaluate trong ngữ cảnh trang. Tiêm shim `__name` vì tsx/esbuild bọc hàm có tên bằng gọi `__name()`
- `typeText(text)` — `Input.insertText` (pipeline nhập native Chromium)
- `pressKey(key, code, keyCode, modifiers)` — `Input.dispatchKeyEvent` (keyDown + keyUp)
- `click(selector)` — evaluate cuộn + click
- `exists(selector)` — kiểm tra phần tử có tồn tại

### 2.2 CDP Bridge (`cdp-bridge.ts`)

**Nhiệm vụ:** Khám phá cửa sổ Cursor, thiết lập và duy trì kết nối CDP, hỗ trợ chuyển cửa sổ.

**Đa cửa sổ:** Mọi cửa sổ Cursor dùng chung một cổng CDP (9222). Mỗi cửa sổ là target `page` riêng tại `/json`. Bridge khám phá mọi target workbench và expose dạng `CursorWindow[]`. Chỉ một cửa sổ kết nối tại một thời điểm; người dùng chuyển qua UI điện thoại.

**Trích tên workspace:** Sau khi kết nối target, bridge chạy `Runtime.evaluate` đọc `vscode.context.configuration().workspace.uri` — API nội bộ ổn định trong mọi renderer Cursor/VS Code Electron. Basename `uri.path` cho tên thư mục project; `uri.authority` cho qualifier remote (WSL, SSH, v.v.). Cách này độc lập nền tảng và không phụ thuộc `document.title` hay đổi. Hậu tố qualifier (ví dụ `[WSL: ubuntu-24.04]`) có thể tắt bằng `WINDOW_TITLE_QUALIFIER=false` trong `.env` để tên chủ đề Telegram gọn hơn. Với cửa sổ chưa kết nối (phát hiện qua `/json` nhưng chưa poll), bridge fallback parse tiêu đề target CDP: bỏ hậu tố ` - Cursor`, tách theo ` - `, lấy đoạn project.

**Vòng đời:**
1. Lấy danh sách target từ `http://<CDP_URL>/json`
2. Lọc mọi page có `workbench` trong URL → expose là `windows`
3. Kết nối `CdpClient` tới `webSocketDebuggerUrl` của target được chọn (hoặc đầu tiên)
4. Expose `CdpClient` và `activeTargetId` cho module khác
5. Khi mất kết nối: phát sự kiện, bắt vòng reconnect với backoff lũy thừa

**Chuyển cửa sổ** (`switchWindow(targetId)`):
1. Ngắt CdpClient hiện tại
2. Phát `disconnected` (extractor dừng, executor xóa client)
3. Gọi `connect(targetId)` cho cửa sổ mới
4. Phát `connected` (extractor chạy lại, executor nhận client mới)

**Làm mới định kỳ:** Mỗi 10 giây, `refreshWindows()` tải lại `/json` để phát hiện cửa sổ Cursor mở/đóng mà không reconnect.

### 2.3 DOM Extractor (`dom-extractor.ts`)

**Nhiệm vụ:** Định kỳ trích trạng thái có cấu trúc từ DOM Cursor.

**Cách hoạt động:**
1. Hàm trích được truyền dạng hàm đã serialize qua `client.callFunction()`
2. Trong renderer Cursor, chọn mọi phần tử `[data-flat-index]`
3. Với mỗi phần tử, đọc `data-message-role` + `data-message-kind` để phân loại
4. Trích nội dung theo kiểu vào đối tượng `ChatElement` có kiểu
5. **Tin assistant:** `html` là **chỉ innerHTML của `.markdown-root`** (prose). **`codeBlocks`** là mảng cấu trúc **`CodeBlockItem`** từ widget mã composer (dòng Shiki, text Monaco `.view-line`, fallback mã thuần có nhận thức dòng, trang trí diff → `diffLines` với `add`/`rem`/`ctx`/…).
6. **ToolCallElement:** khi có khối mã composer trên tool edit-review / compact / line, **`diffBlock`** lưu cùng dạng **`CodeBlockItem`** để render web (và Telegram) gốc — không phản chiếu HTML widget.
7. Cũng trích nút phê duyệt, UI trạng thái cơ bản, tab chat, mode, thông tin model, hàng đợi composer và tín hiệu activity thô (`_rawSignals`)
8. Helper dùng chung (`activity-derive.ts`) chuyển `_rawSignals` + tin đã parse thành `agentStatus`, `agentActivityText`, `agentActivityLive`, `agentActivitySource` để web và Telegram dùng cùng hợp đồng activity trực tiếp
9. Trả về `CursorState` đầy đủ hoặc `null` khi lỗi

**Phân loại phần tử:**

| data-message-role | data-message-kind | Kiểu kết quả      |
| ----------------- | ----------------- | ---------------- |
| human             | human             | HumanMessage hoặc PlanBlock (legacy) |
| ai                | assistant         | AssistantMessage |
| ai                | tool              | PlanBlock (widget), RunCommand, hoặc ToolCallElement |
| (không)           | (không)           | ThoughtBlock, LoadingIndicator, hoặc bỏ qua |

Trong nhánh `ai`/`tool`, thứ tự ưu tiên phân loại:
1. `.composer-create-plan-container` → **PlanBlock** (biến thể widget có todo, hành động)
2. `.composer-terminal-tool-call-block-container` → **RunCommand** (text lệnh, Run/Skip/Allow)
3. `.composer-edit-file-review-wrapper` → **ToolCallElement** (thẻ edit/review; tùy chọn **`diffBlock`** khi có khối mã)
4. `.composer-tool-former-message` → **ToolCallElement** (tóm tắt gọn; có thể có **`diffBlock`**)
5. `.ui-tool-call-line-action` → **ToolCallElement** (dòng tool mở rộng; có thể có **`diffBlock`**)

**Selector DOM chính dùng trong trích:**

| Mục tiêu                  | Selector / thuộc tính                                    |
| ----------------------- | ------------------------------------------------------- |
| Bọc tin        | `[data-flat-index]`                                     |
| Văn human              | `.aislash-editor-input-readonly`                        |
| Mention                | `.mention[data-mention-name]`                           |
| Markdown AI     | innerHTML `.markdown-root` → assistant `html` (chỉ prose) |
| Khối mã             | `.composer-message-codeblock`, `.composer-code-block-container`, `.ui-code-block` → `codeBlocks[]` / `diffBlock` |
| Diff có cấu trúc tool    | Khối composer trong host tool → `ToolCallElement.diffBlock` (`CodeBlockItem`) |
| Dòng tool call          | `.ui-tool-call-line-action`, `.ui-tool-call-line-details` |
| Tóm tắt tool gọn    | `.composer-tool-former-message`                         |
| Thống kê edit tool         | `.ui-edit-tool-call__filename`, `__additions`, `__deletions` |
| Thời lượng thought        | `.ui-collapsible-header span` (chữ "for Xs")           |
| Khối plan (legacy)     | `.plan-execution-label`, `.plan-execution-title`         |
| Widget plan             | `.composer-create-plan-container`                        |
| Tiêu đề widget plan       | `.composer-create-plan-title`                            |
| Nhãn widget plan       | `.composer-create-plan-label`                            |
| Mô tả widget plan | `.composer-create-plan-text .markdown-root`              |
| Todo widget plan       | `.composer-create-plan-todo-item`                        |
| Trạng thái todo plan        | `.composer-plan-todo-indicator-pending`, `-completed`, `-in_progress` |
| Chữ todo plan          | `.composer-create-plan-todo-content`                     |
| Nút Build plan       | `.composer-create-plan-build-button`                     |
| Nút View Plan       | `.composer-create-plan-view-plan-button`                 |
| Khối run command   | `.composer-terminal-tool-call-block-container`            |
| Mô tả run command | `.composer-terminal-top-header-description`               |
| Ứng viên run command  | `.composer-terminal-top-header-candidates`                |
| Text lệnh run        | `.composer-terminal-command-expanded-text`                |
| Nút Skip run         | `.composer-skip-button`                                   |
| Nút Run run          | `.composer-run-button`                                    |
| Tiến độ todo           | `.todo-summary-content` (regex `\d+ of \d+`)            |
| Chỉ báo loading       | `.loading-indicator-v3`                                  |
| Tab chat               | `.agent-sidebar-cell` (aria-label/title/textContent)     |
| Mode                    | `data-mode` trên `.composer-unified-dropdown`              |
| Tên model              | Chữ trong trigger `.composer-unified-dropdown-model`       |

### 2.4 Command Executor (`command-executor.ts`)

**Nhiệm vụ:** Dịch lệnh từ xa thành hành động CDP trên DOM Cursor.

**Lệnh:**

| Lệnh | Triển khai |
| ------- | -------------- |
| `send_message(text)` | 1. Tìm input qua cascade selector + `evaluate()`. 2. Focus + click. 3. Ctrl+A + Backspace xóa. 4. `Input.insertText` cho văn bản. 5. `Input.dispatchKeyEvent` cho Enter. |
| `approve(selectorPath)` | Evaluate cuộn vào view + click. |
| `reject(selectorPath)` | Giống approve cho nút reject. |
| `approve_all()` | Tìm nút "Accept All" theo khớp chữ + click. |
| `switch_tab(tabTitle)` | Tìm `.agent-sidebar-cell` theo tiêu đề, JS `.click()`. |
| `new_chat()` | Click nút chat mới qua cascade selector. |
| `set_mode(modeId)` | JS `.click()` trigger dropdown mode, rồi `.click()` item mode đích. |
| `set_model(modelId)` | JS `.click()` trigger dropdown model, rồi `.click()` item đích `.composer-unified-context-menu-item`. Xác minh menu đóng sau chọn. |
| `click_action(selectorPath)` | Click nút hành động chung. Evaluate cuộn vào view + JS `.click()`. Dùng cho Run, Skip, Allow, Build, View Plan với `selectorPath` đã trích. |

**Vì sao domain Input cho gõ:** Cursor dùng ProseMirror/TipTap cho composer chat. Thao tác cấp DOM (`document.execCommand`, `element.value=`) bỏ qua mô hình trạng thái nội bộ ProseMirror. `Input.insertText` và `Input.dispatchKeyEvent` của CDP đi qua pipeline nhập native Chromium mà ProseMirror xử lý đúng qua handler `beforeinput`/`input`.

**Chính sách retry:** Tối đa 2 lần thử lại, cách 500ms. Trả `{ ok: boolean, error?: string }`.

### 2.5 State Manager (`state-manager.ts`)

**Nhiệm vụ:** So khác trạng thái liên tiếp và phát sự kiện thay đổi chi tiết.

**Thuật toán:**
1. Nhận `CursorState` mới từ extractor
2. So sánh `JSON.stringify` từng trường top-level với trạng thái trước
3. Xây đối tượng patch chỉ chứa trường đổi
4. Debounce patch (mặc định 300ms) để tránh bão broadcast khi stream
5. Phát sự kiện `state:patch`

**Trường do bridge quản lý:** `windows` và `activeWindowId` không do trích DOM điền (DOM chỉ thấy một cửa sổ). Chúng được đặt bởi `updateWindows()` gọi từ `index.ts` sau khi CDP bridge kết nối hoặc làm mới. Diff giữ các trường này khi áp dụng trích.

**Sự kiện phát:**
- `state:patch` — thay đổi trạng thái một phần
- `connection:changed` — đảo trạng thái kết nối CDP

### 2.6 Tầng transport

Kiến trúc không phụ thuộc transport cụ thể. State Manager phát sự kiện; số lượng transport tùy ý có thể đăng ký độc lập. Mỗi transport tự quản vòng đời kết nối, định dạng client và định tuyến lệnh.

#### Web Transport (`relay.ts`)

**Nhiệm vụ:** Phục vụ client web và nối socket.io với backend.

**HTTP:**
- `GET /` → phục vụ `src/client/` như tệp tĩnh
- `GET /health` → trả `{ ok, connected, agentStatus, clients, uptime, windows, activeWindowId, mode, model, chatTabCount, pendingApprovalCount, generation }`

**socket.io:**
- Kết nối mới: gửi `state:full`
- Định tuyến sự kiện `command:*` tới Command Executor
- Định tuyến `command:switch_window` trực tiếp tới CDP Bridge
- Chuyển tiếp sự kiện State Manager tới mọi socket

**Client web** (`src/client/app.js`, `src/client/styles.css`):

- Render các kiểu `ChatElement` vào `#messages`; HTML assistant đi qua `sanitizeHtml` (bỏ script, handler sự kiện, root composer/Shiki nhúng).
- **Mã/diff gốc:** `createNativeBlockFromItem()` xây `.code-block.native-code-block` có thanh công cụ (tiêu đề + toàn màn hình), **`.code-block-viewport`** giới hạn ~7 dòng (`--cb-font`, `--cb-lh`, `--cb-lines`) có cuộn, và style dòng xanh/đỏ cho diff có cấu trúc. **`codeBlocks`** của assistant nối sau prose; **`diffBlock`** của tool gắn dưới **`.tool-diff-host`** (`syncToolDiffHost` / `updateToolEl`). Văn bản patch thuần cũng được phân loại thành `diffLines` phía server để diff không Monaco vẫn có màu add/remove.
- **Đọc toàn màn hình:** Mở rộng mở **`.code-block-fs-overlay`** (modal, padding safe-area, backdrop + Escape đóng, điều khiển ≥44px). Khóa cuộn body khi mở.

#### Telegram Transport (`transports/telegram/`)

**Nhiệm vụ:** Nối trạng thái Cursor với supergroup Telegram có chủ đề diễn đàn.

**Hai triển khai** (chọn qua biến env `TELEGRAM_IMPL`):
- `grammy` (mặc định) — framework bot Grammy cho polling và gọi API. `fetch` của Grammy bọc timeout HTTP 30s để tránh treo vô hạn.
- `raw` — dùng `fetch` native Node trực tiếp Telegram Bot API. Không framework bot ngoài. Timeout HTTP 30s rõ ràng trên mọi gọi API và vòng long-poll riêng có backoff. Dùng nếu khởi động Grammy treo (đã thấy trên một số cấu hình macOS).

**Thành phần dùng chung** (cả hai triển khai):
- `base.ts` — lớp trừu tượng `BaseTelegramTransport` chứa toàn bộ logic nghiệp vụ: bền auth, trạng thái sync, chỉ báo activity, tự tạo chủ đề, xử lý tin, typing, handler sự kiện. Grammy và raw đều kế thừa.
- `tg-types.ts` — định nghĩa kiểu không phụ thuộc Grammy: `TelegramApiClient`, `BotContext`, `TgKeyboard`
- `formatter.ts` — chuyển mỗi kiểu `ChatElement` sang HTML Telegram. Dùng duyệt cây DOM `node-html-parser` để chuyển HTML chính xác (khối mã Shiki, heading, đậm theo class, bảng). Xử lý chia 4096 ký tự, bàn phím inline cho hành động. Không phụ thuộc Grammy.
- `topic-manager.ts` — ánh xạ `windowTitle::tabTitle` → `threadId` chủ đề forum. Tạo chủ đề qua `TelegramApiClient.createForumTopic`
- `message-tracker.ts` — theo dõi `ChatElement.id` → `message_id` Telegram theo chủ đề. Quyết định gửi tin mới hay sửa tin có sẵn
- `commands.ts` — handler lệnh bot (`/sync`, `/mode`, `/model`, `/status`, `/plan`, `/agent`). Dùng interface `BotContext`, không phụ thuộc Grammy

**Riêng Grammy** (`transports/telegram/index.ts`): tạo `Bot` Grammy, plugin `autoRetry`, long-poll qua `bot.start()`, adapter ngữ cảnh Grammy → `BotContext`.

**Riêng Raw** (`transports/telegram-raw/`): `RawTelegramApiClient` (fetch), vòng `getUpdates` long-poll có offset và backoff lỗi, adapter cập nhật thô → `BotContext`.

**Luồng vào** (Telegram → Cursor):
1. User gửi văn bản trong chủ đề forum → phân giải chủ đề → window+tab → chuyển nếu cần → `commandExecutor.sendMessage(text)`
2. User bấm nút bàn phím inline → giải mã callback → gọi phương thức executor phù hợp (`clickApproval`, `clickAction`, `setMode`, `setModel`)
3. User gửi lệnh `/mode` → bot trả mode hiện tại + bàn phím inline → user bấm → `commandExecutor.setMode(modeId)`

**Luồng ra** (Cursor → Telegram):
1. State Manager phát `state:patch` với `messages` đổi (và trường liên quan)
2. `WindowMonitor` điều khiển `doProcessWindow` theo chủ đề đã ánh xạ: **dòng activity** (gửi/sửa/xóa từ `agentActivityText` chỉ khi `agentActivityLive` true, khử trùng với thought step-summary đang chạy), tin **composer queue**, rồi phần tử chat
3. Transport so khác tin mới vs đã theo dõi theo chủ đề
4. Phần tử mới → `sendMessage` với HTML đã định dạng + bàn phím inline tùy chọn
5. Phần tử đổi (ví dụ assistant đang stream) → `editMessageText` trên `message_id` đã theo dõi
6. Trong khi `agentActivityLive` true và `agentStatus` là mode đang hoạt động → `sendChatAction('typing')` mỗi 4 giây

**Kiểm soát truy cập:** Middleware kiểm `update.from.id` với allowlist `TELEGRAM_ALLOWED_USERS`. Bot phải là admin nhóm với privacy mode OFF.

**Cấu hình:** Xem biến env `TELEGRAM_*` trong `docs/prd.md` §8.

Đặc tả đầy đủ: `docs/telegram_prd.md`. Kiến trúc chi tiết: `docs/telegram_architecture.md`.

---

## 3. Mô hình mạng

### 3.1 Kết nối CDP (Relay → Cursor)

```
Tiến trình WSL2 → localhost:9222 → Cursor Windows
```

WSL2 mặc định chuyển tiếp localhost tới máy chủ Windows.

### 3.2 Kết nối client (Điện thoại → Relay)

```
Điện thoại → <ip-lan-windows>:3000 → (chuyển tiếp cổng) → relay server WSL2
```

Cần một trong:
- **Mạng WSL2 mirrored:** `networkingMode=mirrored` trong `.wslconfig`
- **Chuyển tiếp cổng:** `netsh interface portproxy` chuyển tiếp cổng 3000

Cả hai cần quy tắc firewall Windows inbound cho TCP 3000.

---

## 4. Phục hồi lỗi

### 4.1 Mất kết nối CDP

1. CdpClient phát hiện WebSocket đóng
2. CDP Bridge phát `disconnected` → State Manager → client thấy "Disconnected"
3. Vòng reconnect với backoff lũy thừa (1s, 2s, 4s… tối đa 30s)
4. Khi kết nối lại: khám phá lại target, kết nối lại, tiếp tục poll

### 4.2 Trích DOM thất bại

1. Trích bắt mọi lỗi, trả `null`
2. State Manager coi `null` là "không đổi" (giữ trạng thái đã biết cuối)
3. Sau 10 lần `null` liên tiếp, log cảnh báo gợi ý `npm run discover`

### 4.3 Client ngắt kết nối

1. socket.io tự reconnect với backoff lũy thừa
2. Khi kết nối lại, server gửi `state:full` để bắt kịp

### 4.4 Thực thi lệnh thất bại

1. Command Executor thử lại tối đa 2 lần, cách 500ms
2. Trả `{ ok: false, error }` cho client cụ thể
3. Client hiển thị toast lỗi

---

## 5. Cấu trúc thư mục

```
cursor-ide-remote/
├── docs/
│   ├── initial_prd.md            # Yêu cầu gốc (giữ nguyên)
│   ├── prd.md                    # PRD toàn diện (đặc tả dự án)
│   ├── architecture.md           # Tài liệu này
│   ├── telegram_prd.md           # PRD module Telegram
│   └── telegram_architecture.md  # Kiến trúc module Telegram
├── temp/                         # Snapshot DOM lưu để phân tích
│   ├── full.html                 # Toàn bộ DOM cửa sổ Cursor
│   ├── chat.html                 # Chỉ panel chat
│   ├── plan_widget.html          # Snapshot DOM widget plan
│   ├── run_widget.html           # Snapshot DOM widget run command
│   └── workbench.desktop.main.css  # CSS Cursor
├── src/
│   ├── server/
│   │   ├── index.ts              # Điểm vào: nối dây + khởi động
│   │   ├── config.ts             # Cấu hình env + tải selector
│   │   ├── types.ts              # Mọi interface TypeScript dùng chung
│   │   ├── cdp-client.ts         # Client CDP nhẹ (WebSocket thô)
│   │   ├── cdp-bridge.ts         # Vòng đời CDP + reconnect
│   │   ├── dom-extractor.ts      # Poll DOM + trích ChatElement
│   │   ├── command-executor.ts   # Dịch hành động CDP
│   │   ├── state-manager.ts      # So khác trạng thái + phát sự kiện
│   │   ├── relay.ts              # Transport web: Express + socket.io
│   │   └── transports/
│   │       ├── types.ts          # Interface transport
│   │       ├── telegram/
│   │       │   ├── base.ts       # BaseTelegramTransport (logic dùng chung)
│   │       │   ├── tg-types.ts   # Kiểu không Grammy (API, context, keyboard)
│   │       │   ├── index.ts      # TelegramTransport Grammy
│   │       │   ├── formatter.ts  # ChatElement → HTML Telegram
│   │       │   ├── commands.ts   # Handler lệnh bot
│   │       │   ├── topic-manager.ts  # Ánh xạ chủ đề ↔ window+tab
│   │       └── telegram-raw/
│   │           ├── index.ts      # RawTelegramTransport (không Grammy)
│   │           ├── raw-api.ts    # Client API Telegram dùng fetch
│   │           └── message-tracker.ts  # Theo dõi phần tử → message ID
│   ├── client/
│   │   ├── index.html            # Vỏ SPA
│   │   ├── app.js                # Logic client (socket.io, render theo kiểu)
│   │   └── styles.css            # Style tối theo chủ đề Cursor
│   └── discovery/
│       └── discover-dom.ts       # CLI khám phá cấu trúc DOM
├── extension/
│   ├── src/
│   │   ├── extension.ts           # Điểm vào extension VS Code
│   │   ├── server-manager.ts      # Vòng đời tiến trình con + poll sức khỏe
│   │   ├── license-manager.ts     # Xác thực license + link mua
│   │   ├── status-bar.ts          # Mục thanh trạng thái
│   │   ├── output-channel.ts      # Bọc OutputChannel
│   │   ├── config-bridge.ts       # Cài đặt VS Code → biến env
│   │   └── tree-view.ts           # TreeDataProvider thanh bên
│   ├── media/
│   │   └── icon.png               # Icon extension
│   ├── esbuild.js                 # Cấu hình bundler extension
│   └── tsconfig.json              # tsconfig riêng extension
├── scripts/
│   ├── dev-wrapper.ts             # Khởi động dev (nhắc license)
│   └── release.ts                 # Tăng version + changelog + tag
├── selectors.json                # Selector DOM tách ra (user có thể sửa)
├── package.json
├── tsconfig.json
├── CHANGELOG.md
├── .vscodeignore
└── .gitignore
```

---

## 6. Kinh nghiệm triển khai

Bài học khi xây và gỡ lỗi tích hợp CDP với DOM Cursor. Hữu ích khi mở rộng hệ thống hoặc xử lý sự cố sau khi Cursor cập nhật.

### 6.1 Tab chat dùng `.agent-sidebar-cell`

Tab chat trích từ phần tử `.agent-sidebar-cell` trong thanh bên Cursor. Đại diện mục lịch sử chat agent. Mỗi ô có `aria-label` hoặc `title` chứa tên chat. Thuộc tính `data-selected` hoặc `data-highlighted` chỉ tab đang active. Chuyển tab bằng khớp theo tiêu đề và JS `.click()` — không dùng đường selector CSS mong manh hay chuột CDP theo tọa độ.

**Lưu ý:** Tablist VS Code (`ul[role="tablist"] li.composite-bar-action-tab`) chứa tab editor/terminal/output và **không** dùng cho tab chat.

### 6.2 Đường selector CSS phải escape dấu chấm trong ID

Workbench Cursor dùng ID phần tử có dấu chấm (ví dụ `workbench.parts.auxiliarybar`). Khi xây đường selector qua `buildSelectorPath`, phải escape: `#workbench\\.parts\\.auxiliarybar`. Không escape thì `querySelector` hiểu dấu chấm là class và thất bại im lặng.

### 6.3 Tương tác dropdown: JS `.click()` được, chuột CDP không

Cả dropdown mode và model đều mở và chọn mục bằng gọi JavaScript `.click()` qua `Runtime.evaluate`. `Input.dispatchMouseEvent` (chuột theo tọa độ) không đáng tin cho các phần tử này — click có vẻ thành công nhưng không vào handler React, dropdown không mở hoặc chọn không áp dụng.

Mẫu hoạt động (`setMode` và `setModel`):
1. `document.querySelector(trigger).click()` — mở dropdown
2. Đợi 250–300ms để menu render
3. `document.querySelector(item).click()` — chọn mục
4. Xác minh menu đóng (xác nhận chọn được chấp nhận)

### 6.4 Model picker: hover vs trạng thái active

Trong menu chọn model Cursor, `data-is-selected="true"` chỉ mục **đang hover/focus**, không phải model đang active. Model thực sự active được chỉ bằng icon dấu tích (`codicon-check`) ở vùng bên phải mục. Nút trigger (`.composer-unified-dropdown-model`) hiển thị tên model active dạng chữ.

### 6.5 Trích mode

Mode hiện tại (Agent, Plan, Debug, Ask) lưu trong thuộc tính `data-mode` trên phần tử `.composer-unified-dropdown`. Mục mode trong dropdown có ID theo mẫu `composer-mode-*-{modeId}`.

---

### 6.6 Widget plan dùng `.composer-create-plan-container`

Widget plan đầy đủ (danh sách todo, nút Build, View Plan) nằm trong bọc `data-message-kind="tool"` dưới `.composer-tool-former-message`. Phải phát hiện **trước** trích tóm tắt tool gọn chung. Selector chính: `.composer-create-plan-title`, `.composer-create-plan-label`, `.composer-create-plan-todo-item`, `.composer-create-plan-build-button`, `.composer-create-plan-view-plan-button`.

Định dạng plan legacy (`.plan-execution-message-content`) có cấu trúc DOM khác và xuất hiện trong bọc `role=human`. Cả hai ánh xạ tới kiểu `PlanBlock`.

Để điều khiển từ xa, client web không chỉ dựa payload widget gọn đã trích:

- `View Plan` mở modal web cục bộ.
- Relay có thể đọc `~/.cursor/plans/<label>` và trả toàn bộ nội dung plan/todo, khớp render plan đầy đủ trên Telegram khi tệp đã lưu tồn tại.
- Viên thuốc model plan yêu cầu tùy chọn dropdown Cursor trực tiếp qua relay, rồi gửi lựa chọn về Cursor mà không bắt người dùng tương tác UI desktop trực tiếp.

### 6.7 Widget run command dùng `.composer-terminal-tool-call-block-container`

Thẻ phê duyệt lệnh terminal chứa đầy đủ lệnh shell, header mô tả và nút Run/Skip/Allow. Lớp container là `.composer-terminal-tool-call-block-container` (hoặc `.composer-tool-call-container.composer-terminal-compact-mode`). Text lệnh nằm trong `.composer-terminal-command-expanded-text`. Nút nhận diện bằng `.composer-run-button` và `.composer-skip-button`. Nút "Allow" xuất hiện cho yêu cầu quyền sandbox.

Lưu ý: "Skip" trước đây chưa có trong `rejectButton.textMatch` của `selectors.json` và cần thêm.

### 6.8 Trích hành động tool chung

Mọi kiểu tool — Fetch, Edit review, lệnh terminal và widget Cursor tương lai — dùng quy ước nút chung: `.composer-skip-button` cho Skip và `.composer-run-button` / `.anysphere-secondary-button` cho Run/Allow/Accept. Helper `extractToolActions(container)` trong `dom-extractor.ts` quét chung mọi container tool cho các nút này và phân loại `skip`, `run`, hoặc `allow`. Tránh mã trích nút theo từng loại tool và đảm bảo loại tool mới tự động có hành động phê duyệt trên Telegram và web.

Đường tool gọn (`.composer-tool-former-message`) nhắm `.composer-tool-call-header-content` cho text chi tiết/hành động để tránh lấy nhãn nút làm nội dung.

### 6.9 Thông báo trình duyệt

Client web bắn cảnh báo native `Notification` khi tab không focus và có sự kiện cần hành động. Sự kiện bao phủ:
- Phê duyệt toàn cục (từ `pendingApprovals`)
- Lời nhắc run command (tin `type: 'run_command'` có action)
- Phê duyệt cấp tool (tin `type: 'tool'` có action, ví dụ Fetch allowlist, Edit accept)

Mỗi thông báo dùng tag duy nhất theo ID tin để tránh trùng. Quyền được xin lười lần kích hoạt đầu.

---

## 7. Vỏ extension VS Code

Dự án có thể cài như extension VS Code / Cursor. Extension là lớp bọc mỏng — spawn server hiện có như tiến trình con và tích hợp editor native.

Đặc tả đầy đủ: `docs/extension_prd.md`.

### 7.1 Kiến trúc

Extension chạy trong Extension Host (tiến trình Node.js). Giao tiếp với server qua:
1. **Biến môi trường** — cấu hình và license truyền lúc spawn
2. **HTTP polling** — `GET /health` mỗi 5 giây cho dữ liệu trạng thái
3. **Phân tích stdout/stderr** — dòng log server đưa vào `LogOutputChannel`

Extension không import module server. Logic license cố ý trùng lặp — bundle extension không chia sẻ mã với server.

**Mẫu singleton server:** Chỉ một tiến trình server chạy trên mọi cửa sổ Cursor. Khi khởi động, `ServerManager` thử `GET /health` trên cổng cấu hình. Nếu server đã chạy, cửa sổ gắn làm **observer** (poll sức khỏe, không sở hữu tiến trình). Nếu chưa, spawn server và trở thành **owner**. Nếu cửa sổ owner đóng:

1. Observer phát hiện 3 lần poll sức khỏe thất bại liên tiếp
2. Sau jitter ngẫu nhiên (0–3s) để tránh đua, một observer gọi `attemptTakeover()`
3. Spawn tiến trình server mới và trở owner mới
4. Observer khác phát hiện server khỏe và vẫn là observer

Đua khi spawn đồng thời xử lý bắt `EADDRINUSE` từ stderr và fallback sang chế độ observer.

### 7.2 Thành phần

| Tệp | Nhiệm vụ |
| --- | --- |
| `extension/src/extension.ts` | Kích hoạt/hủy, đăng ký lệnh, tự khởi động, sinh mật khẩu |
| `extension/src/server-manager.ts` | Vòng đời singleton: spawn/kill, owner/observer, poll sức khỏe, tự phục hồi |
| `extension/src/license-manager.ts` | Xác thực khóa, lưu VS Code Secrets API, link mua |
| `extension/src/config-bridge.ts` | Đọc cài đặt VS Code → env cho tiến trình con |
| `extension/src/status-bar.ts` | Mục thanh trạng thái màu theo trạng thái kết nối |
| `extension/src/output-channel.ts` | Bọc `LogOutputChannel` với mức `info`/`warn`/`error` |
| `extension/src/tree-view.ts` | TreeDataProvider thanh bên: trạng thái server, Start/Stop, CDP, agent, client |
| `extension/src/setup-panel.ts` | WebviewPanel: cấu hình mạng, quản lý mật khẩu, wizard Telegram |

### 7.3 Build

- **Bundle extension:** esbuild gói `extension/src/extension.ts` → `dist/extension.cjs` (CJS, external: `vscode`)
- **Bundle server:** esbuild gói `src/server/index.ts` + mọi phụ thuộc Node → `dist/server/bundle.mjs` (ESM). Banner tiêm shim tương thích CJS (`__dirname`, `__filename`, `createRequire`) vì gói đã gói như Express phụ thuộc các global này.
- **Tệp client:** `tsc` biên dịch TypeScript, rồi sao chép `src/client/` sang `dist/client/` cùng `socket.io.min.js` từ node_modules.
- Mọi bước chạy qua `vscode:prepublish` trước khi đóng gói bằng `vsce`.

### 7.4 Ghi chú triển khai

**grammY native fetch:** Thư viện bot Telegram (grammY) mặc định client HTTP riêng dựa trên `node:https`, gãy trong môi trường ESM đã bundle esbuild. Bot tạo với `{ client: { fetch } }` để dùng API `fetch` native Node.

**Vòng đời webview:** Setup Panel webview dùng `retainContextWhenHidden: true` để giữ trạng thái. Mở editor Cài đặt VS Code cùng ViewColumn khi webview đang retain có thể deadlock renderer Cursor. Handler "Open All Settings" hủy panel trước, rồi mở Cài đặt trên tick trì hoãn qua `setTimeout`.

---

## 8. Biến môi trường riêng extension

Các biến này do extension đặt khi spawn server là tiến trình con. Đều tương thích ngược — khi vắng, hành vi giống chế độ độc lập.

| Biến env | Mặc định (độc lập) | Extension đặt | Mục đích |
| --- | --- | --- | --- |
| `LICENSE_KEY` | không đặt → đọc `data/license.key` | Khóa từ VS Code secrets API | Truyền license không qua I/O tệp |
| `DATA_DIR` | không đặt → `./data` | `context.globalStorageUri` | Lưu bền tách khỏi thư mục cài extension |
| `LOG_FORMAT` | không đặt → log văn bản có timestamp | `json` | Dòng JSON có cấu trúc để Output Channel parse |

---

## 9. Phụ thuộc

| Gói            | Phiên bản | Mục đích                                              |
| ------------------ | ------- | ---------------------------------------------------- |
| `express`          | ^4.21   | HTTP server cho tệp tĩnh + health                |
| `socket.io`        | ^4.8    | Giao tiếp hai chiều thời gian thực                |
| `ws`               | ^8.18   | WebSocket thô cho client CDP                         |
| `grammy`           | latest  | Framework Telegram Bot API (TypeScript)              |
| `node-html-parser` | latest  | Parse HTML dạng DOM cho formatter Telegram        |
| `tsx`              | ^4.19   | Dev: chạy TypeScript có watch mode            |
| `typescript`       | ^5.7    | Kiểm tra kiểu và biên dịch                        |
| `@types/vscode`    | ^1.85   | Dev: kiểu API extension VS Code                     |
| `esbuild`          | ^0.24   | Dev: đóng gói extension                              |
| `@vscode/vsce`     | ^3.0    | Dev: đóng gói và xuất bản extension              |

Không Puppeteer. Không framework frontend. Không công cụ build cho client.
