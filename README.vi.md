<div align="center">

# 🤖 AI Agent Setup

### Cấu hình Claude Code Production-Ready trong Vài Giây

<p>
  <strong>15 Agent</strong> · <strong>17 Rule</strong> · <strong>8 Command</strong> · <strong>7 Hook</strong> · <strong>6 Skill</strong>
</p>

[![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/create-ai-agent-setup)
[![npm downloads](https://img.shields.io/npm/dm/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=blue)](https://www.npmjs.com/package/create-ai-agent-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Compatible-green?style=for-the-badge)](https://agentskills.io)
[![Node](https://img.shields.io/badge/Node-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br />

```bash
npx create-ai-agent-setup my-app
```

<sub>Hỗ trợ Express · NestJS · Next.js · Vite · Expo · React Native</sub>

<br />

**[English](README.md)** | **Tiếng Việt**

</div>

<br />

---

## ✨ Tại Sao Nên Dùng?

| Không có AI Agent Setup | Có AI Agent Setup |
|-------------------------|-------------------|
| ❌ AI viết code không nhất quán | ✅ **17 rule bắt buộc** đảm bảo chuẩn |
| ❌ Không có quy trình rõ ràng | ✅ **8 slash command** (`/spec` → `/deploy`) |
| ❌ AI trả lời chung chung | ✅ **15 agent chuyên biệt** cho từng lĩnh vực |
| ❌ Review code thủ công | ✅ **Five-axis review** (đúng, bảo mật, hiệu năng...) |
| ❌ Không có quality gate | ✅ **7 hook** tự động kiểm tra trước/sau action |
| ❌ Setup từ đầu | ✅ **Một lệnh** là có config production-ready |

---

## 🚀 Bắt Đầu Nhanh

```bash
# Setup tương tác (khuyên dùng)
npx create-ai-agent-setup my-app
```

### Ví Dụ Một Dòng

```bash
# Backend
npx create-ai-agent-setup my-api -t backend                    # Express
npx create-ai-agent-setup my-api -t backend -f nestjs          # NestJS

# Frontend
npx create-ai-agent-setup my-site -t frontend -f nextjs        # Next.js + shadcn
npx create-ai-agent-setup my-admin -t frontend -f vite -u antd # Vite + Ant Design

# Mobile
npx create-ai-agent-setup my-app -t mobile -f expo             # Expo

# Tích hợp thêm
npx create-ai-agent-setup my-app --codegraph                   # Giảm 57% token
npx create-ai-agent-setup my-app --honesty                     # Giảm hallucination
```

<details>
<summary>📋 <strong>Tất Cả CLI Options</strong></summary>

```
Options:
  -t, --type <type>      Loại project: backend, frontend, fullstack, mobile
  -f, --framework <fw>   Framework: express, nestjs, nextjs, vite, expo, cli
  -u, --ui <library>     UI library: shadcn, antd, chakra, semantic
  -T, --tier <tier>      Rule tier: starter, standard, strict
  -d, --db <database>    Database: postgresql, mysql, sqlite, none
  -c, --codegraph        Setup CodeGraph MCP server
  -H, --honesty          Thêm honesty rule (giảm hallucination)
  -y, --yes              Bỏ qua prompt, dùng mặc định
```

</details>

---

## 📦 Bao Gồm Những Gì

<table>
<tr>
<td width="50%">

### 🎯 Slash Commands (8)

| Command | Mục đích |
|---------|----------|
| `/spec` | Tạo PRD với scope |
| `/plan` | Chia thành vertical slice |
| `/build` | Implement theo TDD |
| `/test` | RED-GREEN-REFACTOR |
| `/review` | Review code 5 trục |
| `/deploy` | Build & ship |
| `/debug` | Phân tích root cause |
| `/simplify` | Giảm độ phức tạp |

</td>
<td width="50%">

### 🤖 Agent Chuyên Biệt (15)

| Nhóm | Agent |
|------|-------|
| **Dev** | Frontend, Backend, Mobile, Architect |
| **Quality** | Reviewer, Tester, Security, QA |
| **Product** | PM, Designer, Copywriter |
| **Resolver** | React, RN, Node, Prisma |

</td>
</tr>
<tr>
<td>

### 📏 Rule Bắt Buộc (17)

- **Code**: clean-code, code-style, error-handling
- **Kiến trúc**: tech-stack, system-design, api-conventions
- **Data**: naming-conventions, database
- **Ops**: security, monitoring, testing, git-workflow
- **Ngôn ngữ**: typescript, python, sql patterns

</td>
<td>

### 🪝 Hooks System (7)

| Loại | Hook |
|------|------|
| **Pre** | security-scan, lint-check |
| **Post** | auto-format, ts-check, console-warn |
| **Life** | session-summary, cost-tracker |

</td>
</tr>
</table>

---

## 🔄 Quy Trình Phát Triển

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   📝 /spec  →  📋 /plan  →  🔨 /build  →  🧪 /test  →  👀 /review  │
│                                                                     │
│   Định nghĩa   Lên kế hoạch   Build      Test       Review  → Ship  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Five-Axis Code Review

| Trục | Câu hỏi |
|------|---------|
| ✅ **Correctness** | Code có chạy đúng không? |
| 📖 **Readability** | Người khác có hiểu được không? |
| 🏗️ **Architecture** | Có theo pattern và principle không? |
| 🔒 **Security** | Input đã validate? Auth đã check? |
| ⚡ **Performance** | N+1 query? Pagination đúng cách? |

---

## 🛠️ Cách Cài Đặt

### Cách 1: CLI (Khuyên dùng)

```bash
npx create-ai-agent-setup my-app
```

Prompt tương tác sẽ hướng dẫn bạn chọn loại project, framework, UI library, và tích hợp.

### Cách 2: Copy vào Project Có Sẵn

```bash
# Copy config .claude
npx degit hoangNguyenAngelhack/ai-agent-setup/.claude .claude

# Copy Agent Skills
npx degit hoangNguyenAngelhack/ai-agent-setup/.agents .agents
```

### Cách 3: Clone Full Repository

```bash
npx degit hoangNguyenAngelhack/ai-agent-setup my-project
cd my-project && ./scripts/init.sh
```

---

## 🔌 Tích Hợp

### CodeGraph — Giảm 57% Token

[CodeGraph](https://github.com/colbymchenry/codegraph) xây dựng knowledge graph ngữ nghĩa để AI explore code nhanh hơn.

| Chỉ số | Cải thiện |
|--------|-----------|
| Token | **Giảm 57%** |
| Chi phí | **Giảm 35%** |
| Tốc độ | **Nhanh hơn 46%** |
| Tool calls | **Giảm 71%** |

```bash
npx create-ai-agent-setup my-app --codegraph
```

### MCP Server Configs

Server được cấu hình sẵn cho các dịch vụ phổ biến:

| Server | Mục đích |
|--------|----------|
| **Supabase** | PostgreSQL, auth, storage |
| **Vercel** | Deploy & preview |
| **Playwright** | Tự động hóa browser |
| **GitHub** | Git operations nâng cao |
| **Sentry** | Theo dõi lỗi |

---

## 🎨 Hỗ Trợ UI Library

| Library | Mô tả | Phù hợp cho |
|---------|-------|-------------|
| **shadcn/ui** | Radix + Tailwind | App hiện đại, toàn quyền kiểm soát |
| **Ant Design** | Enterprise UI | Admin panel |
| **Chakra UI** | Đơn giản, accessible | Prototype nhanh |
| **Semantic UI** | Framework cổ điển | App truyền thống |

```bash
npx create-ai-agent-setup my-app -t frontend -f nextjs -u chakra
```

---

## 📱 Agent Skills (Open Standard)

Tương thích với **30+ AI coding agent** qua [agentskills.io](https://agentskills.io):

| Skill | Stack |
|-------|-------|
| `nodejs-backend` | Express, Prisma, Redis, BullMQ |
| `nestjs-backend` | NestJS, TypeORM, Guards, DI |
| `react-frontend` | Next.js/Vite, Tailwind, Zustand |
| `react-native-mobile` | Expo/RN CLI, NativeWind |
| `code-review` | Framework review 5 trục |
| `tdd` | Quy trình RED-GREEN-REFACTOR |

**Hoạt động với:** Claude Code, Cursor, VS Code Copilot, Windsurf, Cline, Aider, OpenHands...

---

## 💻 Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| **Frontend** | Next.js 14 · React + Vite · Tailwind + shadcn |
| **Backend** | Express · NestJS · Prisma · Redis |
| **Mobile** | Expo · React Native · NativeWind |
| **Database** | PostgreSQL · Redis |
| **Testing** | Vitest · Playwright |
| **Auth** | NextAuth.js · JWT + bcrypt |

---

## 🔗 Dự Án Liên Quan

| Dự án | Mô tả |
|-------|-------|
| [CodeGraph](https://github.com/colbymchenry/codegraph) | Knowledge graph ngữ nghĩa cho code |
| [Agent Skills](https://agentskills.io) | Open standard cho AI agent |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | shadcn/ui skill chính thức |
| [Supabase](https://github.com/supabase/supabase) | Supabase skill chính thức |

---

## 🤝 Đóng Góp

1. Theo quy trình (`/spec` → `/plan` → `/build`)
2. Đảm bảo tất cả test pass
3. Chạy `/review` trước khi submit PR
4. Dùng conventional commit format

---

<div align="center">

**Made with ❤️ by [Hoang Nguyen](mailto:hoang.nguyen@angelhack.com)**

<sub>⭐ Star repo này nếu bạn thấy hữu ích!</sub>

</div>
