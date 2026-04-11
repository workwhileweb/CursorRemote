# Module Transport Telegram — Tài liệu yêu cầu sản phẩm

## 1. Tổng quan

Module transport Telegram nối CursorRemote với supergroup Telegram có chủ đề diễn đàn. Mỗi chủ đề ánh xạ một cặp project + tab chat, cung cấp giao diện bền và thân thiện mobile để theo dõi và điều khiển agent Cursor. Module đăng ký cùng sự kiện `StateManager` như web client và định tuyến lệnh qua cùng `CommandExecutor`, nên là **transport song song** chứ không phải hệ thống riêng.

### 1.1 Vấn đề

Web client cần trình duyệt và chỉ hoạt động khi tab mở. Telegram luôn bật, có push native, hoạt động mọi thiết bị không cần thiết lập phức tạp. Developer vốn đã dùng Telegram — đưa hội thoại agent vào đó giảm ma sát.

### 1.2 Mục tiêu

- Stream hội thoại agent Cursor vào chủ đề forum Telegram với định dạng đúng  
- Nút bàn phím inline cho phê duyệt, hành động plan và thực thi lệnh  
- Lệnh bot để đổi mode/model, kiểm tra trạng thái và quản lý chủ đề  
- Nhận văn bản từ Telegram và chuyển tới agent Cursor  
- Hiển thị chỉ báo typing khi agent đang hoạt động  
- Đăng ký bằng token (`/register <token>`) với tùy chọn ghi đè danh sách user cố định  
- Tự tạo chủ đề cho tab chat mới không cần lệnh thủ công  

### 1.3 Không nằm trong phạm vi

- Chế độ webhook (chỉ long polling — không cần endpoint công khai)  
- Trích media/ảnh từ Cursor  
- Inline mode Telegram hoặc chat riêng (chỉ nhóm)  

---

## 2. User story

### TG-1: Theo dõi theo chủ đề
**Là** developer dùng Telegram, **tôi muốn** mỗi project Cursor + tab chat có chủ đề forum riêng trong nhóm Telegram, **để** hội thoại được tổ chức và tôi theo từng agent.

### TG-2: Stream chat trực tiếp
**Là** developer, **tôi muốn** hội thoại agent đang hoạt động stream vào chủ đề Telegram theo thời gian thực — tin assistant, tóm tắt tool, widget plan và lệnh chạy, **để** theo dõi tiến độ agent từ Telegram.

### TG-3: Phê duyệt qua nút inline
**Là** developer, **tôi muốn** thấy phê duyệy chờ dưới dạng tin Telegram với nút [Accept] [Reject] [Accept All], **để** phê duyệt hoặc từ chối tool không rời Telegram.

### TG-4: Phê duyệt lệnh chạy
**Là** developer, **tôi muốn** thấy đầy đủ lệnh shell kèm mô tả và text lệnh, và bấm [Run] [Skip] hoặc [Allow], **để** quyết định thực thi lệnh có căn cứ.

### TG-5: Tương tác widget plan
**Là** developer, **tôi muốn** thấy tiêu đề plan, mô tả và đủ danh sách todo kèm trạng thái, và bấm [Build] hoặc [View Plan], **để** xem xét và thực thi plan từ Telegram.

### TG-6: Gửi tin nhắn
**Là** developer, **tôi muốn** gõ trong chủ đề Telegram và gửi như prompt tới agent Cursor ánh xạ, **để** điều khiển agent từ Telegram.

### TG-7: Bảng câu hỏi qua nút inline
**Là** developer, **tôi muốn** thấy câu hỏi trắc nghiệm dưới dạng tin Telegram với nút từng lựa chọn cùng Skip và Continue, **để** trả lời không rời Telegram.

### TG-8: Chuyển mode và model
**Là** developer, **tôi muốn** chạy `/mode` và `/model` hiển thị trạng thái hiện tại và bàn phím inline để chuyển, **để** chỉnh hành vi agent từ Telegram.

### TG-9: Tự động đồng bộ
**Là** developer, **tôi muốn** chạy `/sync` một lần để bật auto-sync, sau đó tab chat mới tự có chủ đề, **để** không phải quản lý chủ đề thủ công.

### TG-10: Kiểm tra trạng thái
**Là** developer, **tôi muốn** chạy `/status` xem trạng thái kết nối, agent, cửa sổ và tab đang hoạt động, **để** biết hệ thống có khỏe không.

### TG-11: Chỉ báo typing
**Là** developer, **tôi muốn** thấy chỉ báo typing của bot khi agent đang suy nghĩ, sinh nội dung hoặc chạy tool, **để** biết agent còn hoạt động mà không cần đọc nội dung tin nhắn.

---

## 3. Đặc tả định dạng tin nhắn

Mọi tin dùng parse mode HTML của Telegram. Hỗ trợ: `<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a href="">`, `<blockquote>`, `<tg-spoiler>`.

### 3.1 Tin human

```html
<b>You:</b> the user's prompt text
<i>@file.ts @terminal</i>
```

Mention được nối dạng chữ nghiêng nếu có.

### 3.2 Tin assistant

HTML của Cursor được chuyển sang HTML an toàn cho Telegram bằng cách duyệt cây DOM với `node-html-parser` (không dùng regex). Bộ chuyển xử lý cấu trúc HTML lồng phức tạp của Cursor:

- `<strong>` / `<b>` → `<b>`  
- `<em>` / `<i>` → `<i>`  
- `<span class="font-semibold">` / `data-streamdown="strong"` → `<b>` (Cursor dùng đậm theo class)  
- `<h1>`–`<h6>` → `<b>heading text</b>` với ranh giới xuống dòng  
- `<p>` → nội dung với ngắt đoạn  
- `<code>` → `<code>` (giữ nguyên)  
- `<pre>` có ngôn ngữ → `<pre><code class="language-X">`  
- `<div class="composer-message-codeblock">` / `composer-code-block-container` (widget mã composer + diff) → `<pre><code>` dùng **`codeBlocks`** có cấu trúc (`CodeBlockItem`: `code` thuần hoặc dòng diff với tiền tố `+`/`-`) hoặc khi cần duyệt `.ui-default-code__line-content` / Monaco `.view-line`  
- `<table>` với `<th>`/`<td>` → hàng phân tách bằng `|` với header đậm  
- `<a href>` → `<a href>`  
- `<blockquote>` → `<blockquote>`  
- `<ul>` → dòng có tiền tố `•`, `<ol>` → dòng đánh số (gỡ `<p>` lồng)  
- Phần tử không phải nội dung (nút, thanh cuộn, lớp copy) → bỏ qua  
- Nút văn bản chỉ khoảng trắng → bỏ qua (tránh thụt lề HTML nguồn lọt ra)  

Tin vượt 4096 ký tự được chia tại ranh đoạn đoạn hoặc khối mã. Mỗi phần gửi một tin Telegram riêng. Mọi `message_id` được theo dõi cho phần tử.

Tin assistant được **sửa tại chỗ** khi nội dung stream (chu kỳ cập nhật ~800ms).

### 3.3 Tool call

```
✓ Read src/server/types.ts
```
hoặc
```
● Edit relay.ts  (+15 -3)
```

Icon trạng thái: `✓` hoàn thành, `●` đang tải. Thống kê file hiển thị khi có. Nhiều tool call liên tiếp có thể gộp một tin.

### 3.4 Khối thought

```html
<i>💭 Thought for 4s</i>
```

### 3.5 Widget plan

```html
<b>📋 Telegram Integration Module</b>
<i>telegram_integration_module.plan.md</i>

Design and implement a Telegram bot transport...

<b>To-dos (3/10):</b>
✅ Write docs/telegram_prd.md
✅ Write docs/telegram_architecture.md
🔵 Add PlanWidget and RunCommand types
⚪ Update web client
⚪ Create Transport interface
<i>... 5 more</i>

Model: Opus 4.6
```

Bàn phím inline: `[▶ Build] [📄 View Plan]`

"View Plan" gửi mô tả plan như một tin riêng trong chủ đề.

### 3.6 Run command

```html
<b>🖥 Run outside sandbox:</b> cd, source, npx, python3

<pre>$ cd /home/user/project && npx convex run ...</pre>
```

Bàn phím inline: `[▶ Run] [⏭ Skip]` (và `[🔓 Allow]` khi có)

### 3.7 Chỉ báo loading

Trong khi còn chỉ báo loading, bot gửi `sendChatAction('typing')` mỗi 4 giây. Không gửi tin riêng cho chính chỉ báo loading.

### 3.8 Phê duyệy (từ `pendingApprovals`)

```
⚠️ Approval needed: Accept
```

Bàn phím inline: `[✅ Accept] [❌ Reject] [✅ Accept All]`

Nút sinh từ `approval.actions`. Chỉ các hành động hiển thị mới có nút.

### 3.9 Widget danh sách todo độc lập

```html
<b>📝 To-dos (4/10):</b>
✅ BC: Disable Search Partners, keep Display ON
✅ CRM: Disable Display Network
🔵 CRM: Add negative keywords
⚪ CRM: Mark 26 unreviewed search queries
⚪ Update adjustments logs for both campaigns
```

Widget danh sách todo độc lập (`.todo-list-container`) được trích tách khỏi widget plan. Icon trạng thái: `✅` xong, `🔵` đang làm, `⚪` chờ. Không có bàn phím inline — danh sách chỉ mang tính thông tin.

### 3.10 Chỉ báo activity tạm

Khi agent bận, transport có thể hiển thị **dòng trạng thái ngắn** trong chủ đề (hợp đồng activity chung: `agentActivityText` + `agentActivityLive`), tách khỏi tin chat đồng bộ:

- **Định dạng:** Dòng nghiêng `● {label}…` qua `formatActivity()` trong `formatter.ts`. **Không** dùng `<tg-spoiler>` (spoiler dành cho dòng **thought** đang chạy khi cố ý ẩn chi tiết).  
- **Vòng đời:** Gửi khi text activity xuất hiện lần đầu; **sửa** khi nhãn đổi; **xóa** khi activity hết hoặc stale. Theo dõi `message_id` theo thread forum (`activityMsgIds`, lưu `data/telegram-activity.json` để dọn dẹp).  
- **Typing:** Độc lập, `sendChatAction('typing')` làm mới theo chu kỳ khi `agentActivityLive` true (và trạng thái là mode đang hoạt động), nên chỉ nhãn trạng thái cũ không thể giữ typing mãi.  
- **Khử trùng với thought:** Nếu các `ChatElement` gần đây đã có thought **`step_summary`** đang chạy mà tiêu đề khớp nhãn activity (dòng định dạng `📎`), bot **không** gửi dòng activity tạm và **xóa** mọi tin activity hiện có cho chủ đề đó. Tránh hai dòng song song (ví dụ cả hai “Exploring…”) với spoiler thừa. Triển khai bởi `activityRedundantWithInProgressStepSummary()` dùng `thoughtAppearsInProgress()` export.  

Hàng activity stale cũng bị gỡ theo timer nếu timestamp không cập nhật (`AGENT_ACTIVITY_STALE_MS` trong `activity-stale.ts`, dùng chung Telegram và `StateManager` cho header web).

### 3.11 Bảng câu hỏi (từ `state.questionnaire`)

```
❓ Questions (1 of 3)

1. What is your favorite season?
```

Bàn phím inline: `[A) Spring] [B) Summer] [C) Autumn]` (một nút mỗi lựa chọn) cùng `[⏭ Skip] [▶ Continue]` ở hàng hai.

Tin gửi khi `questionnaire` lần đầu khác null, sửa khi câu đang hoạt động đổi, xóa khi `questionnaire` thành null. Chỉ các lựa chọn của câu đang hoạt động hiển thị nút.

Tiền tố callback: `qan:<hash>` cho lựa chọn trả lời, `qsk:<hash>` cho Skip, `qco:<hash>` cho Continue.

---

## 4. Tham chiếu lệnh

Bot dùng xác thực token. Lần đầu khởi động sinh token đăng ký và in ra console server. Người dùng chạy `/register <token>` để xác thực. Tùy chọn `TELEGRAM_ALLOWED_USERS` trong `.env` cố định ID user được phép (ghi đè auth token).

| Lệnh | Tham số | Hành vi |
|---------|-----------|----------|
| `/register` | `<token>` | Đăng ký bằng token từ console server. Lưu username và ID. |
| `/sync` | — | Bật auto-sync cho nhóm forum này. Tạo chủ đề cho tab đang hoạt động với 5 tin cuối. Tab mới tự tạo chủ đề. |
| `/sync_all` | — | Tạo chủ đề cho MỌI tab mọi cửa sổ (không chỉ tab đang hoạt động). Cần `/sync` trước. |
| `/unsync` | — | Tắt sync, xóa chủ đề theo dõi, xóa toàn bộ state. |
| `/cleanup` | — | Xóa chủ đề không theo dõi/cũ, giữ chủ đề đang sync. |
| `/purge` | — | Xóa MỌI chủ đề forum (reset mạnh, chạy nền). |
| `/status` | — | Trạng thái sync, group ID, kết nối, agent, mode, model |
| `/history` | `[count]` | Gửi N tin cuối (mặc định 30) của hội thoại đang hoạt động. |
| `/mode` | — | Hiển thị mode hiện tại kèm bàn phím inline (Agent/Ask/Plan/Debug) |
| `/model` | — | Hiển thị model hiện tại kèm bàn phím inline |
| `/plan` | `<text>` | Chuyển Plan mode và gửi text làm prompt |
| `/agent` | `<text>` | Chuyển Agent mode và gửi text làm prompt |

Văn bản thường gửi trong chủ đề được chuyển như tin tới agent Cursor ánh xạ chủ đề đó.

---

## 5. Ánh xạ chủ đề

### 5.1 Cấu trúc

Nhóm Telegram là supergroup bật chủ đề diễn đàn. Mỗi chủ đề đại diện một cặp `window + chat tab`.

Định dạng tên chủ đề: `{project} — {tab title}`

Ví dụ:
- `cursor-ide-remote — Fix message sending`
- `adwords-agent — Setup CI pipeline`

### 5.2 Lưu trữ trong bộ nhớ

`Map<string, TopicMapping>` với key `{windowTitle}::{tabTitle}`:

```typescript
interface TopicMapping {
  threadId: number;       // ID thread chủ đề forum Telegram
  windowId: string;       // ID target cửa sổ CDP
  windowTitle: string;    // Tên project
  tabTitle: string;       // Tiêu đề tab chat
  lastActive: number;     // Timestamp cập nhật cuối
}
```

### 5.3 Vòng đời chủ đề

1. Người dùng chạy `/sync` trong nhóm forum → bot kiểm tra (supergroup, forum, quyền admin)  
2. Bot đặt group ID và bật auto-sync (lưu `data/telegram-sync.json`)  
3. Với mỗi cặp window+tab đã phát hiện, tạo chủ đề nếu chưa có  
4. Từ đó WindowMonitor phát hiện tab mới trong chu kỳ 10s và tự tạo chủ đề  
5. Ánh xạ lưu `data/telegram-topics.json` kèm mốc cao cho thao tác purge  

### 5.4 Phân giải chủ đề đang hoạt động

Khi bot nhận tin trong một chủ đề:

1. Tra `threadId` trong ánh xạ để lấy `windowTitle` + `tabTitle`  
2. Tìm cửa sổ theo tiêu đề (không phân biệt hoa thường) trong danh sách cửa sổ hiện tại, làm mới nếu cần  
3. Nếu cửa sổ không phải đang active, chuyển kết nối CDP chính sang cửa sổ đó  
4. Nếu tab không phải đang active, gọi `commandExecutor.switchTab(tabTitle)`  
5. Gửi tin qua `commandExecutor.sendMessage(text)`  

---

## 6. Kiểm soát truy cập

**Auth token (mặc định):**

- Lần đầu khởi động sinh token đăng ký 32 ký tự và lưu `data/telegram-auth.json`  
- Token in ra console server mỗi lần khởi động  
- Người dùng chạy `/register <token>` để xác thực. Lưu username và tên.  
- Người đã đăng ký bền qua restart  

**Ghi đè cố định (tùy chọn):**

- Đặt `TELEGRAM_ALLOWED_USERS=123456789,987654321` trong `.env`  
- Khi đặt, **ghi đè** auth token — chỉ các ID được liệt kê được phép  
- Xóa biến để quay lại auth token  

**Chung:**

- Middleware bot kiểm `ctx.from?.id` với tập đã đăng ký cho mọi cập nhật (trừ `/register`)  
- User không được phép bị bỏ qua im lặng  
- Bot phải là admin nhóm với privacy mode OFF để nhận mọi tin  

---

## 7. Giới hạn tốc độ và ràng buộc

### 7.1 Giới hạn API Telegram

| Ràng buộc | Giới hạn | Cách dùng của chúng ta |
|-----------|-------|-----------|
| Tốc độ gửi tin (mỗi chat) | ~20/phút | Hàng đợi giãn cách ~300ms giữa các lần gửi (ghi đè transport). An toàn. |
| Tốc độ sửa tin (mỗi tin) | ~30/giây | Hàng đợi sửa giãn 100ms. An toàn. |
| Độ dài văn bản tin | 4096 ký tự | Chia tin dài tại ranh đoạn đoạn |
| Độ dài `callback_data` | 64 byte | Dùng bản đồ băm cho đường dẫn selector |
| `sendChatAction` | Hết hạn sau 5s | Gửi lại mỗi 4 giây khi agent còn hoạt động |
| `createForumTopic` | ~20/phút | Giãn cách 1.5s giữa mỗi lần tạo |

### 7.2 Triển khai giới hạn tốc độ

Ba lớp bảo vệ:

1. **Plugin auto-retry grammy** (`@grammyjs/auto-retry`): Bắt 429, đợi `retry_after`, thử lại tới 3 lần (trễ tối đa 60s).  
2. **SendQueue:** Mọi `sendMessage` và `editMessageText` ra ngoài được serialize qua hàng đợi với **~300ms** giữa các lần gửi và **100ms** giữa các lần sửa (constructor `TelegramTransport`; xem `send-queue.ts`). Ưu tiên sửa trước gửi. Hành động typing không qua hàng đợi. Lỗi parse HTML kích hoạt fallback plain text tự động.  
3. **Giãn tạo chủ đề:** Lệnh `createForumTopic` trong `/sync` và tự tạo cách nhau 500ms.  

### 7.3 Giới hạn sync lần đầu

Khi thread được bot thấy lần đầu (ví dụ sau restart hoặc `/sync` đầu tiên), chỉ 5 tin cuối được gửi. Tin cũ hơn đánh dấu "seen" trong tracker để không gửi lại. Dùng `/history [N]` để lấy thêm (mặc định 30, cuộn chat để tải tin cũ hơn).

### 7.4 Gộp tin tool

Nhiều tool call đến trong cùng chu kỳ poll có thể gộp một tin Telegram để giảm nhiễu. Tin gộp được sửa nếu có thêm tool call ở chu kỳ sau.

---

## 8. Trường hợp biên

### 8.1 Không tìm thấy cửa sổ/tab

Nếu người dùng gửi tin trong chủ đề mà cửa sổ hoặc tab không còn (đóng cửa sổ, xóa tab):

- Bot trả lỗi: "Window not found" kèm danh sách cửa sổ đang mở.  
- Mục ánh xạ stale được đánh dấu nhưng không xóa (cửa sổ có thể mở lại).  

### 8.2 Nhiều người dùng hoạt động

Nhiều user được phép có thể tương tác đồng thời. Lệnh xử lý tuần tự (hàng đợi tích hợp grammy). Bấm phê duyệt idempotent — bấm sau khi người khác đã phê duyệt không có tác dụng (nút Cursor biến mất).

### 8.3 Khởi động lại bot

Sau restart, bot không có trạng thái theo dõi tin. Bắt đầu mới:

- Chủ đề hiện có được khám phá lại bằng liệt kê chủ đề forum và khớp tên  
- Tin mới được gửi (không sửa tin cũ)  
- File ánh xạ (nếu bật) khôi phục liên kết chủ đề ↔ window+tab  

### 8.4 Chia tin dài

Khi tin assistant vượt 4096 ký tự:

1. Chia tại `\n\n` cuối cùng trước giới hạn, hoặc tại `\n` cuối, hoặc cứng 4096  
2. Gửi mỗi phần một tin riêng  
3. Theo dõi mọi `message_id` cho phần tử để sửa đúng phần  

### 8.5 Tràn `callback_data`

Telegram giới hạn `callback_data` 64 byte. Đường dẫn selector có thể hàng trăm ký tự. Giải pháp:

- Sinh hash ngắn (8 ký tự) của đường dẫn selector  
- Lưu đường dẫn đầy đủ trong `Map<string, string>` (hash → selectorPath)  
- Định dạng callback: `{action}:{elementId_short}:{hash}` (vừa 64 byte)  
- Hành động questionnaire dùng định dạng ngắn: `{action}:{hash}` (ví dụ `qan:<hash>`, `qsk:<hash>`, `qco:<hash>`)  
- Bản đồ dọn khi phê duyệt/hành động liên quan không còn trong state  

---

## 9. Cấu hình

| Biến | Mặc định | Mô tả |
|----------|---------|-------------|
| `TELEGRAM_ENABLED` | `false` | Bật/tắt transport Telegram |
| `TELEGRAM_BOT_TOKEN` | — | Bot token từ @BotFather (bắt buộc nếu bật) |
| `TELEGRAM_ALLOWED_USERS` | — | Tùy chọn: cố định ID user được phép (ghi đè /register) |

---

## 10. Tiêu chí thành công

Transport Telegram được coi là thành công khi:

1. Bot khởi động, in token đăng ký, kết nối long polling  
2. `/register <token>` xác thực user; `TELEGRAM_ALLOWED_USERS` ghi đè auth token khi đặt  
3. `/sync` kiểm tra nhóm (supergroup, forum, quyền admin) và bật auto-sync  
4. Chủ đề tự tạo cho cửa sổ/tab mới qua giám sát CDP song song (không chuyển UI)  
5. Mọi cửa sổ được giám sát đồng thời; tin stream vào đúng chủ đề  
6. Mỗi kiểu ChatElement render đúng (human, assistant, tool, thought, plan, run_command)  
7. Tin assistant sửa tại chỗ khi stream; lỗi HTML fallback plain text  
8. Phê duyệy chờ hiển thị bàn phím inline kích hoạt đúng hành động  
9. Thẻ run command hiển thị lệnh và nút [Run]/[Skip]/[Allow]  
10. Widget plan hiển thị todo và nút [Build]/[View Plan]  
11. Văn bản trong chủ đề chuyển tới agent Cursor ánh xạ (tự chuyển cửa sổ/tab)  
12. `/history [N]` gửi N tin cuối (mặc định 30) với tốc độ có giới hạn  
13. `/mode` và `/model` hiển thị trạng thái và cho phép chuyển  
14. Chỉ báo typing khi agent hoạt động  
15. `/unsync` tắt sync sạch và xóa chủ đề theo dõi; `/purge` xóa mọi chủ đề  
16. Toàn bộ state bền trong thư mục `data/`; sống qua restart  
