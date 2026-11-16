# Báo điện tử 10A4 · Tri ân thầy cô 20/11

Website tĩnh (HTML/CSS/JS thuần), không cần build, gồm **hai link**:

- `/` (`index.html`) – giới thiệu "Một sản phẩm đến từ nhóm …", có loading, ảnh trang vở lơ lửng, rồi **tự chuyển** sang trang bài học.
- `/bai-hoc` (`bai-hoc.html`) – chủ đề chính: Giá trị lượng giác của góc từ 0° đến 180°. Hết bài là một **dây đèn** treo xuống, người xem **kéo dây** → màn đen + **nhạc** → chữ "Ơ… gì ấy nhỉ?…" → lá & cánh hoa cuộn thành nụ rồi **nở thành hoa** → lời chúc hiện từ từ, **ảnh thầy cô** hiện ra và lơ lửng.

## Đưa lên Vercel
1. Kéo thả thư mục này vào vercel.com/new (hoặc đẩy lên GitHub).
2. Framework Preset: **Other**. Build/Output: để trống. Deploy.

## Cấu trúc
- `style.css` – giao diện dùng chung (mobile + máy tính)
- `common.js` – gợn sóng nút, cánh hoa rơi
- `intro.js` – loading + giới thiệu + chuyển trang (đổi tên nhóm trong `index.html`, thẻ `.in-group`)
- `lesson.js` – mô phỏng nửa đường tròn đơn vị
- `finale.js` – dây đèn giật, màn đen, nhạc, hoa nở, lời chúc, ảnh (đầu file có mục `CFG` để chỉnh nhịp độ/âm lượng)
- `nhac.mp3` – nhạc nền (tách từ video "Người Gieo Mầm Xanh")
- `thay-co-1..5.webp` – ảnh thầy cô (dọc 3:4, ~480×640)

## Sửa nội dung phần tri ân (trong `bai-hoc.html`, tìm `#finale`)
- **Lời chúc**: sửa/thêm/bớt thẻ `<li>` trong `<ol id="wishSrc">`; chữ ký ở `<p id="wishSign">`.
- **Câu dẫn đầu** ("Ơ… gì ấy nhỉ?"…): `<ol id="introSrc">`, `data-hold` = số ms câu đó nằm yên.
- **Ảnh**: thay file `thay-co-N.webp` (hoặc đổi `src`); điền tên vào `<figcaption>` nếu muốn hiện tên bên dưới ảnh.
- **Nhạc**: đổi `src` của `<audio id="bgm">`.
- Tất cả file nằm chung một thư mục (không có thư mục con) để dễ upload bằng điện thoại.
