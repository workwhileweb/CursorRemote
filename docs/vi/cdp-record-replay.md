# Công cụ ghi / phát lại CDP

Công cụ độc lập để ghi trạng thái Cursor IDE theo thời gian và phát lại vào chủ đề test Telegram. Dùng để debug pipeline transport Telegram mà không cần chạy toàn bộ relay.

## Mục đích

Giao diện agent Cursor có animation — phần tử xuất hiện, shimmer, chuyển trạng thái, thay thế. Relay phải dịch các chuyển động này thành lệnh Telegram API đúng (gửi, sửa, xóa). Lỗi ở bước dịch khó tái hiện vì phụ thuộc chuỗi trạng thái DOM cụ thể trong phiên agent thật.

Công cụ giải quyết bằng cách:

1. **Ghi** phiên live thành chuỗi snapshot `CursorState`
2. **Phát** bản ghi vào chủ đề test Telegram, xem chính xác relay sẽ gửi gì
3. **Lặp** chỉnh formatter/transport và phát lại cùng bản ghi để xác minh sửa lỗi

## Kiến trúc

```
Ghi:  CDP -> extractionFunction -> CursorState -> file JSONL
Phát: file JSONL -> formatter -> chủ đề test Telegram + log stdout
```

Cả hai script là tiến trình độc lập. Import code dùng chung từ `src/` như thư viện, không sửa file nguồn relay. Relay có thể chạy song song không xung đột.

## Điều kiện

- Cursor IDE chạy với `--remote-debugging-port=9222`
- File `.env` có `TELEGRAM_BOT_TOKEN` (cho phát)
- Supergroup Telegram bật forum topics

## Ghi

### Lệnh

```bash
npm run record                            # ghi cửa sổ Cursor đầu tiên
npm run record -- --window cursor-ide     # khớp cửa sổ theo chuỗi trong tiêu đề
```

### Hoạt động

1. Kết nối CDP tại `http://127.0.0.1:9222` (ghi đè bằng biến `CDP_URL`)
2. Khám phá mọi cửa sổ Cursor, kết nối cửa sổ khớp
3. Chạy cùng `extractionFunction` như relay, mỗi 300ms
4. Ghi snapshot vào `data/recording-<timestamp>.jsonl`
5. Khử trùng lặp: chỉ ghi khi trạng thái thực sự đổi (file nhỏ hơn)
6. In tiến độ trên stdout

### Định dạng output

Mỗi dòng là một object JSON:

```json
{"ts":1711234567890,"state":{"connected":true,"agentStatus":"generating","agentActivityText":"Planning next moves","messages":[...],...}}
```

- `ts` — mili giây epoch khi chụp snapshot
- `state` — object `CursorState` đầy đủ (hoặc `null` nếu trích xuất thất bại)

### Gợi ý

- Ghi khi agent đang làm việc tích cực để có chuyển trạng thái thú vị
- Bản ghi thường 10–200 KB vài phút hoạt động
- Ctrl+C để dừng ghi gọn

## Phát lại

### Lệnh

```bash
npm run replay -- <recording.jsonl> --thread <topic_id> [--chat <group_id>] [--speed N]
```

### Tham số

| Tham số | Bắt buộc | Mô tả |
|----------|----------|-------------|
| `<file>` | Có | Đường dẫn file `.jsonl` |
| `--thread` | Có | `message_thread_id` chủ đề diễn đàn Telegram |
| `--chat` | Không | ID nhóm Telegram (mặc định: env `TELEGRAM_CHAT_ID`) |
| `--speed` | Không | Hệ số tốc độ phát (mặc định: 5) |

### Hoạt động

1. Đọc mọi snapshot từ bản ghi
2. Với mỗi chuyển trạng thái, theo nhịp đã ghi (nhân với `--speed`):
   - **Chỉ báo hoạt động**: gửi, sửa hoặc xóa tin activity tạm (từ `_rawSignals` qua `deriveActivityFromSignals` nếu có, không thì `agentActivityText`). Relay thật `TelegramTransport` còn **khử trùng** activity với thought step-summary `📎` đang bay (`activityRedundantWithInProgressStepSummary`); script phát **chưa** phản ánh hết khử trùng đó — bản ghi vẫn có thể hiện cả hai dòng nếu thứ tự snapshot trùng edge case.
   - **Tin nội dung**: gửi phần tử chat mới, sửa khi nội dung đổi (`formatElement`; tin tool có thể có trường phát triển như `diffBlock` / `codeBlocks` nếu có trong bản ghi)
3. Log mọi lệnh API Telegram ra stdout

### Ví dụ output

```
[replay] Loaded 47 snapshots from data/recording-2026-03-24T00-24-00.jsonl
[replay] Speed: 10x, thread: 12345, chat: -1001234567890

[replay] Bot: @cursor_controller_bot

[+0.1s] SEND  activity "Planning next moves" -> msgId=100
[+0.4s] SEND  human "fix the bug in config.ts" -> msgId=101
[+0.8s] EDIT  activity msgId=100 "Generating"
[+1.2s] DELETE activity msgId=100
[+1.3s] SEND  tool "Edit config.ts  +14 -7" -> msgId=102
[+1.5s] SEND  assistant "I've fixed the configuration issue..." -> msgId=103
[+2.0s] EDIT  tool msgId=102 "Edit config.ts  +14 -7"

[replay] Done -- 4 content messages, 47 snapshots replayed
```

### Tìm thread ID

Để lấy `message_thread_id` của chủ đề forum:

1. Chuyển tiếp bất kỳ tin nào trong chủ đề tới [@RawDataBot](https://t.me/RawDataBot)
2. Tìm `message_thread_id` trong phản hồi
3. Hoặc xem URL chủ đề — trong `https://t.me/c/1234567890/42`, thread ID là `42`

### Tìm chat ID

ID nhóm (số âm như `-1001234567890`):

1. Chuyển tiếp tin từ nhóm tới [@RawDataBot](https://t.me/RawDataBot)
2. Tìm `chat.id` trong phản hồi
3. Hoặc đặt `TELEGRAM_CHAT_ID` trong `.env`

## Quy trình

### Debug một lỗi cụ thể

```bash
# 1. Bắt đầu ghi khi tái hiện lỗi
npm run record -- --window cursor-ide

# 2. Thao tác trong Cursor gây lỗi
#    (ví dụ bắt đầu tác vụ agent, đợi chỉ báo hoạt động)

# 3. Dừng ghi (Ctrl+C)

# 4. Tạo chủ đề test trong nhóm Telegram

# 5. Phát để xem relay sẽ gửi gì
npm run replay -- data/recording-2026-03-24T00-24-00.jsonl --thread 99999 --speed 5

# 6. Kiểm tra chủ đề test trên Telegram — có ổn không?

# 7. Sửa code, phát lại cùng bản ghi, so sánh
npm run replay -- data/recording-2026-03-24T00-24-00.jsonl --thread 99999 --speed 5
```

### Kiểm thử hồi quy

Giữ bản ghi các kịch bản đã biết trong repo (hoặc thư mục chia sẻ). Sau khi sửa formatter hoặc transport, phát lại và xác minh output không hồi quy.

## Biến môi trường

| Biến | Dùng cho | Mặc định | Mô tả |
|----------|---------|---------|-------------|
| `CDP_URL` | ghi | `http://127.0.0.1:9222` | Endpoint Chrome DevTools Protocol |
| `TELEGRAM_BOT_TOKEN` | phát | -- | Bot token (bắt buộc) |
| `TELEGRAM_CHAT_ID` | phát | -- | ID nhóm mặc định |
| `SELECTORS_PATH` | ghi | `./selectors.json` | File selector tùy chỉnh |
