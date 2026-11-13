import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Pagination } from '../../components/ui/Pagination';
import { SelectField } from '../../components/ui/SelectField';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { AVAILABLE_ICON_KEYS, MedicalIcon } from './icon-map';
import { useMedicalConditions } from './medical-content.storage';
import type {
  DiseaseSeverity,
  FirstAidStep,
  FirstAidTopic,
  MedicalCondition,
} from './medical-content.types';

const ICON_OPTIONS = AVAILABLE_ICON_KEYS.map((k) => ({ value: k, label: k }));

const SEVERITY_OPTIONS: { value: DiseaseSeverity; label: string }[] = [
  { value: 'critical', label: 'Nguy kịch (Đe dọa tính mạng)' },
  { value: 'high', label: 'Cực kỳ nguy hiểm' },
  { value: 'medium', label: 'Cần xử lý ngay (Trung bình)' },
  { value: 'low', label: 'Theo dõi & sơ cứu ban đầu' },
];

const SEVERITY_CONFIG: Record<
  DiseaseSeverity,
  { label: string; tone: 'danger' | 'info' | 'neutral' }
> = {
  critical: { label: 'Nguy kịch', tone: 'danger' },
  high: { label: 'Cực kỳ nguy hiểm', tone: 'danger' },
  medium: { label: 'Cần xử lý ngay', tone: 'info' },
  low: { label: 'Theo dõi & sơ cứu', tone: 'neutral' },
};

export function AdminFirstAidCard() {
  const { conditions, saveCondition, deleteCondition, resetConditions } = useMedicalConditions();

  // Active view: null = Diseases list; conditionId = Specific disease guide view
  const [selectedConditionId, setSelectedConditionId] = useState<string | null>(null);

  // Pagination for Medical Conditions (Diseases list)
  const [conditionPage, setConditionPage] = useState(1);
  const [conditionPageSize, setConditionPageSize] = useState(5);

  // Pagination for Topics (Detail view)
  const [topicPage, setTopicPage] = useState(1);
  const [topicPageSize, setTopicPageSize] = useState(4);

  // -------------------------------------------------------------
  // Disease (Medical Condition) CRUD state
  // -------------------------------------------------------------
  const [editingCondition, setEditingCondition] = useState<MedicalCondition | null>(null);
  const [isCreatingCondition, setIsCreatingCondition] = useState(false);
  const [conditionToDelete, setConditionToDelete] = useState<MedicalCondition | null>(null);
  const [showClearConditionsConfirm, setShowClearConditionsConfirm] = useState(false);
  const [showResetConditionsConfirm, setShowResetConditionsConfirm] = useState(false);

  const [condName, setCondName] = useState('');
  const [condDesc, setCondDesc] = useState('');
  const [condIcon, setCondIcon] = useState('HeartPulse');
  const [condSeverity, setCondSeverity] = useState<DiseaseSeverity>('medium');
  const [condOrder, setCondOrder] = useState<number>(1);
  const [condError, setCondError] = useState('');

  const conditionDialogRef = useRef<HTMLDialogElement>(null);
  const conditionDialogTitleId = useId();

  useEffect(() => {
    const d = conditionDialogRef.current;
    if (!d) return;
    if ((isCreatingCondition || editingCondition) && !d.open) d.showModal();
    if (!isCreatingCondition && !editingCondition && d.open) d.close();
  }, [isCreatingCondition, editingCondition]);

  const handleOpenCreateCondition = () => {
    setCondName('');
    setCondDesc('');
    setCondIcon('HeartPulse');
    setCondSeverity('medium');
    setCondOrder(conditions.length + 1);
    setCondError('');
    setIsCreatingCondition(true);
  };

  const handleOpenEditCondition = (c: MedicalCondition) => {
    setEditingCondition(c);
    setCondName(c.name);
    setCondDesc(c.description);
    setCondIcon(c.icon);
    setCondSeverity(c.severity);
    setCondOrder(c.order);
    setCondError('');
  };

  const handleCloseConditionDialog = () => {
    setIsCreatingCondition(false);
    setEditingCondition(null);
  };

  const handleSaveConditionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!condName.trim()) {
      setCondError('Vui lòng nhập tên loại bệnh / tình trạng.');
      return;
    }

    if (editingCondition) {
      saveCondition({
        ...editingCondition,
        name: condName.trim(),
        description: condDesc.trim(),
        icon: condIcon,
        severity: condSeverity,
        order: Number(condOrder) || 1,
      });
    } else {
      const slug =
        condName
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '') || `disease-${Date.now()}`;

      saveCondition({
        id: slug,
        name: condName.trim(),
        description: condDesc.trim(),
        icon: condIcon,
        severity: condSeverity,
        order: Number(condOrder) || conditions.length + 1,
        topics: [],
      });
      const nextTotal = conditions.length + 1;
      setConditionPage(Math.ceil(nextTotal / conditionPageSize));
    }
    handleCloseConditionDialog();
  };

  // -------------------------------------------------------------
  // Topics CRUD state for selected condition (Direct single-source-of-truth)
  // -------------------------------------------------------------
  const selectedCondition = conditions.find((c) => c.id === selectedConditionId);
  const topics = selectedCondition?.topics ?? [];

  const [editingTopic, setEditingTopic] = useState<FirstAidTopic | null>(null);
  const [isCreatingTopic, setIsCreatingTopic] = useState(false);
  const [topicToDelete, setTopicToDelete] = useState<FirstAidTopic | null>(null);
  const [showResetTopicsConfirm, setShowResetTopicsConfirm] = useState(false);

  // Form states for topic
  const [topicTitle, setTopicTitle] = useState('');
  const [topicSummary, setTopicSummary] = useState('');
  const [topicIcon, setTopicIcon] = useState('HeartPulse');
  const [topicPriorityBadge, setTopicPriorityBadge] = useState('');
  const [topicWarning, setTopicWarning] = useState('');
  const [topicOrder, setTopicOrder] = useState<number>(1);
  const [steps, setSteps] = useState<FirstAidStep[]>([]);
  const [dos, setDos] = useState<string[]>([]);
  const [donts, setDonts] = useState<string[]>([]);

  // Temp step input
  const [newStepTitle, setNewStepTitle] = useState('');
  const [newStepDetail, setNewStepDetail] = useState('');
  // Temp do / dont input
  const [newDoText, setNewDoText] = useState('');
  const [newDontText, setNewDontText] = useState('');

  const [topicError, setTopicError] = useState('');

  const topicDialogRef = useRef<HTMLDialogElement>(null);
  const topicDialogTitleId = useId();

  useEffect(() => {
    const d = topicDialogRef.current;
    if (!d) return;
    if ((isCreatingTopic || editingTopic) && !d.open) d.showModal();
    if (!isCreatingTopic && !editingTopic && d.open) d.close();
  }, [isCreatingTopic, editingTopic]);

  const handleOpenCreateTopic = () => {
    setTopicTitle('');
    setTopicSummary('');
    setTopicIcon(selectedCondition?.icon || 'HeartPulse');
    setTopicPriorityBadge('');
    setTopicWarning('');
    setTopicOrder((topics?.length || 0) + 1);
    setSteps([]);
    setDos([]);
    setDonts([]);
    setTopicError('');
    setIsCreatingTopic(true);
  };

  const handleOpenEditTopic = (t: FirstAidTopic) => {
    setEditingTopic(t);
    setTopicTitle(t.title);
    setTopicSummary(t.summary);
    setTopicIcon(t.icon);
    setTopicPriorityBadge(t.priorityBadge || '');
    setTopicWarning(t.warning || '');
    setTopicOrder(t.order);
    setSteps([...t.steps]);
    setDos([...(t.dos || [])]);
    setDonts([...(t.donts || [])]);
    setTopicError('');
  };

  const handleCloseTopicDialog = () => {
    setIsCreatingTopic(false);
    setEditingTopic(null);
  };

  const handleAddStep = () => {
    if (!newStepTitle.trim() || !newStepDetail.trim()) return;
    setSteps([...steps, { title: newStepTitle.trim(), detail: newStepDetail.trim() }]);
    setNewStepTitle('');
    setNewStepDetail('');
  };

  const handleRemoveStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleAddDo = () => {
    if (!newDoText.trim()) return;
    setDos([...dos, newDoText.trim()]);
    setNewDoText('');
  };

  const handleRemoveDo = (index: number) => {
    setDos(dos.filter((_, i) => i !== index));
  };

  const handleAddDont = () => {
    if (!newDontText.trim()) return;
    setDonts([...donts, newDontText.trim()]);
    setNewDontText('');
  };

  const handleRemoveDont = (index: number) => {
    setDonts(donts.filter((_, i) => i !== index));
  };

  const handleSaveTopicSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicTitle.trim()) {
      setTopicError('Vui lòng nhập tên chủ đề sơ cứu.');
      return;
    }
    if (steps.length === 0) {
      setTopicError('Chủ đề sơ cứu cần ít nhất một bước xử lý cụ thể.');
      return;
    }

    const topicSlug =
      topicTitle
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'topic-item';

    const payload: FirstAidTopic = {
      id: editingTopic ? editingTopic.id : `topic-${topicSlug}`,
      title: topicTitle.trim(),
      summary: topicSummary.trim(),
      icon: topicIcon,
      priorityBadge: topicPriorityBadge.trim() || undefined,
      warning: topicWarning.trim() || undefined,
      order: Number(topicOrder) || (editingTopic ? editingTopic.order : topics.length + 1),
      steps,
      dos: dos.length > 0 ? dos : undefined,
      donts: donts.length > 0 ? donts : undefined,
    };

    if (selectedCondition) {
      const exists = selectedCondition.topics.some((t) => t.id === payload.id);
      const nextTopics = exists
        ? selectedCondition.topics.map((t) => (t.id === payload.id ? payload : t))
        : [...selectedCondition.topics, payload];
      nextTopics.sort((a, b) => a.order - b.order);

      saveCondition({
        ...selectedCondition,
        topics: nextTopics,
      });

      if (!editingTopic) {
        setTopicPage(Math.ceil(nextTopics.length / topicPageSize));
      }
    }
    handleCloseTopicDialog();
  };

  // =============================================================
  // RENDER VIEW 2: TOPICS LIST FOR SELECTED DISEASE
  // =============================================================
  if (selectedCondition) {
    const sevCfg = SEVERITY_CONFIG[selectedCondition.severity];

    const totalTopics = topics.length;
    const topicPageCount = Math.max(1, Math.ceil(totalTopics / topicPageSize));
    const currentTopicPage = Math.min(topicPage, topicPageCount);
    const paginatedTopics = topics.slice(
      (currentTopicPage - 1) * topicPageSize,
      currentTopicPage * topicPageSize,
    );

    return (
      <div className="space-y-6">
        {/* Navigation & Disease Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedConditionId(null)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg shadow-sm transition hover:bg-surface-muted"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span>Quay lại danh sách bệnh</span>
          </button>

          <div className="flex items-center gap-2">
            <Link
              to={`/first-aid?condition=${selectedCondition.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-soft/30 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-soft/60"
            >
              <ExternalLink aria-hidden="true" className="size-3.5" />
              <span>Xem trang công khai bệnh này</span>
            </Link>
          </div>
        </div>

        {/* Selected Disease Info Card */}
        <Card className="border-l-4 border-l-primary p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <MedicalIcon name={selectedCondition.icon} className="size-6" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold text-fg">{selectedCondition.name}</h2>
                  <Badge tone={sevCfg.tone}>{sevCfg.label}</Badge>
                  <Badge tone="neutral">{topics.length} bài hướng dẫn</Badge>
                </div>
                <p className="mt-1 text-sm text-fg-muted">{selectedCondition.description}</p>
              </div>
            </div>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleOpenEditCondition(selectedCondition)}
            >
              <Pencil aria-hidden="true" className="size-3.5" />
              <span>Sửa thông tin bệnh</span>
            </Button>
          </div>
        </Card>

        {/* Topics CRUD Card */}
        <Card className="space-y-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <h3 className="text-lg font-semibold text-fg">
                Cẩm nang sơ cứu cho: {selectedCondition.name}
              </h3>
              <p className="text-xs text-fg-muted">
                Các quy trình, bước cấp cứu và lưu ý đặc thù khi người bệnh gặp nguy kịch.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={handleOpenCreateTopic}>
                <Plus aria-hidden="true" className="size-4" />
                <span>Thêm chủ đề sơ cứu</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetTopicsConfirm(true)}
                title="Xóa toàn bộ bài sơ cứu của bệnh này để tự thêm bài mới"
                className="text-danger hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
                <span>Xóa hết bài</span>
              </Button>
            </div>
          </div>

          {topics.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <Sparkles aria-hidden="true" className="mx-auto size-8 text-fg-muted/60" />
              <p className="mt-2 text-sm font-medium text-fg">Chưa có bài hướng dẫn sơ cứu nào</p>
              <p className="mt-1 text-xs text-fg-muted">
                Hãy thêm bài hướng dẫn đầu tiên cho loại bệnh này.
              </p>
              <Button size="sm" className="mt-4" onClick={handleOpenCreateTopic}>
                <Plus aria-hidden="true" className="size-4" />
                <span>Thêm chủ đề sơ cứu mới</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-4">
                {paginatedTopics.map((t) => {
                  return (
                    <div
                      key={t.id}
                      className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-primary/40 hover:shadow-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                          <MedicalIcon name={t.icon} className="size-5" />
                        </span>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-fg">{t.title}</span>
                            {t.priorityBadge && (
                              <span className="rounded-full bg-danger-soft px-2 py-0.5 text-xs font-semibold text-danger">
                                {t.priorityBadge}
                              </span>
                            )}
                            <span className="text-xs text-fg-muted">
                              ({t.steps.length} bước xử lý
                              {t.dos && t.dos.length > 0 ? ` • ${t.dos.length} nên làm` : ''}
                              {t.donts && t.donts.length > 0
                                ? ` • ${t.donts.length} cần tránh`
                                : ''}
                              )
                            </span>
                          </div>
                          <p className="text-xs text-fg-muted">{t.summary}</p>
                          {t.warning && (
                            <p className="text-xs font-medium text-danger">⚠️ {t.warning}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTopic(t)}
                          aria-label={`Sửa chủ đề ${t.title}`}
                          className="rounded-lg p-2 text-fg-muted transition hover:bg-surface-muted hover:text-fg"
                        >
                          <Pencil aria-hidden="true" className="size-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setTopicToDelete(t)}
                          aria-label={`Xóa chủ đề ${t.title}`}
                          className="rounded-lg p-2 text-fg-muted transition hover:bg-danger-soft hover:text-danger"
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination controls for topics */}
              {totalTopics > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs text-fg-muted">
                  <div className="flex items-center gap-2">
                    <span>Hiển thị</span>
                    <select
                      aria-label="Số bài sơ cứu trên mỗi trang"
                      value={topicPageSize}
                      onChange={(e) => {
                        setTopicPageSize(Number(e.target.value));
                        setTopicPage(1);
                      }}
                      className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-fg focus:border-primary focus:outline-hidden"
                    >
                      <option value={4}>4 bài / trang</option>
                      <option value={8}>8 bài / trang</option>
                      <option value={12}>12 bài / trang</option>
                    </select>
                    <span>
                      ({(currentTopicPage - 1) * topicPageSize + 1} -{' '}
                      {Math.min(currentTopicPage * topicPageSize, totalTopics)} / {totalTopics})
                    </span>
                  </div>

                  <Pagination
                    page={currentTopicPage}
                    pageSize={topicPageSize}
                    total={totalTopics}
                    onPageChange={setTopicPage}
                  />
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Modal: Topic Create / Edit */}
        <dialog
          ref={topicDialogRef}
          aria-labelledby={topicDialogTitleId}
          onClose={handleCloseTopicDialog}
          className="fixed inset-0 z-50 m-auto max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-2xl backdrop:bg-black/50"
        >
          {isCreatingTopic || editingTopic ? (
            <form onSubmit={handleSaveTopicSubmit} className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 id={topicDialogTitleId} className="text-lg font-bold text-fg">
                  {editingTopic ? 'Chỉnh sửa chủ đề sơ cứu' : 'Thêm chủ đề sơ cứu mới'}
                </h3>
                <button
                  type="button"
                  onClick={handleCloseTopicDialog}
                  aria-label="Đóng"
                  className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                >
                  <X aria-hidden="true" className="size-5" />
                </button>
              </div>

              {topicError && (
                <p className="rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
                  {topicError}
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField
                    label="Tên chủ đề sơ cứu"
                    value={topicTitle}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="VD: 1. Cấp cứu nhồi máu cơ tim"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Tóm tắt ngắn / Mục đích"
                    value={topicSummary}
                    onChange={(e) => setTopicSummary(e.target.value)}
                    placeholder="VD: Tư thế ngồi thẳng và hỗ trợ dùng bình xịt..."
                  />
                </div>
                <div>
                  <SelectField
                    label="Biểu tượng (Icon)"
                    value={topicIcon}
                    onChange={(e) => setTopicIcon(e.target.value)}
                    options={ICON_OPTIONS}
                  />
                </div>
                <div>
                  <TextField
                    label="Huy hiệu ưu tiên (nếu có)"
                    value={topicPriorityBadge}
                    onChange={(e) => setTopicPriorityBadge(e.target.value)}
                    placeholder="VD: Khẩn cấp, Tối khẩn cấp"
                  />
                </div>
                <div>
                  <TextField
                    label="Thứ tự hiển thị"
                    type="number"
                    min={1}
                    value={topicOrder}
                    onChange={(e) => setTopicOrder(Number(e.target.value))}
                  />
                </div>
                <div>
                  <TextField
                    label="Cảnh báo đặc biệt (Chữ đỏ)"
                    value={topicWarning}
                    onChange={(e) => setTopicWarning(e.target.value)}
                    placeholder="VD: Tuyệt đối không nhét vật cứng vào miệng"
                  />
                </div>
              </div>

              {/* Steps builder */}
              <div className="space-y-3 rounded-2xl border border-border bg-surface-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-fg">
                    Các bước xử lý cụ thể ({steps.length})
                  </h4>
                  <span className="text-xs text-fg-muted">Tối thiểu 1 bước</span>
                </div>

                {steps.length > 0 && (
                  <ol className="space-y-2 text-xs">
                    {steps.map((st, i) => (
                      <li
                        key={i}
                        className="flex items-start justify-between gap-2 rounded-xl border border-border bg-surface p-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-fg">
                            {i + 1}. {st.title}
                          </p>
                          <p className="text-fg-muted">{st.detail}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveStep(i)}
                          className="text-danger hover:underline"
                        >
                          Xóa
                        </button>
                      </li>
                    ))}
                  </ol>
                )}

                <div className="space-y-2 rounded-xl border border-dashed border-border bg-surface p-3">
                  <TextField
                    label="Tên bước"
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    placeholder="VD: Đặt nạn nhân nằm nghiêng an toàn"
                  />
                  <TextAreaField
                    label="Chi tiết thao tác"
                    rows={2}
                    value={newStepDetail}
                    onChange={(e) => setNewStepDetail(e.target.value)}
                    placeholder="VD: Nhẹ nhàng nghiêng người sang một bên để đường thở thông suốt..."
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddStep}
                    disabled={!newStepTitle.trim() || !newStepDetail.trim()}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Thêm bước này vào danh sách
                  </Button>
                </div>
              </div>

              {/* Do's & Don'ts */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 rounded-2xl border border-border bg-surface-muted/30 p-3">
                  <h4 className="text-xs font-semibold text-primary">NÊN LÀM ({dos.length})</h4>
                  <ul className="space-y-1 text-xs">
                    {dos.map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-1 text-fg">
                        <span>✓ {item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDo(i)}
                          className="text-danger"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-fg"
                      placeholder="Thêm việc NÊN làm..."
                      value={newDoText}
                      onChange={(e) => setNewDoText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDo();
                        }
                      }}
                    />
                    <Button type="button" size="sm" variant="secondary" onClick={handleAddDo}>
                      Thêm
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface-muted/30 p-3">
                  <h4 className="text-xs font-semibold text-danger">
                    TUYỆT ĐỐI TRÁNH ({donts.length})
                  </h4>
                  <ul className="space-y-1 text-xs">
                    {donts.map((item, i) => (
                      <li key={i} className="flex items-center justify-between gap-1 text-fg">
                        <span>✕ {item}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDont(i)}
                          className="text-danger"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-fg"
                      placeholder="Thêm việc CẤM kỵ..."
                      value={newDontText}
                      onChange={(e) => setNewDontText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddDont();
                        }
                      }}
                    />
                    <Button type="button" size="sm" variant="secondary" onClick={handleAddDont}>
                      Thêm
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseTopicDialog}>
                  Hủy
                </Button>
                <Button type="submit">{editingTopic ? 'Lưu thay đổi' : 'Tạo chủ đề sơ cứu'}</Button>
              </div>
            </form>
          ) : null}
        </dialog>

        {/* Confirm Delete Topic */}
        <ConfirmDialog
          open={Boolean(topicToDelete)}
          title="Xác nhận xóa chủ đề sơ cứu"
          confirmLabel="Xóa chủ đề"
          tone="danger"
          onConfirm={() => {
            if (topicToDelete && selectedCondition) {
              const nextTopics = selectedCondition.topics.filter((t) => t.id !== topicToDelete.id);
              saveCondition({
                ...selectedCondition,
                topics: nextTopics,
              });
              setTopicToDelete(null);
            }
          }}
          onCancel={() => setTopicToDelete(null)}
        >
          <p className="text-sm text-fg-muted">
            Bạn có chắc muốn xóa chủ đề &ldquo;{topicToDelete?.title}&rdquo; khỏi hướng dẫn của bệnh
            này?
          </p>
        </ConfirmDialog>

        {/* Confirm Reset / Clear All Topics for this condition */}
        <ConfirmDialog
          open={showResetTopicsConfirm}
          title="Xác nhận làm trống cẩm nang sơ cứu"
          confirmLabel="Xóa hết bài"
          tone="danger"
          onConfirm={() => {
            if (selectedCondition) {
              saveCondition({
                ...selectedCondition,
                topics: [],
              });
              setShowResetTopicsConfirm(false);
            }
          }}
          onCancel={() => setShowResetTopicsConfirm(false)}
        >
          <p className="text-sm text-fg-muted">
            Bạn có chắc muốn xóa toàn bộ các bài sơ cứu của bệnh &ldquo;{selectedCondition.name}
            &rdquo; để tự thêm bài mới từ đầu không?
          </p>
        </ConfirmDialog>
      </div>
    );
  }

  // =============================================================
  // RENDER VIEW 1: MEDICAL CONDITIONS LIST (CRUD BỆNH LÝ)
  // =============================================================
  const totalConditions = conditions.length;
  const conditionPageCount = Math.max(1, Math.ceil(totalConditions / conditionPageSize));
  const currentConditionPage = Math.min(conditionPage, conditionPageCount);
  const paginatedConditions = conditions.slice(
    (currentConditionPage - 1) * conditionPageSize,
    currentConditionPage * conditionPageSize,
  );

  return (
    <Card className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-fg">Cẩm nang sơ cứu ban đầu</h2>
            <Badge tone="neutral">{conditions.length} loại bệnh</Badge>
          </div>
          <p className="text-xs text-fg-muted">
            Quản lý danh sách các loại bệnh, tình trạng cấp cứu và cẩm nang sơ cứu chuyên biệt cho
            từng bệnh.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/first-aid"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg transition hover:bg-surface-muted"
          >
            <ExternalLink aria-hidden="true" className="size-3.5" />
            <span>Xem trang công khai (/first-aid)</span>
          </Link>
          <Button size="sm" onClick={handleOpenCreateCondition}>
            <Plus aria-hidden="true" className="size-4" />
            <span>Thêm loại bệnh mới</span>
          </Button>
          {conditions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowClearConditionsConfirm(true)}
              title="Xóa toàn bộ danh sách bệnh lý để tự thêm từ đầu"
              className="text-danger hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />
              <span>Xóa tất cả bệnh</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowResetConditionsConfirm(true)}
            title="Khôi phục danh mục bệnh chuẩn y tế"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            <span>Khôi phục mẫu</span>
          </Button>
        </div>
      </div>

      {/* Conditions Grid / List */}
      {conditions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <MedicalIcon name="HeartPulse" className="mx-auto size-12 text-fg-muted/60" />
          <h3 className="mt-3 text-lg font-semibold text-fg">Chưa có loại bệnh nào</h3>
          <p className="mt-1 text-sm text-fg-muted max-w-md mx-auto">
            Hệ thống không cài sẵn dữ liệu mẫu. Bạn có thể tự do thêm các loại bệnh lý và hướng dẫn
            sơ cứu theo nhu cầu thực tế.
          </p>
          <Button size="sm" className="mt-4" onClick={handleOpenCreateCondition}>
            <Plus aria-hidden="true" className="size-4" />
            <span>Thêm loại bệnh mới</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {paginatedConditions.map((cond) => {
            const sev = SEVERITY_CONFIG[cond.severity];

            return (
              <div
                key={cond.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-primary/50 hover:shadow-xs sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-4">
                  <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary shadow-xs">
                    <MedicalIcon name={cond.icon} className="size-6" />
                  </span>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-fg text-base">{cond.name}</h3>
                      <Badge tone={sev.tone}>{sev.label}</Badge>
                      <Badge tone="neutral">{cond.topics.length} bài sơ cứu</Badge>
                    </div>
                    <p className="text-xs text-fg-muted">{cond.description}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-end sm:self-center">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedConditionId(cond.id);
                      setTopicPage(1);
                    }}
                    className="font-medium"
                    aria-label={`Chi tiết cẩm nang sơ cứu ${cond.name}`}
                  >
                    <span>Chi tiết</span>
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Button>

                  <button
                    type="button"
                    onClick={() => handleOpenEditCondition(cond)}
                    aria-label={`Sửa thông tin bệnh ${cond.name}`}
                    className="rounded-lg p-2 text-fg-muted transition hover:bg-surface-muted hover:text-fg"
                    title="Chỉnh sửa tên và thông tin bệnh"
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setConditionToDelete(cond)}
                    aria-label={`Xóa loại bệnh ${cond.name}`}
                    className="rounded-lg p-2 text-fg-muted transition hover:bg-danger-soft hover:text-danger"
                    title="Xóa loại bệnh này"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls for Conditions */}
      {totalConditions > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs text-fg-muted">
          <div className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              aria-label="Số loại bệnh trên mỗi trang"
              value={conditionPageSize}
              onChange={(e) => {
                setConditionPageSize(Number(e.target.value));
                setConditionPage(1);
              }}
              className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-fg focus:border-primary focus:outline-hidden"
            >
              <option value={5}>5 loại bệnh / trang</option>
              <option value={10}>10 loại bệnh / trang</option>
              <option value={20}>20 loại bệnh / trang</option>
            </select>
            <span>
              ({(currentConditionPage - 1) * conditionPageSize + 1} -{' '}
              {Math.min(currentConditionPage * conditionPageSize, totalConditions)} /{' '}
              {totalConditions})
            </span>
          </div>

          <Pagination
            page={currentConditionPage}
            pageSize={conditionPageSize}
            total={totalConditions}
            onPageChange={setConditionPage}
          />
        </div>
      )}

      {/* Modal: Create / Edit Medical Condition */}
      <dialog
        ref={conditionDialogRef}
        aria-labelledby={conditionDialogTitleId}
        onClose={handleCloseConditionDialog}
        className="fixed inset-0 z-50 m-auto max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-2xl backdrop:bg-black/50"
      >
        {isCreatingCondition || editingCondition ? (
          <form onSubmit={handleSaveConditionSubmit} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id={conditionDialogTitleId} className="text-lg font-bold text-fg">
                {editingCondition ? 'Chỉnh sửa loại bệnh' : 'Thêm loại bệnh mới'}
              </h3>
              <button
                type="button"
                onClick={handleCloseConditionDialog}
                aria-label="Đóng"
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            {condError && (
              <p className="rounded-xl bg-danger-soft p-3 text-xs font-semibold text-danger">
                {condError}
              </p>
            )}

            <TextField
              label="Tên loại bệnh / tình trạng y tế"
              value={condName}
              onChange={(e) => setCondName(e.target.value)}
              placeholder="VD: Động kinh & Co giật"
              required
            />

            <TextAreaField
              label="Mô tả triệu chứng / dấu hiệu"
              rows={2}
              value={condDesc}
              onChange={(e) => setCondDesc(e.target.value)}
              placeholder="VD: Cơn co giật toàn thân, sùi bọt mép, mất ý thức đột ngột..."
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <SelectField
                label="Biểu tượng (Icon)"
                value={condIcon}
                onChange={(e) => setCondIcon(e.target.value)}
                options={ICON_OPTIONS}
              />

              <SelectField
                label="Mức độ nguy hiểm"
                value={condSeverity}
                onChange={(e) => setCondSeverity(e.target.value as DiseaseSeverity)}
                options={SEVERITY_OPTIONS}
              />
            </div>

            <TextField
              label="Thứ tự hiển thị"
              type="number"
              min={1}
              value={condOrder}
              onChange={(e) => setCondOrder(Number(e.target.value))}
            />

            <div className="flex justify-end gap-2 border-t border-border pt-4">
              <Button type="button" variant="secondary" onClick={handleCloseConditionDialog}>
                Hủy
              </Button>
              <Button type="submit">{editingCondition ? 'Lưu thay đổi' : 'Tạo loại bệnh'}</Button>
            </div>
          </form>
        ) : null}
      </dialog>

      {/* Confirm Delete Condition */}
      <ConfirmDialog
        open={Boolean(conditionToDelete)}
        title="Xác nhận xóa loại bệnh"
        confirmLabel="Xóa loại bệnh"
        tone="danger"
        onConfirm={() => {
          if (conditionToDelete) {
            deleteCondition(conditionToDelete.id);
            setConditionToDelete(null);
          }
        }}
        onCancel={() => setConditionToDelete(null)}
      >
        <p className="text-sm text-fg-muted">
          Bạn có chắc muốn xóa loại bệnh &ldquo;{conditionToDelete?.name}&rdquo; cùng toàn bộ các
          bài hướng dẫn sơ cứu của bệnh này?
        </p>
      </ConfirmDialog>

      {/* Confirm Clear All Conditions */}
      <ConfirmDialog
        open={showClearConditionsConfirm}
        title="Xác nhận xóa toàn bộ danh sách bệnh"
        confirmLabel="Xóa tất cả"
        tone="danger"
        onConfirm={() => {
          conditions.forEach((c) => deleteCondition(c.id));
          setShowClearConditionsConfirm(false);
        }}
        onCancel={() => setShowClearConditionsConfirm(false)}
      >
        <p className="text-sm text-fg-muted">
          Bạn có chắc muốn xóa tất cả các loại bệnh hiện tại để tự tạo danh sách mới từ đầu không?
          Toàn bộ danh mục bệnh và cẩm nang sơ cứu đi kèm sẽ được làm trống.
        </p>
      </ConfirmDialog>

      {/* Confirm Reset All Conditions */}
      <ConfirmDialog
        open={showResetConditionsConfirm}
        title="Khôi phục danh sách bệnh mặc định"
        confirmLabel="Khôi phục danh mục chuẩn"
        tone="primary"
        onConfirm={() => {
          resetConditions();
          setShowResetConditionsConfirm(false);
        }}
        onCancel={() => setShowResetConditionsConfirm(false)}
      >
        <p className="text-sm text-fg-muted">
          Thao tác này sẽ khôi phục 7 loại bệnh và cẩm nang sơ cứu chuẩn y tế ban đầu. Mọi thay đổi
          tùy chỉnh sẽ được đặt lại.
        </p>
      </ConfirmDialog>
    </Card>
  );
}
