import {
  AlertTriangle,
  Eye,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { useId, useRef, useState, useEffect } from 'react';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextAreaField } from '../../components/ui/TextAreaField';
import { TextField } from '../../components/ui/TextField';
import { formatDateTime } from '../../lib/format';
import { useDisclaimerContent } from './medical-content.storage';
import type { DisclaimerItem } from './medical-content.types';

export function AdminDisclaimerCard() {
  const { disclaimer, save, reset, addItem, updateItem, deleteItem } = useDisclaimerContent();

  // State for modals
  const [editingItem, setEditingItem] = useState<DisclaimerItem | null>(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewAgreed, setPreviewAgreed] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DisclaimerItem | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Form fields for item
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');
  const [itemError, setItemError] = useState('');

  // Form fields for general config
  const [configTitle, setConfigTitle] = useState('');
  const [configWarning, setConfigWarning] = useState('');
  const [configCheckbox, setConfigCheckbox] = useState('');
  const [configButton, setConfigButton] = useState('');

  // Dialog refs
  const itemDialogRef = useRef<HTMLDialogElement>(null);
  const configDialogRef = useRef<HTMLDialogElement>(null);
  const previewDialogRef = useRef<HTMLDialogElement>(null);

  const itemDialogTitleId = useId();
  const configDialogTitleId = useId();
  const previewDialogTitleId = useId();

  // Open / Close Item Dialog
  useEffect(() => {
    const d = itemDialogRef.current;
    if (!d) return;
    if ((isAddingItem || editingItem) && !d.open) d.showModal();
    if (!isAddingItem && !editingItem && d.open) d.close();
  }, [isAddingItem, editingItem]);

  // Open / Close Config Dialog
  useEffect(() => {
    const d = configDialogRef.current;
    if (!d) return;
    if (isEditingConfig && !d.open) d.showModal();
    if (!isEditingConfig && d.open) d.close();
  }, [isEditingConfig]);

  // Open / Close Preview Dialog
  useEffect(() => {
    const d = previewDialogRef.current;
    if (!d) return;
    if (isPreviewOpen && !d.open) {
      setPreviewAgreed(false);
      d.showModal();
    }
    if (!isPreviewOpen && d.open) d.close();
  }, [isPreviewOpen]);

  // Handlers for Item
  const handleOpenAdd = () => {
    setItemTitle('');
    setItemContent('');
    setItemError('');
    setIsAddingItem(true);
  };

  const handleOpenEditItem = (item: DisclaimerItem) => {
    setEditingItem(item);
    setItemTitle(item.title);
    setItemContent(item.content);
    setItemError('');
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim() || !itemContent.trim()) {
      setItemError('Vui lòng nhập đầy đủ tiêu đề và nội dung điều khoản.');
      return;
    }

    if (editingItem) {
      updateItem(editingItem.id, { title: itemTitle.trim(), content: itemContent.trim() });
      setEditingItem(null);
    } else {
      addItem({ title: itemTitle.trim(), content: itemContent.trim() });
      setIsAddingItem(false);
    }
  };

  // Handlers for Config
  const handleOpenConfig = () => {
    setConfigTitle(disclaimer.title);
    setConfigWarning(disclaimer.warningText);
    setConfigCheckbox(disclaimer.checkboxLabel);
    setConfigButton(disclaimer.confirmButtonText);
    setIsEditingConfig(true);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!configTitle.trim() || !configCheckbox.trim() || !configButton.trim()) {
      return;
    }
    save({
      ...disclaimer,
      title: configTitle.trim(),
      warningText: configWarning.trim(),
      checkboxLabel: configCheckbox.trim(),
      confirmButtonText: configButton.trim(),
    });
    setIsEditingConfig(false);
  };

  return (
    <>
      <Card className="flex flex-col justify-between">
        <div>
          {/* Card Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-fg">
                <ShieldAlert aria-hidden="true" className="size-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-fg">Điều khoản miễn trừ trách nhiệm</h2>
                  <Badge tone="success">Hiệu lực</Badge>
                </div>
                <p className="text-xs text-fg-muted">
                  Cập nhật: {formatDateTime(disclaimer.updatedAt)} ({disclaimer.items.length} mục)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsPreviewOpen(true)}
                title="Xem thử popup điều khoản hiển thị cho khách"
              >
                <Eye aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Xem trước</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenConfig}
                title="Cấu hình tiêu đề & thông báo"
              >
                <Settings2 aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Cấu hình</span>
              </Button>
            </div>
          </div>

          {/* Quick Info & Notice Banner */}
          <div className="mt-4 rounded-xl border border-warning/20 bg-warning-soft/30 p-3 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-warning" />
              <div className="space-y-1">
                <p className="font-semibold text-fg">Tiêu đề popup: {disclaimer.title}</p>
                <p className="text-fg-muted italic">"{disclaimer.warningText}"</p>
              </div>
            </div>
          </div>

          {/* Items List (Read & Update/Delete) */}
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
                Danh sách các điều khoản ({disclaimer.items.length})
              </span>
              <Button variant="ghost" size="sm" onClick={handleOpenAdd}>
                <Plus aria-hidden="true" className="size-4" />
                Thêm điều khoản
              </Button>
            </div>

            {disclaimer.items.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-fg-muted">
                Chưa có điều khoản nào. Nhấn "+ Thêm điều khoản" bên trên để tạo.
              </p>
            ) : (
              <ul className="space-y-2">
                {disclaimer.items.map((item, idx) => (
                  <li
                    key={item.id}
                    className="group flex items-start justify-between gap-3 rounded-xl border border-border bg-surface-muted p-3 text-xs transition hover:border-primary/40"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-fg">
                          {idx + 1}. {item.title}
                        </span>
                      </div>
                      <p className="text-fg-muted leading-relaxed line-clamp-2">{item.content}</p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1 opacity-90 transition group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => handleOpenEditItem(item)}
                        className="rounded-lg p-1.5 text-fg-muted hover:bg-surface hover:text-fg"
                        aria-label={`Sửa điều khoản ${item.title}`}
                      >
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemToDelete(item)}
                        className="rounded-lg p-1.5 text-fg-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Xóa điều khoản ${item.title}`}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Card Footer Actions */}
        <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs">
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="inline-flex items-center gap-1.5 text-fg-muted hover:text-fg transition-colors"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Khôi phục mặc định y tế
          </button>
          <span className="text-[11px] text-fg-muted">Tự động đồng bộ lên Popup sơ cứu</span>
        </div>
      </Card>

      {/* MODAL 1: ADD OR EDIT ITEM */}
      <dialog
        ref={itemDialogRef}
        aria-labelledby={itemDialogTitleId}
        onCancel={(e) => {
          e.preventDefault();
          setIsAddingItem(false);
          setEditingItem(null);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border bg-surface p-6 text-fg shadow-2xl backdrop:bg-black/60"
      >
        {(isAddingItem || editingItem) && (
          <form onSubmit={handleSaveItem} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id={itemDialogTitleId} className="text-base font-bold text-fg">
                {editingItem ? 'Chỉnh sửa điều khoản' : 'Thêm điều khoản mới'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsAddingItem(false);
                  setEditingItem(null);
                }}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                aria-label="Đóng cửa sổ"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            {itemError && (
              <p className="rounded-lg bg-danger-soft p-2.5 text-xs text-danger">{itemError}</p>
            )}

            <TextField
              label="Tiêu đề điều khoản"
              value={itemTitle}
              onChange={(e) => {
                setItemTitle(e.target.value);
                setItemError('');
              }}
              placeholder="VD: Tính chất tham khảo, Ưu tiên cấp cứu 115..."
              required
            />

            <TextAreaField
              label="Nội dung điều khoản chi tiết"
              value={itemContent}
              onChange={(e) => {
                setItemContent(e.target.value);
                setItemError('');
              }}
              rows={4}
              placeholder="Nhập nội dung quy định miễn trừ trách nhiệm..."
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setIsAddingItem(false);
                  setEditingItem(null);
                }}
              >
                Hủy
              </Button>
              <Button type="submit" variant="primary">
                {editingItem ? 'Lưu thay đổi' : 'Lưu điều khoản mới'}
              </Button>
            </div>
          </form>
        )}
      </dialog>

      {/* MODAL 2: EDIT GENERAL CONFIG */}
      <dialog
        ref={configDialogRef}
        aria-labelledby={configDialogTitleId}
        onCancel={(e) => {
          e.preventDefault();
          setIsEditingConfig(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border bg-surface p-6 text-fg shadow-2xl backdrop:bg-black/60"
      >
        {isEditingConfig && (
          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 id={configDialogTitleId} className="text-base font-bold text-fg">
                Cấu hình thông báo & nút bấm
              </h3>
              <button
                type="button"
                onClick={() => setIsEditingConfig(false)}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                aria-label="Đóng cửa sổ"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <TextField
              label="Tiêu đề cửa sổ Popup"
              value={configTitle}
              onChange={(e) => setConfigTitle(e.target.value)}
              required
            />

            <TextField
              label="Dòng cảnh báo phụ"
              value={configWarning}
              onChange={(e) => setConfigWarning(e.target.value)}
              placeholder="VD: Vui lòng đọc kỹ trước khi xem hướng dẫn sơ cứu..."
            />

            <TextAreaField
              label="Nội dung ô chọn đồng ý (Checkbox)"
              value={configCheckbox}
              onChange={(e) => setConfigCheckbox(e.target.value)}
              rows={2}
              required
            />

            <TextField
              label="Nhãn nút xác nhận"
              value={configButton}
              onChange={(e) => setConfigButton(e.target.value)}
              required
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setIsEditingConfig(false)}>
                Hủy
              </Button>
              <Button type="submit" variant="primary">
                Lưu cấu hình
              </Button>
            </div>
          </form>
        )}
      </dialog>

      {/* MODAL 3: LIVE PREVIEW MODAL */}
      <dialog
        ref={previewDialogRef}
        aria-labelledby={previewDialogTitleId}
        onCancel={(e) => {
          e.preventDefault();
          setIsPreviewOpen(false);
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-3xl border border-border bg-surface p-6 text-fg shadow-2xl backdrop:bg-black/60"
      >
        {isPreviewOpen && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-warning-soft text-warning-soft-fg">
                  <ShieldAlert aria-hidden="true" className="size-5" />
                </span>
                <h3 id={previewDialogTitleId} className="text-lg font-bold text-fg">
                  {disclaimer.title} (Xem thử)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="rounded-lg p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
                aria-label="Đóng xem trước"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <div className="space-y-3 rounded-2xl bg-surface-muted p-4 text-sm leading-relaxed text-fg">
              {disclaimer.warningText && (
                <div className="flex items-start gap-2 text-danger font-medium">
                  <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>{disclaimer.warningText}</span>
                </div>
              )}
              <ul className="list-disc space-y-2 pl-5 text-xs text-fg-muted">
                {disclaimer.items.map((item) => (
                  <li key={item.id}>
                    <strong className="text-fg">{item.title}:</strong> {item.content}
                  </li>
                ))}
              </ul>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-surface-muted">
              <input
                type="checkbox"
                checked={previewAgreed}
                onChange={(e) => setPreviewAgreed(e.target.checked)}
                className="mt-0.5 size-4.5 rounded border-border text-primary focus:ring-primary"
              />
              <span className="text-xs font-medium text-fg leading-relaxed">
                {disclaimer.checkboxLabel}
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setIsPreviewOpen(false)}>
                Đóng xem thử
              </Button>
              <Button
                variant="primary"
                disabled={!previewAgreed}
                onClick={() => setIsPreviewOpen(false)}
              >
                {disclaimer.confirmButtonText}
              </Button>
            </div>
          </div>
        )}
      </dialog>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        open={Boolean(itemToDelete)}
        title="Xác nhận xóa điều khoản"
        confirmLabel="Xóa điều khoản"
        tone="danger"
        onCancel={() => setItemToDelete(null)}
        onConfirm={() => {
          if (itemToDelete) {
            deleteItem(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
      >
        Bạn có chắc chắn muốn xóa điều khoản <strong>"{itemToDelete?.title}"</strong> không? Sau khi
        xóa, popup điều khoản của khách sẽ không còn hiển thị mục này.
      </ConfirmDialog>

      {/* CONFIRM RESET DIALOG */}
      <ConfirmDialog
        open={showResetConfirm}
        title="Khôi phục điều khoản mặc định"
        confirmLabel="Khôi phục gốc"
        tone="danger"
        onCancel={() => setShowResetConfirm(false)}
        onConfirm={() => {
          reset();
          setShowResetConfirm(false);
        }}
      >
        Tất cả các chỉnh sửa điều khoản hiện tại sẽ được thay thế bằng bộ điều khoản miễn trừ trách
        nhiệm y tế chuẩn ban đầu của hệ thống. Bạn có chắc muốn khôi phục không?
      </ConfirmDialog>
    </>
  );
}
