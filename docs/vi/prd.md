# CursorRemote — Tài liệu yêu cầu sản phẩm (PRD)

## 1. Tổng quan

CursorRemote là hệ relay cho phép theo dõi và điều khiển agent AI của Cursor IDE từ xa — qua trình duyệt điện thoại hoặc nhóm Telegram. Hệ thống kết nối tới instance Cursor đang chạy qua Chrome DevTools Protocol (CDP), trích trạng thái chat agent dưới dạng dữ liệu có cấu trúc, và stream tới client qua hệ sự kiện không phụ thuộc transport. Từ điện thoại hoặc Telegram bạn có thể đọc hội thoại, phê duyệt hoặc từ chối tool, chạy hoặc bỏ qua lệnh shell, tương tác widget plan, gửi prompt mới, chuyển tab chat, đổi mode/model — không cần chạm máy host.

### 1.1 Phát biểu vấn đề

Khi chạy phiên agent Cursor kéo dài, developer bị trói vào máy host. Ra khỏi bàn đồng nghĩa bỏ lỡ bước phê duyệt chặn agent, lãng phí thời gian và đứt luồng. Không có cách tích hợp sẵn để tương tác agent Cursor từ xa.

### 1.2 Mục tiêu

Giao một hệ thống hoạt động:

- Kết nối Cursor IDE cục bộ qua CDP  
- Trích trạng thái panel chat agent thành dữ liệu có kiểu — gồm widget plan có danh sách todo và widget phê duyệt lệnh terminal  
- Stream trạng thái tới client (trình duyệt và Telegram) theo thời gian thực qua hệ sự kiện không phụ thuộc transport  
- Cho phép người dùng từ xa phê duyệt/từ chối tool, chạy/bỏ qua lệnh shell, kích hoạt build plan  
- Hỗ trợ chuyển tab chat, chọn mode và model  
- Cung cấp tích hợp bot Telegram dùng chủ đề forum (một chủ đề / project + tab chat) để theo dõi và điều khiển  
- Chạy hoàn toàn trên mạng cục bộ (không phụ thuộc cloud, trừ API Telegram)

### 1.3 Không phải mục tiêu

- Xác thực hoặc kiểm soát truy cập đa người dùng cho web client  
- Lịch sử chat bền trong cơ sở dữ liệu  
- PWA / hỗ trợ offline  
- Discord hoặc nền tảng chat khác (kiến trúc cho phép mở rộng nhưng chưa triển khai)

---

## 2. User story

### US-1: Phê duyệt từ xa
**Là** developer không ở bàn, **tôi muốn** biết khi agent cần phê duyệt và bấm Phê duyệt/Từ chối trên điện thoại, **để** agent không bị chặn khi tôi vắng mặt.

### US-2: Gửi prompt từ xa
**Là** developer trên điện thoại, **tôi muốn** gõ và gửi prompt mới cho agent, **để** đổi hướng hoặc tiếp tục công việc agent từ xa.

### US-3: Theo dõi hội thoại
**Là** developer, **tôi muốn** đọc toàn bộ hội thoại agent trên điện thoại với định dạng đúng (markdown, khối mã, tool, plan), **để** hiểu agent đã làm gì và đang làm gì.

### US-4: Nhận biết trạng thái agent
**Là** developer, **tôi muốn** thấy nhanh agent đang rảnh, suy nghĩ, chạy tool hay chờ phê duyệt, **để** biết khi nào cần tôi can thiệp.

### US-5: Thông báo nền
**Là** developer với web client ở tab nền, **tôi muốn** nhận thông báo trình duyệt khi có hành động cần chú ý — phê duyệt toàn cục, nhắc Skip/Run lệnh, phê duyệt cấp tool (ví dụ Fetch allowlist, Edit Accept/Skip), và widget tool khác có thể thao tác, **để** không bỏ lỡ bước nhạy cảm thời gian bất kể loại tool.

### US-6: Độ tin cậy kết nối
**Là** developer, **tôi muốn** hệ thống tự kết nối lại khi mạng rớt, **để** không phải tự refresh hay khởi động lại.

### US-7: Quản lý tab chat
**Là** developer, **tôi muốn** thấy mọi tab chat đang mở và chuyển giữa chúng từ điện thoại, **để** quản lý nhiều hội thoại agent từ xa.

### US-8: Điều khiển mode & model
**Là** developer, **tôi muốn** đổi mode agent (Agent/Ask/Manual) và model từ điện thoại, **để** chỉnh hành vi agent không cần về máy host.

### US-9: Quản lý đa cửa sổ
**Là** developer mở nhiều cửa sổ Cursor, **tôi muốn** thấy mọi cửa sổ và chuyển giữa chúng từ điện thoại, **để** theo dõi và điều khiển agent trên nhiều project.

### US-10: Tương tác widget plan
**Là** developer, **tôi muốn** thấy đầy đủ thẻ plan — tiêu đề, mô tả, danh sách todo kèm trạng thái từng mục — và bấm "Build" hoặc "View Plan" từ điện thoại hoặc Telegram, **để** xem xét và thực thi plan agent từ xa.

### US-11: Phê duyệt lệnh shell
**Là** developer, **tôi muốn** thấy đầy đủ lệnh shell agent muốn chạy (kèm mô tả và text lệnh) và bấm "Run", "Skip" hoặc "Allow" từ điện thoại hoặc Telegram, **để** quyết định đúng đắn thay vì chỉ thấy prompt phê duyệt chung chung.

### US-12: Theo dõi Telegram
**Là** developer dùng Telegram, **tôi muốn** thấy hội thoại agent stream vào chủ đề forum Telegram (một chủ đề / project + tab) với định dạng đúng và cập nhật trực tiếp, **để** theo dõi tiến độ agent từ Telegram không cần mở trình duyệt.

### US-13: Điều khiển Telegram
**Là** developer dùng Telegram, **tôi muốn** gửi tin nhắn, phê duyệt/từ chối tool qua nút inline, đổi mode/model, kích hoạt build plan — tất cả từ Telegram, **để** điều khiển đầy đủ agent từ mọi thiết bị có Telegram.

### US-14: Bảng câu hỏi agent
**Là** developer không ở bàn, **tôi muốn** thấy và trả lời câu hỏi trắc nghiệm của agent từ điện thoại hoặc Telegram, **để** agent không bị chặn chờ input khi tôi vắng mặt.

### US-15: Tự động đồng bộ Telegram
**Là** developer dùng Telegram, **tôi muốn** chạy `/sync` một lần để bật auto-sync, sau đó tab chat mới tự có chủ đề forum, **để** không phải tạo chủ đề thủ công khi mở hội thoại agent mới.

---

## 3. Kiến trúc hệ thống

```
┌─────────────────────────┐       CDP WebSocket        ┌───────────────────────────────────┐
│  Cursor IDE (Windows)   │ ←────── port 9222 ───────→ │  Relay Server (WSL2/Node.js)      │
│                         │                             │                                   │
│  Electron với           │                             │  ┌─ CDP Bridge ─────────────────┐ │
│  --remote-debugging-port│                             │  │  CdpClient tùy chỉnh (ws)      │ │
│                         │                             │  └──────────┬────────────────────┘ │
│  ┌─ Agent Chat Panel ─┐ │                             │             │                      │
│  │  Messages           │ │                             │  ┌──────────▼────────────────────┐ │
│  │  Tool calls         │ │                             │  │  DOM Extractor                │ │
│  │  Plan widgets       │ │                             │  │  Runtime.evaluate poll        │ │
│  │  Run command cards  │ │                             │  │  theo data-attribute          │ │
│  │  Approval buttons   │ │                             │  └──────────┬────────────────────┘ │
│  │  Composer input     │ │                             │             │                      │
│  │  Mode/Model select  │ │                             │  ┌──────────▼────────────────────┐ │
│  │  Chat tab sidebar   │ │                             │  │  State Manager                │ │
│  └─────────────────────┘ │                             │  │  (diff + phát sự kiện)        │ │
│                         │                             │  └──────┬──────────────┬──────────┘ │
│                         │                             │         │              │            │
│                         │                             │  ┌──────▼───────┐ ┌────▼──────────┐ │
│                         │                             │  │ Web Transport│ │ Telegram      │ │
│                         │                             │  │ (socket.io)  │ │ Transport     │ │
│                         │                             │  │ Express+WS   │ │ (grammy bot)  │ │
│                         │                             │  └──────┬───────┘ └────┬──────────┘ │
└─────────────────────────┘                             └─────────┼──────────────┼────────────┘
                                                                  │              │
                                                           socket.io        Telegram Bot API
                                                           port 3000             │
                                                                  │              │
                                                    ┌─────────────▼───┐  ┌───────▼──────────┐
                                                    │  Trình duyệt    │  │  Nhóm Telegram    │
                                                    │  điện thoại     │  │  Chủ đề forum     │
                                                    └─────────────────┘  └──────────────────┘
```

### 3.0 Kiến trúc transport

State Manager phát sự kiện `state:patch` và `connection:changed`. Bất kỳ số lượng transport nào cũng có thể đăng ký độc lập. Mỗi transport:

1. **Đăng ký** sự kiện State Manager cho dữ liệu đi ra  
2. **Gọi** phương thức Command Executor (hoặc CDP Bridge để chuyển cửa sổ) cho lệnh đi vào  
3. **Quản lý** vòng đời kết nối và trạng thái riêng của client  

Hiện có hai transport:

- **Web Transport** (`relay.ts`): Express phục vụ tĩnh + socket.io. Chuyển tiếp sự kiện trạng thái tới client trình duyệt, định tuyến lệnh socket.io tới executor.  
- **Telegram Transport** (`transports/telegram/`): bot grammy long polling. Ánh xạ trạng thái sang tin Telegram trong chủ đề forum, định tuyến callback bàn phím inline và tin nhắn văn bản tới executor. Đặc tả đầy đủ: `docs/telegram_prd.md`.

### 3.1 Luồng dữ liệu — Quan sát

1. Relay server poll DOM Cursor mỗi 500ms qua `Runtime.evaluate` (CDP)  
2. Hàm trích chạy trong renderer Cursor, duyệt phần tử `[data-flat-index]`  
3. Trả về object `CursorState` có cấu trúc (`ChatElement[]`, approvals, tab, mode, model)  
4. State Manager diff với trạng thái trước  
5. Chỉ các trường đổi được phát tới client qua socket.io `state:patch`  
6. Client mới kết nối nhận toàn bộ trạng thái qua `state:full`

### 3.2 Luồng dữ liệu — Lệnh

1. Client điện thoại phát sự kiện socket.io (ví dụ `command:approve`, `command:send_message`)  
2. Relay kiểm tra payload và chuyển tới Command Executor  
3. Executor dịch sang hành động CDP (`Input.insertText`, `Input.dispatchKeyEvent`, `Runtime.evaluate`)  
4. CDP thực thi trên DOM Cursor  
5. Chu kỳ quan sát tiếp theo bắt thay đổi trạng thái  
6. Relay phát trạng thái cập nhật tới mọi client

---

## 4. Mô hình trạng thái

### 4.1 CursorState (cấp cao nhất)

| Trường | Kiểu | Mô tả |
| ------------------ | ------------------ | -------------------------------------------- |
| `connected` | `boolean` | CDP đã kết nối Cursor |
| `agentStatus` | `AgentStatus` | Trạng thái tiêu đề bền (`idle`, `waiting_approval`, `error`, v.v.) |
| `agentActivityText` | `string \| null` | Nhãn hoạt động trực tiếp; `null` nghĩa là đã xóa rõ ràng trên wire |
| `agentActivityLive` | `boolean` | Chỉ true khi tín hiệu DOM hiện tại chứng minh đang có việc |
| `agentActivitySource` | union | Nguồn tín hiệu activity trực tiếp |
| `messages` | `ChatElement[]` | Phần tử chat có thứ tự (union có kiểu) |
| `pendingApprovals` | `Approval[]` | Tool đang chờ quyết định người dùng |
| `inputAvailable` | `boolean` | Ô chat có hiển thị/có thể focus |
| `chatTabs` | `ChatTab[]` | Tab composer đang mở |
| `mode` | `ModeInfo` | Mode agent hiện tại và danh sách có thể chọn |
| `model` | `ModelInfo` | Tên và ID model hiện tại |
| `windows` | `CursorWindow[]` | Mọi cửa sổ Cursor đã phát hiện |
| `activeWindowId` | `string` | ID cửa sổ đang kết nối |
| `composerQueue` | `ComposerQueueState` | Prompt xếp hàng trên thanh composer |
| `questionnaire` | `Questionnaire \| null` | Widget bảng câu hỏi trắc nghiệm |

### 4.2 AgentStatus

Một trong: `idle`, `thinking`, `generating`, `running_tool`, `waiting_approval`, `error`

### 4.3 ChatElement (union phân biệt theo `type`)

Mỗi phần tử chat là một trong tám kiểu, xác định bằng trường `type`:

#### HumanMessage (`type: 'human'`)

| Trường | Kiểu | Mô tả |
| ----------- | --------------------------------------- | ---------------------------------- |
| `id` | `string` | UUID tin nhắn từ DOM Cursor |
| `flatIndex` | `number` | Vị trí tuần tự trong chat |
| `text` | `string` | Nội dung văn bản thuần |
| `mentions` | `{ name: string; mentionType: string }[]` | @ mention (file, terminal, v.v.) |

#### AssistantMessage (`type: 'assistant'`)

| Trường | Kiểu | Mô tả |
| ------------ | --------------------------------------------------------- | ---------------------------------- |
| `id` | `string` | UUID tin nhắn |
| `flatIndex` | `number` | Vị trí tuần tự |
| `text` | `string` | Văn bản thuần |
| `html` | `string` | HTML `.markdown-root` đã làm sạch |
| `codeBlocks` | `CodeBlockItem[]` (xem §6.11) | Khối mã/diff có cấu trúc cho web/Telegram |

#### ToolCallElement (`type: 'tool'`)

| Trường | Kiểu | Mô tả |
| ------------- | -------- | ------------------------------------------------------ |
| `id` | `string` | UUID tin nhắn |
| `flatIndex` | `number` | Vị trí tuần tự |
| `toolCallId` | `string` | ID tool call của Cursor |
| `status` | `string` | `'loading'` hoặc `'completed'` |
| `action` | `string` | Tên hành động tool hoặc tóm tắt trạng thái |
| `details` | `string` | Mục tiêu (file, terminal, v.v.) |
| `filename` | `string?` | File đang sửa (từ thẻ edit) |
| `additions` | `number?` | Dòng thêm (thống kê edit) |
| `deletions` | `number?` | Dòng xóa (thống kê edit) |
| `summaryText` | `string?` | Tóm tắt gọn đầy đủ (fallback) |
| `diffBlock` | `CodeBlockItem?` | Diff/mã có cấu trúc cho tool edit/review |

#### ThoughtBlock (`type: 'thought'`)

| Trường | Kiểu | Mô tả |
| ----------- | -------- | ----------------------------- |
| `id` | `string` | ID sinh ra |
| `flatIndex` | `number` | Vị trí tuần tự |
| `duration` | `string` | ví dụ "4s" |

#### PlanBlock (`type: 'plan'`)

Đại diện cả tóm tắt plan legacy (`.plan-execution-message-content`) và widget plan đầy đủ (`.composer-create-plan-container`). Biến thể widget có thêm trường.

| Trường | Kiểu | Mô tả |
| ---------------- | -------------- | -------------------------------------------------------- |
| `id` | `string` | UUID tin nhắn |
| `flatIndex` | `number` | Vị trí tuần tự |
| `label` | `string` | Tên file plan hoặc nhãn (ví dụ "Build") |
| `title` | `string` | Tiêu đề plan |
| `todosCompleted` | `number` | Số todo đã xong |
| `todosTotal` | `number` | Tổng số todo |
| `description` | `string?` | Tổng quan/mô tả (chỉ widget) |
| `todos` | `PlanTodo[]?` | Từng todo kèm trạng thái (chỉ widget) |
| `model` | `string?` | Tên model hiển thị trong widget plan (chỉ widget) |
| `actions` | `PlanAction[]?` | Selector nút View Plan và Build (chỉ widget) |

#### PlanTodo (phụ của PlanBlock)

| Trường | Kiểu | Mô tả |
| -------- | -------- | -------------------------------------------------- |
| `text` | `string` | Nội dung todo |
| `status` | `string` | `'pending'`, `'completed'`, hoặc `'in_progress'` |

#### PlanAction (phụ của PlanBlock)

| Trường | Kiểu | Mô tả |
| -------------- | -------- | --------------------------------------- |
| `label` | `string` | Chữ nút ("View Plan", "Build") |
| `type` | `string` | `'view_plan'` hoặc `'build'` |
| `selectorPath` | `string` | Đường dẫn selector CSS để click qua CDP |

#### RunCommand (`type: 'run_command'`)

Lệnh terminal agent muốn chạy, hiển thị dạng thẻ tương tác với đầy đủ text lệnh và nút Run/Skip/Allow. Khác với tool call đã hoàn thành — đây là quyết định đang chờ.

| Trường | Kiểu | Mô tả |
| ------------- | -------------- | -------------------------------------------------------- |
| `id` | `string` | UUID tin nhắn |
| `flatIndex` | `number` | Vị trí tuần tự |
| `toolCallId` | `string` | ID tool call Cursor |
| `description` | `string` | Tiêu đề (ví dụ "Run outside sandbox:") |
| `candidates` | `string` | Tóm tắt lệnh (ví dụ "cd, source, npx, python3") |
| `command` | `string` | Toàn bộ text lệnh |
| `actions` | `RunAction[]` | Nút kèm selector |

#### RunAction (phụ của RunCommand)

| Trường | Kiểu | Mô tả |
| -------------- | -------- | ---------------------------------------------- |
| `label` | `string` | Chữ nút ("Run", "Skip", "Allow") |
| `type` | `string` | `'run'`, `'skip'`, hoặc `'allow'` |
| `selectorPath` | `string` | Đường dẫn CSS để click nút qua CDP |

#### LoadingIndicator (`type: 'loading'`)

| Trường | Kiểu | Mô tả |
| ----------- | -------- | ----------------------------- |
| `id` | `string` | ID sinh ra |
| `flatIndex` | `number` | Vị trí tuần tự |

### 4.4 ChatTab

| Trường | Kiểu | Mô tả |
| ------------- | --------- | ------------------------------------- |
| `composerId` | `string` | ID composer nội bộ Cursor |
| `title` | `string` | Tên hiển thị tab |
| `isActive` | `boolean` | Tab đang focus |
| `status` | `string` | Trạng thái tab (completed, running, v.v.) |
| `selectorPath`| `string` | Đường CSS để click chuyển tab |

### 4.5 ModeInfo

| Trường | Kiểu | Mô tả |
| ----------- | --------------------------------------------- | -------------------------- |
| `current` | `string` | Tên mode hiện tại |
| `available` | `{ id: string; label: string; icon: string }[]` | Các mode có thể chọn |

### 4.6 ModelInfo

| Trường | Kiểu | Mô tả |
| ----------- | -------- | ------------------------ |
| `current` | `string` | Tên hiển thị model hiện tại |
| `currentId` | `string` | Định danh model nội bộ |

### 4.7 CursorWindow

| Trường | Kiểu | Mô tả |
| ------- | -------- | ------------------------------------------ |
| `id` | `string` | ID target CDP |
| `title` | `string` | Tên project parse từ tiêu đề cửa sổ |
| `url` | `string` | URL target |

### 4.8 Approval

| Trường | Kiểu | Mô tả |
| ------------- | ------------------ | ---------------------------------------- |
| `id` | `string` | Định danh duy nhất |
| `description` | `string` | Nội dung cần phê duyệt |
| `actions` | `ApprovalAction[]` | Các nút khả dụng |

### 4.9 ApprovalAction

| Trường | Kiểu | Mô tả |
| -------------- | -------- | --------------------------------------------------- |
| `label` | `string` | Chữ nút ("Accept", "Reject", v.v.) |
| `type` | `string` | `'approve'`, `'reject'`, hoặc `'approve_all'` |
| `selectorPath` | `string` | Đường CSS để click nút qua CDP |

### 4.10 Questionnaire

Thanh công cụ bảng câu hỏi trắc nghiệm (`.composer-questionnaire-toolbar`). `null` khi không có bảng hỏi.

| Trường | Kiểu | Mô tả |
| --------------------- | ------------------------- | ---------------------------------------- |
| `questions` | `QuestionnaireQuestion[]` | Mọi câu hỏi |
| `activeIndex` | `number` | Chỉ số câu đang hoạt động (0-based) |
| `totalLabel` | `string` | Nhãn bước, ví dụ "1 of 3" |
| `skipSelectorPath` | `string` | Selector nút Skip |
| `continueSelectorPath`| `string` | Selector nút Continue |
| `continueDisabled` | `boolean` | Continue có bị vô hiệu không |

### 4.11 QuestionnaireQuestion

| Trường | Kiểu | Mô tả |
| ----------- | ------------------------- | ---------------------------------------------- |
| `number` | `string` | Số hiển thị ("1.", "2.", …) |
| `text` | `string` | Nội dung câu hỏi |
| `options` | `QuestionnaireOption[]` | Các lựa chọn |
| `isActive` | `boolean` | Có phải câu đang hoạt động không |

### 4.12 QuestionnaireOption

| Trường | Kiểu | Mô tả |
| -------------- | --------- | ------------------------------------------------- |
| `letter` | `string` | Chữ lựa chọn ("A", "B", …) |
| `label` | `string` | Nội dung lựa chọn |
| `isFreeform` | `boolean` | True cho lựa chọn nhập tự do "Other..." |
| `selectorPath` | `string` | Đường CSS để click lựa chọn qua CDP |

---

## 5. Giao thức — sự kiện socket.io

### 5.1 Server → Client

| Sự kiện | Payload | Khi nào |
| ------------------- | ------------------------ | ------------------------------------- |
| `state:full` | `CursorState` | Kết nối client lần đầu |
| `state:patch` | `Partial<CursorState>` | Bất kỳ trường trạng thái nào đổi |
| `connection:status` | `{ connected: boolean }` | CDP kết nối hoặc ngắt |
| `command:result` | `{ id, ok, error? }` | Sau khi lệnh thực thi hoặc thất bại |

### 5.2 Client → Server

| Sự kiện | Payload | Mô tả |
| ---------------------- | --------------------------------------------- | ------------------------------ |
| `command:send_message` | `{ commandId, text }` | Gõ và gửi prompt mới |
| `command:approve` | `{ commandId, approvalId, selectorPath }` | Bấm nút phê duyệt |
| `command:approve_all` | `{ commandId }` | Bấm "Accept All" |
| `command:reject` | `{ commandId, approvalId, selectorPath }` | Bấm nút từ chối |
| `command:switch_tab` | `{ commandId, tabTitle }` | Chuyển tab chat khác |
| `command:new_chat` | `{ commandId }` | Tạo tab chat mới |
| `command:set_mode` | `{ commandId, modeId }` | Đổi mode agent |
| `command:set_model` | `{ commandId, modelId }` | Đổi model |
| `command:switch_window`| `{ commandId, windowId }` | Chuyển cửa sổ Cursor khác |
| `command:click_action` | `{ commandId, selectorPath }` | Click nút hành động theo selector (Run, Skip, Allow, Build, View Plan) |

Mọi lệnh client có `commandId` (UUID), được trả lại trong `command:result` để khớp.

---

## 6. Đặc tả UI/UX

### 6.1 Bố cục

Mobile-first, một cột, tối giống Cursor. Năm vùng cố định:

1. **Header** (dính trên): Chỉ báo kết nối + trạng thái agent  
2. **Thanh cửa sổ** (dưới header): Chọn cửa sổ theo project (ẩn khi chỉ 1 cửa sổ)  
3. **Thanh tab** (dưới thanh cửa sổ): Chọn tab chat trong cửa sổ đang hoạt động (ẩn khi ≤ 1 tab)  
4. **Tin nhắn** (giữa cuộn): Phần tử chat render theo kiểu  
5. **Footer** (dính dưới): Thanh phê duyệt (có điều kiện) + pill mode/model + ô nhập tin  

### 6.2 Phần tử chat

Mỗi kiểu `ChatElement` render khác biệt:

- **Tin human:** Bong bóng căn phải, văn bản thuần và huy hiệu mention  
- **Tin assistant:** Bong bóng căn trái với HTML đã làm sạch từ markdown renderer Cursor (chỉ prose: đậm, danh sách, code inline, link). Gốc composer/Shiki được gỡ khỏi `html` để trang không phụ thuộc CSS theme VS Code. **Mã và diff** render từ `codeBlocks` (`CodeBlockItem`: `blockKind` `code` hoặc `diff`, tùy chọn `filename`/`language`, text `code`, và với diff thì `diffLines` với `add`/`rem`/`ctx`/`meta`/`hunk`). Các khối nối sau bong bóng prose. Mỗi khối có thanh công cụ (tên file hoặc ngôn ngữ nếu biết + điều khiển **toàn màn hình**). Phần thân nằm trong **`.code-block-viewport`**: tối đa ~**7 dòng** cao, **cuộn** khi tràn; toàn màn hình mở modal (vùng an toàn trên mobile, nền hoặc Escape đóng, nút đóng lớn).  
- **Tool call:** Một dòng gọn với icon trạng thái, tên hành động, chi tiết mục tiêu, tùy chọn tên file với +/- thống kê (xanh/đỏ). **Tool edit/review** có thể có **`diffBlock`**: cùng dạng `CodeBlockItem` như khối mã assistant, render dưới tóm tắt trong **`.tool-diff-host`** cùng viewport, cuộn và toàn màn hình.  
- **Thought:** Một dòng chữ mờ: "Thought for Xs"  
- **Plan:** Thẻ giàu với tiêu đề, mô tả, danh sách todo cuộn kèm chấm trạng thái màu, thanh tiến độ, nút Build/View Plan, modal plan đầy đủ và picker model phạm vi plan trên web. Xem §6.9.  
- **Run command:** Thẻ lệnh với tiêu đề mô tả, text lệnh monospace, nút Run/Skip/Allow. Xem §6.10.  
- **Loading:** Ba chấm animation  

### 6.3 Thanh phê duyệt

- Xuất hiện giữa tin nhắn và ô nhập khi `pendingApprovals.length > 0`  
- Hai nút lớn: Phê duyệt (xanh) và Từ chối (đỏ)  
- Chiều cao nút tối thiểu 48px để bấm mobile tin cậy  
- Biến mất khi không còn phê duyệy  

### 6.4 Ô nhập tin

- Vùng text full width với nút gửi tròn  
- Enter gửi (Shift+Enter xuống dòng trên desktop)  
- Văn bản gửi qua `Input.insertText` + `Input.dispatchKeyEvent` cho Enter  

### 6.5 Bộ chọn cửa sổ

- Hiển thị mọi cửa sổ Cursor đã phát hiện (target CDP page có `workbench` trong URL)  
- Tiêu đề cửa sổ là tên project trích từ tiêu đề (bỏ tiền tố tên file và hậu tố ` - Cursor`)  
- Cửa sổ đang hoạt động được tô sáng, bấm để chuyển (ngắt hiện tại, kết nối target mới)  
- Ẩn khi chỉ một cửa sổ Cursor  
- Danh sách cửa sổ làm mới mỗi 10 giây  

### 6.6 Thanh tab chat

- Hiển thị mọi tab mở trích từ phần tử `.agent-sidebar-cell`  
- Tab đang hoạt động được tô sáng, bấm để chuyển bằng khớp tiêu đề  
- Ẩn khi 1 hoặc ít hơn tab  

### 6.7 Chỉ báo trạng thái

- **Chấm kết nối:** Xanh (kết nối), vàng (đang kết nối lại), đỏ (mất kết nối)  
- **Trạng thái agent:** Nhãn văn bản mô tả hoạt động (Idle, Thinking, Running tool, Needs approval, Error)  

### 6.8 Thiết kế hình ảnh

- Chủ đề tối khớp màu Cursor thực (`#181818` nền, `rgba(228,228,228,0.92)` chữ)  
- Biến CSS tùy chỉnh cho mọi màu  
- Font monospace cho mã/mô tả tool, sans-serif cho chat  
- Không framework CSS bên ngoài  

### 6.9 Widget plan

Thẻ tương tác giàu mirror UI plan Cursor. Render khi `PlanBlock` có mảng `todos` (biến thể widget).

**Bố cục:**
- **Header:** Tên file plan (mờ, nhỏ) + tiêu đề (đậm)  
- **Mô tả:** Văn tổng quan dưới tiêu đề (nếu có)  
- **Danh sách todo:** Danh sách cuộn (max-height ~200px), mỗi mục có: chấm trạng thái xanh (completed), xanh dương (in_progress), xám (pending); text todo; chỉ báo "N more" nếu widget ẩn mục  
- **Thanh tiến độ:** Track + phần đầy + nhãn "N/M"  
- **Hàng nút:** "View Plan" (trái) + tên model / picker (giữa) + "Build" (phải)  

**Hành vi:**
- "Build" phát `command:click_action` với `selectorPath` nút Build  
- "View Plan" mở modal web; khi có file plan đã lưu, modal tải toàn bộ nội dung plan và todo từ đĩa để khớp view Telegram  
- Bấm pill model mở picker phía web lấy tùy chọn từ menu model plan hiện tại của Cursor, rồi áp dụng lựa chọn về Cursor  
- Thẻ cập nhật tại chỗ khi trạng thái todo đổi trong lúc thực thi plan  

### 6.10 Widget Run command

Thẻ phê duyệt lệnh tương tác khi agent muốn chạy lệnh shell.

**Bố cục:**
- **Header:** Mô tả (ví dụ "Run outside sandbox:") + tóm tắt lệnh ở chữ mờ  
- **Khối lệnh:** Toàn bộ text lệnh font monospace, nền tối, cuộn ngang khi dài. Tiền tố ký tự `$`.  
- **Hàng nút:** "Skip" (trái) + "Run" (phải). Nút "Allow" khi cần quyền sandbox.  

**Hành vi:**
- "Run" / "Skip" / "Allow" đều phát `command:click_action` với `selectorPath` tương ứng  

### 6.11 Khối mã/diff gốc (`codeBlocks`, `diffBlock`, UX web)

**Mô hình dữ liệu** (`src/server/types.ts` — `CodeBlockItem`):

- `blockKind`: `'code'` | `'diff'`  
- `filename`, `language` (tùy chọn)  
- `code`: text phẳng giữ xuống dòng thật cho khối thuần (fallback theo dòng, không phải `textContent` thô)  
- `diffLines` (khi `blockKind === 'diff'`): `{ kind: 'add'|'rem'|'ctx'|'meta'|'hunk'; text: string }[]` — loại đến từ decoration dòng Monaco trong extractor, không parse HTML mirror.  

**Assistant:** `html` chỉ **innerHTML `.markdown-root`** (prose). Extractor xây **`codeBlocks`** từ `composer-code-block-container` / `composer-message-codeblock` / đường liên quan mà không gộp HTML widget composer vào `html`.  

**Tool (edit/review):** Khi có khối composer khớp, **`diffBlock`** mang cùng cấu trúc; client web render trong **`.tool-diff-host`**.  

**Patch thuần không có diff Monaco:** Nếu Cursor phát text patch/unified diff trong khối code thường, extractor nâng lên `blockKind: 'diff'` để renderer gốc vẫn tô dòng đỏ/xanh thay vì khối code phẳng.  

**Client web** (`src/client/app.js`, `src/client/styles.css`): `createNativeBlockFromItem` — thanh công cụ + **`.code-block-viewport`** (max ~7 dòng qua `--cb-font`, `--cb-lh`, `--cb-lines`) + `.code-block-diff-plain`. Toàn màn hình: **`.code-block-fs-overlay`**. Mobile: vùng chạm tối thiểu 44×48px; `-webkit-overflow-scrolling: touch`; `overscroll-behavior: contain`.  

**Telegram:** `formatter.ts` ánh xạ sang `<pre><code>` dùng `codeBlocks` / tiền tố dòng diff (không mirror Monaco).  

**Hạn chế:** Nếu Cursor chưa vẽ dòng editor (widget thu gọn), `codeBlocks` / `diffBlock` có thể rỗng đến lần poll sau.  

---

## 7. Chiến lược trích DOM

### 7.1 Thách thức

Cursor là ứng dụng Electron dựa trên VS Code. DOM dùng class sinh đổi theo phiên bản. Không có API công khai cho trạng thái chat.

### 7.2 Cách tiếp cận — Trích theo thuộc tính data

DOM chat Cursor dùng thuộc tính `data-*` ổn định:

- `data-flat-index="N"` — chỉ số tuần tự trên wrapper tin nhắn  
- `data-message-role="human|ai"` — tác giả  
- `data-message-kind="human|assistant|tool"` — loại tin  
- `data-message-id="UUID"` — định danh tin ổn định  
- `data-tool-call-id="ID"` — ID tool call  
- `data-tool-status="loading|completed"` — trạng thái thực thi tool  
- `data-compact="true"` — tóm tắt tool thu gọn  

Hàm trích chọn mọi `[data-flat-index]` trong container chat, phân loại theo `data-message-role` + `data-message-kind`, trích nội dung theo kiểu:

| Kiểu | Chỉ báo DOM | Nội dung trích |
| ----------- | ----------------------------------------------------- | ----------------------------------------------------- |
| human | `role=human`, `kind=human` | Text `.aislash-editor-input-readonly`, phần tử `.mention` |
| assistant | `role=ai`, `kind=assistant` | innerHTML + textContent `.markdown-root`; `codeBlocks` từ widget mã composer |
| tool | `role=ai`, `kind=tool` | `data-tool-call-id`, `data-tool-status`, `.ui-tool-call-line-action/details`, thống kê edit |
| plan | `role=ai`, `kind=tool` + `.composer-create-plan-container` | Tên file plan, tiêu đề, mô tả, todo kèm trạng thái, selector Build/View Plan, model |
| plan (legacy) | `.plan-execution-message-content` | Nhãn, tiêu đề, số đếm todo |
| run_command | `role=ai`, `kind=tool` + `.composer-terminal-tool-call-block-container` | Mô tả, candidates, full text lệnh, selector Run/Skip/Allow |
| thought | `.ui-collapsible.ui-step-group-collapsible` | Thời lượng từ span header |
| loading | `.loading-indicator-v3` | Chỉ hiện diện |

Phần tử ngoài hệ data-attribute (container chat, input, nút phê duyệy/từ chối, trạng thái, tab, mode/model) dùng selector CSS từ `selectors.json` với chiến lược cascade.

### 7.3 Công cụ Discovery

CLI (`src/discovery/discover-dom.ts`, `npm run discover`) kết nối Cursor qua CDP: liệt kê target CDP, dump cây DOM tóm tắt cửa sổ chính, tìm phần tử khớp pattern chat/agent, gợi ý selector cho `selectors.json`.

### 7.4 Poll và diff

- Extractor chạy mỗi `POLL_INTERVAL_MS` (mặc định 500ms)  
- Debounce `DEBOUNCE_MS` (mặc định 300ms) tránh bão phát khi stream  
- State Manager so sánh sâu (JSON.stringify) từng trường top-level  
- Chỉ trường đổi nằm trong sự kiện `state:patch`  

---

## 8. Cấu hình

Mọi cấu hình qua biến môi trường với mặc định hợp lý:

**Lõi:**

| Biến | Mặc định | Mô tả |
| ------------------ | -------------------------- | ---------------------------------------- |
| `CDP_URL` | `http://127.0.0.1:9222` | Endpoint CDP Cursor |
| `SERVER_PORT` | `3000` | Cổng web client + socket.io |
| `SERVER_HOST` | `0.0.0.0` | Địa chỉ bind (0.0.0.0 cho LAN) |
| `POLL_INTERVAL_MS` | `500` | Tần suất poll DOM (ms) |
| `DEBOUNCE_MS` | `300` | Khoảng phát tối thiểu (ms) |
| `SELECTORS_PATH` | `./selectors.json` | Đường dẫn cấu hình selector DOM |
| `LOG_LEVEL` | `info` | Độ chi tiết log (debug/info/warn/error) |

**Transport Telegram:**

| Biến | Mặc định | Mô tả |
| ------------------------ | -------- | ------------------------------------------------ |
| `TELEGRAM_ENABLED` | `false` | Bật/tắt transport Telegram |
| `TELEGRAM_BOT_TOKEN` | — | Token từ @BotFather (bắt buộc nếu bật) |
| `TELEGRAM_ALLOWED_USERS` | — | Tùy chọn: cố định ID user được phép (ghi đè auth token) |

---

## 9. Yêu cầu kỹ thuật

### 9.1 Server

- Node.js 20+  
- TypeScript chế độ strict  
- CDP client nhẹ (`ws`) — **không** Puppeteer (Electron chặn)  
- `express` phục vụ HTTP tĩnh  
- `socket.io` WebSocket với tự kết nối lại và fallback transport  
- `grammy` Telegram Bot API (Bot API 9.5, chủ đề forum, bàn phím inline)  
- `node-html-parser` chuyển HTML Cursor phức tạp sang HTML an toàn cho Telegram  
- `tsx` phát triển (hot-reload qua `tsx watch`)  

### 9.2 Client

- HTML/CSS/JS thuần (không framework, không bước build)  
- Client socket.io tự phục vụ từ server  
- Trình duyệt mobile hiện đại (Safari iOS 15+, Chrome Android 90+)  
- Không phụ thuộc CDN bên ngoài  

### 9.3 Môi trường host

- Cursor IDE trên Windows với `--remote-debugging-port=9222`  
- Relay server trên WSL2 (cùng máy)  
- Điện thoại trên cùng mạng LAN với máy Windows host  

---

## 10. Quyết định kỹ thuật chính

### 10.1 CDP client tùy chỉnh so với Puppeteer

**Quyết định:** Client CDP nhẹ dùng `ws` trực tiếp.  
**Lý do:** Electron/Cursor chặn `Target.getBrowserContexts` mà Puppeteer cần. Client kết nối trực tiếp WebSocket URL của target trang, bỏ qua API cấp trình duyệt.

### 10.2 Miền CDP Input cho nhập văn bản

**Quyết định:** Dùng `Input.insertText` và `Input.dispatchKeyEvent` để gõ.  
**Lý do:** Cursor dùng ProseMirror/TipTap cho composer. Thao tác DOM (`execCommand`, `element.value=`) bỏ qua mô hình trạng thái nội bộ ProseMirror. Miền Input của CDP đi qua pipeline nhập native Chromium mà ProseMirror xử lý đúng.

### 10.3 Trích theo data-attribute so với selector theo class

**Quyết định:** Dùng `data-flat-index`, `data-message-role`, `data-message-kind` cho trích tin nhắn.  
**Lý do:** Tên class sinh và đổi giữa phiên bản Cursor. Thuộc tính data mang ngữ nghĩa và ổn định hơn — phản ánh mô hình dữ liệu nội bộ Cursor.

---

## 11. Trạng thái triển khai

| Tính năng | Trạng thái | Ghi chú |
| --------------------------- | ----------- | --------------------------------------------- |
| Kết nối + khám phá CDP | Done | Client CDP tùy chỉnh, tự phát hiện target |
| Đa cửa sổ | Done | Khám phá mọi target workbench, UI chọn cửa sổ, lệnh switchWindow |
| Trích DOM (tin nhắn) | Done | ChatElement có kiểu qua thuộc tính data |
| Trích DOM (tab/mode) | Done | Tab `.agent-sidebar-cell` + mode/model từ dropdown |
| Quản lý trạng thái + diff | Done | Diff JSON, phát có debounce, cửa sổ theo dõi tách DOM |
| Gửi tin nhắn | Done | Input.insertText + Enter qua CDP |
| Nút phê duyệt | Done | Khớp văn bản + click theo selector |
| Chuyển tab chat | Done | Khớp tiêu đề trên `.agent-sidebar-cell` qua JS `.click()` |
| Chuyển mode | Done | JS `.click()` trigger + mục menu |
| Chuyển model | Done | JS `.click()` + xác minh menu đóng |
| Menu model mobile | Done | Toggle MAX, danh mục, huy hiệu |
| Web client mobile | Done | Render theo kiểu, chủ đề tối khớp Cursor |
| Tự kết nối lại | Done | Cả CDP và socket.io |
| Thông báo trình duyệt | Done | Phê duyệy chờ, run command, hành động tool |
| Trích widget plan | Done | `.composer-create-plan-container` → PlanBlock có todo, actions |
| Render plan web | Done | Thẻ giàu, todo, nút Build/View Plan |
| Trích run command | Done | `.composer-terminal-tool-call-block-container` → RunCommand |
| Render run command web | Done | Thẻ lệnh monospace, Run/Skip/Allow |
| Mã/diff gốc (web) | Done | `codeBlocks` / `diffBlock` → viewport ~7 dòng + modal toàn màn hình |
| Trừu tượng transport | Done | Interface Transport, SendQueue, MessageTracker, WindowMonitor |
| Transport Telegram | Done | grammy, auto-sync, auth /register, CDP song song, inline keyboard |
| Tài liệu setup | Partial | Cần hướng dẫn cho người mới |

---

## 12. Rủi ro & Giảm thiểu

| Rủi ro | Tác động | Khả năng | Giảm thiểu |
| ---- | ------ | ---------- | ---------- |
| Cấu trúc DOM Cursor đổi giữa phiên bản | Trích hỏng | Cao | Trích data-attribute + selector bên ngoài + công cụ discovery |
| Stream token gây bão phát | CPU/băng thông cao | Cao | Debounce phát, gửi diff không phải toàn trạng thái |
| Mạng WSL2 chặn điện thoại | Client không kết nối | Trung bình | Tài liệu mirrored mode và chuyển tiếp cổng |
| ProseMirror từ chối nhập lập trình | Gửi tin thất bại | Thấp | Miền Input CDP qua pipeline Chromium native |
| Cursor đổi layout nút phê duyệt | Phê duyệt hỏng | Cao | Fallback khớp văn bản + discovery tái ánh xạ |
| Nhiều cửa sổ dùng một cổng CDP | Lệnh gửi sai cửa sổ | Thấp | UI chọn cửa sổ, chuyển cửa sổ rõ ràng, làm mới danh sách |
| ID phần tử có dấu chấm hoặc hai chấm | Đường selector CSS hỏng | Trung bình | Escape ký tự đặc biệt trong `buildSelectorPath` |
| Giới hạn tốc độ sửa tin Telegram | Cập nhật rơi hoặc trễ | Thấp | Poll 500ms + debounce 300ms ≈ ~1 lần sửa/giây, trong giới hạn ~30/giây của Telegram |
| Giới hạn 4096 ký tự tin Telegram | Tin assistant dài bị cắt | Trung bình | Chia nhiều tin, theo dõi mọi message_id theo phần tử |
| Giới hạn 64 byte callback_data | Không mã hóa hết selector | Cao | Bản đồ băm selector trong callback data |
| DOM widget plan đổi | Trích plan hỏng | Trung bình | Phát hiện `.composer-create-plan-container`, fallback legacy |
| Biến thể widget run command | Thiếu nút hoặc sai phân loại | Trung bình | Phát hiện container terminal, trích mọi nút theo pattern class |
| Trạng thái cửa sổ/tab không active lỗi thời trên Telegram | Chủ đề hiển thị cũ | Cao | Ghi nhận hạn chế; tự chuyển khi người dùng tương tác; chế độ quét nền tương lai |

---

## 13. Lộ trình tương lai

- **Transport Discord:** Tái sử dụng interface Transport cho bot Discord (thread như chủ đề)  
- **Quét nền đa cửa sổ:** Luân phiên cửa sổ không active để cập nhật mọi chủ đề Telegram  
- **Xác thực:** Middleware auth token trên HTTP và socket.io  
- **UX mã web:** Sao chép clipboard tùy chọn, chiều cao xem trước tùy chỉnh (mặc định ~7 dòng)  
- **Quy tắc tự phê duyệt:** Ví dụ "tự phê duyệt thao tác đọc"  
- **PWA:** Service worker + manifest "Thêm vào màn hình chính"  
- **Push:** Web Push khi trình duyệt đóng  
- **Danh sách model động:** Trích model khả dụng từ DOM thay vì hardcode  

---

## 14. Tiêu chí thành công

Hệ thống được coi là thành công khi:

**Web client:**
1. Relay kết nối Cursor đang chạy qua CDP  
2. Web client trên điện thoại hiển thị hội thoại agent với định dạng đúng  
3. Mỗi kiểu phần tử chat render riêng (human, assistant, tool, thought, widget plan, run command)  
4. Widget plan hiển thị đủ todo kèm trạng thái, nút Build/View Plan hoạt động  
5. Widget run command hiển thị đủ text lệnh, nút Run/Skip/Allow hoạt động  
6. Bấm Phê duyệt/Từ chối trên điện thoại kích hoạt hành động trong Cursor  
7. Gõ và gửi tin từ điện thoại xuất hiện trong composer Cursor và submit  
8. Tab chat, mode, model có thể chuyển từ điện thoại  
9. Hệ thống tự phục hồi sau mất kết nối tạm thời  
10. Độ trễ từ hành động tới phản ánh trên UI dưới 2 giây  

**Transport Telegram:**
11. Bot kết nối, người dùng đăng ký `/register <token>`, `/sync` bật auto-sync vào nhóm forum  
12. Chủ đề tự tạo cho cửa sổ và tab mới khi bật sync. Mọi cửa sổ giám sát qua CDP song song (không chuyển UI)  
13. Hội thoại cửa sổ+tab đang active stream vào chủ đề Telegram tương ứng với định dạng đúng (5 tin cuối khi sync lần đầu)  
14. `/history [N]` gửi N tin cuối (mặc định 30) vào chủ đề với tốc độ có giới hạn  
15. Mỗi kiểu ChatElement render đúng định dạng Telegram (HTML, khối mã, bàn phím inline)  
16. Nút inline phê duyệt (Accept/Reject/Accept All) kích hoạt đúng hành động trong Cursor  
17. Thẻ run command hiển thị lệnh và nút Run/Skip/Allow inline  
18. Widget plan hiển thị todo và nút Build/View Plan inline  
19. Gõ trong chủ đề gửi tin tới agent Cursor ánh xạ (tự chuyển cửa sổ/tab)  
20. `/mode` và `/model` hiển thị trạng thái hiện tại và cho phép chuyển qua bàn phím inline  
21. Bot hiển thị chỉ báo typing khi agent đang hoạt động  
22. Mọi lệnh API ra ngoài có giới hạn tốc độ qua SendQueue (~300ms gửi, 100ms sửa trong transport Telegram) + plugin auto-retry  
23. Auth token (`/register`) với tùy chọn ghi đè `TELEGRAM_ALLOWED_USERS`. Dữ liệu bền trong thư mục `data/`.  
