"use client";

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Mark from 'mark.js';
import { useSpeech } from './useSpeech';

// Force dynamic rendering to prevent useSearchParams SSR issues
// export const dynamic = 'force-dynamic';

export default function BookReaderPage() {
  const params = useParams();
  const bookId = params.bookId;
  const router = useRouter();

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

  const [book, setBook] = useState(null);
  const [topics, setTopics] = useState([]);
  const [allPages, setAllPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isFlipping, setIsFlipping] = useState(false);
  const [flipDirection, setFlipDirection] = useState(null);
  const [bookOpened, setBookOpened] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragCurrentX, setDragCurrentX] = useState(0);
  const [canDrag, setCanDrag] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window === 'undefined') return 100;
    const width = window.innerWidth;
    if (width < 1024) return 100; // Mobile & Tablet
    if (width <= 1300) return 51; // Small Desktop (1024-1300px)
    return 65; // Large Desktop (>1300px)
  });
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [pageViewMode, setPageViewMode] = useState('double'); // 'single' or 'double' for desktop
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1920);
  const bookContainerRef = useRef(null);
  const selectionTimerRef = useRef(null);
  const applyingHighlightsRef = useRef(false);

  // Highlight states
  const [highlights, setHighlights] = useState([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectedColor, setSelectedColor] = useState('#FFFF00');
  const [highlightTitle, setHighlightTitle] = useState('');
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });

  // Bookmark states
  const [bookmarks, setBookmarks] = useState([]);
  const [showBookmarkModal, setShowBookmarkModal] = useState(false);

  // A4 EXACT dimensions at 96 DPI (matching author page: PAGE_WIDTH=794, PAGE_HEIGHT=1123)
  const A4_WIDTH = 794;
  const A4_HEIGHT = 1123;
  const [maxPageHeight, setMaxPageHeight] = useState(A4_HEIGHT);
  const prevFontSizeRef = useRef(fontSize); // Track previous font size with ref (more reliable)
  const globalMaxHeightRef = useRef(0); // Start at 0 so first measurement sets the correct height
  // Font size slider bounds
  const FONT_MIN = 10; // allow sizes below 50%
  const FONT_MAX = 200;
  const FONT_STEP = 5;

  const [token, setToken] = useState(null);
  // tokenRef — always holds the latest token in memory.
  // Used by all fetch functions so they work even when localStorage is
  // blocked (incognito / third-party storage restrictions).
  const tokenRef = useRef(null);
  const setAuthToken = (t) => { tokenRef.current = t; setToken(t); };

  // Safe localStorage helpers — silently no-op when storage is blocked
  const safeSetLS = (key, value) => { try { localStorage.setItem(key, value); } catch (e) { } };
  const safeGetLS = (key) => { try { return localStorage.getItem(key); } catch (e) { return null; } };

  // Helper to get current token from URL parameters
  const getCurrentUrlToken = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token');
    } catch (e) {
      console.error('❌ Failed to get URL token:', e);
      return null;
    }
  };

  // Helper to update URL token parameter instead of storing in localStorage
  const updateUrlToken = (newToken) => {
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('token', newToken);
      window.history.replaceState(null, '', currentUrl.toString());
      console.log('✅ URL token updated:', newToken?.substring(0, 30) + '...');
    } catch (e) {
      console.error('❌ Failed to update URL token:', e);
    }
  };

  // Compute slider fill percent for UI and update CSS custom property for font scaling
  const sliderFill = Math.round(((fontSize - FONT_MIN) / (FONT_MAX - FONT_MIN)) * 100);

  // Helper to check if we're in single page mode (mobile OR desktop with single view)
  const isSinglePageMode = () => isMobile || pageViewMode === 'single';

  const [flippingCorner, setFlippingCorner] = useState(null);

  const renderCornerFolds = (pageSide, showBothSides = false) => {
    const foldClasses = showBothSides
      ? ['fold-top-left', 'fold-bottom-left', 'fold-top-right', 'fold-bottom-right']
      : pageSide === 'left'
        ? ['fold-top-left', 'fold-bottom-left']
        : ['fold-top-right', 'fold-bottom-right'];

    return (
      <>
        {foldClasses.map((foldClass) => (
          <div
            key={foldClass}
            className={`page-fold ${foldClass} ${isFlipping && flippingCorner === foldClass ? 'force-hover' : ''} ${isFlipping && flippingCorner !== foldClass ? 'pointer-events-none' : ''}`}
            onMouseEnter={() => !isFlipping && setFlippingCorner(foldClass)}
            onClick={() => {
              if (isFlipping) return;
              setFlippingCorner(foldClass);
              if (foldClass.includes('right')) {
                nextPage();
              } else {
                prevPage();
              }
            }}
          />
        ))}
      </>
    );
  };

  // Speech synthesis hook
  const { isSpeaking, isPaused, wasPlayingBeforeFlip, setWasPlayingBeforeFlip, startSpeaking, pauseSpeaking, resumeSpeaking, stopSpeaking } = useSpeech({
    currentPageIndex,
    allPages,
    isSinglePageMode,
    isFlipping,
    onAutoAdvance: () => nextPage?.(),
  });

  // Helper: estimate scale applied by CSS transform on the container.
  const getScaleForElement = (el) => {
    if (!el) return 1;
    try {
      const cs = window.getComputedStyle(el);
      const t = cs.transform;
      if (!t || t === 'none') return 1;
      // Use DOMMatrix when available
      if (typeof DOMMatrixReadOnly !== 'undefined') {
        const m = new DOMMatrixReadOnly(t);
        return m.a || 1;
      }
      // Fallback parse matrix(a,b,c,d,e,f)
      const values = t.match(/matrix\(([^)]+)\)/);
      if (values && values[1]) {
        const parts = values[1].split(',').map(p => parseFloat(p.trim()));
        if (parts.length >= 6) return parts[0] || 1;
      }
    } catch (err) {
      // ignore
    }
    return 1;
  };



  // embed/book/[bookId]/page.jsx ke andar — existing useEffects ke saath
  // embed/book/[bookId]/page.jsx mein
  // Existing useEffects ke saath yeh bhi hona chahiye

  // Component ke andar, baaki states ke saath
  const searchParams = useSearchParams();

  // ── PRIMARY AUTH: URL query params se user data lo ──
  // Parent iframe src mein params inject kare:
  // ?username=xxx&email=xxx@test.com&guestUserId=xxx&name=xxx
  // Ya legacy JWT: ?token=xxx
  // URL params are ALWAYS available — no cookie/localStorage/timing issues.
  useEffect(() => {
    const urlToken = searchParams.get('token');
    const urlUsername = searchParams.get('username');
    const urlEmail = searchParams.get('email');
    const urlGuestId = searchParams.get('guestUserId');
    const urlName = searchParams.get('name');

    console.log('🔍 Auth useEffect triggered with:', { urlToken, urlUsername, urlEmail, urlGuestId, urlName });

    // Case 1: direct user params in URL
    if (urlUsername || urlEmail) {
      const doAuth = async () => {
        try {
          console.log('📤 Sending direct user data to set-token...');
          const res = await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              username: urlUsername,
              email: urlEmail,
              guestUserId: urlGuestId,
              name: urlName,
            }),
          });
          const data = await res.json();
          console.log('✅ URL-param auth response:', data);
          if (data.success) {
            setAuthToken(data.token);
            updateUrlToken(data.token); // Update URL parameter instead of localStorage
            console.log('✅ Token updated in URL, user created:', data.user);
            window.dispatchEvent(new CustomEvent('auth-updated', { detail: { token: data.token } }));
            fetchHighlights();
            fetchBookmarks();
          } else {
            console.error('❌ Auth failed:', data.error);
          }
        } catch (err) {
          console.error('❌ URL-param auth error:', err);
        }
      };
      doAuth();
      return; // don't run legacy JWT flow
    }

    // Case 2: legacy JWT token in URL
    if (urlToken) {
      console.log('📤 Sending JWT token to set-token..., token length:', urlToken.length);
      setAuthToken(urlToken);
      const doAuth = async () => {
        try {
          const res = await fetch('/api/auth/set-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: urlToken }),
            credentials: 'include',
          });
          const data = await res.json();
          console.log('✅ JWT Set token response:', data);
          if (data.success) {
            setAuthToken(data.token);
            updateUrlToken(data.token); // Update URL parameter instead of localStorage
            console.log('✅ Token updated in URL for JWT auth');
            fetchHighlights();
            fetchBookmarks();

          } else {
            console.error('❌ Token verification failed:', data.error, data.details);
          }
        } catch (err) {
          console.error('❌ Auth error:', err);
        }
      };
      doAuth();
    }
  }, []); // ← runs once on mount — URL params don't change


  // ── SECONDARY AUTH: postMessage fallback ──
  // Used when parent can't inject URL params (e.g. dynamic iframe src is hard to change)
  useEffect(() => {
    // If URL params are present, URL-param auth handles everything — skip postMessage flow
    const hasUrlAuth = !!(searchParams.get('username') || searchParams.get('email') || searchParams.get('token'));
    let authDone = hasUrlAuth;
    let readyInterval = null;

    const handleMessage = async (event) => {
      const data = event.data;

      // Validate: sirf wahi messages accept karo jo user data carry karte hain
      if (!data || typeof data !== 'object') return;
      if (!data.username && !data.email) return;

      // Already authed — ignore duplicate messages
      if (authDone) return;

      console.log('📨 postMessage received:', data);

      const { username, email, guestUserId, name } = data;

      try {
        const res = await fetch('/api/auth/set-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, email, guestUserId, name }),
          credentials: 'include',
        });

        const result = await res.json();
        console.log('✅ postMessage auth response:', result);

        if (result.success) {
          authDone = true; // ← stop retrying
          clearInterval(readyInterval);

          // Token save karo — memory mein (always works) + URL parameter update
          setAuthToken(result.token);
          updateUrlToken(result.token); // Update URL parameter instead of localStorage
          // AuthContext ko trigger karo checkAuth re-run karne ke liye
          window.dispatchEvent(new CustomEvent('auth-updated', { detail: { token: result.token } }));
          // Highlights aur bookmarks reload karo ab ke user logged in hai
          fetchHighlights?.();
          fetchBookmarks?.();

          // Parent window ko bata do ke auth ho gayi
          event.source?.postMessage({ type: 'AUTH_SUCCESS', user: result.user }, event.origin);
        } else {
          console.error('❌ postMessage auth failed:', result.error);
        }
      } catch (err) {
        console.error('❌ postMessage auth error:', err);
      }
    };

    window.addEventListener('message', handleMessage);

    // ── Drain early-captured messages (arrived before React hydrated) ──
    // The layout's inline script stores them in window.__earlyAuthMessages.
    // Process them now that our handler is registered.
    if (Array.isArray(window.__earlyAuthMessages)) {
      const buffered = window.__earlyAuthMessages.splice(0);
      buffered.forEach(e => handleMessage(e));
    }
    // Single send is not enough — in SPA navigations the parent's message
    // listener may not be registered yet when the first ping fires.
    // We retry every 300ms for up to 10 seconds, then give up.
    const sendReady = () => {
      if (authDone) return;
      try { window.parent.postMessage({ type: 'IFRAME_READY' }, '*'); } catch (e) { }
    };

    sendReady(); // immediate first attempt
    let attempts = 0;
    const MAX_ATTEMPTS = 33; // 33 × 300ms ≈ 10 seconds
    readyInterval = setInterval(() => {
      if (authDone || attempts >= MAX_ATTEMPTS) {
        clearInterval(readyInterval);
        return;
      }
      attempts++;
      sendReady();
    }, 300);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(readyInterval);
    };
  }, []); // ← Runs once, listener persists for the lifetime of the component


  // Update CSS custom property for font scaling
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', fontSize / 100);

    // Reset maxPageHeight AND globalMaxHeightRef when font size changes to allow recalculation
    if (fontSize !== prevFontSizeRef.current) {
      globalMaxHeightRef.current = 0; // Reset to 0 to allow fresh measurement
      setMaxPageHeight(A4_HEIGHT);
      prevFontSizeRef.current = fontSize; // Update ref AFTER comparison
    }
  }, [fontSize]);

  // Synchronize page heights - calculate max height and apply to all pages
  // IMPORTANT: Height only INCREASES, never decreases (except on font change)
  useEffect(() => {
    if (!bookOpened) return;

    const syncPageHeights = () => {
      // Wait for render
      requestAnimationFrame(() => {
        const allPageElements = document.querySelectorAll('.book-page');

        if (allPageElements.length === 0) return;

        // First pass: set all to auto to get natural heights
        // and prevent cross-page stretch from affecting measurement.
        allPageElements.forEach(pageEl => {
          pageEl.style.height = 'auto';
          pageEl.style.alignSelf = 'flex-start';
        });

        // Force reflow
        void document.body.offsetHeight;

        // Start with current global max (so we only increase)
        let measuredMax = 0;

        // Second pass: measure natural heights, but ignore TOC pages.
        // TOC can grow a lot with many topics; shared page height should come
        // from content/title pages while TOC itself scrolls internally.
        allPageElements.forEach(pageEl => {
          const isTocPage =
            pageEl.dataset.pageKind === 'toc' ||
            !!pageEl.querySelector('[data-page-type="toc"]');
          if (isTocPage) return;

          const pageHeight = pageEl.scrollHeight;
          if (pageHeight > measuredMax) {
            measuredMax = pageHeight;
          }
        });

        // Apply minimum A4 height if content is too small
        measuredMax = Math.max(measuredMax, A4_HEIGHT * (fontSize / 100));

        // Round up to avoid fractional pixels
        measuredMax = Math.ceil(measuredMax);

        // KEY: Only update if new height is GREATER than stored global max
        // This ensures height never shrinks when flipping to smaller pages
        if (measuredMax > globalMaxHeightRef.current) {
          globalMaxHeightRef.current = measuredMax;
        }

        // Always use the global max (largest page ever measured)
        const finalHeight = globalMaxHeightRef.current;
        setMaxPageHeight(finalHeight);

        // Third pass: apply the max height to all pages immediately
        allPageElements.forEach(pageEl => {
          pageEl.style.height = `${finalHeight}px`;
          pageEl.style.alignSelf = '';
        });
      });
    };

    // Run sync multiple times to ensure it catches everything
    syncPageHeights();
    const timer1 = setTimeout(syncPageHeights, 100);
    const timer2 = setTimeout(syncPageHeights, 300);
    const timer3 = setTimeout(syncPageHeights, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [fontSize, currentPageIndex, bookOpened]);

  // Load page view mode preference from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMode = localStorage.getItem('pageViewMode');
      if (savedMode === 'single' || savedMode === 'double') {
        setPageViewMode(savedMode);
      }
    }
  }, []);

  // Check if mobile/tablet and set responsive fontSize
  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      setIsMobile(width < 1024);
      setWindowWidth(width);

      // Update fontSize based on device width
      const newFontSize = width < 1024 ? 100 : (width <= 1300 ? 51 : 65);
      setFontSize(newFontSize);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Compensate for CSS transform scaling by adjusting bottom margin of the container.
  // Apply this compensation always (even when book is closed) so layout doesn't
  // leave a large gap under the container in single-page/scaled views.
  useEffect(() => {
    const el = bookContainerRef.current;
    if (!el) return;

    const applyCompensation = () => {
      try {
        const scale = getScaleForElement(el) || 1;
        const delta = Math.max(0, Math.round(maxPageHeight - (maxPageHeight * scale)));
        el.style.marginBottom = delta > 0 ? `-${delta}px` : '';
      } catch (err) {
        console.warn('applyCompensation error', err);
      }
    };

    // Apply now and on a short delay (renders may change heights)
    applyCompensation();
    const t1 = setTimeout(applyCompensation, 60);
    const t2 = setTimeout(applyCompensation, 300);

    // Also update on window resize (scale may change via media queries)
    window.addEventListener('resize', applyCompensation);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', applyCompensation);
      // Clear inline style when effect cleans up
      try { el.style.marginBottom = ''; } catch (e) { }
    };
  }, [maxPageHeight, windowWidth, fontSize, bookOpened]);

  // ✅ FIX: Define this BEFORE useEffect that uses it
  // Check if user is authenticated via cookie (no localStorage needed)
  const checkAuthAndFetchUserData = async () => {
    try {
      console.log('🔍 Checking auth via /api/auth/me...');
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        console.log('✅ User authenticated via cookie:', data.user);

        // Cookie auth doesn't give us token in response, but that's OK
        // The cookie itself will authenticate our API calls
        // Set a placeholder to trigger the token-dependent useEffect
        tokenRef.current = 'COOKIE_AUTH';
        setAuthToken('COOKIE_AUTH');

        // Now fetch highlights/bookmarks
        console.log('📥 Fetching highlights/bookmarks for authenticated user...');
        fetchHighlights();
        fetchBookmarks();
      } else {
        console.log('⚠️ User not authenticated (will wait for auth flow)');
      }
    } catch (err) {
      console.error('❌ Error checking auth:', err);
    }
  };

  useEffect(() => {
    if (bookId) {
      console.log('🚀 BookReader mounted for bookId:', bookId);
      fetchAllData();

      // Check if token already exists in URL from previous session
      const currentUrlToken = searchParams.get('token');
      if (currentUrlToken) {
        console.log('📦 Found existing URL token, restoring...');
        tokenRef.current = currentUrlToken;
        setAuthToken(currentUrlToken);
        // Don't call fetch here, the useEffect below will handle it
      } else {
        console.log('⚠️ No token in URL, checking cookie auth...');
        // Cookie might have auth, check and fetch
        checkAuthAndFetchUserData();
      }
    }
  }, [bookId]);

  // Separate effect: fetch highlights/bookmarks when token becomes available
  useEffect(() => {
    if (token && bookId) {
      console.log('✅ Token state changed, fetching highlights/bookmarks...');
      console.log('🔑 Current token:', token === 'COOKIE_AUTH' ? 'COOKIE_AUTH' : token?.substring(0, 30) + '...');
      fetchHighlights();
      fetchBookmarks();
    }
  }, [token, bookId]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (!bookOpened) return;

      if (e.key === 'ArrowRight') {
        nextPage();
      } else if (e.key === 'ArrowLeft') {
        prevPage();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPageIndex, allPages.length, bookOpened, isMobile]);

  const fetchAllData = async () => {
    try {
      const bookRes = await fetch(`${API_BASE}/api/books/${bookId}`);
      if (bookRes.status === 404) {
        // Book not found -> redirect to home
        try { router.push('/'); } catch (err) { console.warn('redirect failed', err); }
        return;
      }
      const bookData = await bookRes.json();
      if (bookData && bookData.success) {
        setBook(bookData.data);
      }

      const topicsRes = await fetch(`${API_BASE}/api/books/${bookId}/topics`);
      const topicsData = await topicsRes.json();
      if (topicsData.success) {
        setTopics(topicsData.data);
        await fetchAllPages(topicsData.data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHighlights = async () => {
    try {
      const token = getCurrentUrlToken() || tokenRef.current; // Prioritize URL token

      const response = await fetch(`${API_BASE}/api/books/${bookId}/highlights`, {
        headers: {
          ...(token ? { 'x-book-token': token } : {}),
        },
        credentials: 'include', // cookie bhi saath jaayegi
      });

      const data = await response.json();
      if (data.success) {
        setHighlights(data.data);
      } else if (data.message === 'Unauthorized') {
        console.log('User not logged in - highlights disabled');
      }
    } catch (error) {
      console.error('Error fetching highlights:', error);
    }
  };


  const handleTextSelection = () => {
    // Small delay removed here; callers will debounce as needed.
    try {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || '';

      if (text.length > 0 && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Detect which page the selection is on
        const selectedElement = range.commonAncestorContainer;
        const pageElement = selectedElement.nodeType === 3
          ? selectedElement.parentElement?.closest('.book-page')
          : selectedElement.closest('.book-page');

        // Check if it's the right page (second page in spread)
        const isRightPage = pageElement?.classList.contains('page-right');
        const actualPageIndex = isSinglePageMode() ? currentPageIndex : (isRightPage ? currentPageIndex + 1 : currentPageIndex);

        setSelectedText(text);
        setColorPickerPosition({
          x: rect.left + rect.width / 2,
          y: rect.top - 10,
          pageIndex: actualPageIndex
        });
        setShowColorPicker(true);
      }
    } catch (err) {
      // Swallow any selection errors (can happen on some Android browsers)
      console.warn('Selection handling error', err);
    }
  };

  const saveHighlight = async () => {
    if (!highlightTitle.trim() || !selectedText) {
      alert('Please enter a title for the highlight');
      return;
    }

    try {
      const token = getCurrentUrlToken() || tokenRef.current; // Prioritize URL token

      const response = await fetch(`${API_BASE}/api/books/${bookId}/highlights`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-book-token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          title: highlightTitle,
          page_index: colorPickerPosition.pageIndex || currentPageIndex,
          selected_text: selectedText,
          color: selectedColor
        })
      });

      const data = await response.json();

      if (data.success) {
        setHighlights([...highlights, data.data]);
        setShowColorPicker(false);
        setSelectedText('');
        setHighlightTitle('');
        setSelectedColor('#FFFF00');
        window.getSelection().removeAllRanges();
      } else if (data.message === 'Unauthorized') {
        alert('Please login to save highlights');
        setShowColorPicker(false);
        setSelectedText('');
        setHighlightTitle('');
        window.getSelection().removeAllRanges();
      } else {
        alert(data.message || 'Failed to save highlight');
      }
    } catch (error) {
      console.error('Error saving highlight:', error);
      alert('Failed to save highlight');
    }
  };


  const deleteHighlight = async (highlightId) => {
    if (!confirm('Are you sure you want to delete this highlight?')) {
      return;
    }

    try {
      const token = getCurrentUrlToken() || tokenRef.current; // Prioritize URL token

      const response = await fetch(`${API_BASE}/api/books/${bookId}/highlights?id=${highlightId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'x-book-token': token } : {}),
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        const newHighlights = highlights.filter(h => h.id !== highlightId);
        setHighlights(newHighlights);

        // Immediately remove highlight styling from DOM and from allPages content
        try {
          const marks = Array.from(document.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`));
          marks.forEach(m => {
            try {
              const frag = document.createRange().createContextualFragment(m.innerHTML || '');
              m.replaceWith(frag);
            } catch (err) {
              m.remove();
            }
          });

          if (allPages && allPages.length > 0) {
            const updated = allPages.map((p) => {
              if (p.type !== 'content' || !p.content || !p.content.content) return p;
              try {
                const container = document.createElement('div');
                container.innerHTML = p.content.content;
                const marks = Array.from(container.querySelectorAll(`mark[data-highlight-id="${highlightId}"]`));
                if (marks.length === 0) return p;

                marks.forEach(m => {
                  try {
                    const frag = document.createDocumentFragment();
                    while (m.firstChild) frag.appendChild(m.firstChild);
                    m.replaceWith(frag);
                  } catch (e) {
                    m.remove();
                  }
                });

                const newHtml = container.innerHTML;
                if (newHtml !== p.content.content) {
                  return { ...p, content: { ...p.content, content: newHtml } };
                }
              } catch (err) {
                console.warn('strip mark from page error', err);
              }
              return p;
            });
            setAllPages(updated);
          }
        } catch (err) {
          console.warn('immediate highlight remove error', err);
        }
      } else {
        alert(data.message || 'Failed to delete highlight');
      }
    } catch (error) {
      console.error('Error deleting highlight:', error);
      alert('Failed to delete highlight');
    }
  };


  const goToHighlight = (pageIndex, highlightId) => {
    if (isSinglePageMode()) {
      // Single page mode (mobile or desktop single view): direct navigation
      setCurrentPageIndex(pageIndex);
    } else {
      // Desktop double-page: Adjust for 2-page spread
      if (pageIndex % 2 === 1) {
        setCurrentPageIndex(pageIndex - 1);
      } else {
        setCurrentPageIndex(pageIndex);
      }
    }

    // After page navigation + highlight re-application, scroll the specific mark into view
    if (highlightId) {
      setTimeout(() => {
        const mark = document.querySelector(`mark[data-highlight-id="${highlightId}"]`);
        if (mark) {
          mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Brief pulse outline so the user sees exactly which text was highlighted
          mark.style.outline = '3px solid #3b82f6';
          mark.style.outlineOffset = '2px';
          setTimeout(() => {
            mark.style.outline = '';
            mark.style.outlineOffset = '';
          }, 1500);
        }
      }, 700); // 700ms: enough for React re-render + applyHighlightsToPage (500ms delay)
    }
  };

  // Bookmark Functions
  const fetchBookmarks = async () => {
    try {
      const token = getCurrentUrlToken() || tokenRef.current; // Prioritize URL token

      const response = await fetch(`${API_BASE}/api/books/${bookId}/bookmarks`, {
        headers: {
          ...(token ? { 'x-book-token': token } : {}),
        },
        credentials: 'include',
      });

      const data = await response.json();
      if (data.success) {
        setBookmarks(data.data);
      } else if (data.message === 'Unauthorized') {
        console.log('User not logged in - bookmarks disabled');
      }
    } catch (error) {
      console.error('Error fetching bookmarks:', error);
    }
  };


  const handleBookmarkClick = () => {
    // If we're in single-page mode (mobile OR desktop single view),
    // bookmark the visible page directly. Only show the chooser modal
    // for two-page desktop spreads.
    if (isSinglePageMode()) {
      toggleBookmark(currentPageIndex);
    } else {
      setShowBookmarkModal(true);
    }
  };

  const toggleBookmark = async (pageIndex) => {
    try {
      const token = getCurrentUrlToken() || tokenRef.current; // Prioritize URL token

      const response = await fetch(`${API_BASE}/api/books/${bookId}/bookmarks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-book-token': token } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          page_index: pageIndex
        })
      });

      const data = await response.json();

      if (data.success) {
        if (data.action === 'added') {
          setBookmarks([...bookmarks, data.data]);
        } else if (data.action === 'removed') {
          setBookmarks(bookmarks.filter(b => b.page_index !== pageIndex));
        }
        setShowBookmarkModal(false);
      } else if (data.message === 'Unauthorized') {
        alert('Please login to add bookmarks');
        setShowBookmarkModal(false);
      } else {
        alert(data.message || 'Failed to toggle bookmark');
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      alert('Failed to toggle bookmark');
    }
  };


  const deleteBookmark = async (bookmarkId) => {
    if (!confirm('Are you sure you want to remove this bookmark?')) {
      return;
    }

    try {
      const token = getCurrentUrlToken() || tokenRef.current; // Prioritize URL token

      const response = await fetch(`${API_BASE}/api/books/${bookId}/bookmarks?id=${bookmarkId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { 'x-book-token': token } : {}),
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (data.success) {
        setBookmarks(bookmarks.filter(b => b.id !== bookmarkId));
      } else {
        alert(data.message || 'Failed to delete bookmark');
      }
    } catch (error) {
      console.error('Error deleting bookmark:', error);
      alert('Failed to delete bookmark');
    }
  };


  const goToBookmark = (pageIndex) => {
    if (isSinglePageMode()) {
      setCurrentPageIndex(pageIndex);
    } else {
      if (pageIndex % 2 === 1) {
        setCurrentPageIndex(pageIndex - 1);
      } else {
        setCurrentPageIndex(pageIndex);
      }
    }
  };

  const isPageBookmarked = (pageIndex) => {
    return bookmarks.some(b => b.page_index === pageIndex);
  };

  useEffect(() => {
    // Debounced handlers for selection: mouseup is fast, touchend needs more time on Android
    const handleMouseUp = () => {
      setTimeout(handleTextSelection, 10);
    };

    const handleTouchEnd = () => {
      // Android often finalizes selection a bit later; wait longer
      setTimeout(handleTextSelection, 600);
    };

    const handleSelectionChange = () => {
      // Debounce selection changes so modal opens only after selection is stable
      if (selectionTimerRef.current) clearTimeout(selectionTimerRef.current);
      selectionTimerRef.current = setTimeout(() => {
        try {
          const sel = window.getSelection()?.toString().trim() || '';
          if (sel.length > 0) {
            handleTextSelection();
          }
        } catch (err) {
          console.warn('selection debounce error', err);
        }
      }, 500); // wait 500ms of stability
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('selectionchange', handleSelectionChange);
      if (selectionTimerRef.current) {
        clearTimeout(selectionTimerRef.current);
        selectionTimerRef.current = null;
      }
    };
  }, [currentPageIndex, highlights, bookOpened]);

  // Apply highlights to current page (re-apply when fontSize or darkMode changes)
  useEffect(() => {
    if (highlights.length > 0 && bookOpened) {
      setTimeout(() => {
        applyHighlightsToPage();
      }, 100);

      // Re-apply after a longer delay to ensure content is fully rendered
      const timer2 = setTimeout(() => {
        applyHighlightsToPage();
      }, 500);

      return () => clearTimeout(timer2);
    }
  }, [currentPageIndex, fontSize, isDarkMode, highlights, bookOpened, allPages]);

  const applyHighlightsToPage = () => {
    // Mark that we're applying highlights to avoid reacting to our own DOM mutations
    // Keep the guard a bit longer to cover React re-renders that may follow.
    applyingHighlightsRef.current = true;
    setTimeout(() => { applyingHighlightsRef.current = false; }, 800);
    const currentPageHighlights = highlights.filter(h => {
      if (isMobile) {
        return h.page_index === currentPageIndex;
      } else {
        return h.page_index === currentPageIndex || h.page_index === currentPageIndex + 1;
      }
    });

    currentPageHighlights.forEach(highlight => {
      // Apply to all visible content elements (both left and right pages).
      // ContentPage already handles this inline via React rendering; this function
      // is a safety net for cases where DOM marks need re-application.
      const contentElements = document.querySelectorAll('.book-spread .book-content-text');
      contentElements.forEach(element => {
        // Check if highlight already exists
        const existingMark = element.querySelector(`mark[data-highlight-id="${highlight.id}"]`);
        if (existingMark) {
          return; // Skip if already highlighted
        }

        try {
          const instance = new Mark(element);
          instance.mark(highlight.selected_text || '', {
            separateWordSearch: false,
            diacritics: false,
            acrossElements: true,
            accuracy: 'exactly',
            caseSensitive: false,
            each: (node) => {
              try {
                node.setAttribute('data-highlight-id', String(highlight.id));
                node.style.backgroundColor = highlight.color;
                node.style.padding = '2px 0';
                node.style.cursor = 'pointer';
                if (highlight.title) node.title = highlight.title;
              } catch (e) { }
            }
          });
        } catch (err) {
          // fallback to previous approach if mark.js fails
          try {
            const htmlContent = element.innerHTML;
            const textToHighlight = highlight.selected_text;
            const escapedText = textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(?![^<]*>)(?!<mark[^>]*>)(${escapedText})(?!</mark>)`, 'gi');
            const highlightedContent = htmlContent.replace(regex, (match) => `<mark style="background-color: ${highlight.color}; padding: 2px 0; cursor: pointer;" data-highlight-id="${highlight.id}" title="${highlight.title}">${match}</mark>`);
            if (highlightedContent !== htmlContent) element.innerHTML = highlightedContent;
          } catch (e) {
            console.warn('mark.js and fallback both failed', e);
          }
        }
      });
    });
  };

  // Inject highlights directly into `allPages` HTML so React renders them
  // and they won't be removed by subsequent re-renders. This makes highlights
  // persistent until explicitly removed from `highlights` state.
  const injectHighlightsIntoAllPages = (hlList) => {
    if (!allPages || allPages.length === 0) return;

    const updated = allPages.map((p, idx) => {
      if (p.type !== 'content' || !p.content || !p.content.content) return p;

      let html = p.content.content;

      const pageHighlights = hlList.filter(h => h.page_index === idx);
      if (pageHighlights.length === 0) return p;

      pageHighlights.forEach(highlight => {
        try {
          // Skip if already injected
          if (html.includes(`data-highlight-id="${highlight.id}"`)) return;
          try {
            const container = document.createElement('div');
            container.innerHTML = html;
            if (container.querySelector(`mark[data-highlight-id="${highlight.id}"]`)) return;
            const instance = new Mark(container);
            instance.mark(highlight.selected_text || '', {
              separateWordSearch: false,
              diacritics: false,
              acrossElements: true,
              accuracy: 'exactly',
              caseSensitive: false,
              each: (node) => {
                try {
                  node.setAttribute('data-highlight-id', String(highlight.id));
                  node.style.backgroundColor = highlight.color;
                  node.style.padding = '2px 0';
                  node.style.cursor = 'pointer';
                  if (highlight.title) node.title = highlight.title;
                } catch (e) { }
              }
            });
            html = container.innerHTML;
          } catch (e) {
            console.warn('inject highlight error (mark.js)', e);
          }
        } catch (err) {
          console.warn('inject highlight error', err);
        }
      });

      if (html !== p.content.content) {
        return { ...p, content: { ...p.content, content: html } };
      }
      return p;
    });

    // Only update state when something actually changed to avoid update loops
    const changed = updated.some((p, i) => {
      if (!allPages[i] || !allPages[i].content) return true;
      return updated[i].content.content !== allPages[i].content.content;
    });
    if (changed) setAllPages(updated);
  };

  // Ensure highlights are embedded into pages whenever either list changes
  useEffect(() => {
    // Run only when highlights change. injectHighlightsIntoAllPages will read
    // the current `allPages` and update it only if necessary.
    if (!highlights || highlights.length === 0) return;
    if (!allPages || allPages.length === 0) return;
    injectHighlightsIntoAllPages(highlights);
  }, [highlights]);

  // Watch for React re-renders / DOM updates and re-apply highlights when content changes
  useEffect(() => {
    if (!bookOpened || highlights.length === 0) return;

    const contentElements = Array.from(document.querySelectorAll('.book-content-text'));
    if (contentElements.length === 0) return;

    let obsTimer = null;
    const observer = new MutationObserver((mutations) => {
      if (applyingHighlightsRef.current) return;

      // Determine if any mutation removed nodes or removed/changed mark elements
      const meaningful = mutations.some(m => {
        if (m.type === 'childList') {
          if (m.removedNodes && m.removedNodes.length > 0) return true;
          if (m.addedNodes && m.addedNodes.length > 0) return true;
        }
        if (m.type === 'characterData') return true;
        return false;
      });

      if (!meaningful) return;

      if (obsTimer) clearTimeout(obsTimer);
      // Debounce longer to avoid rapid remove/add flicker
      obsTimer = setTimeout(() => {
        try {
          applyHighlightsToPage();
        } catch (err) {
          console.warn('reapply highlights error', err);
        }
      }, 450);
    });

    contentElements.forEach(el => {
      observer.observe(el, { childList: true, subtree: true, characterData: true });
    });

    return () => {
      if (obsTimer) clearTimeout(obsTimer);
      observer.disconnect();
    };
  }, [bookOpened, highlights, currentPageIndex, fontSize, isDarkMode, allPages]);

  const fetchAllPages = async (topicsList) => {
    try {
      const allPagesData = [];
      const topicPageMap = {};
      const subtopicPageMap = {};

      allPagesData.push({ type: 'cover', content: null });

      const tocIndex = allPagesData.length;
      const topicSubtopicsMap = {};
      allPagesData.push({ type: 'toc', content: topicsList, topicPageMap: {}, subtopicPageMap: {}, topicSubtopicsMap: {} });

      for (const topic of topicsList) {
        // Mark topic start position
        topicPageMap[topic.id] = allPagesData.length;

        // Add topic title page
        allPagesData.push({ type: 'topic-title', content: topic });

        // First, fetch and add topic-level pages (where subtopic_id is NULL)
        try {
          const topicPagesRes = await fetch(`${API_BASE}/api/books/${bookId}/topics/${topic.id}/pages`);
          const topicPagesData = await topicPagesRes.json();

          if (topicPagesData.success && topicPagesData.data && topicPagesData.data.length > 0) {
            topicPagesData.data.forEach(page => {
              allPagesData.push({
                type: 'content',
                content: page,
                topicTitle: topic.name,
                subtopicTitle: null
              });
            });
          }
        } catch (err) {
          console.warn('Error fetching topic pages:', err);
        }

        // Then fetch subtopics for this topic
        const subtopicsRes = await fetch(`${API_BASE}/api/books/${bookId}/topics/${topic.id}/subtopics`);
        const subtopicsData = await subtopicsRes.json();

        if (subtopicsData.success && subtopicsData.data.length > 0) {
          topicSubtopicsMap[topic.id] = subtopicsData.data;
          for (const subtopic of subtopicsData.data) {
            // Mark subtopic start position
            subtopicPageMap[subtopic.id] = allPagesData.length;

            // Add subtopic title page
            allPagesData.push({
              type: 'subtopic-title',
              content: subtopic,
              topicTitle: topic.name
            });

            // Fetch pages for this subtopic
            const pagesRes = await fetch(`${API_BASE}/api/books/${bookId}/topics/${topic.id}/subtopics/${subtopic.id}/pages`);
            const pagesData = await pagesRes.json();

            if (pagesData.success && pagesData.data.length > 0) {
              pagesData.data.forEach(page => {
                allPagesData.push({
                  type: 'content',
                  content: page,
                  topicTitle: topic.name,
                  subtopicTitle: subtopic.name
                });
              });
            }
          }
        }
      }

      allPagesData.push({ type: 'back-cover', content: null });
      allPagesData[tocIndex].topicPageMap = topicPageMap;
      allPagesData[tocIndex].subtopicPageMap = subtopicPageMap;
      allPagesData[tocIndex].topicSubtopicsMap = topicSubtopicsMap;

      setAllPages(allPagesData);
    } catch (error) {
      console.error('Error fetching pages:', error);
    }
  };



  const togglePageViewMode = () => {
    const newMode = pageViewMode === 'double' ? 'single' : 'double';

    // If switching to double-page view, ensure the currently visible
    // single page stays on the same side in the spread. If the current
    // page index is odd (a right-side page), move the left index one
    // page back so the same page appears on the right in double view.
    if (newMode === 'double') {
      setCurrentPageIndex(prev => (prev % 2 === 1 ? Math.max(0, prev - 1) : prev));
    }

    setPageViewMode(newMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pageViewMode', newMode);
    }
  };

  const openBook = () => {
    setBookOpened(true);
  };
  const closeBook = () => {
    stopSpeaking(false); // Don't auto-resume when closing book
    setBookOpened(false);
    setCurrentPageIndex(0);
    setWasPlayingBeforeFlip(false); // Reset flag
  };


  const goToPage = (pageIndex) => {
    if (pageIndex >= 0 && pageIndex < allPages.length) {
      if (isSinglePageMode()) {
        // Single page mode: direct navigation
        setCurrentPageIndex(pageIndex);
      } else {
        // Desktop double-page: Adjust for 2-page spread
        // If page is odd (1, 3, 5...), show it on right by going to previous page
        // If page is even (0, 2, 4...), show it on left
        if (pageIndex % 2 === 1) {
          // Odd page → show on RIGHT side
          setCurrentPageIndex(pageIndex - 1);
        } else {
          // Even page → show on LEFT side
          setCurrentPageIndex(pageIndex);
        }
      }
    }
  };

  const nextPage = () => {
    const maxIndex = isSinglePageMode() ? allPages.length - 1 : allPages.length - 2;

    if (currentPageIndex < maxIndex) {
      // Check if audio is currently playing
      const wasPlaying = isSpeaking && !isPaused;

      // Stop current audio but mark for resume
      if (wasPlaying) {
        stopSpeaking(true); // Pass true to indicate we want auto-resume
      }

      setIsFlipping(true);
      setFlipDirection('next');
      setTimeout(() => {
        setCurrentPageIndex(prev => isSinglePageMode() ? prev + 1 : prev + 2);
        setIsFlipping(false);
        setFlipDirection(null);
      }, 600);
    }
  };

  const prevPage = () => {
    if (currentPageIndex > 0) {
      // Check if audio is currently playing
      const wasPlaying = isSpeaking && !isPaused;

      // Stop current audio but mark for resume
      if (wasPlaying) {
        stopSpeaking(true); // Pass true to indicate we want auto-resume
      }

      setIsFlipping(true);
      setFlipDirection('prev');
      setTimeout(() => {
        setCurrentPageIndex(prev => isSinglePageMode() ? prev - 1 : Math.max(0, prev - 2));
        setIsFlipping(false);
        setFlipDirection(null);
      }, 600);
    }
  };

  // Navigation helper functions
  const canGoNext = () => {
    const maxIndex = isSinglePageMode() ? allPages.length - 1 : allPages.length - 2;
    return currentPageIndex < maxIndex;
  };

  const canGoPrevious = () => {
    return currentPageIndex > 0;
  };

  const goToNextPage = () => {
    if (canGoNext()) {
      nextPage();
    }
  };

  const goToPreviousPage = () => {
    if (canGoPrevious()) {
      prevPage();
    }
  };

  const getTocPageIndex = () => allPages.findIndex((p) => p.type === 'toc');

  const getBookEndPageIndex = () => {
    const backCoverIndex = allPages.findIndex((p) => p.type === 'back-cover');
    return backCoverIndex !== -1 ? backCoverIndex : Math.max(0, allPages.length - 1);
  };

  const getNextTopicPageIndex = () => {
    const visibleRightEdge = isSinglePageMode()
      ? currentPageIndex
      : Math.min(currentPageIndex + 1, allPages.length - 1);

    return allPages.findIndex(
      (p, idx) => idx > visibleRightEdge && p.type === 'topic-title'
    );
  };

  const getPreviousTopicPageIndex = () => {
    for (let i = currentPageIndex - 1; i >= 0; i--) {
      if (allPages[i]?.type === 'topic-title') return i;
    }
    return -1;
  };

  const goToHomePage = () => {
    const tocIndex = getTocPageIndex();
    if (tocIndex !== -1) goToPage(tocIndex);
  };

  const goToNextTopic = () => {
    const nextTopicIndex = getNextTopicPageIndex();
    if (nextTopicIndex !== -1) goToPage(nextTopicIndex);
  };

  const goToPreviousTopic = () => {
    const prevTopicIndex = getPreviousTopicPageIndex();
    if (prevTopicIndex !== -1) goToPage(prevTopicIndex);
  };

  const goToEndPage = () => {
    const endIndex = getBookEndPageIndex();
    goToPage(endIndex);
  };


  const handleMouseDown = (e) => {
    if (!bookOpened) return;

    const clickedElement = e.target;
    const isTextContent = clickedElement.closest('.select-text, button, a, input, textarea');

    if (isTextContent) {
      setCanDrag(false);
      return;
    }

    setCanDrag(true);
    setIsDragging(true);
    setDragStartX(e.clientX);
    setDragCurrentX(e.clientX);
    e.preventDefault();
  };

  const handleMouseMove = (e) => {
    if (isDragging && canDrag) {
      setDragCurrentX(e.clientX);
    }
  };

  const handleMouseUp = (e) => {
    if (isDragging && canDrag) {
      const dragDistance = dragCurrentX - dragStartX;
      const threshold = 50;

      if (dragDistance > threshold) {
        prevPage();
      } else if (dragDistance < -threshold) {
        nextPage();
      }
    }

    setIsDragging(false);
    setCanDrag(false);
    setDragStartX(0);
    setDragCurrentX(0);
  };



  const handleTouchStart = (e) => {
    if (!bookOpened) return;

    const touchedElement = e.target;
    const isTextContent = touchedElement.closest('.select-text, button, a');

    if (isTextContent) {
      setCanDrag(false);
      return;
    }

    setCanDrag(true);
    setIsDragging(true);
    setDragStartX(e.touches[0].clientX);
    setDragCurrentX(e.touches[0].clientX);
  };

  const handleTouchMove = (e) => {
    if (isDragging && canDrag) {
      setDragCurrentX(e.touches[0].clientX);

      const diff = e.touches[0].clientX - dragStartX;
      if (Math.abs(diff) > 10) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = (e) => {
    handleMouseUp(e);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]">
        <div className="flex flex-col items-center gap-6">


          {/* Text */}
          <div className="text-center">
            <p className="text-white text-lg font-semibold tracking-wide">
              Loading book
            </p>
            {/* Animated dots */}
            <div className="flex justify-center gap-1 mt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:0ms]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:150ms]"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-white/60 animate-bounce [animation-delay:300ms]"></span>
            </div>
          </div>
        </div>
      </div>
    );
  }


  const leftPageIndex = currentPageIndex;
  const rightPageIndex = currentPageIndex + 1;
  const leftPage = allPages[leftPageIndex];
  const rightPage = !isSinglePageMode() ? allPages[rightPageIndex] : null;

  const nextLeftPageIndex = isSinglePageMode() ? currentPageIndex + 1 : currentPageIndex + 2;
  const nextRightPageIndex = !isSinglePageMode() ? currentPageIndex + 3 : null;
  const prevLeftPageIndex = isSinglePageMode() ? currentPageIndex - 1 : currentPageIndex - 2;
  const prevRightPageIndex = !isSinglePageMode() ? currentPageIndex - 1 : null;

  const nextLeftPage = allPages[nextLeftPageIndex];
  const nextRightPage = nextRightPageIndex !== null ? allPages[nextRightPageIndex] : null;
  const prevLeftPage = allPages[prevLeftPageIndex];
  const prevRightPage = prevRightPageIndex !== null ? allPages[prevRightPageIndex] : null;

  const dragOffset = isDragging && canDrag ? dragCurrentX - dragStartX : 0;
  const previousTopicPageIndex = getPreviousTopicPageIndex();
  const nextTopicPageIndex = getNextTopicPageIndex();
  const tocPageIndex = getTocPageIndex();
  const endPageIndex = getBookEndPageIndex();

  return (
    <>
      <style jsx global>{`  
  * {
    box-sizing: border-box;
  }

  body {
    margin: 0;
    padding: 0;
    overflow-x: hidden;
  }

  /*removing default margins */
  .book-content-text p {
    font-size: calc(15px * var(--font-scale, 1));
     margin-bottom: 0.2em !important; 
     display: block !important;
}
.book-content-text img {
    border-radius: 0px !important;
    max-width: 100%;
    height: auto !important;
    margin: 1em auto;
    display: block;
    /* Scale images proportionally with the font-size slider */
    zoom: var(--font-scale, 1);
    transform-origin: left top;
}

.book-content-text ul, .book-content-text ol {
    // font-size: calc(16px * var(--font-scale, 1));
    margin-bottom: 0.2em !important;
    // margin-left:0em !important;
    // padding-left: 0em !important;
}

.book-content-text li {
    font-size: calc(16px * var(--font-scale, 1));
    margin-bottom: 0em !important;
    display: list-item !important;
}


.book-content-text h1 {
    font-size: calc(26px * var(--font-scale, 1));
    display:block !important;
    color: #1a1a1a;
     margin-top:0em !important; 
    margin-bottom: 0em !important; 
    font-weight: bold;
    line-height: 1.3;
}
  /* Book Container with Responsive Scaling */
  .book-spread-container {
    position: relative;
    perspective: 2800px;
    transform-style: preserve-3d;
    margin: 0 auto;
  }

  /* Single-page view: use a narrower max-width on desktop only.
     isMobile threshold in JS is <1024, so apply this at >=1024px. */
  @media (min-width: 1024px) {
    .book-spread-container.single-page-mode {
      max-width: 700px !important; /* adjust as needed */
    }
  }

  /* Desktop - Two page spread with scaling */
  

  
  @media (min-width: 1451px) {
    .book-spread-container {
      transform: scale(1);
      transform-origin: center top;
      max-width: 70%;
    }
  }
    
      @media (min-width: 1024px) and (max-width: 1450px) {
    .book-spread-container {
      transform: scale(1);
      transform-origin: center top;
      max-width: 80%;
    }
  }
  
  /* Tablet - Single page centered */
  @media (min-width: 768px) and (max-width: 1023px) {
    .book-spread-container {
      transform: scale(0.8);
      transform-origin: center top;
      max-width: ${A4_WIDTH}px;
    }
  }

  /* Laptop small screens: keep spread container wider but avoid scale */
  @media (min-width: 1024px) and (max-width: 1150px) {
    .book-spread-container {
      transform: none !important;
      transform-origin: unset;
      max-width: 900px;
      margin: 0 auto;
    }
  }
      @media (min-width: 1150px) and (max-width: 1300px) {
    .book-spread-container {
      transform: none !important;
      transform-origin: unset;
      max-width: 1000px;
      margin: 0 auto;
    }
  }

  /* Mobile - Single page smaller scale */
  @media (max-width: 767px) {
    .book-spread-container {
      transform: scale(0.6);
      transform-origin: center top;
      max-width: ${A4_WIDTH}px;
    }
  }

  @media (max-width: 600px) {
    .book-spread-container {
      transform: scale(0.55);
    }
  }

  @media (max-width: 480px) {
    .book-spread-container {
      transform: scale(0.48);
    }
    
    .control-btn span {
      display: none;
    }
    
    .control-btn {
      padding: 6px;
    }
  }

  @media (max-width: 400px) {
    .book-spread-container {
      transform: scale(0.42);
    }
  }

  .book-page {
    background: ${isDarkMode ? '#1A1A1A' : 'white'};
    border-radius: 4px;
    box-shadow:
      0 20px 60px rgba(0, 0, 0, 0.3),
      inset 0 0 0 1px rgba(0, 0, 0, 0.1);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .page-fold {
    position: absolute;
    width: 48px;
    height: 48px;
    pointer-events: auto;
    z-index: 40;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.98) 0%, #f5f1e8 55%, #d9d2c2 100%);
    filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.22));
    cursor: pointer;
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
    overflow: hidden;
    clip-path: polygon(0 0, 100% 0, 0 100%);
    transform: rotate(var(--fold-rotation, 0deg));
    transform-origin: center;
  }

  .page-fold:hover {
    opacity: 1;
    width: 100px;
    height: 100px;
    filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.4));
    transform: rotate(var(--fold-rotation, 0deg));
  }

  .page-fold::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      rgba(255, 255, 255, 0.95) 0%,
      rgba(255, 255, 255, 0.55) 34%,
      rgba(0, 0, 0, 0.03) 70%,
      rgba(0, 0, 0, 0.08) 100%
    );
  }

  .page-fold::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, transparent 46%, rgba(0, 0, 0, 0.16) 49%, transparent 52%);
    opacity: 0.7;
  }

  .fold-top-left {
    top: 0;
    left: 0;
    --fold-rotation: 0deg;
    box-shadow: inset -1px -1px 0 rgba(0, 0, 0, 0.12);
  }

  .fold-bottom-left {
    left: 0;
    bottom: 0;
    --fold-rotation: 270deg;
    box-shadow: inset -1px -1px 0 rgba(0, 0, 0, 0.12);
  }

  .fold-top-right {
    top: 0;
    right: 0;
    --fold-rotation: 90deg;
    box-shadow: inset -1px -1px 0 rgba(0, 0, 0, 0.12);
  }

  .fold-bottom-right {
    right: 0;
    bottom: 0;
    --fold-rotation: 180deg;
    box-shadow: inset -1px -1px 0 rgba(0, 0, 0, 0.12);
  }

  .page-inner {
    width: 100%;
    height: 100%;
    min-height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  .book-spread {
    display: flex;
    gap: 0;
    position: relative;
    z-index: 2;
    align-items: stretch;
    filter: drop-shadow(0 14px 30px rgba(0, 0, 0, 0.18));
  }

  /* Center single page on desktop */
  .single-page-mode .book-spread {
    justify-content: center;
    margin: 0 auto;
  }

  .book-spread-background {
    display: flex;
    gap: 0;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
    align-items: stretch;
    width: 100%;
  }

  /* Center background pages in single-page mode */
  .single-page-mode .book-spread-background {
    justify-content: center;
  }

  .page-flip-animation {
    transition: transform 0.6s cubic-bezier(0.22, 0.61, 0.36, 1);
    transform-style: preserve-3d;
    position: relative;
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
    will-change: transform, box-shadow, opacity;
  }

  .page-flip-shade {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 26;
    opacity: 0;
    background:
      linear-gradient(
        90deg,
        rgba(0, 0, 0, 0.26) 0%,
        rgba(0, 0, 0, 0.08) 26%,
        rgba(255, 255, 255, 0.18) 55%,
        rgba(0, 0, 0, 0.22) 100%
      );
    mix-blend-mode: multiply;
  }

  .page-left {
    transform-origin: right center;
  }

  .page-right {
    transform-origin: left center;
  }

  /* Override transform origin for single page animations */
  .single-page-mode.flipping-next .page-left {
    transform-origin: left center;
  }

  .single-page-mode.flipping-prev .page-left {
    transform-origin: right center;
  }

  .flipping-next .page-right {
    animation: flipNextSimple 0.62s cubic-bezier(0.2, 0.65, 0.2, 1) forwards;
  }

  .flipping-prev .page-left {
    animation: flipPrevSimple 0.62s cubic-bezier(0.2, 0.65, 0.2, 1) forwards;
  }

  .flipping-next .page-right .page-flip-shade {
    animation: flipShadeNext 0.62s ease-in-out forwards;
  }

  .flipping-next .page-left .page-flip-shade {
    animation: facingPageShade 0.62s ease-in-out forwards;
  }

  .flipping-prev .page-left .page-flip-shade {
    animation: flipShadeNext 0.62s ease-in-out forwards;
  }

  .flipping-prev .page-right .page-flip-shade {
    animation: flipShadeNext 0.62s ease-in-out forwards !important;
  }

  .flipping-next .page-right .page-inner {
    animation: pageToneNext 0.62s ease-in-out forwards;
  }

  .flipping-prev .page-left .page-inner {
    animation: pageToneNext 0.62s ease-in-out forwards;
  }

  .flipping-prev .page-right .page-inner {
    animation: pageToneNext 0.62s ease-in-out forwards;
  }

  /* Single page mode - animate left page on next and prev */
  .single-page-mode.flipping-next .page-left {
    animation: flipNextMobile 0.62s cubic-bezier(0.2, 0.65, 0.2, 1) forwards !important;
  }

  .single-page-mode.flipping-prev .page-left {
    animation: flipPrevMobile 0.62s cubic-bezier(0.2, 0.65, 0.2, 1) forwards !important;
  }

  .single-page-mode.flipping-next .page-left .page-flip-shade,
  .flipping-next .page-left .page-flip-shade {
    animation: flipShadeNext 0.62s ease-in-out forwards;
  }

  .single-page-mode.flipping-prev .page-left .page-flip-shade,
  .flipping-prev .page-left .page-flip-shade {
    animation: flipShadeNext 0.62s ease-in-out forwards;
  }

  .single-page-mode.flipping-next .page-left .page-inner,
  .flipping-next .page-left .page-inner {
    animation: pageToneNext 0.62s ease-in-out forwards;
  }

  .single-page-mode.flipping-prev .page-left .page-inner,
  .flipping-prev .page-left .page-inner {
    animation: pageToneNext 0.62s ease-in-out forwards;
  }

  @media (max-width: 1023px) {
    .flipping-next .page-left {
      animation: flipNextMobile 0.62s cubic-bezier(0.2, 0.65, 0.2, 1) forwards !important;
    }
    .flipping-prev .page-left {
      animation: flipPrevMobile 0.62s cubic-bezier(0.2, 0.65, 0.2, 1) forwards !important;
    }
  }

  @keyframes flipNextSimple {
    0% {
      transform: rotateY(0deg) translateX(0) translateZ(0);
      opacity: 1;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
      z-index: 10;
    }
    18% {
      transform: rotateY(-26deg) translateX(-10px) translateZ(8px);
      opacity: 1;
      box-shadow: -14px 12px 32px rgba(0, 0, 0, 0.18);
    }
    50% {
      transform: rotateY(-96deg) translateX(-22px) translateZ(14px);
      opacity: 1;
      box-shadow: -28px 14px 38px rgba(0, 0, 0, 0.24);
      z-index: 12;
    }
    82% {
      transform: rotateY(-154deg) translateX(-8px) translateZ(6px);
      opacity: 0.85;
      box-shadow: -18px 10px 28px rgba(0, 0, 0, 0.18);
      z-index: 0;
    }
    100% {
      transform: rotateY(-180deg) translateX(0) translateZ(0);
      opacity: 0.18;
      box-shadow: 0 0 0 rgba(0, 0, 0, 0);
      z-index: 0;
    }
  }

  @keyframes flipPrevSimple {
    0% {
      transform: rotateY(0deg) translateX(0) translateZ(0);
      opacity: 1;
      box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
      z-index: 10;
    }
    18% {
      transform: rotateY(26deg) translateX(10px) translateZ(8px);
      opacity: 1;
      box-shadow: 14px 12px 32px rgba(0, 0, 0, 0.18);
    }
    50% { 
      transform: rotateY(96deg) translateX(22px) translateZ(14px);
      opacity: 1;
      box-shadow: 28px 14px 38px rgba(0, 0, 0, 0.24);
      z-index: 12;
    }
    82% { 
      transform: rotateY(154deg) translateX(8px) translateZ(6px);
      opacity: 0.85;
      box-shadow: 18px 10px 28px rgba(0, 0, 0, 0.18);
      z-index: 0;
    }
    100% {
      transform: rotateY(180deg) translateX(0) translateZ(0);
      opacity: 0.18;
      box-shadow: 0 0 0 rgba(0, 0, 0, 0);
      z-index: 0;
    }
  }

  @keyframes flipNextMobile {
    0% {
      transform: rotateY(0deg) translateX(0) translateZ(0);
      opacity: 1;
      z-index: 10;
    }
    22% {
      transform: rotateY(-28deg) translateX(-8px) translateZ(8px);
      opacity: 1;
    }
    50% {
      transform: rotateY(-96deg) translateX(-16px) translateZ(10px);
      opacity: 1;
      z-index: 12;
    }
    82% {
      transform: rotateY(-154deg) translateX(-8px) translateZ(6px);
      opacity: 0.7;
      z-index: 0;
    }
    100% {
      transform: rotateY(-180deg) translateX(0) translateZ(0);
      opacity: 0.2;
      z-index: 0;
    }
  }

  @keyframes flipPrevMobile {
    0% {
      transform: rotateY(0deg) translateX(0) translateZ(0);
      opacity: 1;
      z-index: 10;
    }
    22% {
      transform: rotateY(28deg) translateX(8px) translateZ(8px);
      opacity: 1;
    }
    50% {
      transform: rotateY(96deg) translateX(16px) translateZ(10px);
      opacity: 1;
      z-index: 12;
    }
    82% {
      transform: rotateY(154deg) translateX(8px) translateZ(6px);
      opacity: 0.7;
      z-index: 0;
    }
    100% {
      transform: rotateY(180deg) translateX(0) translateZ(0);
      opacity: 0.2;
      z-index: 0;
    }
  }

  @keyframes flipShadeNext {
    0% {
      opacity: 0;
      transform: scaleX(1);
    }
    30% {
      opacity: 0.26;
      transform: scaleX(1.02);
    }
    50% {
      opacity: 0.54;
      transform: scaleX(1.08);
    }
    80% {
      opacity: 0.22;
      transform: scaleX(1.02);
    }
    100% {
      opacity: 0;
      transform: scaleX(1);
    }
  }

  @keyframes facingPageShade {
    0% {
      opacity: 0;
      transform: scaleX(1);
    }
    30% {
      opacity: 0.12;
      transform: scaleX(1.01);
    }
    55% {
      opacity: 0.24;
      transform: scaleX(1.03);
    }
    85% {
      opacity: 0.1;
      transform: scaleX(1.01);
    }
    100% {
      opacity: 0;
      transform: scaleX(1);
    }
  }

  @keyframes pageToneNext {
    0% {
      filter: brightness(1) saturate(1);
    }
    50% {
      filter: brightness(0.72) saturate(0.95);
    }
    100% {
      filter: brightness(0.96) saturate(0.98);
    }
  }

  @media (max-width: 1023px) {
    .book-spread {
      display: block;
      margin: 0 auto;
      max-width: ${A4_WIDTH}px;
    }
    
    .page-right {
      display: none !important;
    }

    .book-spread-background {
      max-width: ${A4_WIDTH}px;
      margin: 0 auto;
    }
  }

  .select-text, .select-text * {
    user-select: text !important;
    -webkit-user-select: text !important;
    -moz-user-select: text !important;
    -ms-user-select: text !important;
    cursor: text !important;
  }

  .book-closed {
    cursor: pointer;
    transition: transform 0.3s ease;
    transform: scale(0.65);
    transform-origin: center top;
  }

  .navbar-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-btn {
    background: rgba(0, 0, 0, 0.05);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(0, 0, 0, 0.1);
    color: #1f2937;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 6px;
    white-space: nowrap;
  }

  .control-btn:hover:not(:disabled) {
    background: rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .control-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .control-btn.active {
    background: rgba(99, 102, 241, 0.15);
    border-color: rgba(99, 102, 241, 0.3);
    color: #4f46e5;
  }

  @keyframes pulse-border {
    0%, 100% {
      border-color: rgba(99, 102, 241, 0.3);
    }
    50% {
      border-color: rgba(99, 102, 241, 0.6);
    }
  }

  .control-btn.speaking {
    animation: pulse-border 1.5s ease-in-out infinite;
  }

  @media (max-width: 1700px) {
    .book-closed {
      transform: scale(0.75);
      transform-origin: center top;
    }
  }

  @media (max-width: 1400px) {
    .book-closed {
      transform: scale(0.5);
      transform-origin: center top;
    }
  }

  @media (max-width: 1024px) {
    .book-closed {
      transform: scale(0.5);
      transform-origin: center top;
    }
  }

  @media (max-width: 850px) {
    .book-closed {
      transform: scale(0.75);
      transform-origin: center top;
    }
  }

  @media (max-width: 768px) {
    .book-closed {
      transform: scale(0.65);
      transform-origin: center top;
    }
  }

  @media (max-width: 600px) {
    .book-closed {
      transform: scale(0.55);
      transform-origin: center top;
    }
  }

  @media (max-width: 480px) {
    .book-closed {
      transform: scale(0.48);
      transform-origin: center top;
    }
    
    .control-btn span {
      display: none;
    }
    
    .control-btn {
      padding: 6px;
    }
  }

  @media (max-width: 400px) {
    .book-closed {
      transform: scale(0.42);
      transform-origin: center top;
    }
    
    .navbar-controls {
      gap: 6px;
    }
    
    .control-btn {
      padding: 6px 10px;
      font-size: 12px;
      gap: 4px;
    }
    
    .control-btn svg {
      width: 14px;
      height: 14px;
    }
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .navbar-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .navbar-left {
    flex-shrink: 0;
  }

  .navbar-center {
    flex: 1;
    min-width: 0;
    text-align: center;
  }

  .navbar-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }

  .navbar-title {
    font-size: 20px;
    font-weight: bold;
  }

  @media (max-width: 768px) {
    .navbar-container {
      gap: 4px;
    }

    .navbar-title { 
      font-size: 14px !important;
    }

    .navbar-page-info {
      font-size: 10px !important;
    }
    
    .navbar-right .divider {
      display: none !important;
    }
    
    .scale-slider-container {
      display: none !important;
    }
  }

  @media (max-width: 480px) {
    .navbar-title {
      font-size: 12px !important;
    }
  }

  @media print {
    @page {
      size: A4;
      margin: 0;
    }
  }
`}</style>



      <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#F0F4F8]'}`}>

        {/* Previous Button - Fixed Left Side */}
        {canGoPrevious() && bookOpened && !isMobile && (
          <button
            onClick={goToPreviousPage}
            disabled={isFlipping}
            className={`hidden lg:block fixed left-[0.5%] top-[150px] xl:left-[5%] xl:top-[150px] 2xl:left-[10%] 2xl:top-[150px] p-4 rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed z-[9999] ${isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-800 hover:bg-gray-50'
              }`}
            style={{ filter: 'none', WebkitFilter: 'none' }}
            title="Previous Page"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next Button - Fixed Right Side */}
        {canGoNext() && bookOpened && !isMobile && (
          <button
            onClick={goToNextPage}
            disabled={isFlipping}
            className={`hidden lg:block fixed right-[0.5%] top-[150px] xl:right-[5%] xl:top-[150px] 2xl:right-[10%] 2xl:top-[150px] p-4 rounded-full shadow-lg transition-all hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed z-[9999] ${isDarkMode ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-800 hover:bg-gray-50'
              }`}
            style={{ filter: 'none', WebkitFilter: 'none' }}
            title="Next Page"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Top Navbar - Fully Responsive */}
        <div className={`sticky top-0 z-50 transition-colors duration-300 shadow-sm ${isDarkMode ? 'bg-[#2A2A2A] border-b border-gray-700' : 'bg-white border-b border-gray-200'}`}>
          <div className="max-w-full mx-auto px-2 sm:px-4 md:px-6 py-2 md:py-3">
            <div className="flex items-center justify-between gap-2 sm:gap-4">

              {/* Left: Close + Topic Navigation */}
              <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                <button
                  onClick={closeBook}
                  className={`p-1 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                  title="Close"
                >
                  <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>

                {bookOpened && (
                  <div className="flex items-center gap-0.5 sm:gap-2 ml-1 overflow-x-auto">
                    <button
                      onClick={goToHomePage}
                      disabled={tocPageIndex === -1 || isFlipping}
                      className={`px-1.5 py-0.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-sm rounded-md border transition whitespace-nowrap ${isDarkMode
                        ? 'border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-40'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40'
                        }`}
                      title="Go to table of contents"
                    >
                      Home
                    </button>

                    <button
                      onClick={goToPreviousTopic}
                      disabled={previousTopicPageIndex === -1 || isFlipping}
                      className={`px-1.5 py-0.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-sm rounded-md border transition whitespace-nowrap ${isDarkMode
                        ? 'border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-40'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40'
                        }`}
                      title="Go to previous topic"
                    >
                      Previous
                    </button>

                    <button
                      onClick={goToNextTopic}
                      disabled={nextTopicPageIndex === -1 || isFlipping}
                      className={`px-1.5 py-0.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-sm rounded-md border transition whitespace-nowrap ${isDarkMode
                        ? 'border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-40'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40'
                        }`}
                      title="Go to next topic"
                    >
                      Next
                    </button>

                    <button
                      onClick={goToEndPage}
                      disabled={endPageIndex < 0 || isFlipping}
                      className={`px-1.5 py-0.5 sm:px-3 sm:py-1.5 text-[10px] sm:text-sm rounded-md border transition whitespace-nowrap ${isDarkMode
                        ? 'border-gray-600 text-gray-200 hover:bg-gray-700 disabled:opacity-40'
                        : 'border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-40'
                        }`}
                      title="Go to end page"
                    >
                      End
                    </button>
                  </div>
                )}
              </div>

              {/* Center: Page Number */}
              {bookOpened && (
                <div className="flex-1 flex items-center justify-center">
                  <span className={`text-xs sm:text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {leftPageIndex + 1}/{allPages.length}
                  </span>
                </div>
              )}

              {/* Right: Controls */}
              <div className="flex items-center gap-1 sm:gap-3">
                {bookOpened && (
                  <>
                    {/* Font Size Range Input */}
                    <div className="scale-slider-container flex items-center gap-2 mr-2">
                      <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Font:</span>
                      <input
                        type="range"
                        min={FONT_MIN}
                        max={FONT_MAX}
                        step={FONT_STEP}
                        value={fontSize}
                        onChange={(e) => setFontSize(parseInt(e.target.value))}
                        className="w-32 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        style={{
                          background: `linear-gradient(to right, #10B981 0%, #10B981 ${sliderFill}%, #E5E7EB ${sliderFill}%, #E5E7EB 100%)`
                        }}
                      />
                      <span className={`text-xs w-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{fontSize}%</span>
                    </div>

                    <div className={`h-6 w-px ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`}></div>
                    {/* Bookmark Icon */}
                    {/* <button
                      className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      title="Bookmark"
                    >
                      <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button> */}

                    {/* Dark Mode Toggle */}
                    <button
                      onClick={() => setIsDarkMode(!isDarkMode)}
                      className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
                    >
                      {isDarkMode ? (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                        </svg>
                      )}
                    </button>

                    {/* Page View Toggle (Desktop Only) */}
                    {!isMobile && (
                      <button
                        onClick={togglePageViewMode}
                        className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        title={pageViewMode === 'double' ? 'Single Page View' : 'Double Page View'}
                      >
                        {pageViewMode === 'single' ? (
                          <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                        ) : (
                          <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        )}
                      </button>
                    )}

                    {/* Audio/Speaker Icon */}
                    {!isSpeaking ? (
                      <button
                        onClick={startSpeaking}
                        className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                        title="Read Aloud"
                      >
                        <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                        </svg>
                      </button>
                    ) : (
                      <>
                        {!isPaused ? (
                          <button
                            onClick={pauseSpeaking}
                            className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'bg-blue-900/30' : 'bg-blue-50'}`}
                            title="Pause"
                          >
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={resumeSpeaking}
                            className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                            title="Resume"
                          >
                            <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}

                    {/* Bookmark Icon */}
                    <button
                      onClick={handleBookmarkClick}
                      className={`p-1.5 sm:p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                      title="Bookmark Page"
                    >
                      <svg className={`w-4 h-4 sm:w-5 sm:h-5 ${isPageBookmarked(currentPageIndex) || (!isMobile && isPageBookmarked(currentPageIndex + 1))
                        ? 'text-blue-500 fill-current'
                        : isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>



        {/* Book Content Area */}
        <div className="flex justify-center items-start px-2 sm:px-4 py-4 sm:py-8 md:py-3 min-h-0">
          {!bookOpened ? (
            <div className="book-closed" onClick={openBook}>
              <div className="book-page" style={{ width: `${A4_WIDTH}px`, height: `${A4_HEIGHT}px` }}>
                <CoverPage book={book} />
              </div>
              <p className="text-white text-center mt-6 text-lg animate-pulse">
                Click to open book • A4 Size (210×297mm)
              </p>
            </div>
          ) : (
            <div
              ref={bookContainerRef}
              className={`book-spread-container ${isSinglePageMode() ? 'single-page-mode' : ''}`}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <div className="book-spread-background">
                {isFlipping && flipDirection === 'next' && nextLeftPage && (
                  <>
                    <div className="book-page page-left" data-page-kind={nextLeftPage?.type} style={{ width: `${A4_WIDTH}px`, height: `${maxPageHeight}px` }}>
                      <div className="page-flip-shade" />
                      <PageContent
                        page={nextLeftPage}
                        pageIndex={nextLeftPageIndex}
                        pageNumber={currentPageIndex + (isSinglePageMode() ? 2 : 3)}
                        highlights={highlights}
                        onChapterClick={goToPage}
                        book={book}
                        isDarkMode={isDarkMode}
                        setIsDarkMode={setIsDarkMode}
                        isMobile={isMobile}
                        currentPageIndex={nextLeftPageIndex}
                      />
                    </div>
                    {!isSinglePageMode() && (
                      <div className="book-page page-right" data-page-kind={nextRightPage?.type} style={{ width: `${A4_WIDTH}px`, height: `${maxPageHeight}px` }}>
                        <div className="page-flip-shade" />
                        {nextRightPage ? (
                          <PageContent
                            page={nextRightPage}
                            pageIndex={nextRightPageIndex}
                            pageNumber={currentPageIndex + 4}
                            highlights={highlights}
                            onChapterClick={goToPage}
                            book={book}
                            isDarkMode={isDarkMode}
                            setIsDarkMode={setIsDarkMode}
                            isMobile={isMobile}
                            currentPageIndex={nextLeftPageIndex}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%' }} />
                        )}
                      </div>
                    )}
                  </>
                )}

                {isFlipping && flipDirection === 'prev' && prevLeftPage && (
                  <>
                    <div className="book-page page-left" data-page-kind={prevLeftPage?.type} style={{ width: `${A4_WIDTH}px`, height: `${maxPageHeight}px` }}>
                      <div className="page-flip-shade" />
                      <PageContent
                        page={prevLeftPage}
                        pageIndex={prevLeftPageIndex}
                        pageNumber={currentPageIndex - (isSinglePageMode() ? 0 : 1)}
                        highlights={highlights}
                        onChapterClick={goToPage}
                        book={book}

                        isDarkMode={isDarkMode}
                        setIsDarkMode={setIsDarkMode}
                        isMobile={isMobile}
                        currentPageIndex={prevLeftPageIndex}
                      />
                    </div>
                    {!isSinglePageMode() && (
                      <div className="book-page page-right" data-page-kind={prevRightPage?.type} style={{ width: `${A4_WIDTH}px`, height: `${maxPageHeight}px` }}>
                        <div className="page-flip-shade" />
                        {prevRightPage ? (
                          <PageContent
                            page={prevRightPage}
                            pageIndex={prevRightPageIndex}
                            pageNumber={currentPageIndex}
                            highlights={highlights}
                            onChapterClick={goToPage}
                            book={book}

                            isDarkMode={isDarkMode}
                            setIsDarkMode={setIsDarkMode}
                            isMobile={isMobile}
                            currentPageIndex={prevLeftPageIndex}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%' }} />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className={`book-spread ${isFlipping ? `flipping-${flipDirection}` : ''} ${isSinglePageMode() ? 'single-page-mode' : ''}`} style={{ position: 'relative' }}>
                {leftPage && (
                  <div
                    className="book-page page-left page-flip-animation"
                    data-page-kind={leftPage?.type}
                    style={{
                      width: `${A4_WIDTH}px`,
                      height: `${maxPageHeight}px`,
                      transform: isDragging && canDrag && dragOffset > 0
                        ? `rotateY(${Math.min(dragOffset / 5, 30)}deg)`
                        : 'rotateY(0deg)'
                    }}
                  >
                    {renderCornerFolds('left', isSinglePageMode())}
                    <div className="page-flip-shade" />
                    <PageContent
                      page={leftPage}
                      pageIndex={leftPageIndex}
                      pageNumber={leftPageIndex + 1}
                      highlights={highlights}
                      onChapterClick={goToPage}
                      book={book}

                      isDarkMode={isDarkMode}
                      setIsDarkMode={setIsDarkMode}
                      isMobile={isMobile}
                      currentPageIndex={currentPageIndex}
                    />
                  </div>
                )}

                {!isSinglePageMode() && (
                  <div
                    className="book-page page-right page-flip-animation"
                    data-page-kind={rightPage?.type}
                    style={{
                      width: `${A4_WIDTH}px`,
                      height: `${maxPageHeight}px`,
                      transform: isDragging && canDrag && dragOffset < 0
                        ? `rotateY(${Math.max(dragOffset / 5, -30)}deg)`
                        : 'rotateY(0deg)'
                    }}
                  >
                    {renderCornerFolds('right')}
                    <div className="page-flip-shade" />
                    {rightPage ? (
                      <PageContent
                        page={rightPage}
                        pageIndex={rightPageIndex}
                        pageNumber={rightPageIndex + 1}
                        highlights={highlights}
                        onChapterClick={goToPage}
                        book={book}

                        isDarkMode={isDarkMode}
                        setIsDarkMode={setIsDarkMode}
                        isMobile={isMobile}
                        currentPageIndex={currentPageIndex}
                      />
                    ) : (
                      <div style={{ width: '100%', height: '100%' }} />
                    )}
                  </div>
                )}


              </div>
              <p className={`text-center mt-6 text-lg ${isDarkMode ? 'text-white' : 'text-black'}`}>
                Drag to Flip Pages
              </p>

              {/* Highlights Section */}
              {bookOpened && highlights.length > 0 && (
                <div className={`highlights-section max-w-6xl mx-auto mt-6 mb-6 px-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      My Highlights ({highlights.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                    {highlights.map((highlight) => (
                      <div
                        key={highlight.id}
                        className={`group relative px-3 py-2 rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md ${isDarkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
                          }`}
                        style={{ borderTop: `2px solid ${highlight.color}` }}
                        onClick={() => goToHighlight(highlight.page_index, highlight.id)}
                      >
                        <div className="flex items-start gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full mt-1" style={{ backgroundColor: highlight.color }}></div>
                          <h4 className="font-semibold text-xs line-clamp-2 flex-1">{highlight.title}</h4>
                        </div>
                        <p className={`text-xs mb-1 line-clamp-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          "{highlight.selected_text}"
                        </p>
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                            P {highlight.page_index + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteHighlight(highlight.id);
                            }}
                            className="text-red-500 hover:text-red-700 p-0.5 ml-2"
                            title="Delete"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookmarks Section */}
              {bookOpened && bookmarks.length > 0 && (
                <div className={`bookmarks-section max-w-6xl mx-auto mt-6 mb-8 px-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                      </svg>
                      My Bookmarks ({bookmarks.length})
                    </h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {bookmarks.map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className={`group relative px-3 py-2 rounded-lg shadow-sm cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 ${isDarkMode ? 'bg-gray-800 hover:bg-gray-750' : 'bg-white hover:bg-gray-50'
                          }`}
                        onClick={() => goToBookmark(bookmark.page_index)}
                      >
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                          </svg>
                          <span className={`text-sm font-semibold ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                            Page {bookmark.page_index + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBookmark(bookmark.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 ml-1"
                            title="Remove"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bookmark Choice Modal (Desktop) */}
      {showBookmarkModal && !isMobile && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={() => setShowBookmarkModal(false)}
          />
          <div
            className={`fixed z-50 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'} rounded-lg shadow-2xl p-6 w-96`}
            style={{
              left: '50%',
              top: '50%',
              marginLeft: '-192px',
              marginTop: '-200px'
            }}
          >
            <h3 className="text-lg font-bold mb-4">Bookmark Page</h3>
            <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              Which page do you want to bookmark?
            </p>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => toggleBookmark(currentPageIndex)}
                className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${isPageBookmarked(currentPageIndex)
                  ? 'border-blue-500 bg-blue-50'
                  : isDarkMode
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <svg className={`w-8 h-8 mx-auto mb-2 ${isPageBookmarked(currentPageIndex) ? 'text-blue-500' : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`} fill={isPageBookmarked(currentPageIndex) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <p className="font-semibold">Left Page</p>
                <p className="text-sm text-gray-500">Page {currentPageIndex + 1}</p>
                {isPageBookmarked(currentPageIndex) && (
                  <p className="text-xs text-blue-500 mt-1">✓ Bookmarked</p>
                )}
              </button>

              <button
                onClick={() => toggleBookmark(currentPageIndex + 1)}
                className={`p-4 rounded-lg border-2 transition-all hover:scale-105 ${isPageBookmarked(currentPageIndex + 1)
                  ? 'border-blue-500 bg-blue-50'
                  : isDarkMode
                    ? 'border-gray-600 hover:border-gray-500'
                    : 'border-gray-300 hover:border-gray-400'
                  }`}
              >
                <svg className={`w-8 h-8 mx-auto mb-2 ${isPageBookmarked(currentPageIndex + 1) ? 'text-blue-500' : isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`} fill={isPageBookmarked(currentPageIndex + 1) ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <p className="font-semibold">Right Page</p>
                <p className="text-sm text-gray-500">Page {currentPageIndex + 2}</p>
                {isPageBookmarked(currentPageIndex + 1) && (
                  <p className="text-xs text-blue-500 mt-1">✓ Bookmarked</p>
                )}
              </button>
            </div>

            <button
              onClick={() => setShowBookmarkModal(false)}
              className={`w-full mt-6 px-4 py-2 rounded-lg transition-colors font-medium ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                }`}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Color Picker Modal */}
      {showColorPicker && (
        <>
          <div
            className={`fixed z-50 ${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-black'} rounded-lg shadow-2xl p-3 w-72`}
            style={{
              left: `${colorPickerPosition.x}px`,
              top: `${colorPickerPosition.y + 10}px`,
              transform: 'translateX(-50%)'
            }}
          >
            <button
              onClick={() => {
                setShowColorPicker(false);
                setSelectedText('');
                setHighlightTitle('');
                window.getSelection().removeAllRanges();
              }}
              className={`absolute top-2 right-2 p-1 rounded-full transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-xs font-bold mb-2">Choose highlight color</h3>

            <div className="mb-2">
              <div className="flex gap-1.5 flex-wrap justify-center">
                {[
                  { color: '#FFFF00', name: 'Yellow' },
                  { color: '#90EE90', name: 'Green' },
                  { color: '#FFB6C1', name: 'Pink' },
                  { color: '#87CEEB', name: 'Blue' },
                  { color: '#FFD700', name: 'Gold' },
                  { color: '#DDA0DD', name: 'Plum' },
                  { color: '#FFA500', name: 'Orange' },
                  { color: '#98FB98', name: 'Mint' }
                ].map((item) => (
                  <button
                    key={item.color}
                    onClick={() => setSelectedColor(item.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedColor === item.color ? 'border-black ring-2 ring-blue-500' : 'border-gray-300'
                      }`}
                    style={{ backgroundColor: item.color }}
                    title={item.name}
                  />
                ))}
              </div>
            </div>

            <div className="mb-2">
              <input
                type="text"
                value={highlightTitle}
                onChange={(e) => setHighlightTitle(e.target.value)}
                placeholder="Add a note (optional)"
                className={`w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'}`}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={saveHighlight}
                className="flex-1 bg-blue-500 text-white px-3 py-1.5 text-xs rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setShowColorPicker(false);
                  setSelectedText('');
                  setHighlightTitle('');
                  window.getSelection().removeAllRanges();
                }}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
                  }`}
              >
                Cancel
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// Page Content Component (EXACT SAME AS YOUR ORIGINAL)
function PageContent({ page, pageIndex, pageNumber, highlights, onChapterClick, book, isDarkMode, setIsDarkMode, isMobile, currentPageIndex }) {
  if (page.type === 'cover') {
    return <CoverPage book={book} />;
  }
  if (page.type === 'toc') {
    return (
      <TableOfContents
        chapters={page.content}
        chapterPageMap={page.chapterPageMap}
        topicPageMap={page.topicPageMap}
        subtopicPageMap={page.subtopicPageMap}
        topicSubtopicsMap={page.topicSubtopicsMap}
        onChapterClick={onChapterClick}
      />
    );
  }
  if (page.type === 'topic-title') {
    return <TopicTitlePage topic={page.content} pageNumber={pageNumber} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }
  if (page.type === 'subtopic-title') {
    return <SubtopicTitlePage subtopic={page.content} topicTitle={page.topicTitle} pageNumber={pageNumber} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }
  if (page.type === 'chapter-title') {
    return <ChapterTitlePage chapter={page.content} pageNumber={pageNumber} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />;
  }
  if (page.type === 'content') {
    return <ContentPage page={page.content} pageIndex={pageIndex} highlights={highlights} chapterTitle={page.topicTitle} subtopicTitle={page.subtopicTitle} pageNumber={pageNumber} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} isMobile={isMobile} currentPageIndex={currentPageIndex} />;
  }
  if (page.type === 'back-cover') {
    return <BackCoverPage book={book} />;
  }
  return null;
}

function CoverPage({ book }) {
  return (
    <div className="page-inner bg-gradient-to-br from-blue-500 via-blue-500 to-blue-500 text-white" style={{ height: '100%' }}>
      {/* Header */}
      <div className="flex-shrink-0 pt-8 text-center" style={{ height: '80px' }}>
        {/* <div className="mx-auto flex items-center justify-center px-4">
          <img
            src="/api/files/logo.png"
            alt="PLAB MEDI"
            className="h-auto w-[130px] max-w-full object-contain sm:w-[160px] md:w-[190px]"
            style={{ maxHeight: '44px' }}
          />
        </div> */}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-start items-center p-12">
        <div className="text-center space-y-6">
          {/* Book Icon */}
          <div className="mb-8">
            <img
              src="/api/files/logo.png"
              alt="Book icon"
              className="h-auto w-40 sm:w-70 lg:w-100 mx-auto object-contain"
              style={{ maxHeight: '96px' }}
            />
          </div>

          {/* Title */}
          <h1 className="text-xl font-bold leading-tight px-6 select-text">
            {book?.title || 'Smart Notes'}
          </h1>

          {/* Author */}
          <div className="space-y-2 pt-2">
            <p className="text-lg text-blue-200">by {book?.author_name || 'Dr. Karam Singh'}</p>
          </div>

          {/* Divider Line */}
          <div className="w-48 h-px bg-blue-300/50 mx-auto my-6"></div>

          {/* Edition/Subject */}
          <div className="space-y-3 pt-2">
            <p className="text-base text-blue-100 select-text">
              {book?.subject_name || 'Clinical Practice Edition'}
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 text-center pb-8" style={{ height: '80px' }}>
        <p className="text-sm text-blue-200">Tap to open</p>
        <p className="text-xs text-blue-300">{book?.topic_name || '2025 Edition'}</p>
      </div>
    </div>
  );
}


function TableOfContents({ chapters, chapterPageMap, topicPageMap, subtopicPageMap, topicSubtopicsMap, onChapterClick }) {
  const topics = chapters;
  const [openTopicId, setOpenTopicId] = useState(null);

  return (
    <div className="page-inner bg-white" style={{ height: '100%' }} data-page-type="toc">
      {/* Header */}
      <div className="flex-shrink-0 p-10 pb-4">
        <h2 className="text-3xl font-bold text-gray-900 select-text">
          Course Contents
        </h2>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 px-10 pb-4 overflow-y-auto">
        <div className="space-y-0">
          {topics.map((topic, topicIndex) => {
            const topicPageIndex = topicPageMap?.[topic.id];
            const subtopics = topicSubtopicsMap?.[topic.id] || [];
            const isOpen = openTopicId === topic.id;

            return (
              <div key={topic.id} className="border-b border-gray-200 last:border-b-0">
                {/* Topic Header Row */}
                <div className="flex items-center bg-blue-50/50 hover:bg-blue-50 transition-all">
                  {/* Expand/collapse toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenTopicId(isOpen ? null : topic.id);
                    }}
                    className="flex-shrink-0 w-10 flex items-center justify-center self-stretch text-blue-600 hover:text-blue-800"
                    title={isOpen ? 'Collapse' : 'Expand'}
                  >
                    <svg
                      className="w-4 h-4 transition-transform duration-200"
                      style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Topic title — click to navigate */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (topicPageIndex !== undefined) onChapterClick(topicPageIndex);
                    }}
                    className="flex-1 text-left p-1"
                  >
                    <div className="space-y-0.5">
                      <h3 className="font-bold text-sm text-blue-900 select-text">
                        {topicIndex + 1}. {topic.name}
                      </h3>
                      {topic.description && (
                        <p className="text-xs text-gray-500 select-text line-clamp-1">{topic.description}</p>
                      )}
                      <p className="text-xs text-blue-500 font-medium">
                        {subtopics.length} subtopic{subtopics.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </button>

                  {/* Page number */}
                  {topicPageIndex !== undefined && (
                    <span className="flex-shrink-0 pr-4 text-xs text-gray-400 font-medium">
                      p.{topicPageIndex + 1}
                    </span>
                  )}
                </div>

                {/* Subtopics accordion */}
                {isOpen && subtopics.length > 0 && (
                  <div className="bg-gray-50 border-t border-gray-100">
                    {subtopics.map((subtopic, subIndex) => {
                      const subtopicPageIndex = subtopicPageMap?.[subtopic.id];
                      return (
                        <button
                          key={subtopic.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (subtopicPageIndex !== undefined) onChapterClick(subtopicPageIndex);
                          }}
                          className="w-full flex items-center justify-between px-6 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0"
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {subIndex + 1}
                            </span>
                            <span className="text-sm text-gray-800 select-text">{subtopic.name}</span>
                          </div>
                          {subtopicPageIndex !== undefined && (
                            <span className="text-xs text-gray-400 font-medium flex-shrink-0 ml-2">
                              p.{subtopicPageIndex + 1}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 h-12"></div>
    </div>
  );
}


function ChapterTitlePage({ chapter, pageNumber, chapterIndex, isDarkMode }) {
  return (
    <div
      className={`page-inner relative ${isDarkMode ? 'bg-[#2A2A2A]' : 'bg-white'
        }`}
      style={{ height: '100%' }}>
      <div className="flex flex-col justify-start items-center p-12 h-full">
        <div className="text-center space-y-6 max-w-2xl">
          {/* Chapter Number */}
          {/* <p
            className={`text-sm uppercase tracking-wide select-text ${isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}
          >
            CHAPTER {chapterIndex || 1}
          </p>

          {/* Chapter Title */}
          <h2
            className={`text-4xl font-bold leading-tight select-text ${isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}
          >
            {chapter.title}
          </h2>

          {/* Underline */}
          <div
            className={`w-16 h-1 mx-auto ${isDarkMode ? 'bg-blue-400' : 'bg-blue-600'
              }`}
          ></div>

          {/* Description */}
          <p
            className={`text-base leading-relaxed px-8 select-text mt-8 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}
          >
            This chapter covers essential endocrinology concepts including diabetes mellitus,
            thyroid disorders, adrenal pathology, and metabolic syndromes. Key topics include
            pathophysiology, clinical manifestations, diagnostic approaches, and evidence-based
            management strategies.
          </p>
        </div>

        {/* Page Number */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <span
            className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}
          >
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

function TopicTitlePage({ topic, pageNumber, isDarkMode }) {
  return (
    <div
      className={`page-inner relative ${isDarkMode ? 'bg-[#2A2A2A]' : 'bg-white'
        }`}
      style={{ height: '100%' }}>
      <div className="flex flex-col justify-start items-center p-12 h-full">
        <div className="text-center space-y-6 max-w-2xl w-full">
          <div className="mx-auto flex items-center justify-center">
            <img
              src="/api/files/logo.png"
              alt="Topic logo"
              className="h-auto w-[150px] max-w-full object-contain sm:w-[190px] md:w-[230px]"
              style={{ maxHeight: '62px' }}
            />
          </div>

          <div className="px-2 sm:px-6">

            <h2
              className={`text-3xl sm:text-4xl font-bold leading-tight select-text ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
            >
              {topic.name}
            </h2>
            <div className={`w-16 h-1 mt-4 mx-auto ${isDarkMode ? 'bg-blue-400' : 'bg-blue-600'}`}></div>

          </div>
        </div>

        {/* Page Number */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <span
            className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}
          >
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}

function SubtopicTitlePage({ subtopic, topicTitle, pageNumber, isDarkMode }) {
  return (
    <div
      className={`page-inner relative ${isDarkMode ? 'bg-[#2A2A2A]' : 'bg-white'
        }`}
      style={{ height: '100%' }}>
      <div className="flex flex-col justify-start items-center p-12 h-full">
        <div className="text-center space-y-6 max-w-2xl w-full">
          <div className="mx-auto flex items-center justify-center">
            <img
              src="/api/files/logo.png"
              alt="Subtopic logo"
              className="h-auto w-[150px] max-w-full object-contain sm:w-[190px] md:w-[230px]"
              style={{ maxHeight: '62px' }}
            />
          </div>

          <div className="px-2 sm:px-6">

            <p className={`text-sm font-semibold mb-3 select-text ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
              {topicTitle}
            </p>


            <h2
              className={`text-2xl sm:text-3xl font-bold leading-tight select-text ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}
            >
              {subtopic.name}
            </h2>
            <div className={`w-16 h-1 mt-4 mx-auto ${isDarkMode ? 'bg-green-400' : 'bg-green-600'}`}></div>

          </div>
        </div>

        {/* Page Number */}
        <div className="absolute bottom-8 left-0 right-0 text-center">
          <span
            className={`text-sm ${isDarkMode ? 'text-gray-500' : 'text-gray-500'
              }`}
          >
            {pageNumber}
          </span>
        </div>
      </div>
    </div>
  );
}


function ContentPage({ page, pageIndex, highlights, chapterTitle, pageNumber, isDarkMode, isMobile, currentPageIndex }) {
  // Header and footer heights
  const HEADER_HEIGHT = 60;
  const FOOTER_HEIGHT = 50;
  // Prepare HTML content and inject highlights for this page synchronously
  let htmlContent = page.content || `<p class="${isDarkMode ? 'text-gray-500' : 'text-gray-400'} italic text-center mt-20">No content available</p>`;

  // Remove empty <p><br></p> tags only from the start and end of content
  const emptyP = /^(\s*<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>\s*)+/gi;
  htmlContent = htmlContent.replace(emptyP, '');
  htmlContent = htmlContent.replace(new RegExp(emptyP.source + '$', 'gi'), '').trimEnd();
  // Trim trailing empty <p><br></p>
  htmlContent = htmlContent.replace(/(\s*<p[^>]*>\s*(<br\s*\/?>)?\s*<\/p>\s*)+$/gi, '');

  // Always strip any previously-injected <mark> tags from the base HTML.
  // This ensures stale marks from injectHighlightsIntoAllPages (baked into
  // allPages state) are never rendered on pages we navigate to after a delete.
  try {
    const stripContainer = document.createElement('div');
    stripContainer.innerHTML = htmlContent;
    stripContainer.querySelectorAll('mark[data-highlight-id]').forEach(m => {
      const frag = document.createDocumentFragment();
      while (m.firstChild) frag.appendChild(m.firstChild);
      m.replaceWith(frag);
    });
    htmlContent = stripContainer.innerHTML;
  } catch (e) { }

  try {
    if (highlights && highlights.length > 0 && typeof pageIndex === 'number') {
      // Show highlights from BOTH pages of the current spread so that
      // a word present on both left and right page gets marked on both.
      const spreadIndices = (!isMobile && typeof currentPageIndex === 'number')
        ? [currentPageIndex, currentPageIndex + 1]
        : (typeof currentPageIndex === 'number' ? [currentPageIndex] : [pageIndex]);
      const pageHighlights = highlights.filter(h => spreadIndices.includes(h.page_index));
      if (pageHighlights.length > 0) {
        try {
          const container = document.createElement('div');
          container.innerHTML = htmlContent;

          pageHighlights.forEach(highlight => {
            try {
              const instance = new Mark(container);
              instance.mark(highlight.selected_text || '', {
                separateWordSearch: false,
                diacritics: false,
                acrossElements: true,
                each: (node) => {
                  try {
                    node.setAttribute('data-highlight-id', String(highlight.id));
                    node.style.backgroundColor = highlight.color;
                    node.style.padding = '2px 0';
                    node.style.cursor = 'pointer';
                    if (highlight.title) node.title = highlight.title;
                  } catch (e) { }
                }
              });
            } catch (err) {
              console.warn('inject highlight (page) error', err);
            }
          });

          htmlContent = container.innerHTML;
        } catch (err) {
          console.warn('inject highlight (page) error', err);
        }
      }
    }
  } catch (err) {
    console.warn('prepare highlights error', err);
  }
  return (
    <div
      className={`page-inner ${isDarkMode ? 'bg-[#2A2A2A] text-gray-200' : 'bg-white text-gray-900'}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
    >
      {/* Header */}
      <div
        className={`flex-shrink-0 border-b-2 ${isDarkMode
          ? 'bg-[#2A2A2A] border-gray-700'
          : 'border-gray-200'
          }`}
        style={{ height: `${HEADER_HEIGHT}px`, padding: '12px 40px', background: isDarkMode ? undefined : '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <p
          className={`text-sm font-semibold truncate select-text ${isDarkMode ? 'text-gray-300' : 'text-gray-900'}`}
        >
          {chapterTitle}
        </p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <img
            src="/api/files/logo.png"
            alt="Page logo"
            className="h-auto w-7 sm:w-20 object-contain"
            style={{ maxHeight: '18px' }}
          />
          <p className={`text-xs select-text ${isDarkMode ? 'text-gray-500' : 'text-gray-500'}`}>{pageNumber}</p>
        </div>
      </div>

      {/* Content Area */}
      <div
        className={`flex-1 ${isDarkMode ? 'bg-[#2A2A2A]' : 'bg-white'}`}
        style={{ padding: '40px' }}
      >
        <div
          className={`book-content-text select-text ${isDarkMode ? 'dark-book-content' : ''}`}
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />

      </div>

      {/* Footer */}
      <div
        className={`flex-shrink-0 border-t text-center ${isDarkMode
          ? 'bg-[#2A2A2A] border-gray-700'
          : 'border-gray-200'
          }`}
        style={{ height: `${FOOTER_HEIGHT}px`, padding: '12px 0', background: isDarkMode ? undefined : '#f9fafb', fontSize: '12px', color: isDarkMode ? '#9ca3af' : '#6b7280' }}
      >
        <div className="h-full flex flex-col items-center justify-center gap-0.5 px-3">
          <img
            src="/api/files/logo.png"
            alt="Footer logo"
            className="h-auto w-8 sm:w-20 object-contain"
            style={{ maxHeight: '20px' }}
          />
          {/* <span className="select-text text-[11px] leading-tight truncate max-w-full">{chapterTitle}</span> */}
        </div>
      </div>
    </div>
  );
}



function BackCoverPage({ book }) {
  return (
    <div className="page-inner bg-gradient-to-br from-gray-800 to-gray-900 text-white" style={{ height: '100%' }}>
      {/* Header */}
      <div className="flex-shrink-0 h-20"></div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center p-12">
        <div className="text-center space-y-8">
          <div className="text-8xl mb-6">✨</div>
          <h2 className="text-4xl font-bold">Thank You for Reading!</h2>
          <div className="w-32 h-1 bg-white mx-auto"></div>
          <p className="text-3xl font-semibold select-text px-8">{book?.title}</p>
          <p className="text-xl text-gray-300 select-text">by {book?.author_name}</p>
          <div className="mt-10 space-y-3">
            <p className="text-base text-gray-400 select-text">{book?.subject_name}</p>
            <p className="text-base text-gray-400 select-text">{book?.topic_name}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 h-20"></div>
    </div>
  );
}






{/* <p><iframe id="plab-iframe" src="https://plabcoachdb.vercel.app/embed/book/222" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; border: none; margin: 0; padding: 0; overflow: hidden; z-index: 9999;" allow="speech-synthesis; clipboard-read; clipboard-write" allowfullscreen="allowfullscreen">
</iframe></p>
<p>
<script>
(function() {
  const username    = localStorage.getItem('username');
  const guestUserId = localStorage.getItem('guest_user_id');
  const name        = localStorage.getItem('name');
  const email       = username ? username + '@testing.com' : null;

  if (!username || !email) return; // user not logged in

  const userData = { username, email, guestUserId, name };

  // &#9472;&#9472; METHOD 1: Inject as URL params (fires on first byte, no timing issues) &#9472;&#9472;
  const iframe = document.getElementById('plab-iframe');
  const base   = 'https://plabcoachdb.vercel.app/embed/book/222';
  const params = new URLSearchParams(userData).toString();
  iframe.src   = base + '?' + params;

  // &#9472;&#9472; METHOD 2: IFRAME_READY listener (fallback for postMessage flow) &#9472;&#9472;
  window.addEventListener('message', function(event) {
    if (event.origin !== 'https://plabcoachdb.vercel.app') return;
    if (event.data?.type === 'IFRAME_READY') {
      iframe.contentWindow.postMessage(userData, 'https://plabcoachdb.vercel.app');
    }
  });
})();
</script>
</p> */}
