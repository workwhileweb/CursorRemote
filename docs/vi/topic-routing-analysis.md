# Định tuyến chủ đề — Phân tích sâu & kế hoạch giải pháp

## Tóm tắt vấn đề

Chủ đề được tạo sai cặp (cửa sổ, tab):
- `cursor-ide-remote — Campaign results improvement plan` (đáng lẽ là adwords)
- `adwords-optimization-agent — VNC setup on Ubuntu machine` (đáng lẽ là .openclaw)

## Bằng chứng từ telegram-topics.json

```
adwords (C25284...) — "Campaign results improvement plan" ✓ đúng
adwords (C25284...) — "VNC setup on Ubuntu machine"       ✗ sai (thuộc .openclaw)
cursor-ide-remote (EAF88...) — "Campaign results improvement plan" ✗ sai (thuộc adwords)
```

Cùng tiêu đề tab xuất hiện dưới sai cửa sổ.

## Phân tích nguyên nhân gốc

### 1. Kiến trúc "Agent Unification" của Cursor

Khi `body.agent-unification-enabled`, thanh bên hiển thị **mọi project** trong một view:
- `.agent-sidebar-project-cell` cho mỗi project (adwords, cursor-ide-remote, .openclaw, v.v.)
- `.agent-sidebar-cell` (tab chat) lồng trong từng project

Khi kết nối tới cửa sổ X qua CDP, ta nhận DOM của cửa sổ đó. Nhưng DOM có thể hiển thị **sidebar thống nhất** với mọi project.

### 2. Logic phạm vi hiện tại (mong manh)

Phạm vi theo `containerComposerId`:
1. Lấy composer-id từ container chat (tin nhắn)
2. Tìm tab có composer-id khớp
3. Lấy ô cha `.agent-sidebar-project-cell` của tab đó
4. Chỉ trả về tab nằm trong ô project đó

**Cách hỏng:**
- `containerComposerId` rỗng → scopeRoot = null → dùng `document` → lấy **mọi** tab mọi project
- Không có cell khớp (composer-id tab vs container lệch) → fallback tương tự
- Không tìm thấy `.agent-sidebar-project-cell` (cấu trúc DOM đổi) → dùng `document.body` → phạm vi sai

### 3. Tiêu đề cửa sổ vs DOM

Tiêu đề CDP (ví dụ `cursor-ide-remote [WSL: ubuntu-24.04]`) là **nguồn đáng tin** cho project đang mở. DOM có thể hiển thị nhiều project. Phải giới hạn tab bằng cách khớp **tiêu đề cửa sổ** với nhãn ô project trong DOM.

## Kế hoạch giải pháp

### Phương án A: Truyền tiêu đề cửa sổ vào bước trích xuất (Khuyến nghị)

1. **Thêm tham số `windowTitle`** cho `extractionFunction`
2. **Người gọi**: WindowMonitor truyền `win.title` khi poll; extractor DOM chính lấy từ `cdpBridge.windows` + `activeTargetId`
3. **Logic phạm vi**: Tìm `.agent-sidebar-project-cell` có nhãn/text chứa hoặc khớp `windowTitle` (chuẩn hóa). Chỉ trả về tab trong ô đó.
4. **Fallback**: Nếu không khớp ô project, trả về **chatTabs rỗng** — không dùng tab không có phạm vi.

### Phương án B: Từ chối tab không có phạm vi

1. Khi `scopeRoot` là null (không phạm vi theo composer-id), trả `chatTabs: []`
2. Tránh tạo chủ đề sai khi phạm vi thất bại
3. Có thể gây "không đồng bộ" vài cửa sổ cho đến khi sửa phạm vi

### Phương án C: Dùng tên workspace từ DOM

1. Đọc `.agent-sidebar-workspace-name` hoặc `.auxiliary-bar-workspace-name`
2. Dùng để tìm ô project khớp
3. Không cần truyền tiêu đề cửa sổ từ bên ngoài

## Triển khai khuyến nghị

**Kết hợp A + B:**
1. Truyền `windowTitle` vào trích xuất (từ snapshot/cửa sổ khi poll)
2. Phạm vi chính: tìm ô project khớp tiêu đề cửa sổ
3. Fallback: thử phạm vi theo composer-id
4. Nếu cả hai thất bại: trả `chatTabs` rỗng (an toàn)

## File cần sửa

- `dom-extractor.ts`: Thêm tham số windowTitle, khớp ô project theo tiêu đề, chatTabs rỗng khi thất bại
- `window-monitor.ts`: Truyền `win.title` vào `extractFromClient`
- `dom-extractor.ts` (lớp DOMExtractor): Truyền tiêu đề cửa sổ từ trạng thái bridge khi poll
- `index.ts` hoặc phần cấu hình extractor: Nối tiêu đề cửa sổ vào vòng poll chính
