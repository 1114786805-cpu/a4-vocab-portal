/**
 * 设置页面 — GitHub Token 配置 + 手动同步按钮
 */

import React, { useState, useEffect } from 'react';
import {
  verifyToken,
  connectGist,
  pushToGist,
  disconnectGist,
  getGistStatus,
  getStoredToken,
  clearStoredToken,
} from '../data/gistSync';

interface SyncSettingsPageProps {
  onBack: () => void;
}

const SyncSettingsPage: React.FC<SyncSettingsPageProps> = ({ onBack }) => {
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [username, setUsername] = useState('');
  const [gistStatus, setGistStatus] = useState(getGistStatus());

  useEffect(() => {
    const savedToken = getStoredToken();
    if (savedToken) {
      setToken(savedToken);
      if (gistStatus.connected) {
        setStatus('connected');
      }
    }
  }, []);

  const handleConnect = async () => {
    if (!token.trim()) {
      setMessage('请输入 GitHub Token');
      setStatus('error');
      return;
    }

    // 验证格式
    if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('github_pat_')) {
      setMessage('Token 格式不正确，以 ghp_ / gho_ / github_pat_ 开头');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setMessage('正在连接…');

    const result = await connectGist(token.trim());

    if (result.success) {
      setStatus('connected');
      setMessage(`${result.message} (Gist: ${result.gistId?.slice(0, 8)}...)`);
      setGistStatus(getGistStatus());

      // 获取用户名
      const user = await verifyToken(token.trim());
      if (user.valid && user.username) {
        setUsername(user.username);
      }
    } else {
      setStatus('error');
      setMessage(result.error || '连接失败');
    }
  };

  const handleDisconnect = () => {
    clearStoredToken();
    disconnectGist();
    setToken('');
    setStatus('idle');
    setMessage('已断开连接');
    setUsername('');
    setGistStatus({ connected: false });
  };

  const handleManualSync = async () => {
    const savedToken = getStoredToken();
    if (!savedToken) {
      setMessage('请先连接 GitHub');
      return;
    }

    setMessage('正在同步…');
    const result = await pushToGist(savedToken);
    setMessage(result.message);
    if (result.success) {
      setGistStatus(getGistStatus());
    }
  };

  const copyGistUrl = () => {
    if (gistStatus.gistId) {
      navigator.clipboard.writeText(`https://gist.github.com/${gistStatus.gistId}`).catch(() => {});
    }
  };

  return (
    <div className="app-container settings-page">
      <div className="settings-header">
        <button className="settings-back-btn" onClick={onBack}>← 返回</button>
        <h2>数据同步设置</h2>
      </div>

      <div className="settings-body">
        {/* 连接状态 */}
        <div className="settings-section">
          <h3>同步状态</h3>
          <div className={`gist-status ${status}`}>
            {status === 'connected' ? '✅ 已连接' :
             status === 'connecting' ? '🔄 连接中…' :
             status === 'error' ? '❌ 连接失败' :
             '⏸ 未连接'}
          </div>
          {username && <div className="gist-username">GitHub: {username}</div>}
          {gistStatus.lastSyncedAt && (
            <div className="gist-synced-at">
              上次同步: {new Date(gistStatus.lastSyncedAt).toLocaleString('zh-CN')}
            </div>
          )}
        </div>

        {/* Token 输入 */}
        <div className="settings-section">
          <h3>GitHub Token</h3>
          <p className="settings-hint">
            使用 GitHub Personal Access Token 共享数据。Token 仅保存在本机浏览器，
            用于读写你的 Secret Gist。
          </p>
          <p className="settings-hint">
            <a
              href="https://github.com/settings/tokens/new?scopes=gist&description=a4-paper-sync"
              target="_blank"
              rel="noopener noreferrer"
            >
              点此创建 Token →
            </a>
            &nbsp;（需要勾选 <code>gist</code> 权限）
          </p>
          <input
            type="password"
            className="settings-token-input"
            placeholder="gho_... 或 github_pat_..."
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleConnect(); }}
            disabled={status === 'connected'}
          />
        </div>

        {/* 操作按钮 */}
        <div className="settings-actions">
          {status !== 'connected' ? (
            <button
              className="settings-btn primary"
              onClick={handleConnect}
              disabled={status === 'connecting' || !token.trim()}
            >
              {status === 'connecting' ? '连接中…' : '连接并同步'}
            </button>
          ) : (
            <>
              <button className="settings-btn primary" onClick={handleManualSync}>
                📤 手动同步到云端
              </button>
              <button className="settings-btn danger" onClick={handleDisconnect}>
                断开连接
              </button>
            </>
          )}
        </div>

        {message && (
          <div className={`settings-message ${status === 'error' ? 'error' : 'info'}`}>
            {message}
            {gistStatus.gistId && (
              <span className="gist-link" onClick={copyGistUrl} title="点击复制 Gist 链接">
                &nbsp;📋 复制链接
              </span>
            )}
          </div>
        )}

        {/* 说明 */}
        <div className="settings-section settings-info">
          <h3>工作原理</h3>
          <ol>
            <li>输入 GitHub Token 后，自动创建或连接一个私密 Gist</li>
            <li>你的所有学习数据（词书、进度、错词等）打包加密存放</li>
            <li>三端使用同一个 Gist → 共享同一份数据</li>
            <li>每次打开时自动从云端拉取最新数据</li>
            <li>你也可以手动点击"同步到云端"即时上传</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default SyncSettingsPage;
