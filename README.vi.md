<div align="center">

# AI Agent Setup

### Một catalog rule, skill và agent kỹ thuật, cài dạng gốc cho Claude Code và Codex

[![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/create-ai-agent-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%20%7C%2022%20%7C%2024-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

**[English](README.md)** | **Tiếng Việt**

```bash
npx create-ai-agent-setup setup
```

</div>

AI Agent Setup trang bị cho agent viết code của bạn bộ rule, skill, agent và workflow của một đội
kỹ thuật giàu kinh nghiệm, đúng với các ngôn ngữ dự án đang dùng, đồng thời đặt rào chắn cho những gì
agent được phép làm. Công cụ ghi cấu hình gốc của từng host (`.claude/` cho Claude Code; `AGENTS.md`,
`.agents/` và `.codex/` cho Codex) và quản lý nó như một dependency: xem trước được, cập nhật được và
hoàn tác được.

## Vì sao nên dùng

- **Gốc cho cả hai host.** Một catalog có phiên bản được sinh thành rule, skill, agent và lệnh slash
  của Claude Code, và `AGENTS.md`, skill, agent, cấu hình của Codex.
- **Chỉ cài thứ dự án cần.** Công cụ nhận diện stack và cài đúng gói ngôn ngữ bạn dùng: service Go
  nhận hướng dẫn Go, không nhận của React. Rule ngôn ngữ chỉ được nạp khi agent đụng tới file của
  ngôn ngữ đó, nên phần ngữ cảnh luôn nạp vẫn nhỏ.
- **Cài an toàn.** Mọi thay đổi được hiện thành diff trước, được backup, và hoàn tác bằng `rollback`.
  File bạn đã sửa không bao giờ bị ghi đè: bản mới được ghi cạnh file của bạn.
- **Rào chắn.** Một policy hook kiểm mọi lệnh shell và mọi lần ghi file. Lệnh phá huỷ (`rm -rf`,
  `git push --force`, `DROP TABLE`) và lệnh publish ở mọi hệ (`npm publish`, `cargo publish`,
  `docker push`, …) cần bạn duyệt; ghi credential ở định dạng đã biết thì bị chặn.
- **Kiểm chứng, không hứa suông.** Quality gate chạy chính lệnh build, test, linter, coverage và audit
  thư viện của dự án, rồi lưu bằng chứng. Thứ gì không kiểm được thì báo NOT_VERIFIED, không bao giờ
  báo đạt.

## Bắt đầu nhanh

Cần Node.js 20 trở lên.

```bash
# Trong dự án sẵn có: xem trước, rồi áp dụng
npx create-ai-agent-setup diff
npx create-ai-agent-setup setup --yes

# Thêm cả Codex (hoặc chỉ Codex)
npx create-ai-agent-setup setup --adapter claude-code,codex --yes

# Tạo dự án mới từ template
npx create-ai-agent-setup my-api -t backend -f nestjs -y
```

Sau đó mở dự án bằng Claude Code hoặc Codex. Với Codex, hãy tin cậy (trust) dự án và duyệt hook bằng
`/hooks`: Codex chỉ nạp cấu hình dự án khi dự án được tin cậy.

## Ngôn ngữ được hỗ trợ

| Stack | Hướng dẫn được cài | Gate chạy được |
|---|---|---|
| TypeScript / JavaScript | Rule TypeScript; skill Node, React, React Native, Prisma | script trong `package.json`, coverage (Istanbul), `npm audit` |
| Python | Rule Python, skill build | pytest, Ruff, mypy, coverage (pytest-cov), pip-audit |
| Go | Rule Go, skill build | `go build`, `go test`, `go vet`, coverage, govulncheck |
| Java, Kotlin | Rule Java và Kotlin, skill build JVM | build và test bằng Maven hoặc Gradle, ktlint hoặc detekt, JaCoCo |
| Android | Rule Android, skill build | Gradle, Android Lint |
| C# / .NET | Rule C#, skill build .NET | `dotnet build`/`test`/`format`, coverlet, gói có lỗ hổng |
| Rust | Rule Rust, skill build | `cargo build`/`test`/`clippy`/`check`, cargo-llvm-cov, cargo-audit |
| PHP | Rule PHP, skill build | PHPUnit hoặc Pest, PHPStan, coverage, `composer audit` |
| Ruby | Rule Ruby, skill build | RSpec hoặc Minitest, RuboCop, SimpleCov, bundler-audit |
| Swift | Rule Swift, skill build | `swift build`/`test`, SwiftLint, coverage |
| Dart / Flutter | Rule Dart và Flutter, skill build | `flutter test`/`analyze` (hoặc `dart`), coverage |
| C / C++ | Rule C và C++, skill build | CMake và CTest |

Gate chỉ chạy công cụ dự án có khai báo: dự án không dùng RuboCop thì không có gate RuboCop. Mọi dự
án cũng nhận phần hướng dẫn chung: kiến trúc, thiết kế API, test, bảo mật, Git workflow, review code,
cùng các agent lập kế hoạch, triển khai, review và bảo mật.

## Lệnh dùng hằng ngày

| Lệnh | Tác dụng |
|---|---|
| `setup [thư mục]` | Cài cấu hình (hỏi trước; `--yes` để áp dụng, `--dry-run` chỉ lập kế hoạch) |
| `diff [thư mục]` | Hiện mọi thay đổi dưới dạng diff; không ghi gì |
| `update [thư mục]` | Chuyển sang catalog của phiên bản đang cài; giữ các chỗ bạn đã sửa |
| `doctor [thư mục]` | Kiểm bản cài so với manifest |
| `rollback [thư mục]` | Trả lại đúng từng byte trạng thái trước lần cài gần nhất |
| `gates run [thư mục]` | Chạy các quality gate bắt buộc và lưu bằng chứng |
| `create <tên>` | Tạo dự án từ template (Express, NestJS, Next.js, Vite, fullstack, Expo, React Native) |

Lập kế hoạch, phân tích ảnh hưởng, chạy run, báo cáo và cô lập khi chạy agent có trong
[tham chiếu CLI](docs/guides/cli-reference.md) (tiếng Anh), kèm mọi tuỳ chọn.

## Những gì được cài

| | Claude Code | Codex |
|---|---|---|
| Hướng dẫn | section được quản lý trong `.claude/CLAUDE.md` | section được quản lý trong `AGENTS.md` (giữ dưới 24 KiB) |
| Rule | `.claude/rules/` (rule ngôn ngữ giới hạn theo đường dẫn) | trong `AGENTS.md`; rule có phạm vi thành skill |
| Skill | `.claude/skills/` | `.agents/skills/` |
| Agent | `.claude/agents/` | `.codex/agents/*.toml` |
| Workflow | `/spec`, `/plan`, `/build`, `/test`, `/review`, … | skill gọi bằng `$spec`, `$plan`, … |
| An toàn | quyền `ask`/`deny` và policy hook trong `.claude/settings.json` | policy hook trong `.codex/hooks.json`; sandbox `workspace-write`, duyệt `on-request` |
| MCP server | `.mcp.json`, chỉ những server bạn bật | `[mcp_servers]` trong `.codex/config.toml`, chỉ những server bạn bật |

Mọi thứ được ghi đều nằm trong `.ai-agent-setup/manifest.json` (hãy commit file này). Backup và nhật
ký giao dịch nằm cục bộ trong `.ai-agent-setup/`.

## Catalog

Toàn bộ cấu hình đến từ `catalog/`: các entry YAML được kiểm bằng JSON Schema, chia thành 12 domain
năng lực, từ sản phẩm, thiết kế tới bảo mật, DevOps và dữ liệu.

<!-- catalog-summary:begin (generated by `npm run docs:summary`; do not edit) -->
| Catalog | Count |
|---|---|
| Domains | 12 |
| Capabilities | 123 |
| Agents | 9 canonical + 10 V1 aliases |
| Skills | 25 |
| Rules | 29 (6 always-scoped, 19 path-scoped, 4 capability-scoped) |
| Workflows | 9 |
| Profiles | 3 |
| Tools | 16 MCP servers (opt-in) + 1 other |
| Policies | 2 (12 rules) |
| Adapters | claude-code, codex |
<!-- catalog-summary:end -->

## Trạng thái và giới hạn đã biết

Phiên bản hiện tại có trên [npm](https://www.npmjs.com/package/create-ai-agent-setup) và trong
[changelog](CHANGELOG.md). Những gì đã kiểm chứng và chưa:

- **Claude Code:** giao kế hoạch, luồng sự kiện, lượng token và quyền đã được kiểm trên CLI thật
  (2.1.332). **Codex** (0.172.0) mới kiểm một phần: khởi động, thất bại, timeout và huỷ, chưa có
  lượt chạy với tài khoản đã đăng nhập. Codex chỉ chạy trong repo Git hoặc thư mục được tin cậy.
- **Chưa khẳng định về hiệu quả.** Benchmark so sánh agent có và không có cấu hình này đã được xây và
  review, nhưng chưa chạy trên host thật.
- **Lệnh mặc định của gate** theo tài liệu của từng công cụ và được test bằng fixture, chưa chạy với
  mọi toolchain thật. Câu báo kết quả của các công cụ audit thư viện chưa được kiểm; nếu lệch, gate
  báo NOT_VERIFIED, không bao giờ báo đạt sai.
- **Cô lập khi chạy agent** (`run deliver --isolation restricted`) là bản xem trước, chỉ có trên
  macOS; Linux và Windows chưa hỗ trợ ([hướng dẫn](docs/guides/runtime-isolation.md)).
- **Rào chắn không phải sandbox.** Policy hook và run được ký giúp chặn nhầm lẫn, không chặn được
  chương trình agent chạy dưới tài khoản của bạn ([mô hình đe doạ](docs/v2/11-runtime-threat-model.md)).
- **Dự án V1** giữ nguyên các rule allow trong `.claude/settings.json` (kể cả rule rộng như
  `Bash(rm *)`); `setup` cảnh báo nhưng không xoá cấu hình của bạn.
- `--db mysql` hoặc `sqlite` đổi provider của Prisma; schema của từng template trên các database đó
  chưa được kiểm.

## Nâng cấp từ 1.x

Đọc [Chuyển từ V1](docs/guides/migrating-from-v1.md), rồi chạy `diff` trước `setup`. Bản 1.x vẫn dùng
được bằng `npx create-ai-agent-setup@1` và được vá bảo mật đến 2027-05-25.

## Tài liệu

- [Tham chiếu CLI](docs/guides/cli-reference.md)
- [Chuyển từ V1](docs/guides/migrating-from-v1.md)
- [Cô lập khi chạy agent](docs/guides/runtime-isolation.md)
- [Gói ngôn ngữ và gate](docs/v2/16-language-packs.md)
- [Tài liệu thiết kế](docs/v2/README.md): kiến trúc, quyết định, lộ trình và trạng thái
- [Changelog](CHANGELOG.md)

## Phát triển

```bash
npm ci
npm run typecheck
npm run lint              # ESLint có kiểm kiểu, không cho phép cảnh báo
npm test                  # test unit, contract, golden, installer, bảo mật và end-to-end
npm run test:coverage     # fail khi chỉ số nào dưới 80%
npm run catalog:validate  # in thêm kích thước ngữ cảnh luôn nạp theo từng profile
npm run docs:summary      # cập nhật bảng catalog trong cả hai README
```

CI chạy trên Linux và Windows với Node 20, 22 và 24, và trên macOS với Node 20 và 24. Muốn đóng góp: làm trên nhánh `feature/*`
hoặc `fix/*` với conventional commit, thêm test, và giữ `npm test` cùng `npm run catalog:validate`
xanh.

## Giấy phép

MIT
