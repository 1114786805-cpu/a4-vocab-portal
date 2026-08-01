/**
 * 保存状态提示 Toast
 * 在页面右下角显示所有存储层的同步状态
 *
 * 轮询每个 store 的 _lastSyncResult，汇总显示：
 * - ✅ 全部已同步
 * - ⚠️ N 个存储层同步失败（点击展开详情）
 * - 优雅的动画进出
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getLastBackupSyncResult } from '../data/readingStore';
import { getMasterySyncResult } from '../store/progressStore';
import { getProgressSyncResult } from '../store/persistStore';
import { getPhraseSyncResult } from '../data/phraseStore';

type SyncResult = { success: true } | { success: false; error: string };

interface StoreStatus {
  label: string;
  result: SyncResult;
}

const POLL_INTERVAL = 1500; // ms

export default function SaveStatusToast() {
  const [stores, setStores] = useState<StoreStatus[]>([]);
  const [expanded, setExpanded] = useState(false);
  const prevOkRef = useRef(true);

  const poll = useCallback(() => {
    const results: StoreStatus[] = [
      { label: '阅读篇目', result: getLastBackupSyncResult() },
      { label: '掌握度', result: getMasterySyncResult() },
      { label: '学习进度', result: getProgressSyncResult() },
      { label: '短语积累', result: getPhraseSyncResult() },
    ];
    setStores(results);
  }, []);

  useEffect(() => {
    poll(); // 初始拉取
    const id = setInterval(poll, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [poll]);

  const failed = stores.filter(s => !s.result.success);
  const allOk = failed.length === 0;
  const anyLoading = stores.length === 0;

  // 从成功→失败时自动展开
  if (!allOk && prevOkRef.current) {
    prevOkRef.current = false;
    setExpanded(true);
  }
  if (allOk) prevOkRef.current = true;

  const toastStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: 16,
    right: 16,
    zIndex: 9999,
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'all 0.3s ease',
  };

  const bubbleStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 20,
    background: allOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
    border: `1px solid ${allOk ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
    color: allOk ? '#16a34a' : '#dc2626',
    backdropFilter: 'blur(8px)',
  };

  const panelStyle: React.CSSProperties = {
    marginTop: 6,
    padding: '8px 12px',
    borderRadius: 10,
    background: 'rgba(0,0,0,0.75)',
    backdropFilter: 'blur(12px)',
    color: '#e5e5e5',
    fontSize: 12,
    lineHeight: 1.6,
    minWidth: 200,
  };

  return (
    <div
      style={toastStyle}
      onClick={() => setExpanded(v => !v)}
      title={allOk ? '数据已备份' : `${failed.length} 个存储层同步失败，点击查看详情`}
    >
      {/* 小圆点 */}
      <div style={bubbleStyle}>
        <span style={{ fontSize: 16 }}>{allOk ? '✅' : '⚠️'}</span>
        <span>{allOk ? '已保存' : `${failed.length} 项失败`}</span>
      </div>

      {/* 展开详情面板 */}
      {expanded && (
        <div style={panelStyle}>
          {anyLoading && <div>检测中…</div>}
          {stores.map(s => (
            <div
              key={s.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 0',
              }}
            >
              <span>{s.result.success ? '✅' : '❌'}</span>
              <span style={{ fontWeight: 500, minWidth: 70 }}>{s.label}</span>
              <span style={{ color: s.result.success ? '#86efac' : '#fca5a5', fontSize: 11 }}>
                {s.result.success ? 'OK' : s.result.error.slice(0, 40) + (s.result.error.length > 40 ? '…' : '')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
