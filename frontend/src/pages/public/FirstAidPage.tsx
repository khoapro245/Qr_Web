import {
  ArrowLeft,
  CheckCircle2,
  HeartPulse,
  Phone,
  ShieldAlert,
  TriangleAlert,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { MedicalIcon } from '../../features/medical-content/icon-map';
import { useMedicalConditions } from '../../features/medical-content/medical-content.storage';
import { usePageTitle } from '../../lib/use-page-title';

export function FirstAidPage() {
  usePageTitle('Hướng dẫn sơ cứu khẩn cấp theo tình trạng');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const conditionParam = searchParams.get('condition');
  const personName = searchParams.get('name');

  const { conditions } = useMedicalConditions();
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null);

  const activeConditionId =
    userSelectedId ||
    (conditionParam && conditions.some((c) => c.id === conditionParam) ? conditionParam : null) ||
    conditions[0]?.id ||
    null;

  const activeCondition = conditions.find((c) => c.id === activeConditionId) || conditions[0];
  const topics = activeCondition?.topics ?? [];

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="border-b border-border/60 bg-surface/90 px-4 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            type="button"
            onClick={() => void navigate(-1)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-fg-muted transition hover:text-fg"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Quay lại cứu hộ</span>
          </button>
          <Logo size="md" />
          <div className="w-16" /> {/* Spacer for visual balance */}
        </div>
      </header>

      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Personalized Emergency Alert Banner if person has an associated condition */}
          {personName && activeCondition && (
            <div className="rounded-3xl border-2 border-danger/40 bg-danger-soft/20 p-5 shadow-sm">
              <div className="flex items-start gap-3.5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-danger text-white shadow-xs">
                  <HeartPulse aria-hidden="true" className="size-6" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-danger">
                    Cẩm nang cấp cứu khẩn cấp cho người gặp nạn
                  </p>
                  <h2 className="text-xl font-bold text-fg">
                    {personName} — Tình trạng: {activeCondition.name}
                  </h2>
                  <p className="text-xs text-fg-muted">{activeCondition.description}</p>
                  <div className="pt-1.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-semibold text-white">
                      Mức độ:{' '}
                      {activeCondition.severity === 'critical'
                        ? 'Nguy kịch'
                        : activeCondition.severity === 'high'
                          ? 'Cực kỳ nguy hiểm'
                          : 'Cần xử lý ngay'}
                    </span>
                    <span className="text-xs text-fg-muted">
                      Ưu tiên thực hiện theo các bước chuyên biệt dưới đây!
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Quick Hotline Bar */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
            <a
              href="tel:115"
              className="flex flex-col items-center justify-center rounded-2xl border-2 border-danger bg-danger-soft/20 p-3 text-center transition hover:bg-danger-soft/40"
            >
              <Phone aria-hidden="true" className="size-5 text-danger" />
              <span className="mt-1 text-base font-bold text-danger">115</span>
              <span className="text-[11px] font-medium text-fg-muted">Cấp cứu y tế</span>
            </a>
            <a
              href="tel:114"
              className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-3 text-center transition hover:bg-surface-muted"
            >
              <Phone aria-hidden="true" className="size-5 text-primary" />
              <span className="mt-1 text-base font-bold text-fg">114</span>
              <span className="text-[11px] font-medium text-fg-muted">Cứu hộ cứu nạn</span>
            </a>
            <a
              href="tel:113"
              className="flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-3 text-center transition hover:bg-surface-muted"
            >
              <Phone aria-hidden="true" className="size-5 text-fg-muted" />
              <span className="mt-1 text-base font-bold text-fg">113</span>
              <span className="text-[11px] font-medium text-fg-muted">Công an</span>
            </a>
          </div>

          {/* Medical Condition Switcher Tabs */}
          {/* Conditions tabs */}
          {conditions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                  Chọn cẩm nang theo loại bệnh:
                </p>
                <span className="text-xs text-fg-muted">{conditions.length} danh mục y tế</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {conditions.map((cond) => {
                  const isSelected = cond.id === activeCondition?.id;
                  return (
                    <button
                      key={cond.id}
                      type="button"
                      onClick={() => setUserSelectedId(cond.id)}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold transition ${
                        isSelected
                          ? 'bg-primary text-primary-fg shadow-sm'
                          : 'border border-border bg-surface text-fg hover:bg-surface-muted'
                      }`}
                    >
                      <MedicalIcon name={cond.icon} className="size-4 shrink-0" />
                      <span>{cond.name}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-surface-muted text-fg-muted'
                        }`}
                      >
                        {cond.topics.length} bài
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Condition Header Banner */}
          {activeCondition && (
            <div className="rounded-3xl border border-primary/20 bg-primary-soft/30 p-5">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-fg">
                  <MedicalIcon name={activeCondition.icon} className="size-5" />
                </span>
                <div>
                  <h1 className="text-lg font-bold text-fg">{activeCondition.name}</h1>
                  <p className="text-xs text-fg-muted">{activeCondition.description}</p>
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Topics List or Empty State */}
          {conditions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
              <HeartPulse aria-hidden="true" className="mx-auto size-10 text-fg-muted/60" />
              <p className="mt-3 text-sm font-semibold text-fg">Chưa có danh mục sơ cứu nào</p>
              <p className="mt-1 text-xs text-fg-muted">
                Danh mục sơ cứu đang được cập nhật. Trong trường hợp khẩn cấp, vui lòng gọi ngay
                115.
              </p>
            </div>
          ) : topics.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center">
              <HeartPulse aria-hidden="true" className="mx-auto size-10 text-fg-muted/60" />
              <p className="mt-3 text-sm font-semibold text-fg">
                Chưa có bài hướng dẫn sơ cứu nào cho tình trạng này
              </p>
              <p className="mt-1 text-xs text-fg-muted">
                Nội dung sơ cứu cho mục này đang được cập nhật. Trong trường hợp khẩn cấp, vui lòng
                gọi ngay 115.
              </p>
            </div>
          ) : (
            topics.map((topic) => {
              return (
                <section
                  key={topic.id}
                  className="overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <MedicalIcon name={topic.icon} className="size-5" />
                      </span>
                      <div>
                        <h2 className="text-lg font-bold text-fg">{topic.title}</h2>
                        <p className="text-xs text-fg-muted">{topic.summary}</p>
                      </div>
                    </div>
                    {topic.priorityBadge && (
                      <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                        {topic.priorityBadge}
                      </span>
                    )}
                  </div>

                  {/* Red warning alert */}
                  {topic.warning && (
                    <div className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger-soft/30 p-3.5 text-xs text-danger font-medium leading-relaxed">
                      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span>{topic.warning}</span>
                    </div>
                  )}

                  {/* Steps */}
                  <div className="space-y-3 text-sm">
                    {topic.steps.map((step, idx) => (
                      <div key={idx} className="rounded-xl bg-surface-muted p-3">
                        <p className="font-semibold text-primary">{step.title}:</p>
                        <p className="text-xs text-fg-muted mt-0.5 leading-relaxed">
                          {step.detail}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Dos & Don'ts */}
                  {((topic.dos && topic.dos.length > 0) ||
                    (topic.donts && topic.donts.length > 0)) && (
                    <div className="grid gap-3 pt-2 sm:grid-cols-2">
                      {topic.dos && topic.dos.length > 0 && (
                        <div className="space-y-1.5 rounded-2xl border border-success/20 bg-success-soft/20 p-3 text-xs">
                          <span className="font-semibold text-success flex items-center gap-1.5">
                            <CheckCircle2 aria-hidden="true" className="size-3.5" />
                            Nên làm:
                          </span>
                          <ul className="space-y-1 pl-1 text-fg-muted">
                            {topic.dos.map((d, i) => (
                              <li key={i} className="leading-relaxed">
                                • {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {topic.donts && topic.donts.length > 0 && (
                        <div className="space-y-1.5 rounded-2xl border border-danger/20 bg-danger-soft/20 p-3 text-xs">
                          <span className="font-semibold text-danger flex items-center gap-1.5">
                            <XCircle aria-hidden="true" className="size-3.5" />
                            Tuyệt đối không làm:
                          </span>
                          <ul className="space-y-1 pl-1 text-fg-muted">
                            {topic.donts.map((d, i) => (
                              <li key={i} className="leading-relaxed">
                                • {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })
          )}

          {/* Footer Disclaimer Reminder */}
          <div className="flex items-start gap-3 rounded-2xl bg-surface-muted p-4 text-xs text-fg-muted">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-muted" />
            <p>
              Nội dung biên soạn dựa trên khuyến cáo sơ cứu chuẩn quốc tế của Hội Chữ thập đỏ. Hãy
              luôn liên hệ <strong>115</strong> để được nhân viên y tế hỗ trợ và hướng dẫn trực tiếp
              qua điện thoại.
            </p>
          </div>

          {/* Quick Return to Rescue Button */}
          <div className="pt-2">
            <Button
              variant="danger"
              size="lg"
              fullWidth
              onClick={() => void navigate(-1)}
              className="shadow-md"
            >
              <ArrowLeft aria-hidden="true" className="size-5" />
              Quay lại màn hình cứu hộ & vị trí GPS
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
