# Checklist kiểm thử trước khi phát hành

Chạy các bước kiểm thử thủ công sau khi test tự động pass và trước khi publish bản phát hành.

## Môi trường

- [ ] Cài VSIX đã đóng gói trên máy hoặc profile sạch (không phải bản checkout đang dev)
- [ ] Xác nhận server khởi động và in `=== CursorRemote vX.Y.Z ===` đúng phiên bản

## Web App

- [ ] Web app tải trên trình duyệt — không lỗi console cho `io`, `vendor-socket.io.min.js`
- [ ] Favicon tải (không 404)
- [ ] Đăng nhập / phiên bền hoạt động (reload vẫn giữ phiên)
- [ ] Chấm trạng thái kết nối hiển thị "Connected" khi Cursor đang hoạt động
- [ ] Trạng thái agent hiển thị shimmer khi có hoạt động, trở lại "Idle" khi xong
- [ ] Tin nhắn render đúng kiểu (human, assistant, tool, thought)
- [ ] Thẻ lệnh chạy hiển thị text lệnh, nút Skip/Run
- [ ] Sau khi phê duyệt, nút phê duyệt biến mất và kết quả tool xuất hiện
- [ ] Widget plan hiển thị tiêu đề, tiến độ, "View Plan" mở modal đầy đủ kế hoạch
- [ ] Chọn model cho plan mở sheet với các tùy chọn model
- [ ] Khối code giữ xuống dòng, diff hiển thị màu đỏ/xanh
- [ ] Cuộn lên thì tắt auto-scroll; tin mới không tự kéo xuống

## Telegram

- [ ] Hoạt động trực tiếp hiển thị shimmer (thẻ spoiler) — ví dụ `● Thinking…` có spoiler
- [ ] Shimmer biến mất khi hoạt động kết thúc (tin nhắn bị xóa)
- [ ] Tóm tắt bước thought hiển thị spoiler khi đang chạy, gỡ khi hoàn thành
- [ ] Dòng activity không trùng lặp với step-summary khớp
- [ ] Lệnh chạy hiển thị text lệnh với nút Skip/Run inline
- [ ] Khối plan render với todo và nút View Plan / Build

## Trường hợp biên

- [ ] Chuyển giữa nhiều cửa sổ Cursor hiển thị đúng trạng thái từng cửa sổ
- [ ] Đưa Cursor xuống nền (macOS) suy giảm êm — không crash, trạng thái stale
- [ ] Chuyển tab nhanh không gây tin nhắn trùng
