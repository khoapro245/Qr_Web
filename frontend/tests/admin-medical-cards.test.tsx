import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AdminDisclaimerCard } from '../src/features/medical-content/AdminDisclaimerCard';
import { AdminFirstAidCard } from '../src/features/medical-content/AdminFirstAidCard';
import { DashboardDisclaimerSummaryCard } from '../src/features/medical-content/DashboardDisclaimerSummaryCard';
import { DashboardFirstAidSummaryCard } from '../src/features/medical-content/DashboardFirstAidSummaryCard';
import { AdminDisclaimerPage } from '../src/pages/admin/AdminDisclaimerPage';
import { AdminFirstAidPage } from '../src/pages/admin/AdminFirstAidPage';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('Dashboard summary cards', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders neat disclaimer summary card with link to detail page', () => {
    renderWithRouter(<DashboardDisclaimerSummaryCard />);

    expect(
      screen.getByRole('heading', { name: /Điều khoản miễn trừ trách nhiệm/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Hiệu lực/i)).toBeInTheDocument();
    expect(screen.getByText(/3 điều khoản/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Chi tiết & Chỉnh sửa/i });
    expect(link).toHaveAttribute('href', '/admin/disclaimer');
  });

  it('renders neat first aid summary card with link to detail page', () => {
    renderWithRouter(<DashboardFirstAidSummaryCard />);

    expect(screen.getByRole('heading', { name: /Cẩm nang sơ cứu ban đầu/i })).toBeInTheDocument();
    expect(screen.getByText(/6 chủ đề/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /Chi tiết & Chỉnh sửa/i });
    expect(link).toHaveAttribute('href', '/admin/first-aid');
  });
});

describe('Admin detail pages', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders AdminDisclaimerPage with back link and full card', () => {
    renderWithRouter(<AdminDisclaimerPage />);

    expect(screen.getByRole('link', { name: /Quay lại Tổng quan/i })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(
      screen.getByRole('heading', { name: /Quản lý Điều khoản miễn trừ trách nhiệm/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\. Tính chất tham khảo/i)).toBeInTheDocument();
  });

  it('renders AdminFirstAidPage with back link and full card', () => {
    renderWithRouter(<AdminFirstAidPage />);

    expect(screen.getByRole('link', { name: /Quay lại Tổng quan/i })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(screen.getByRole('heading', { name: /Quản lý Cẩm nang sơ cứu/i })).toBeInTheDocument();
    expect(screen.getByText(/Chấn thương & Tai nạn thông thường/i)).toBeInTheDocument();
    expect(screen.getByText(/Động kinh & Co giật/i)).toBeInTheDocument();
  });
});

describe('AdminDisclaimerCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders disclaimer card with default items and status', () => {
    renderWithRouter(<AdminDisclaimerCard />);

    expect(
      screen.getByRole('heading', { name: /Điều khoản miễn trừ trách nhiệm/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Hiệu lực/i)).toBeInTheDocument();
    expect(screen.getByText(/1\. Tính chất tham khảo/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Ưu tiên cấp cứu 115/i)).toBeInTheDocument();
    expect(screen.getByText(/3\. Miễn trừ trách nhiệm/i)).toBeInTheDocument();
  });

  it('adds a new disclaimer item (Create)', () => {
    renderWithRouter(<AdminDisclaimerCard />);

    // Click "Thêm điều khoản"
    const addBtn = screen.getByRole('button', { name: /Thêm điều khoản/i });
    fireEvent.click(addBtn);

    // Modal opens
    expect(screen.getByRole('heading', { name: /Thêm điều khoản mới/i })).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/Tiêu đề điều khoản/i), {
      target: { value: 'Bảo mật dữ liệu định vị' },
    });
    fireEvent.change(screen.getByLabelText(/Nội dung điều khoản chi tiết/i), {
      target: { value: 'Dữ liệu vị trí GPS chỉ được dùng cho mục đích cứu hộ trong 15 phút.' },
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: 'Lưu điều khoản mới' }));

    // Item should appear in list
    expect(screen.getByText(/Bảo mật dữ liệu định vị/i)).toBeInTheDocument();
  });

  it('edits an existing disclaimer item (Update)', () => {
    renderWithRouter(<AdminDisclaimerCard />);

    const editBtn = screen.getByLabelText(/Sửa điều khoản Tính chất tham khảo/i);
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: /Chỉnh sửa điều khoản/i })).toBeInTheDocument();

    const titleInput = screen.getByLabelText(/Tiêu đề điều khoản/i);
    fireEvent.change(titleInput, { target: { value: 'Chỉ mang tính chất tham khảo' } });

    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));

    expect(screen.getByText(/1\. Chỉ mang tính chất tham khảo/i)).toBeInTheDocument();
  });

  it('opens live preview modal', () => {
    renderWithRouter(<AdminDisclaimerCard />);

    const previewBtn = screen.getByRole('button', { name: /Xem trước/i });
    fireEvent.click(previewBtn);

    expect(
      screen.getByRole('heading', { name: /Điều khoản miễn trừ trách nhiệm \(Xem thử\)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Đóng xem thử/i })).toBeInTheDocument();
  });
});

describe('AdminFirstAidCard', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders list of medical conditions (diseases)', () => {
    renderWithRouter(<AdminFirstAidCard />);

    expect(screen.getByRole('heading', { name: /Cẩm nang sơ cứu ban đầu/i })).toBeInTheDocument();
    expect(screen.getByText(/7 loại bệnh/i)).toBeInTheDocument();
    expect(screen.getByText(/Chấn thương & Tai nạn thông thường/i)).toBeInTheDocument();
    expect(screen.getByText(/Động kinh & Co giật/i)).toBeInTheDocument();
    expect(screen.getByText(/Hen suyễn & Hen phế quản/i)).toBeInTheDocument();
    expect(screen.getByText(/Bệnh tim mạch & Đột quỵ tim/i)).toBeInTheDocument();
  });

  it('creates a new medical condition (Create disease)', () => {
    renderWithRouter(<AdminFirstAidCard />);

    fireEvent.click(screen.getByRole('button', { name: /Thêm loại bệnh mới/i }));

    expect(screen.getByRole('heading', { name: /Thêm loại bệnh mới/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tên loại bệnh \/ tình trạng y tế/i), {
      target: { value: 'Say nắng & Sốc nhiệt' },
    });
    fireEvent.change(screen.getByLabelText(/Mô tả triệu chứng \/ dấu hiệu/i), {
      target: { value: 'Sốt cao trên 40 độ, ngất xỉu, da nóng đỏ' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Tạo loại bệnh/i }));

    expect(screen.getByText(/Say nắng & Sốc nhiệt/i)).toBeInTheDocument();
  });

  it('edits an existing medical condition (Update disease)', () => {
    renderWithRouter(<AdminFirstAidCard />);

    const editBtn = screen.getByLabelText(/Sửa thông tin bệnh Động kinh & Co giật/i);
    fireEvent.click(editBtn);

    expect(screen.getByRole('heading', { name: /Chỉnh sửa loại bệnh/i })).toBeInTheDocument();

    const nameInput = screen.getByLabelText(/Tên loại bệnh \/ tình trạng y tế/i);
    fireEvent.change(nameInput, { target: { value: 'Động kinh & Co giật cấp tính' } });

    fireEvent.click(screen.getByRole('button', { name: /Lưu thay đổi/i }));

    expect(screen.getByText(/Động kinh & Co giật cấp tính/i)).toBeInTheDocument();
  });

  it('deletes a medical condition after confirmation (Delete disease)', () => {
    renderWithRouter(<AdminFirstAidCard />);

    const deleteBtn = screen.getByLabelText(/Xóa loại bệnh Bệnh tim mạch & Đột quỵ tim/i);
    fireEvent.click(deleteBtn);

    expect(screen.getByRole('heading', { name: /Xác nhận xóa loại bệnh/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Xóa loại bệnh' }));

    expect(screen.queryByText(/Bệnh tim mạch & Đột quỵ tim/i)).not.toBeInTheDocument();
  });

  it('drills down to disease first-aid guide and allows CRUD of topics', () => {
    renderWithRouter(<AdminFirstAidCard />);

    // Click into "Chi tiết" for trauma
    const manageBtn = screen.getByRole('button', {
      name: /Chi tiết cẩm nang sơ cứu Chấn thương & Tai nạn thông thường/i,
    });
    fireEvent.click(manageBtn);

    // Should now see topics view
    expect(
      screen.getByRole('heading', {
        name: /Cẩm nang sơ cứu cho: Chấn thương & Tai nạn thông thường/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/1\. Quy trình đánh giá DRCAB/i)).toBeInTheDocument();
    expect(screen.getByText(/2\. Hồi sinh tim phổi \(CPR\) cho người lớn/i)).toBeInTheDocument();

    // Create a new topic for this disease
    fireEvent.click(screen.getByRole('button', { name: /Thêm chủ đề sơ cứu/i }));
    expect(screen.getByRole('heading', { name: /Thêm chủ đề sơ cứu mới/i })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Tên chủ đề sơ cứu/i), {
      target: { value: '7. Xử lý điện giật' },
    });
    fireEvent.change(screen.getByLabelText(/Tóm tắt ngắn \/ Mục đích/i), {
      target: { value: 'Ngắt nguồn điện an toàn' },
    });

    // Add step
    fireEvent.change(screen.getByLabelText(/Tên bước/i), {
      target: { value: 'Ngắt cầu dao điện' },
    });
    fireEvent.change(screen.getByLabelText(/Chi tiết thao tác/i), {
      target: { value: 'Lập tức ngắt nguồn điện hoặc dùng vật cách điện gạt dây điện' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Thêm bước này vào danh sách/i }));

    fireEvent.click(screen.getByRole('button', { name: /Tạo chủ đề sơ cứu/i }));

    expect(screen.getByText(/7\. Xử lý điện giật/i)).toBeInTheDocument();

    // Delete topic
    const deleteTopicBtn = screen.getByLabelText(/Xóa chủ đề 7\. Xử lý điện giật/i);
    fireEvent.click(deleteTopicBtn);
    expect(
      screen.getByRole('heading', { name: /Xác nhận xóa chủ đề sơ cứu/i }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xóa chủ đề' }));

    expect(screen.queryByText(/7\. Xử lý điện giật/i)).not.toBeInTheDocument();

    // Back to disease list
    fireEvent.click(screen.getByRole('button', { name: /Quay lại danh sách bệnh/i }));
    expect(screen.getByText(/7 loại bệnh/i)).toBeInTheDocument();
  });
});
