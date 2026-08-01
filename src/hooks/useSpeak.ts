import { useCallback, useRef } from 'react';

/**
 * 使用 Web Speech API 播放单词发音
 * 自动检测可用语音，优先用美式发音
 */
export function useSpeak() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    // 取消当前正在播放的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.9;      // 稍微慢一点，更清晰
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // 尝试选择美式英语语音
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => v.lang.startsWith('en-US') && v.name.includes('Female'))
      || voices.find(v => v.lang.startsWith('en-US'))
      || voices.find(v => v.lang.startsWith('en'));
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  return { speak, stop };
}
