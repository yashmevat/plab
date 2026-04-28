'use client';
import { useState, useRef, useEffect } from 'react';

export function useSpeech({ currentPageIndex, allPages, isSinglePageMode, isFlipping, onAutoAdvance }) {
  // Keep latest onAutoAdvance in a ref so utterance.onend always calls current version
  const onAutoAdvanceRef = useRef(onAutoAdvance);
  onAutoAdvanceRef.current = onAutoAdvance;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechPageIndex, setSpeechPageIndex] = useState(null);
  const [wasPlayingBeforeFlip, setWasPlayingBeforeFlip] = useState(false);
  const speechRef = useRef(null);
  const utteranceRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speechRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-resume after page flip
  useEffect(() => {
    if (wasPlayingBeforeFlip && !isFlipping) {
      const timer = setTimeout(() => {
        startSpeaking();
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [currentPageIndex, isFlipping, wasPlayingBeforeFlip]);

  // Extract text from HTML, adding a natural pause after each block/list item
  const extractTextFromHtml = (html) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Block-level tags that should each become a separate sentence chunk
    const BLOCK_TAGS = new Set([
      'P', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
      'BLOCKQUOTE', 'DT', 'DD', 'FIGCAPTION', 'CAPTION',
      'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER',
    ]);

    const chunks = [];

    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent;
        if (t.trim()) {
          // Append to last chunk if there is one, otherwise start new
          if (chunks.length > 0) {
            chunks[chunks.length - 1] += t;
          } else {
            chunks.push(t);
          }
        }
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName;
      const isBlock = BLOCK_TAGS.has(tag);

      if (isBlock) {
        // Start a fresh chunk for this block
        chunks.push('');
        for (const child of node.childNodes) walk(child);
        // Ensure the chunk ends with a period so TTS pauses
        const last = chunks[chunks.length - 1].trimEnd();
        if (last && !/[.!?]$/.test(last)) {
          chunks[chunks.length - 1] = last + '. ';
        } else if (last) {
          chunks[chunks.length - 1] = last + ' ';
        }
      } else {
        for (const child of node.childNodes) walk(child);
      }
    };

    for (const child of tempDiv.childNodes) walk(child);

    return chunks.join('').replace(/\s{2,}/g, ' ').trim();
  };

  const getPageText = () => {
    let text = '';

    if (isSinglePageMode()) {
      const page = allPages[currentPageIndex];
      if (page) {
        if (page.type === 'content' && page.content?.content) {
          text = extractTextFromHtml(page.content.content);
        } else if (page.type === 'topic-title') {
          text = page.content.name;
        } else if (page.type === 'subtopic-title') {
          text = page.content.name;
        }
      }
    } else {
      const leftPageIndex = currentPageIndex;
      const rightPageIndex = currentPageIndex + 1;
      const leftPage = allPages[leftPageIndex];
      const rightPage = allPages[rightPageIndex];

      if (leftPage) {
        if (leftPage.type === 'content' && leftPage.content?.content) {
          const leftText = extractTextFromHtml(leftPage.content.content);
          if (leftText.trim()) text += leftText + ' ';
        } else if (leftPage.type === 'chapter-title') {
          text += leftPage.content.title + '. ';
        }
      }

      if (rightPage) {
        if (rightPage.type === 'content' && rightPage.content?.content) {
          const rightText = extractTextFromHtml(rightPage.content.content);
          if (rightText.trim()) text += rightText;
        } else if (rightPage.type === 'chapter-title') {
          text += rightPage.content.title;
        }
      }
    }

    return text.trim();
  };

  const startSpeaking = () => {
    if (!window.speechSynthesis) {
      alert('Speech synthesis not supported in your browser');
      return;
    }

    const text = getPageText();
    if (!text.trim()) {
      // No readable text on this page — skip to next page automatically
      const maxIndex = isSinglePageMode() ? allPages.length - 1 : allPages.length - 2;
      if (currentPageIndex < maxIndex) {
        setWasPlayingBeforeFlip(true);
        onAutoAdvanceRef.current?.();
      } else {
        setWasPlayingBeforeFlip(false);
      }
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setSpeechPageIndex(currentPageIndex);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setSpeechPageIndex(null);

      const maxIndex = isSinglePageMode() ? allPages.length - 1 : allPages.length - 2;
      if (currentPageIndex < maxIndex) {
        setWasPlayingBeforeFlip(true);
        setTimeout(() => { onAutoAdvanceRef.current?.(); }, 500);
      } else {
        setWasPlayingBeforeFlip(false);
      }
    };

    utterance.onerror = (event) => {
      console.log('Speech error:', event);
      setIsSpeaking(false);
      setIsPaused(false);
      setSpeechPageIndex(null);
      setWasPlayingBeforeFlip(false);
    };

    utteranceRef.current = utterance;
    speechRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeaking = () => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      setSpeechPageIndex(currentPageIndex);
    }
  };

  const resumeSpeaking = () => {
    if (speechPageIndex !== null && speechPageIndex !== currentPageIndex) {
      stopSpeaking(false);
      setTimeout(() => { startSpeaking(); }, 100);
    } else if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      startSpeaking();
    }
  };

  const stopSpeaking = (shouldResume = false) => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setSpeechPageIndex(null);
    setWasPlayingBeforeFlip(shouldResume ? true : false);
  };

  return {
    isSpeaking,
    isPaused,
    wasPlayingBeforeFlip,
    setWasPlayingBeforeFlip,
    startSpeaking,
    pauseSpeaking,
    resumeSpeaking,
    stopSpeaking,
  };
}
