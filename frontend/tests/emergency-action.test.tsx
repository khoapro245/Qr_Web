import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmergencyLocationAction } from '../src/features/emergency/EmergencyLocationAction';

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('EmergencyLocationAction', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  it('renders emergency trigger button on public view', () => {
    renderWithRouter(
      <EmergencyLocationAction fullName="Khoa Kiều Văn" familyPhone="+84987654321" mode="public" />,
    );
    expect(
      screen.getByRole('button', { name: /Gửi vị trí GPS cho người thân/i }),
    ).toBeInTheDocument();
  });

  it('requests geolocation and displays GPS coordinates with Zalo and SMS links', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: {
            latitude: 21.028511,
            longitude: 105.854167,
            accuracy: 15,
          },
        });
      }),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    renderWithRouter(
      <EmergencyLocationAction fullName="Khoa Kiều Văn" familyPhone="+84987654321" mode="public" />,
    );

    const button = screen.getByRole('button', { name: /Gửi vị trí GPS cho người thân/i });
    fireEvent.click(button);

    expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledTimes(1);

    // Modal dialog contents
    expect(await screen.findByText(/Thông tin cứu hộ khẩn cấp/i)).toBeInTheDocument();
    expect(screen.getByText(/21.028511, 105.854167/i)).toBeInTheDocument();

    // Zalo link with normalized phone
    const zaloLink = screen.getByRole('link', { name: /Gửi qua Zalo người thân/i });
    expect(zaloLink).toHaveAttribute('href', 'https://zalo.me/0987654321');

    // SMS link with pre-filled body
    const smsLink = screen.getByRole('link', { name: /Gửi tin nhắn SMS/i });
    expect(smsLink.getAttribute('href')).toContain('sms:+84987654321');
    expect(smsLink.getAttribute('href')).toContain(encodeURIComponent('Khoa Kiều Văn'));

    // Call link
    const callLink = screen.getByRole('link', { name: /Gọi ngay cho người thân/i });
    expect(callLink).toHaveAttribute('href', 'tel:+84987654321');

    // Ambulance hotline 115 link
    const ambulanceLink = screen.getByRole('link', { name: /Gọi cứu hộ y tế \(Cấp cứu 115\)/i });
    expect(ambulanceLink).toHaveAttribute('href', 'tel:115');

    // First aid guide button
    expect(screen.getByRole('button', { name: /Hướng dẫn sơ cứu ban đầu/i })).toBeInTheDocument();
  });

  it('handles geolocation permission denied gracefully with direct call options', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((_success, error) => {
        error({
          code: 1, // PERMISSION_DENIED
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        });
      }),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    renderWithRouter(
      <EmergencyLocationAction fullName="Khoa Kiều Văn" familyPhone="+84987654321" mode="public" />,
    );

    const button = screen.getByRole('button', { name: /Gửi vị trí GPS cho người thân/i });
    fireEvent.click(button);

    expect(await screen.findByText(/Quyền truy cập vị trí bị từ chối/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Gọi điện thoại khẩn cấp/i })).toHaveAttribute(
      'href',
      'tel:+84987654321',
    );
    expect(screen.getByRole('link', { name: /Gọi cứu hộ y tế \(Cấp cứu 115\)/i })).toHaveAttribute(
      'href',
      'tel:115',
    );
  });

  it('opens first-aid disclaimer modal and requires agreement before viewing guide', async () => {
    const mockGeolocation = {
      getCurrentPosition: vi.fn((success) => {
        success({
          coords: { latitude: 21.028511, longitude: 105.854167, accuracy: 15 },
        });
      }),
    };
    Object.defineProperty(navigator, 'geolocation', {
      value: mockGeolocation,
      configurable: true,
    });

    renderWithRouter(
      <EmergencyLocationAction fullName="Khoa Kiều Văn" familyPhone="+84987654321" mode="public" />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Gửi vị trí GPS cho người thân/i }));
    expect(await screen.findByText(/Thông tin cứu hộ khẩn cấp/i)).toBeInTheDocument();

    // Click "Hướng dẫn sơ cứu ban đầu"
    const firstAidBtn = screen.getByRole('button', { name: /Hướng dẫn sơ cứu ban đầu/i });
    fireEvent.click(firstAidBtn);

    // Disclaimer modal opens
    expect(
      screen.getByRole('heading', { name: /Điều khoản miễn trừ trách nhiệm/i }),
    ).toBeInTheDocument();
    const agreeBtn = screen.getByRole('button', { name: /Đồng ý & Xem hướng dẫn/i });
    expect(agreeBtn).toBeDisabled();

    // Check the agreement checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(agreeBtn).not.toBeDisabled();

    // Confirm agreement
    fireEvent.click(agreeBtn);
  });

  it('auto-reopens emergency dialog with cached coordinates when returning from first-aid', async () => {
    sessionStorage.setItem('qrc_emergency_reopen', 'true');
    sessionStorage.setItem(
      'qrc_emergency_coords',
      JSON.stringify({
        latitude: 20.981572,
        longitude: 105.843513,
        accuracy: 12,
        timestamp: Date.now(),
      }),
    );

    renderWithRouter(
      <EmergencyLocationAction fullName="Khoa Kiều Văn" familyPhone="+84987654321" mode="public" />,
    );

    // Dialog is immediately open and displays cached coordinates
    expect(await screen.findByText(/Thông tin cứu hộ khẩn cấp/i)).toBeInTheDocument();
    expect(screen.getByText(/20.981572, 105.843513/i)).toBeInTheDocument();
    expect(sessionStorage.getItem('qrc_emergency_reopen')).toBeNull();
  });
});
