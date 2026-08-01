/**
 * PhraseBookPage — 短语积累本
 *
 * 功能：
 * - 列表展示所有已积累的短语（按时间倒序）
 * - 点击"+"添加新短语
 * - 点击短语条目可编辑或删除
 * - 输入框：短语、释义、例句（可选）、备注（可选）
 */

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { getAllPhrases, addPhrase, deletePhrase, updatePhrase, type PhraseEntry } from '../data/phraseStore';
import { completePhrase } from '../ai/completePhrase';

interface PhraseBookPageProps {
  onBack: () => void;
}

type PhModalMode = 'add' | 'edit' | null;

export function PhraseBookPage({ onBack }: PhraseBookPageProps) {
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalMode, setModalMode] = useState<PhModalMode>(null);
  const [editEntry, setEditEntry] = useState<PhraseEntry | null>(null);

  // 编辑/新增表单字段
  const [formPhrase, setFormPhrase] = useState('');
  const [formDef, setFormDef] = useState('');
  const [formExample, setFormExample] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // AI 补全状态
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const phraseInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const phrases = useMemo(() => getAllPhrases(), [refreshKey]);

  // 打开添加弹窗
  const openAdd = useCallback(() => {
    setFormPhrase('');
    setFormDef('');
    setFormExample('');
    setFormNotes('');
    setEditEntry(null);
    setModalMode('add');
    setTimeout(() => phraseInputRef.current?.focus(), 100);
  }, []);

  // 打开编辑弹窗
  const openEdit = useCallback((entry: PhraseEntry) => {
    setFormPhrase(entry.phrase);
    setFormDef(entry.definition);
    setFormExample(entry.example);
    setFormNotes(entry.notes);
    setEditEntry(entry);
    setModalMode('edit');
    setTimeout(() => phraseInputRef.current?.focus(), 100);
  }, []);

  // 关闭弹窗
  const closeModal = useCallback(() => {
    setModalMode(null);
    setEditEntry(null);
    setAiLoading(false);
    setAiError('');
  }, []);

  // 保存（新增或更新）
  const handleSave = useCallback(() => {
    const p = formPhrase.trim();
    const d = formDef.trim();
    if (!p || !d) {
      alert('短语和释义不能为空');
      return;
    }

    if (modalMode === 'add') {
      addPhrase(p, d, formExample.trim(), formNotes.trim());
    } else if (modalMode === 'edit' && editEntry) {
      updatePhrase(editEntry.id, { phrase: p, definition: d, example: formExample.trim(), notes: formNotes.trim() });
    }

    setRefreshKey(k => k + 1);
    closeModal();
  }, [formPhrase, formDef, formExample, formNotes, modalMode, editEntry, closeModal]);

  // 删除
  const handleDelete = useCallback((id: string) => {
    if (!confirm('确定删除这条短语？')) return;
    deletePhrase(id);
    setRefreshKey(k => k + 1);
  }, []);

  // AI 补全短语
  const handleAiComplete = useCallback(async () => {
    const p = formPhrase.trim();
    if (!p) {
      setAiError('请先输入短语');
      return;
    }

    setAiLoading(true);
    setAiError('');

    try {
      const result = await completePhrase(p, formDef.trim() || undefined);
      // AI 返回后填入表单，不覆盖用户已手动输入的内容
      if (!formDef.trim() && result.definition) setFormDef(result.definition);
      if (!formExample.trim() && result.example) setFormExample(result.example);
      if (!formNotes.trim() && result.notes) setFormNotes(result.notes);
    } catch (e: any) {
      setAiError(e.message || 'AI 补全失败');
    } finally {
      setAiLoading(false);
    }
  }, [formPhrase, formDef, formExample, formNotes]);

  // 点击遮罩关闭弹窗
  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === overlayRef.current) closeModal();
  }, [closeModal]);

  // 键盘快捷键
  useEffect(() => {
    if (!modalMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [modalMode, closeModal, handleSave]);

  return (
    <div className="phrasebook-page">
      {/* 顶栏 */}
      <div className="phrasebook-header">
        <button className="nav-back-btn" onClick={onBack}>← 返回</button>
        <h2 className="phrasebook-title">短语积累本</h2>
        <div className="phrasebook-header-spacer" />
      </div>

      {/* 统计 + 添加按钮 */}
      <div className="phrasebook-toolbar">
        <span className="phrasebook-count">共 {phrases.length} 条短语</span>
        <button className="phrasebook-add-btn" onClick={openAdd}>+ 添加短语</button>
      </div>

      {/* 短语列表 */}
      <div className="phrasebook-list">
        {phrases.length === 0 ? (
          <div className="phrasebook-empty">
            <div className="phrasebook-empty-icon">📝</div>
            <p>还没有积累短语</p>
            <p className="phrasebook-empty-hint">点击上方「+ 添加短语」开始积累</p>
          </div>
        ) : (
          phrases.map(entry => (
            <div key={entry.id} className="phrasebook-item" onClick={() => openEdit(entry)}>
              <div className="phrasebook-item-main">
                <span className="phrasebook-item-phrase">{entry.phrase}</span>
                <span className="phrasebook-item-def">{entry.definition}</span>
              </div>
              <div className="phrasebook-item-meta">
                {entry.example && <span className="phrasebook-item-example">{entry.example}</span>}
                {entry.notes && <span className="phrasebook-item-notes">{entry.notes}</span>}
                <span className="phrasebook-item-date">{new Date(entry.createdAt).toLocaleDateString('zh-CN')}</span>
              </div>
              <button
                className="phrasebook-item-delete"
                onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                title="删除"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>

      {/* 添加/编辑弹窗 */}
      {modalMode && (
        <div className="phrasebook-overlay" ref={overlayRef} onClick={handleOverlayClick}>
          <div className="phrasebook-modal">
            <h3 className="phrasebook-modal-title">
              {modalMode === 'add' ? '添加短语' : '编辑短语'}
            </h3>

            <label className="phrasebook-modal-label">
              短语 <span className="required">*</span>
            </label>
            <div className="phrasebook-modal-phrase-row">
              <input
                ref={phraseInputRef}
                className="phrasebook-modal-input phrase-input-wide"
                type="text"
                value={formPhrase}
                onChange={e => setFormPhrase(e.target.value)}
                placeholder="例如：break the ice"
              />
              <button
                className="phrasebook-ai-btn"
                onClick={handleAiComplete}
                disabled={aiLoading || !formPhrase.trim()}
                title="AI 补全释义、例句和备注"
              >
                {aiLoading ? '⏳' : '✨'} AI
              </button>
            </div>
            {aiError && <p className="phrasebook-ai-error">⚠️ {aiError}</p>}

            <label className="phrasebook-modal-label">
              释义 <span className="required">*</span>
            </label>
            <input
              className="phrasebook-modal-input"
              type="text"
              value={formDef}
              onChange={e => setFormDef(e.target.value)}
              placeholder="例如：打破僵局"
            />

            <label className="phrasebook-modal-label">例句（可选）</label>
            <textarea
              className="phrasebook-modal-textarea"
              value={formExample}
              onChange={e => setFormExample(e.target.value)}
              placeholder="例如：He told a joke to break the ice at the meeting."
              rows={2}
            />

            <label className="phrasebook-modal-label">备注（可选）</label>
            <input
              className="phrasebook-modal-input"
              type="text"
              value={formNotes}
              onChange={e => setFormNotes(e.target.value)}
              placeholder="例如：常用于社交破冰场景"
            />

            <div className="phrasebook-modal-actions">
              <button className="phrasebook-modal-btn cancel" onClick={closeModal}>取消</button>
              <button className="phrasebook-modal-btn save" onClick={handleSave}>
                {modalMode === 'add' ? '添加' : '保存'}
              </button>
            </div>
            <p className="phrasebook-modal-hint">按 Ctrl+Enter 快速保存，按 Esc 取消</p>
          </div>
        </div>
      )}
    </div>
  );
}
