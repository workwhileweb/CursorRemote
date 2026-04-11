# Transport Telegram — Tài liệu kiến trúc

## 1. Tổng quan thành phần

```
┌───────────────────────────────────────────────────────────┐
│                    TelegramTransport                       │
│                                                           │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ TopicManager │  │ MessageTracker│  │   Formatter     │  │
│  │              │  │              │  │                 │  │
│  │ threadId ↔   │  │ elementId →  │  │ ChatElement →   │  │
│  │ window+tab   │  │ msgId[]      │  │ Telegram HTML   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬────────┘  │
│         │                 │                    │           │
│  ┌──────▼─────────────────▼────────────────────▼────────┐  │
│  │              Bot (grammy)                            │  │
│  │                                                      │  │
│  │  Lệnh: /topics /mode /model /status              │  │
│  │  Callback: approve, reject, run, skip, build, v.v.  │  │
│  │  Văn bản: chuyển thành sendMessage tới Cursor        │  │
│  │  Typing: vòng sendChatAction khi agent hoạt động      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                           │
└────────────────────────┬──────────────────────────────────┘
                         │
            đăng ký tới │ gọi
                         │
         ┌───────────────▼───────────────┐
         │         Hệ thống lõi           │
         │                               │
         │  StateManager  (sự kiện)       │
         │  CommandExecutor  (phương thức)│
         │  CDPBridge  (switchWindow)    │
         └───────────────────────────────┘
```

## 2. Cấu trúc module

```
src/server/transports/telegram/
├── index.ts            # Lớp TelegramTransport - vòng đời, nối sự kiện
├── formatter.ts        # Chuyển ChatElement → HTML Telegram
├── commands.ts         # Handler lệnh bot + callback query
├── topic-manager.ts    # Ánh xạ hai chiều Topic ↔ window+tab
└── message-tracker.ts  # Theo dõi ChatElement.id → message_id Telegram
```

## 3. Luồng dữ liệu

### 3.1 Xuất: Cursor → Telegram

```
StateManager phát 'state:patch'
  │
  ▼
TelegramTransport.onStatePatch(patch)
  │
  ├─ patch.messages? → diffMessages(oldMessages, newMessages)
  │   │
  │   ├─ Phần tử mới → formatter.format(element) → bot.sendMessage(chatId, html, { thread_id, reply_markup })
  │   │                                          → messageTracker.track(elementId, telegramMsgId, threadId)
  │   │
  │   ├─ Phần tử đổi → formatter.format(element) → bot.editMessageText(chatId, msgId, html, { reply_markup })
  │   │
  │   └─ Phần tử xóa → (không hành động, tin Telegram giữ nguyên)
  │
  ├─ patch.pendingApprovals? → sendOrUpdateApprovalMessage(threadId, approvals)
  │
  ├─ patch.agentStatus? → updateTypingIndicator(status)
  │
  ├─ patch.mode? / patch.model? → (không đẩy tự động, hiển thị qua /mode /model)
  │
  └─ patch.chatTabs? / patch.windows? → (không đẩy tự động, hiển thị qua /topics /status)
```

**Snapshot cửa sổ:** Trong production, `WindowMonitor` bắn `window:update` → `TelegramTransport.processWindow` → `doProcessWindow` cho mỗi cửa sổ kết nối. Luồng đó gửi **activity tạm** (có khử trùng thought), **tóm tắt hàng đợi composer**, và **tin nội dung** dùng cùng `formatter` + `MessageTracker` như trên — không chỉ `state:patch`.

### 3.2 Nhập: Telegram → Cursor

```
Người dùng gửi văn bản trong chủ đề
  │
  ▼
Middleware bot: kiểm allowlist → từ chối nếu không được phép
  │
  ▼
topicManager.resolveThread(threadId)
  │
  ├─ Trả { windowId, tabTitle }
  │
  ├─ Nếu windowId !== activeWindowId → cdpBridge.switchWindow(windowId) → đợi 'connected'
  │
  ├─ Nếu tabTitle !== activeTab → commandExecutor.switchTab(tabTitle) → đợi
  │
  └─ commandExecutor.sendMessage(text) → trả lời xác nhận hoặc lỗi
```

```
Người dùng bấm nút bàn phím inline
  │
  ▼
Handler callback_query bot
  │
  ├─ Parse callback data: "{action}:{shortId}:{selectorHash}"
  │
  ├─ Tra cứu selectorPath đầy đủ từ bản đồ hash
  │
  ├─ Định tuyến theo action:
  │   ├─ approve / reject / approve_all → commandExecutor.clickApproval(selectorPath)
  │   ├─ run / skip / allow → commandExecutor.clickAction(selectorPath)
  │   ├─ build / view_plan → commandExecutor.clickAction(selectorPath)
  │   ├─ set_mode:{modeId} → commandExecutor.setMode(modeId)
  │   └─ set_model:{modelId} → commandExecutor.setModel(modelId)
  │
  └─ Trả lời callback query bằng text kết quả
```

## 4. Chi tiết thành phần

### 4.1 TelegramTransport (`index.ts`)

Lớp chính triển khai interface `Transport`.

**Constructor** nhận: `TelegramConfig`, `StateManager`, `CommandExecutor`, `CDPBridge`

**Vòng đời:**
- `start()`: Tạo `Bot` grammy với plugin auto-retry, đăng ký middleware (allowlist), đăng ký lệnh và callback handler, đăng ký sự kiện StateManager, bắt đầu long polling
- `stop()`: Dừng long polling, hủy đăng ký StateManager

**Giới hạn tốc độ:**
- Plugin `@grammyjs/auto-retry`: bắt 429, đợi `retry_after`, thử lại tới 3 lần (tối đa trễ 60s)
- Lớp `SendQueue`: serialize `sendMessage` / `editMessageText` ra ngoài với **~300ms** giữa các lần gửi và **100ms** giữa các lần sửa (mặc định transport so với `send-queue.ts`)
- Tập `seenThreads`: lần đầu gặp thread, chỉ gửi 5 tin nhắn cuối (cũ hơn đánh dấu "skipped" trong tracker)

**Tin activity** (dòng trạng thái tạm):

- Mỗi snapshot cửa sổ, `doProcessWindow` so `snapshot.agentActivityText` với trạng thái đã theo dõi theo `threadId`, chỉ khi `snapshot.agentActivityLive` true.
- Nếu activity **thừa** với thought `step_summary` đang chạy khớp nhãn, xóa tin activity Telegram hiện có và không gửi mới (`activityRedundantWithInProgressStepSummary`).
- Ngược lại: gửi → sửa khi nhãn đổi → xóa khi activity hết hoặc stale; `cleanStaleActivity()` gỡ hàng kẹt sau `AGENT_ACTIVITY_STALE_MS` (30s). Cùng timeout xóa header web qua `StateManager`.
- Lưu map `message_id` activity vào `data/telegram-activity.json` để restart dọn tin mồ côi.

**Đăng ký trạng thái:**
- `stateManager.on('state:patch', this.onStatePatch)`
- `stateManager.on('connection:changed', this.onConnectionChanged)`

**Vòng typing:**
- Khi `agentActivityLive` true và `agentStatus` là `thinking`, `generating`, hoặc `running_tool`, `setInterval` gọi `sendChatAction('typing')` mỗi 4 giây tới chủ đề đang hoạt động
- Xóa interval ngay khi live activity tắt, kể cả khi nhãn stale còn trong DOM Cursor
- Hành động typing không qua SendQueue (rẻ và không quan trọng)

### 4.2 Formatter (`formatter.ts`)

Hàm thuần chuyển `ChatElement` thành chuỗi HTML Telegram và tùy chọn `InlineKeyboard`.

**Hàm chính:**
- `formatElement(element): { html, keyboard? }` — phân nhánh theo kiểu phần tử
- `formatAssistant(msg)` — HTML Cursor → HTML Telegram, dùng `msg.codeBlocks` render mã chính xác
- `formatActivity(text)` — dòng activity tạm (`● label…`), không dùng `<tg-spoiler>`
- `thoughtAppearsInProgress(msg)` — export; dùng khử trùng activity và định dạng thought
- `activityRedundantWithInProgressStepSummary(...)` — chặn activity trùng thought step-summary `📎`
- `formatPlan`, `formatRunCommand`, `formatApprovals`, `splitMessage`

**Chuyển HTML** (`cursorHtmlToTelegram`): `node-html-parser` parse cây DOM, đi quyệt để ra HTML an toàn cho Telegram. Thay thế cách regex cũ không xử lý được cấu trúc lồng phức tạp của Cursor.

### 4.3 TopicManager (`topic-manager.ts`)

Quản lý ánh xạ hai chiều giữa thread ID chủ đề forum Telegram và cặp window+tab Cursor.

**Trạng thái:**
- `byKey: Map<string, TopicMapping>` — key `{windowTitle}::{tabTitle}`
- `byThread: Map<number, TopicMapping>` — tra ngược theo threadId

**Phương thức:** `createTopics`, `resolveThread`, `getThreadForKey`, `getActiveThread`

**Bền (tùy chọn):** Lưu `telegram-topics.json`, load khi khởi động

### 4.4 MessageTracker (`message-tracker.ts`)

Theo dõi quan hệ `ChatElement.id` ↔ ID tin Telegram trong từng chủ đề.

**Trạng thái:** `messages: Map` với key `{threadId}:{elementId}`

**Phương thức:** `getTracked`, `track`, `clearThread`, `hasChanged`

### 4.5 Commands (`commands.ts`)

Đăng ký handler lệnh và callback query.

**Handler lệnh:** `/topics`, `/status`, `/history`, `/mode`, `/model`, `/plan`, `/agent`

**Handler callback:** Parse `callbackData`, định tuyến tới CommandExecutor, trả lời callback

## 5. Mã hóa callback data

Telegram giới hạn `callback_data` 64 byte. Sơ đồ:

```
{action}:{shortId}:{hash}
```

- `action`: chuỗi ngắn `apr`, `rej`, `run`, v.v.
- `shortId`: 8 ký tự đầu ID phần tử/approval
- `hash`: 8 ký tự đầu hash của selector path

`Map<string, string>` lưu `hash → selectorPath`. Cập nhật khi gửi hành động mới, dọn khi hành động không còn trong state.

## 6. Vòng đời tin nhắn

### 6.1 Phần tử mới xuất hiện

1. Formatter chuyển phần tử thành HTML + keyboard tùy chọn
2. Nếu HTML > 4096 ký tự, chia phần
3. Gửi mỗi phần qua `sendMessage` với `message_thread_id`, `parse_mode: HTML`
4. Theo dõi mọi message_id trong MessageTracker

### 6.2 Nội dung phần tử thay đổi (stream)

1. Tính hash nội dung mới
2. Hash khớp hash đã theo dõi → bỏ qua
3. Khác → format lại và `editMessageText`
4. Nếu tin đã chia phần và nội dung mới gọn hơn — sửa phần hiện có
5. Cập nhật hash đã theo dõi

### 6.3 Phê duyệt đã xử lý

1. Patch tiếp theo `pendingApprovals` rỗng
2. Sửa tin phê duyệt thành "Resolved" (hoặc gỡ keyboard)
3. Dọn mục hash map callback cho phê duyệt đó

## 7. Phục hồi lỗi

### 7.1 Lỗi API Telegram

- **429**: grammy xử lý tự động với retry-after
- **400 message not found**: Xóa khỏi tracker, gửi tin mới ở lần cập nhật sau
- **400 chat not found**: Log lỗi, bỏ qua chủ đề đó đến khi chạy lại `/topics`
- **Lỗi mạng**: long polling grammy tự kết nối lại

### 7.2 Mất kết nối CDP

Khi `connection:changed` với `false`:
- Gửi tin trạng thái vào chủ đề đang hoạt động: "⚠️ Disconnected from Cursor IDE"
- Dừng chỉ báo typing
- Khi kết nối lại: "✅ Reconnected to Cursor IDE"

### 7.3 Khởi động lại bot

- TopicManager load mapping từ `telegram-topics.json` nếu có
- MessageTracker rỗng — không sửa tin cũ
- Chủ đề hiện có khám phá lại bằng khớp tên
- Tin mới chảy bình thường từ patch tiếp theo

## 8. Phụ thuộc

| Gói | Mục đích |
|---------|---------|
| `grammy` | Framework Telegram Bot API (TypeScript, Bot API 9.5) |
| `node-html-parser` | Parse DOM HTML Cursor → HTML Telegram |

grammy xử lý long polling, rate limit và API gọi có kiểu. `node-html-parser` nhẹ (~40KB) cho HTML Cursor lồng sâu (Shiki, bảng, v.v.).
