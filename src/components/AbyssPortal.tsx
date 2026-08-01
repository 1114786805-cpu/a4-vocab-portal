import { useRef, useEffect, useCallback } from 'react';
import './AbyssPortal.css';

const abyssUrl = `${import.meta.env.BASE_URL}abyss.html`;

interface Props {
  onExit: () => void;
}

export function AbyssPortal({ onExit }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 监听 iframe 内 postMessage（用于 home 按钮返回）
  const handleMessage = useCallback((e: MessageEvent) => {
    if (e.data === 'a4-exit-abyss') {
      onExit();
    }
  }, [onExit]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  return (
    <div className="abyss-portal-wrapper">
      {/* 返回按钮 — 浮在 iframe 上方 */}
      <button className="abyss-exit-btn" onClick={onExit} title="返回首页">
        ✦ 退出异世界 ✦
      </button>

      <iframe
        ref={iframeRef}
        className="abyss-iframe"
        src={abyssUrl}
        title="异世界入口"
      />
    </div>
  );
}
