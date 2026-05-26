# Cách Khiến Claude Trung Thực Hơn

> Hướng dẫn giảm thiểu hallucination và cải thiện độ chính xác trong câu trả lời của Claude.

---

## Tại Sao Điều Này Quan Trọng

Bạn hỏi Claude: *"Einstein đã nói gì về sự sáng tạo?"*

Claude tự tin trả lời: *"Einstein từng nói: 'Sáng tạo là trí thông minh đang vui chơi.'"*

Nghe rất hay. Nhưng vấn đề là — **Einstein có lẽ chưa bao giờ nói câu đó**. Đây là một câu quote bị gán nhầm cho ông trên internet. Claude đôi khi bịa ra trích dẫn, số liệu và nguồn để nghe có vẻ đáng tin. Nó không cố ý nói dối; nó chỉ đang "pattern-matching" xem một câu trả lời hữu ích trông như thế nào.

Hiện tượng này gọi là **hallucination** (ảo giác), và đây là một trong những rủi ro lớn nhất khi sử dụng AI cho nghiên cứu, viết lách, hoặc ra quyết định.

Tin tốt: bạn có thể giảm đáng kể hành vi này chỉ với một thay đổi cấu hình đơn giản.

---

## Vấn Đề

Các mô hình AI đôi khi:
- Trình bày thông tin không chắc chắn như sự thật
- Bịa nguồn, số liệu, hoặc trích dẫn
- Đoán về các sự kiện gần đây mà không có dữ liệu
- Tỏ ra tự tin khi không nên

## Giải Pháp

Thêm **Honesty Prompt** vào cấu hình Claude của bạn. Điều này hướng dẫn Claude ưu tiên độ chính xác hơn sự tự tin.

---

## Các Tùy Chọn Cài Đặt

### Tùy chọn 1: Toàn cục (Tất cả Projects)

Tạo hoặc chỉnh sửa `~/.claude/CLAUDE.md`:

```bash
mkdir -p ~/.claude
nano ~/.claude/CLAUDE.md
```

### Tùy chọn 2: Theo Project

Tạo hoặc chỉnh sửa `.claude/CLAUDE.md` trong thư mục gốc project:

```bash
mkdir -p .claude
nano .claude/CLAUDE.md
```

### Tùy chọn 3: Tách Riêng Thành Rule

Tạo `.claude/rules/honesty.md` để dễ bật/tắt:

```bash
mkdir -p .claude/rules
nano .claude/rules/honesty.md
```

---

## Honesty Prompt

Copy nội dung này vào file bạn chọn:

```markdown
## Sự Trung Thực & Khiêm Tốn Trong Nhận Thức

Ưu tiên độ chính xác hơn sự tự tin. Minh bạch về những gì bạn biết, không biết, và đang suy luận.

### 1. Sự Không Chắc Chắn
- Nếu không chắc, hãy nói rõ: "Tôi không hoàn toàn chắc, nhưng...", "Bạn nên xác minh điều này...", "Dựa trên kiến thức hiện có của tôi..."
- Không trình bày thông tin không chắc chắn như sự thật
- Nếu thiếu ngữ cảnh, nói rõ cần thông tin gì
- Nếu có nhiều khả năng, giải thích các khả năng chính

### 2. Nguồn Thông Tin
Không bao giờ bịa:
- Bài nghiên cứu, URL, tác giả
- Số liệu thống kê, nghiên cứu, sách
- Vụ án pháp lý, trích dẫn, báo cáo công ty
- Tài liệu tham khảo lịch sử

Nếu không có nguồn có thể kiểm chứng, hãy nói rõ. Nếu dựa trên kiến thức chung, hãy nói rõ.

### 3. Thống Kê & Con Số
Đánh dấu bất kỳ con số, tỷ lệ phần trăm, xếp hạng, quy mô thị trường, hoặc ước tính nào mà bạn không hoàn toàn tự tin. Không bịa số liệu chỉ để có vẻ hữu ích.

### 4. Sự Kiện Gần Đây
Không đoán về các sự kiện hiện tại. Với các chủ đề có thể đã thay đổi gần đây (tin tức, luật pháp, tính năng sản phẩm, phiên bản phần mềm, lãnh đạo công ty), lưu ý rằng thông tin có thể đã lỗi thời và cần xác minh.

### 5. Con Người & Trích Dẫn
Không bao giờ gán một câu nói cho người thật trừ khi chắc chắn họ đã nói điều đó. Tách biệt sự thật đã xác nhận và phần suy diễn.
```

---

## Ví Dụ Trước & Sau

### Ví dụ 1: Số Liệu Thống Kê

**Không có honesty prompt:**
> "React chiếm 85% thị phần trong các framework frontend."

**Có honesty prompt:**
> "React là một trong những framework frontend phổ biến nhất. Tôi không có dữ liệu thị phần chính xác hiện tại — bạn nên kiểm tra các khảo sát gần đây như State of JS để có con số chính xác."

### Ví dụ 2: Nguồn Thông Tin

**Không có honesty prompt:**
> "Theo một nghiên cứu năm 2023 của Đại học Stanford..."

**Có honesty prompt:**
> "Dựa trên kiến thức chung về chủ đề này (tôi không có nguồn cụ thể để trích dẫn)..."

### Ví dụ 3: Sự Kiện Gần Đây

**Không có honesty prompt:**
> "Phiên bản mới nhất của iPhone là iPhone 16 với các tính năng này..."

**Có honesty prompt:**
> "Tính đến thời điểm kiến thức của tôi được cập nhật, iPhone 15 là phiên bản mới nhất. Hãy kiểm tra trang web chính thức của Apple để biết phiên bản hiện tại."

---

## Khi Nào Nên Dùng

| Trường hợp sử dụng | Khuyến nghị |
|-------------------|-------------|
| Nghiên cứu & tìm kiếm thông tin | Có |
| Viết tài liệu | Có |
| Viết code | Tùy chọn (ít liên quan) |
| Viết sáng tạo | Không (có thể quá thận trọng) |
| Các tác vụ code nhanh | Không (làm chậm workflow) |

---

## Mẹo Sử Dụng

1. **Toàn cục vs Theo project**: Dùng toàn cục (`~/.claude/CLAUDE.md`) nếu bạn muốn hành vi này ở mọi nơi. Dùng theo project nếu chỉ cần cho công việc nghiên cứu.

2. **Kết hợp với các rule khác**: Prompt này hoạt động song song với coding standards, tech stack rules, v.v.

3. **Điều chỉnh khi cần**: Nếu Claude trở nên quá thận trọng, bạn có thể làm nhẹ ngôn ngữ hoặc chuyển sang file rule riêng để bật/tắt.

---

## Kiểm Tra

Sau khi cài đặt, thử hỏi các câu như:
- "Thị phần hiện tại của TypeScript là bao nhiêu?"
- "Trích dẫn câu Elon Musk nói về AI tuần trước"
- "Mức lương chính xác cho senior engineer ở Google là bao nhiêu?"

Claude bây giờ sẽ thận trọng hơn thay vì bịa ra câu trả lời.
