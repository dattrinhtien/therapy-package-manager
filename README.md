# Quản Lý Gói Trị Liệu (Therapy Package Manager)

Ứng dụng web quản lý bệnh nhân, dịch vụ trị liệu, gói trị liệu (5 ngày / 10 ngày), lịch hẹn, thanh toán và báo cáo cho phòng trị liệu / y học cổ truyền.

## Công nghệ sử dụng

- **Framework:** Next.js 15 (App Router)
- **Ngôn ngữ:** TypeScript
- **UI:** Tailwind CSS + shadcn/ui
- **Icons:** Lucide React
- **Biểu đồ:** Recharts
- **Backend/Auth/DB:** Supabase (Auth + PostgreSQL + RLS)
- **Deploy:** Vercel

## Tính năng chính

- 🔐 Đăng ký / Đăng nhập / Đăng xuất (Supabase Auth)
- 👥 Quản lý bệnh nhân (CRUD + tìm kiếm)
- 🩺 Quản lý dịch vụ trị liệu
- 📦 Quản lý gói trị liệu (5/10 ngày, tùy chỉnh)
- 📅 Quản lý lịch hẹn (đánh dấu đã đến / không đến)
- 💳 Quản lý thanh toán & công nợ
- 📊 Báo cáo biểu đồ (doanh thu, bệnh nhân, dịch vụ)
- 🔒 Row Level Security (mỗi user chỉ thấy data của mình)
- 📱 Responsive trên desktop, tablet, mobile

## Cài đặt Local

### 1. Clone repository

```bash
git clone <your-repo-url>
cd therapy-package-manager
```

### 2. Cài dependencies

```bash
npm install
```

### 3. Tạo Supabase Project

1. Truy cập [https://supabase.com](https://supabase.com) và tạo tài khoản.
2. Tạo project mới (chọn region gần nhất, VD: Singapore).
3. Đợi project khởi tạo xong.

### 4. Chạy Schema SQL

1. Trong Supabase Dashboard, vào **SQL Editor**.
2. Tạo query mới.
3. Copy toàn bộ nội dung file `supabase/schema.sql` và paste vào.
4. Nhấn **Run** để tạo bảng, index, RLS policies.

### 5. Cấu hình Supabase Auth

1. Trong Supabase Dashboard → **Authentication** → **Providers**.
2. Đảm bảo **Email** provider đã được bật.
3. (Tùy chọn) Tắt **Confirm email** trong **Authentication** → **Settings** nếu muốn test nhanh mà không cần xác nhận email.

### 6. Lấy API Keys

1. Vào **Settings** → **API** trong Supabase Dashboard.
2. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 7. Tạo file .env.local

```bash
cp .env.local.example .env.local
```

Mở `.env.local` và điền giá trị:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 8. Chạy ứng dụng

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000) trong trình duyệt.

## Kết nối GitHub

```bash
git init
git add .
git commit -m "Initial commit: Therapy Package Manager MVP"
git branch -M main
git remote add origin https://github.com/your-username/therapy-package-manager.git
git push -u origin main
```

## Deploy lên Vercel

### 1. Import project

1. Truy cập [https://vercel.com](https://vercel.com).
2. Nhấn **Add New** → **Project**.
3. Import repository từ GitHub.

### 2. Cấu hình Environment Variables

Trong Vercel project settings → **Environment Variables**, thêm:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `your-anon-key` |

### 3. Deploy

Nhấn **Deploy**. Vercel sẽ tự build và deploy.

### 4. Cập nhật Supabase Redirect URL

Sau khi deploy, vào Supabase Dashboard → **Authentication** → **URL Configuration**:
- Thêm domain Vercel (VD: `https://your-app.vercel.app`) vào **Site URL** và **Redirect URLs**.

## Checklist kiểm thử

- [ ] Đăng ký tài khoản
- [ ] Đăng nhập
- [ ] Vào Dashboard
- [ ] Thêm bệnh nhân mới
- [ ] Thêm dịch vụ mới
- [ ] Tạo gói trị liệu 5 ngày
- [ ] Tạo gói trị liệu 10 ngày
- [ ] Tạo lịch hẹn
- [ ] Đánh dấu "Đã đến" → kiểm tra số buổi tăng
- [ ] Ghi nhận thanh toán một phần → kiểm tra còn nợ
- [ ] Ghi nhận thanh toán đủ → kiểm tra hết nợ
- [ ] Xem báo cáo doanh thu
- [ ] Xem biểu đồ
- [ ] Kiểm tra responsive trên mobile

## Cấu trúc thư mục

```
src/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Root redirect
│   ├── login/page.tsx      # Đăng nhập
│   ├── signup/page.tsx     # Đăng ký
│   ├── dashboard/page.tsx  # Tổng quan
│   ├── patients/           # Bệnh nhân
│   ├── services/page.tsx   # Dịch vụ
│   ├── therapy-packages/   # Gói trị liệu
│   ├── appointments/       # Lịch hẹn
│   ├── payments/           # Thanh toán
│   ├── reports/            # Báo cáo
│   └── settings/           # Cài đặt
├── components/
│   ├── layout/             # AppSidebar, AppShell
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── supabase/           # Client, Server, Middleware
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Utilities
└── middleware.ts            # Route protection
```

## License

MIT
