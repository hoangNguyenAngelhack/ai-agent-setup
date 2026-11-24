<div align="center">

# AI Agent Setup

### Cấu hình kỹ thuật AI dùng chung cho Claude Code và Codex

[![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/create-ai-agent-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%20%7C%2022%20%7C%2024-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

**[English](README.md)** | **Tiếng Việt**

</div>

> **Trạng thái: bản xem trước V2, chưa phát hành.** Bản trên npm (`npx create-ai-agent-setup`) vẫn
> là **1.6.1 (V1)**. Nhánh này chứa nền tảng V2 mô tả bên dưới; muốn dùng thử thì build từ mã nguồn
> (xem [Bắt đầu nhanh](#bắt-đầu-nhanh-v2-từ-mã-nguồn)). Người dùng V1: đọc
> [Chuyển từ V1](docs/guides/migrating-from-v1.md) trước khi chạy V2 trong dự án V1.

## Công cụ làm gì

- **Tạo dự án** từ bảy template (Express, NestJS, Next.js, Vite, Next.js fullstack, Expo, React
  Native CLI), kèm cấu hình kỹ thuật AI.
- **Thêm vào dự án sẵn có** một cách an toàn: dry-run, diff, backup, xử lý xung đột, rollback và
  kiểm tra toàn vẹn. File bạn đã sửa không bao giờ bị ghi đè im lặng.
- **Sinh cấu hình gốc cho từng host** từ một catalog có phiên bản: Claude Code (`.claude/`) và Codex
  (`AGENTS.md`, `.agents/skills`, `.codex/`).
- **Áp chính sách an toàn** bằng một hook chạy trước mỗi lệnh shell và mỗi lần ghi file. Lệnh phá
  huỷ (`rm -rf`, `git push --force`, `DROP TABLE`, `npm publish`, …) cần được duyệt; ghi khoá bí mật
  ở định dạng token đã biết thì bị chặn.

## Bắt đầu nhanh (V2 từ mã nguồn)

```bash
git clone https://github.com/hoangNguyenAngelhack/ai-agent-setup.git
cd ai-agent-setup && git checkout feature/v2-foundation
npm ci && npm run build

# Tạo dự án mới (cờ V1 vẫn dùng được)
node bin/cli.js my-api -t backend -f nestjs -y

# Thêm cấu hình vào dự án sẵn có: xem trước, rồi áp dụng
node bin/cli.js diff ../my-project
node bin/cli.js setup ../my-project --yes
node bin/cli.js doctor ../my-project
node bin/cli.js rollback ../my-project      # hoàn tác lần cài gần nhất
```

## Lệnh

| Lệnh | Tác dụng |
|---|---|
| `[tên] [tuỳ chọn]` hoặc `create <tên>` | Tạo dự án từ template và cài cấu hình AI |
| `setup [thư mục]` | Thêm cấu hình vào dự án sẵn có; hỏi trước khi ghi (`--yes` để bỏ hỏi, `--dry-run` chỉ lập kế hoạch) |
| `diff [thư mục]` | Hiện kế hoạch và diff của mọi thay đổi; không ghi gì |
| `doctor [thư mục]` | Đối chiếu file và section được quản lý với `.ai-agent-setup/manifest.json` |
| `rollback [thư mục] [--force]` | Trả lại đúng từng byte trạng thái trước lần cài gần nhất |
| `catalog validate [thư mục]` | Kiểm tra catalog (schema, tham chiếu, policy, ngân sách context) |
| `plan "<task>"` *(bản xem trước V2.1)* | Đề xuất kế hoạch: domain, agent, skill, gate và chi phí ước lượng, kèm giải thích; `--mode`, `--domain`, `--agent`, `--exclude-agent`, `--allow-tools`, `--budget`, `--approve-at`, `--json` |
| `explain <plan-id>` | Xem lại kế hoạch đã lưu và phần giải thích |
| `impact [file...]` *(bản xem trước V2.1)* | File thay đổi chạm vào đâu: module, vùng code, rủi ro, test liên quan, chủ sở hữu theo CODEOWNERS; không truyền file thì đọc thay đổi chưa commit trong git, `--since <ref>` để so với một ref. `plan --files`, `--changed`, `--since` dùng cùng phân tích này |
| `gates list\|run\|history [thư mục]` *(bản xem trước V2.2)* | Quality gate có bằng chứng: `list` liệt kê mọi gate, mức hỗ trợ và lệnh sẽ chạy; `run` chạy các gate bắt buộc (profile + `.ai-agent-setup/gates.json`), ghi bằng chứng đã che dữ liệu nhạy cảm và có checksum; mã thoát 0 PASS, 1 FAIL, 2 NOT_VERIFIED. `--gate`, `--skip`, `--run`, `--profile`, `--json` |
| `run <hành động>` *(bản xem trước V2.1)* | Lượt thực thi (ADR-009): `create <plan-id>`, `approve` và `approve-step` (cần terminal tương tác, gõ lại id), `deliver --host claude-code\|codex [--dry-run] [--timeout giây]`, `event`, `verify <run-id> <bước>`, `cancel`, `status`. Lượt chỉ SUCCEEDED khi mọi bước được báo đã thực thi và qua gate; qua gate mà không có báo cáo thực thi thì là OUTCOME_VERIFIED (mã thoát 2). Lượt chạy được ký bằng khoá cục bộ (ADR-016). `deliver --isolation restricted [--network deny] [--pass-env a,b]` chạy host trong sandbox nhân hệ điều hành macOS ([hướng dẫn](docs/guides/runtime-isolation.md)) |
| `isolation check` *(bản xem trước V2.2)* | Cô lập lúc chạy (ADR-017, đề xuất): bảng nền tảng và, theo từng biện pháp, hồ sơ (`none`, `restricted`, `isolated`) thực thi được gì trên máy này; mã thoát 2 khi không thực thi được |

Tuỳ chọn của `create` giữ nguyên V1: `-t` (`backend`, `frontend`, `fullstack`, `mobile`), `-f`
(backend: `express`, `nestjs` · frontend: `nextjs`, `vite` · mobile: `expo`, `cli`), `-u` (chỉ
frontend: `shadcn`, `antd`, `chakra`, `semantic`), `-T` (`starter`, `standard`, `strict`, chọn
profile), `-d` (`postgresql`, `mysql`, `sqlite`, `none`), `-H` (rule honesty), `-c` (CodeGraph, cần
mạng), `-y` (dùng mặc định, không hỏi).

Tuỳ chọn của `setup`: `-a claude-code,codex` (mặc định: các host đã cấu hình sẵn, nếu không có thì
Claude Code), `--profile <id>`, `--strategy write-new|skip|backup-overwrite` (mặc định `write-new`:
ghi `<file>.ai-agent-setup.new` cạnh file của bạn), `--enable-tool <id>` (bật một MCP server, ví dụ
`tool.mcp-github`).

## Cài những gì

| | Claude Code | Codex |
|---|---|---|
| Chỉ dẫn | section được quản lý trong `.claude/CLAUDE.md` | section được quản lý trong `AGENTS.md` (giữ dưới 24 KiB) |
| Rule | `.claude/rules/` (rule theo đường dẫn dùng `paths:`) | trong `AGENTS.md`; rule có phạm vi thành skill |
| Skill | `.claude/skills/` | `.agents/skills/` |
| Agent | `.claude/agents/` (giữ tên agent V1) | `.codex/agents/*.toml` |
| Workflow | `/spec`, `/plan`, `/build`, `/test`, `/review`, … trong `.claude/commands/` | skill gọi bằng `$spec`, `$plan`, … |
| An toàn | quyền `ask`/`deny` + hook chính sách trong `.claude/settings.json` | hook chính sách trong `.codex/hooks.json`; sandbox `workspace-write`, duyệt `on-request` |
| MCP | `.mcp.json`, chỉ server bạn bật | `[mcp_servers]` trong `.codex/config.toml`, chỉ server bạn bật |

Mọi thứ bộ cài ghi ra được lưu trong `.ai-agent-setup/manifest.json` (nên commit). Bản backup và
nhật ký giao dịch chỉ nằm trên máy, trong `.ai-agent-setup/backups/` và `.ai-agent-setup/transactions/`.

## Catalog

Toàn bộ cấu hình đến từ `catalog/`: các mục YAML được kiểm bằng JSON Schema, chia thành 12 domain
(sản phẩm, thiết kế, frontend, backend, mobile, dữ liệu và AI, DevOps, chất lượng, bảo mật, kiến
trúc, tài liệu và trải nghiệm lập trình viên, tích hợp). Mọi domain và capability đều đã được định
nghĩa; phần lớn nội dung hướng dẫn vẫn lấy từ rule, skill, agent của V1, nội dung chuyên sâu hơn
nằm trong lộ trình.

<!-- catalog-summary:begin (generated by `npm run docs:summary`; do not edit) -->
| Catalog | Count |
|---|---|
| Domains | 12 |
| Capabilities | 123 |
| Agents | 9 canonical + 10 V1 aliases |
| Skills | 14 |
| Rules | 17 (6 always-scoped, 7 path-scoped, 4 capability-scoped) |
| Workflows | 9 |
| Profiles | 3 |
| Tools | 16 MCP servers (opt-in) + 1 other |
| Policies | 2 (12 rules) |
| Adapters | claude-code, codex |
<!-- catalog-summary:end -->

## Giới hạn đã biết

- **Chưa kiểm trong host thật:** file sinh ra theo tài liệu của Claude Code và Codex (đối chiếu
  24/11/2026) và có golden test, nhưng chưa được nạp vào `claude` hay `codex` đang chạy.
- **Codex** chỉ nạp `.codex/` (config, agent, hook) trong dự án đã được tin cậy, và chỉ chạy hook
  sau khi bạn duyệt bằng `/hooks`.
- **Dự án V1** giữ nguyên các rule `allow` cũ trong `.claude/settings.json`, kể cả `Bash(rm *)`;
  `setup` cảnh báo nhưng không xoá cấu hình của bạn.
- **Node.js:** CI kiểm Node 20, 22, 24. `package.json` vẫn khai `>=18` nhưng chưa được kiểm (câu hỏi
  mở OQ-07).
- `--db mysql` / `sqlite` đổi provider Prisma; chưa kiểm chứng schema của từng template migrate được
  trên các CSDL đó.
- **Bảo vệ trạng thái runtime** chặn agent ghi vào `.ai-agent-setup/` qua công cụ của host, và mỗi lượt
  chạy được ký bằng khoá nằm trong thư mục cấu hình của bạn (`ai-agent-setup/keys`). Cả hai đều không
  phải ranh giới an ninh trước chương trình agent chạy bằng tài khoản của bạn; xem
  [docs/v2/11](docs/v2/11-runtime-threat-model.md).
- **Giao kế hoạch và quality gate** mới được kiểm bằng lệnh giả lập và tiến trình host giả. Giao
  kế hoạch cho `claude` hay `codex` thật là NOT_VERIFIED; định dạng thông điệp của host lấy từ tài
  liệu công bố. Quét secret dựa trên mẫu, không chứng minh thay đổi sạch secret.
- **Không có tuyên bố về hiệu năng:** tác động lên token, chi phí, tốc độ chưa được đo. Kế hoạch
  benchmark ở [docs/v2/09](docs/v2/09-testing-and-benchmark-strategy.md). Số liệu công bố của
  CodeGraph là của nhà cung cấp, không được đo ở đây.

## Tài liệu

- [Chuyển từ V1](docs/guides/migrating-from-v1.md)
- [Tài liệu thiết kế V2](docs/v2/README.md): audit, đặc tả sản phẩm và kiến trúc, lộ trình kèm trạng
  thái hiện tại ([08 §9](docs/v2/08-implementation-roadmap.md#9-implementation-status)), chiến lược
  kiểm thử, quyết định kiến trúc.
- [Changelog](CHANGELOG.md)

## Phát triển

```bash
npm ci
npm run typecheck
npm run lint              # ESLint với luật có kiểm kiểu, không cho phép cảnh báo
npm test                  # unit, contract, golden, installer và end-to-end
npm run test:coverage     # như trên kèm coverage V8; lỗi nếu chỉ số nào dưới 80%
npm run catalog:validate  # in kèm số byte context luôn nạp đo được theo profile
npm run docs:summary      # cập nhật bảng catalog trong cả hai README
```

CI chạy trên Linux, macOS và Windows với Node 20, 22 và 24.

## Giấy phép

MIT
