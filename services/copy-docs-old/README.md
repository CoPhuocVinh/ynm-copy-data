# Copy Docs Old Service

Dịch vụ này chịu trách nhiệm sao chép tài liệu cũ từ cơ sở dữ liệu này sang cơ sở dữ liệu khác sử dụng RabbitMQ cho hàng đợi tin nhắn.

## Tính năng

- Tiêu thụ tin nhắn từ hàng đợi RabbitMQ có tên `vinhcp_test`
- Sử dụng loại hàng đợi quorum cho tính sẵn sàng cao
- Xử lý các yêu cầu sao chép tài liệu

## Yêu cầu

- Node.js (v14 trở lên)
- Yarn hoặc npm
- RabbitMQ server

## Cài đặt

```bash
# Cài đặt dependencies
yarn install
```

## Cấu hình

Cấu hình được lưu trữ trong file `env.yaml`:

```yaml
app:
  name: copy-docs-old
  port: 3003

rabbitmq:
  host: '192.168.1.12'
  port: 5673
  username: 'nguyennp'
  password: 'nguyennpNguyenNP3579'
  vhost: /
  heartbeat: 60
  frameMax: 0

queue:
  docs:
    name: vinhcp_test
    durable: true
    autoDelete: false
    type: quorum
```

## Sử dụng

### Khởi động dịch vụ

```bash
# Khởi động dịch vụ
yarn dev
```

## Cấu trúc thư mục

```
copy-docs-old/
├── package.json         # Quản lý dependencies và scripts
├── tsconfig.json        # Cấu hình TypeScript
├── env.yaml             # Cấu hình ứng dụng
└── src/
    ├── main.ts          # Điểm vào ứng dụng
    ├── app.module.ts    # Module chính
    ├── consumer/        # Xử lý nhận tin nhắn
    │   └── consumer.service.ts
    └── producer/        # Xử lý gửi tin nhắn
        └── producer.service.ts
```

## Phát triển

```bash
# Build dự án
yarn build

# Format code
yarn format

# Lint code
yarn lint
```

## License

This project is proprietary and confidential. 