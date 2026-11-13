import {
  AlertTriangle,
  Ambulance,
  Check,
  Copy,
  ExternalLink,
  HeartPulse,
  MapPin,
  MessageCircle,
  MessageSquare,
  Navigation,
  Phone,
  RotateCw,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { buttonClasses } from '../../components/ui/button-classes';
import { formatPhone } from '../../lib/format';
import {
  buildEmergencyMessage,
  createGoogleMapsUrl,
  createSmsUrl,
  formatZaloPhone,
} from './emergency';
import { FirstAidDisclaimerModal } from './FirstAidDisclaimerModal';
import { getUserCondition } from '../medical-content/medical-content.storage';

interface EmergencyLocationActionProps {
  fullName: string;
  familyPhone: string;
  /** 'public' on public QR scan page; 'preview' on customer's own profile page. */
  mode?: 'public' | 'preview';
}

interface GpsCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
}

const CACHE_KEY_COORDS = 'qrc_emergency_coords';
const CACHE_KEY_REOPEN = 'qrc_emergency_reopen';

function loadInitialEmergencyState(): { coords: GpsCoordinates | null; reopen: boolean } {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY_COORDS);
    const shouldReopen = sessionStorage.getItem(CACHE_KEY_REOPEN) === 'true';
    if (cached) {
      const parsed = JSON.parse(cached) as GpsCoordinates & { timestamp: number };
      if (Date.now() - parsed.timestamp < 15 * 60 * 1000) {
        if (shouldReopen) {
          sessionStorage.removeItem(CACHE_KEY_REOPEN);
        }
        return {
          coords: {
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            accuracy: parsed.accuracy,
          },
          reopen: shouldReopen,
        };
      } else {
        sessionStorage.removeItem(CACHE_KEY_COORDS);
      }
    }
  } catch {
    // sessionStorage unavailable
  }
  return { coords: null, reopen: false };
}

export function EmergencyLocationAction({
  fullName,
  familyPhone,
  mode = 'public',
}: EmergencyLocationActionProps) {
  const navigate = useNavigate();
  const [initialState] = useState(loadInitialEmergencyState);
  const [locating, setLocating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(initialState.reopen);
  const [firstAidModalOpen, setFirstAidModalOpen] = useState(false);
  const [coords, setCoords] = useState<GpsCoordinates | null>(initialState.coords);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Dialog open/close management
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogOpen && !dialog.open) {
      dialog.showModal();
    } else if (!dialogOpen && dialog.open) {
      dialog.close();
    }
  }, [dialogOpen]);

  const mapsUrl = coords ? createGoogleMapsUrl(coords.latitude, coords.longitude) : '';
  const emergencyMessage = coords ? buildEmergencyMessage(fullName, mapsUrl) : '';
  const zaloPhone = formatZaloPhone(familyPhone);
  const zaloUrl = `https://zalo.me/${zaloPhone}`;
  const smsUrl = coords ? createSmsUrl(familyPhone, emergencyMessage) : `sms:${familyPhone}`;

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      }
    } catch {
      // Clipboard write failed or disallowed
    }
  };

  const handleGetLocation = () => {
    // If fresh coordinates were already obtained in this session, open immediately!
    if (coords) {
      setDialogOpen(true);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      setCoords(null);
      setDialogOpen(true);
      return;
    }

    setLocating(true);
    setError(null);
    setCopied(false);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const newCoords: GpsCoordinates = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
        };
        setCoords(newCoords);
        try {
          sessionStorage.setItem(
            CACHE_KEY_COORDS,
            JSON.stringify({ ...newCoords, timestamp: Date.now() }),
          );
        } catch {
          // sessionStorage unavailable
        }
        setDialogOpen(true);

        const newMapsUrl = createGoogleMapsUrl(newCoords.latitude, newCoords.longitude);
        const msg = buildEmergencyMessage(fullName, newMapsUrl);
        void copyToClipboard(msg);
      },
      (err) => {
        setLocating(false);
        setCoords(null);
        let message = 'Không thể lấy được vị trí GPS.';
        if (err.code === err.PERMISSION_DENIED) {
          message =
            'Quyền truy cập vị trí bị từ chối. Vui lòng cho phép quyền vị trí trên trình duyệt để gửi tọa độ chính xác.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message =
            'Không xác định được vị trí của thiết bị. Hãy kiểm tra định vị GPS trên điện thoại.';
        } else if (err.code === err.TIMEOUT) {
          message = 'Quá thời gian lấy vị trí GPS. Vui lòng thử lại ở nơi có sóng tốt hơn.';
        }
        setError(message);
        setDialogOpen(true);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  return (
    <>
      {mode === 'public' ? (
        <section
          aria-label="Cứu hộ khẩn cấp"
          className="rounded-2xl border border-danger/30 bg-danger-soft/30 p-4 text-center"
        >
          <div className="mb-3 flex items-center justify-center gap-2 text-danger">
            <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
            <h2 className="text-base font-bold text-fg">Cứu hộ khẩn cấp / Báo tai nạn</h2>
          </div>
          <p className="mb-4 text-sm text-fg-muted">
            Nhấn nút để lấy vị trí GPS chính xác và gửi kèm bản đồ cho người thân qua Zalo hoặc tin
            nhắn SMS.
          </p>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            loading={locating}
            onClick={handleGetLocation}
            className="shadow-md"
          >
            <Navigation aria-hidden="true" className="size-5" />
            Gửi vị trí GPS cho người thân
          </Button>
        </section>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium text-fg">Nút khẩn cấp GPS (Khi quét mã QR)</p>
            <p className="text-sm text-fg-muted">
              Người đi đường khi quét mã có thể nhấn nút này để gửi vị trí hiện tại đến SĐT người
              thân ({formatPhone(familyPhone)}).
            </p>
          </div>
          <Button
            variant="danger"
            size="md"
            loading={locating}
            onClick={handleGetLocation}
            className="shrink-0"
          >
            <Navigation aria-hidden="true" className="size-4" />
            Thử gửi vị trí GPS
          </Button>
        </div>
      )}

      {/* Emergency Modal Dialog */}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          setDialogOpen(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border bg-surface p-6 text-fg shadow-2xl backdrop:bg-black/60"
      >
        {dialogOpen && (
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-danger-soft text-danger">
                  <AlertTriangle aria-hidden="true" className="size-5" />
                </span>
                <h3 id={titleId} className="text-lg font-bold text-fg">
                  Thông tin cứu hộ khẩn cấp
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                aria-label="Đóng cửa sổ"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            {coords ? (
              <div className="space-y-4">
                {/* Location result card */}
                <div className="rounded-xl border border-primary/20 bg-primary-soft/40 p-3.5 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 font-semibold text-primary-soft-fg">
                        <MapPin aria-hidden="true" className="size-4 shrink-0" />
                        <span>Đã lấy tọa độ GPS chính xác:</span>
                      </div>
                      <p className="font-mono text-xs text-fg">
                        {coords.latitude}, {coords.longitude}{' '}
                        <span className="text-fg-muted">(Sai số ±{coords.accuracy}m)</span>
                      </p>
                    </div>
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                    >
                      Bản đồ
                      <ExternalLink aria-hidden="true" className="size-3" />
                    </a>
                  </div>
                </div>

                {/* Pre-filled message preview */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-fg-muted">
                      Nội dung tin nhắn báo nạn:
                    </span>
                    <button
                      type="button"
                      onClick={() => void copyToClipboard(emergencyMessage)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                    >
                      {copied ? (
                        <>
                          <Check aria-hidden="true" className="size-3 text-success" />
                          <span className="text-success font-semibold">Đã sao chép!</span>
                        </>
                      ) : (
                        <>
                          <Copy aria-hidden="true" className="size-3" />
                          <span>Sao chép</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="rounded-xl bg-surface-muted p-3 text-xs leading-relaxed text-fg">
                    {emergencyMessage}
                  </div>
                  <p className="text-[11px] text-fg-muted">
                    💡 Hệ thống đã tự động sao chép nội dung và link bản đồ vào bộ nhớ tạm.
                  </p>
                </div>

                {/* Action buttons */}
                <div className="space-y-2.5 pt-1">
                  <a
                    href={zaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-between rounded-xl bg-[#0068ff] px-4 py-3 text-white transition hover:bg-[#0055d4]"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare aria-hidden="true" className="size-5 shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">Gửi qua Zalo người thân</p>
                        <p className="text-xs text-blue-100">
                          Mở Zalo và Dán (Paste) nội dung tin nhắn để gửi
                        </p>
                      </div>
                    </div>
                    <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-blue-200" />
                  </a>

                  <a
                    href={smsUrl}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-fg transition hover:bg-surface-muted"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageCircle aria-hidden="true" className="size-5 shrink-0 text-success" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">Gửi tin nhắn SMS</p>
                        <p className="text-xs text-fg-muted">
                          Tự động mở SMS kèm sẵn link Google Maps
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-primary">Mở tin nhắn →</span>
                  </a>

                  <a href={`tel:${familyPhone}`} className={buttonClasses('danger', 'lg', true)}>
                    <Phone aria-hidden="true" className="size-5" />
                    Gọi ngay cho người thân ({formatPhone(familyPhone)})
                  </a>

                  <a
                    href="tel:115"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-danger bg-surface p-3 font-semibold text-danger transition hover:bg-danger-soft/20"
                  >
                    <Ambulance aria-hidden="true" className="size-5 shrink-0" />
                    Gọi cứu hộ y tế (Cấp cứu 115)
                  </a>

                  <button
                    type="button"
                    onClick={() => setFirstAidModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/30 p-3 font-semibold text-primary transition hover:bg-primary-soft/60"
                  >
                    <HeartPulse aria-hidden="true" className="size-5 shrink-0" />
                    Hướng dẫn sơ cứu ban đầu
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {error && (
                  <Alert tone="warning" title="Chưa lấy được tọa độ GPS">
                    {error}
                  </Alert>
                )}
                <p className="text-sm text-fg-muted">
                  Bạn vẫn có thể liên hệ trực tiếp với người thân của người gặp nạn qua các phương
                  thức sau:
                </p>

                <div className="space-y-2.5">
                  <a href={`tel:${familyPhone}`} className={buttonClasses('danger', 'lg', true)}>
                    <Phone aria-hidden="true" className="size-5" />
                    Gọi điện thoại khẩn cấp ({formatPhone(familyPhone)})
                  </a>

                  <a
                    href="tel:115"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-danger bg-surface p-3 font-semibold text-danger transition hover:bg-danger-soft/20"
                  >
                    <Ambulance aria-hidden="true" className="size-5 shrink-0" />
                    Gọi cứu hộ y tế (Cấp cứu 115)
                  </a>

                  <button
                    type="button"
                    onClick={() => setFirstAidModalOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary-soft/30 p-3 font-semibold text-primary transition hover:bg-primary-soft/60"
                  >
                    <HeartPulse aria-hidden="true" className="size-5 shrink-0" />
                    Hướng dẫn sơ cứu ban đầu
                  </button>

                  <a
                    href={zaloUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-between rounded-xl bg-[#0068ff] px-4 py-3 text-white transition hover:bg-[#0055d4]"
                  >
                    <div className="flex items-center gap-2.5">
                      <MessageSquare aria-hidden="true" className="size-5 shrink-0" />
                      <div className="text-left">
                        <p className="text-sm font-semibold">Mở chat Zalo người thân</p>
                        <p className="text-xs text-blue-100">Nhắn tin trực tiếp qua Zalo</p>
                      </div>
                    </div>
                    <ExternalLink aria-hidden="true" className="size-4 shrink-0 text-blue-200" />
                  </a>

                  <Button
                    variant="secondary"
                    size="md"
                    fullWidth
                    loading={locating}
                    onClick={handleGetLocation}
                  >
                    <RotateCw aria-hidden="true" className="size-4" />
                    Thử lấy lại vị trí GPS
                  </Button>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button variant="ghost" size="sm" fullWidth onClick={() => setDialogOpen(false)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </dialog>

      <FirstAidDisclaimerModal
        open={firstAidModalOpen}
        onClose={() => setFirstAidModalOpen(false)}
        onAccept={() => {
          try {
            sessionStorage.setItem(CACHE_KEY_REOPEN, 'true');
          } catch {
            // sessionStorage unavailable
          }
          setFirstAidModalOpen(false);
          setDialogOpen(false);
          const condId =
            getUserCondition(familyPhone) ||
            getUserCondition(fullName) ||
            getUserCondition('current_user') ||
            'trauma';
          const search = new URLSearchParams();
          if (condId) search.set('condition', condId);
          if (fullName) search.set('name', fullName);
          void navigate(`/first-aid?${search.toString()}`);
        }}
      />
    </>
  );
}
