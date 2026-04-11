# Truy cập an toàn với Tailscale

> **Người dùng extension:** Mở Setup Panel (`CursorRemote: Open Setup Panel`) và chọn **Địa chỉ cụ thể (Tailscale / tùy chỉnh)** trong phần Mạng. Nhập IP Tailscale, bấm **Save & Restart**, xong. Hướng dẫn dưới đây là cấu hình thủ công đầy đủ.

Tailscale tạo VPN mesh riêng giữa các thiết bị. Thay vì lộ cổng 3000 ra LAN (hoặc internet), bạn truy cập web app qua IP Tailscale chỉ thiết bị của bạn tới được. Không cần chuyển tiếp cổng, quy tắc firewall hay cấu hình DNS.

## Vì sao dùng Tailscale

- **Không lộ ra ngoài** — relay server không bao giờ truy cập được từ internet công cộng
- **Hoạt động qua mạng khác nhau** — truy cập từ điện thoại 4G, laptop quán cà phê, v.v.
- **Không chuyển tiếp cổng** — đặc biệt hữu ích với WSL2 khi lộ LAN phức tạp
- **Mã hóa đầu cuối** — WireGuard bên dưới
- **Gói miễn phí** — tới 100 thiết bị trên gói cá nhân

## 1. Cài Tailscale trên máy chạy server

Cài trên máy (hoặc instance WSL2) nơi relay chạy.

### Linux / WSL2

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Làm theo URL xác thực in trong terminal để đăng nhập.

### macOS

```bash
brew install tailscale
sudo tailscale up
```

### Windows 11

```bash
winget install tailscale
tailscale up
```

Hoặc tải từ [tailscale.com/download](https://tailscale.com/download) và đăng nhập.

Hoặc cài bản Microsoft Store.

### Xác minh

```bash
tailscale ip -4
# in dạng 100.64.1.23
```

## 2. Cài Tailscale trên điện thoại

- **iOS**: [App Store](https://apps.apple.com/app/tailscale/id1470499037)
- **Android**: [Play Store](https://play.google.com/store/apps/details?id=com.tailscale.ipn)

Đăng nhập cùng tài khoản. Cả hai thiết bị hiển thị trong console quản trị Tailscale.

## 3. Truy cập web app

Mở `http://<tailscale-ip>:3000` trên điện thoại, `<tailscale-ip>` là IP Tailscale của máy server (bước 1), ví dụ `http://100.64.1.23:3000`.

Nếu bật MagicDNS, có thể dùng tên máy:

```
http://my-desktop:3000
```

## 4. Khóa chỉ Tailscale

Mặc định server bind `127.0.0.1` (localhost). Để giới hạn chỉ Tailscale:

- **Extension:** Setup Panel > Mạng > chọn "Địa chỉ cụ thể (Tailscale / tùy chỉnh)" > nhập IP Tailscale > Save & Restart. Hoặc đặt `cursorRemote.serverHost` trực tiếp trong Settings.
- **Standalone:** Đặt `SERVER_HOST` trong `.env`:

```bash
# .env
SERVER_HOST=100.64.1.23   # IP Tailscale của bạn
```

Server chỉ lắng trên interface Tailscale. Kết nối LAN và internet khác bị từ chối ở tầng OS.

## 5. Tailscale + mật khẩu (phòng thủ nhiều lớp)

Để an toàn hơn, kết hợp Tailscale với mật khẩu webapp:

- **Extension:** Mật khẩu tự sinh lần đầu cài. Xem hoặc đổi trong Setup Panel hoặc Settings (`cursorRemote.webappPassword`).
- **Standalone:** Đặt cả hai trong `.env`:

```bash
# .env
SERVER_HOST=100.64.1.23
WEBAPP_PASSWORD=my-secret-password
```

Ngay cả khi ai đó vào mạng Tailscale của bạn, vẫn cần mật khẩu.

## 6. Tailscale Funnel (truy cập công khai tạm thời)

Khi cần chia sẻ tạm mà không bắt bên kia cài Tailscale:

```bash
tailscale funnel 3000
```

Tạo URL HTTPS công khai (ví dụ `https://my-desktop.tail1234.ts.net:443`). Dừng bằng Ctrl+C khi xong. Kết hợp `WEBAPP_PASSWORD` để chặn truy cập trái phép qua funnel.

## Xử lý sự cố

### Điện thoại báo "Connection refused"

- Hai thiết bị cùng tài khoản Tailscale?
- `tailscale status` hiển thị cả hai đã kết nối?
- Server chạy với `SERVER_HOST` đúng?

### Riêng WSL2

- Cài Tailscale **trong** WSL2, không phải trên Windows host (trừ khi dùng mirrored networking)
- Nếu dùng mirrored networking, có thể cài Tailscale trên Windows và vẫn dùng được cho WSL2

### MagicDNS không resolve

- Bật MagicDNS trong console quản trị Tailscale (cài đặt DNS)
- Một số điện thoại cần khởi động lại app Tailscale sau khi bật
