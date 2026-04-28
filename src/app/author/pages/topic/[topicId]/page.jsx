'use client';
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TopicPagesPage() {
  const params = useParams();
  const router = useRouter();
  const topicId = params.topicId;

  const [pages, setPages] = useState([]);
  const [topicTitle, setTopicTitle] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [bookId, setBookId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [quillLoaded, setQuillLoaded] = useState(false);
  
  const [livePages, setLivePages] = useState([
    { id: 'page-1', content: '', existingPageId: null, pageNumber: 1 }
  ]);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [editingPageId, setEditingPageId] = useState(null);
  const [editingPageNumber, setEditingPageNumber] = useState(null);
  const [insertAtSavedIndex, setInsertAtSavedIndex] = useState(null);
  const [pageScale, setPageScale] = useState(1);
  useEffect(() => {
    const updateScale = () => {
      // 32px = outer px-4 padding (both sides), 48px = card p-6 padding (both sides)
      const available = window.innerWidth - 32 - 48;
      setPageScale(available < PAGE_WIDTH ? available / PAGE_WIDTH : 1);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, []);
  const quillRefs = useRef({});
  const initializedEditors = useRef(new Set());
  const reflowTimeout = useRef(null);
  const topRef = useRef(null);

  // ✅ FIX 1: Always-fresh ref for livePages — solves stale closure in initQuill
  const livePagesRef = useRef(livePages);
  useEffect(() => {
    livePagesRef.current = livePages;
  }, [livePages]);

  // A4 EXACT DIMENSIONS (96 DPI standard)
  const PAGE_WIDTH = 794;
  const PAGE_HEIGHT = 1123;
  const HEADER_HEIGHT = 60;
  const FOOTER_HEIGHT = 50;
  const CONTENT_PADDING = 40;
  const CONTENT_HEIGHT = PAGE_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT; // 1013px full container
  const CONTENT_WIDTH = PAGE_WIDTH - (CONTENT_PADDING * 2);           // 714px text area width
  // .ql-editor has padding 40px top + 40px bottom — actual visible text area height:
  const EFFECTIVE_CONTENT_HEIGHT = CONTENT_HEIGHT - (2 * CONTENT_PADDING); // 933px

  // Persistent hidden measurement div — created once, reused for all height checks
  const measureHeight = useRef(null);

  useEffect(() => {
    // Wrap measurement div inside .ql-snow > .ql-container > .ql-editor so that
    // ALL Quill CSS rules (paragraph margins, heading sizes, list indents, etc.)
    // apply to it exactly as they do inside a real editor — key fix for
    // empty-page / overflow bugs caused by height mismatch.
    const wrapperDiv = document.createElement('div');
    wrapperDiv.className = 'ql-snow';
    wrapperDiv.style.cssText = `position:absolute;visibility:hidden;left:-9999px;top:0;width:${PAGE_WIDTH}px;pointer-events:none;`;

    const containerDiv = document.createElement('div');
    containerDiv.className = 'ql-container';
    containerDiv.style.cssText = 'height:auto!important;overflow:visible!important;max-height:none!important;';

    const measureDiv = document.createElement('div');
    measureDiv.id = 'height-measure-div-topic';
    measureDiv.className = 'ql-editor';
    // Keep width equal to the real editor box width (border-box) so wrapping
    // and measured text height match the visible editor exactly.
    measureDiv.style.cssText = `width:${PAGE_WIDTH}px;height:auto!important;max-height:none!important;overflow:visible!important;`;

    containerDiv.appendChild(measureDiv);
    wrapperDiv.appendChild(containerDiv);
    document.body.appendChild(wrapperDiv);
    measureHeight.current = measureDiv;

    return () => {
      if (wrapperDiv && document.body.contains(wrapperDiv)) {
        document.body.removeChild(wrapperDiv);
      }
    };
  }, []);

  // NOTE: Because the measure div is a real .ql-editor, it inherits Quill's
  // `padding: 40px !important`. scrollHeight includes that padding, so we
  // subtract it to get net content height (matching EFFECTIVE_CONTENT_HEIGHT).
  const getContentHeight = (html) => {
    if (!html || html.trim() === '' || html === '<p><br></p>') return 0;
    if (measureHeight.current) {
      measureHeight.current.innerHTML = html;
      const style = window.getComputedStyle(measureHeight.current);
      const pt = parseFloat(style.paddingTop) || 0;
      const pb = parseFloat(style.paddingBottom) || 0;
      const height = (measureHeight.current.scrollHeight || 0) - pt - pb;
      measureHeight.current.innerHTML = '';
      return height;
    }
    return 0;
  };

  // Preload all <img> srcs in an HTML string so the browser caches their
  // dimensions before getContentHeight runs — prevents 0px image heights
  const preloadImages = (html) => {
    return new Promise((resolve) => {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const imgs = Array.from(doc.querySelectorAll('img'));
      if (imgs.length === 0) return resolve();
      let count = 0;
      const done = () => { if (++count >= imgs.length) resolve(); };
      imgs.forEach((img) => {
        const src = img.getAttribute('src');
        if (!src) { done(); return; }
        const image = new window.Image();
        image.onload = done;
        image.onerror = done;
        image.src = src;
      });
    });
  };

  // Async height measurement: sets innerHTML, waits for every <img> in the
  // measureDiv to finish layout (onload/onerror), then reads scrollHeight.
  // Fixes 0px image height bug that causes page overflow after paste.
  const getContentHeightAsync = (html) => {
    return new Promise((resolve) => {
      if (!html || html.trim() === '' || html === '<p><br></p>') return resolve(0);
      if (!measureHeight.current) return resolve(0);
      measureHeight.current.innerHTML = html;
      const imgs = Array.from(measureHeight.current.querySelectorAll('img'));
      const measure = () => {
        const style = window.getComputedStyle(measureHeight.current);
        const pt = parseFloat(style.paddingTop) || 0;
        const pb = parseFloat(style.paddingBottom) || 0;
        const height = (measureHeight.current.scrollHeight || 0) - pt - pb;
        measureHeight.current.innerHTML = '';
        resolve(height);
      };
      if (imgs.length === 0) return measure();
      let loaded = 0;
      const onDone = () => { if (++loaded >= imgs.length) measure(); };
      imgs.forEach(img => {
        if (img.complete && img.naturalHeight > 0) { onDone(); return; }
        img.addEventListener('load', onDone, { once: true });
        img.addEventListener('error', onDone, { once: true });
      });
    });
  };

  const registerQuillFormats = () => {
    if (!window.Quill || window.__pagesPageFormatsRegistered) return;

    const Parchment = window.Quill.import('parchment');
    const FontStyle = window.Quill.import('attributors/style/font');
    const SizeStyle = window.Quill.import('attributors/style/size');
    const AlignStyle = window.Quill.import('attributors/style/align');
    const BackgroundStyle = window.Quill.import('attributors/style/background');
    const ColorStyle = window.Quill.import('attributors/style/color');
    const DirectionStyle = window.Quill.import('attributors/style/direction');

    FontStyle.whitelist = null;
    SizeStyle.whitelist = null;

    const LineHeightStyle = new Parchment.Attributor.Style('lineheight', 'line-height', {
      scope: Parchment.Scope.BLOCK,
    });
    const LetterSpacingStyle = new Parchment.Attributor.Style('letterspacing', 'letter-spacing', {
      scope: Parchment.Scope.INLINE,
    });
    const FontWeightStyle = new Parchment.Attributor.Style('fontweight', 'font-weight', {
      scope: Parchment.Scope.INLINE,
    });
    const MarginTopStyle = new Parchment.Attributor.Style('margintop', 'margin-top', {
      scope: Parchment.Scope.BLOCK,
    });
    const MarginBottomStyle = new Parchment.Attributor.Style('marginbottom', 'margin-bottom', {
      scope: Parchment.Scope.BLOCK,
    });
    const MarginLeftStyle = new Parchment.Attributor.Style('marginleft', 'margin-left', {
      scope: Parchment.Scope.BLOCK,
    });
    const MarginRightStyle = new Parchment.Attributor.Style('marginright', 'margin-right', {
      scope: Parchment.Scope.BLOCK,
    });
    const TextIndentStyle = new Parchment.Attributor.Style('textindent', 'text-indent', {
      scope: Parchment.Scope.BLOCK,
    });

    window.Quill.register(FontStyle, true);
    window.Quill.register(SizeStyle, true);
    window.Quill.register(AlignStyle, true);
    window.Quill.register(BackgroundStyle, true);
    window.Quill.register(ColorStyle, true);
    window.Quill.register(DirectionStyle, true);
    window.Quill.register(LineHeightStyle, true);
    window.Quill.register(LetterSpacingStyle, true);
    window.Quill.register(FontWeightStyle, true);
    window.Quill.register(MarginTopStyle, true);
    window.Quill.register(MarginBottomStyle, true);
    window.Quill.register(MarginLeftStyle, true);
    window.Quill.register(MarginRightStyle, true);
    window.Quill.register(TextIndentStyle, true);

    window.__pagesPageFormatsRegistered = true;
  };

  const normalizePastedWhitespace = (text) => {
    if (!text) return text;

    return text
      .replace(/\t/g, '    ')
      .replace(/ {2,}/g, (spaces) => ` ${'\u00A0'.repeat(spaces.length - 1)}`);
  };

 useEffect(() => {
  const loadQuill = async () => {
    // Load Quill CSS
    const link = document.createElement('link');
    link.href = 'https://cdn.quilljs.com/1.3.6/quill.snow.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Load Quill JS
    const script = document.createElement('script');
    script.src = 'https://cdn.quilljs.com/1.3.6/quill.js';
    
    script.onload = () => {
      registerQuillFormats();

      // Load Image Resize Module
      const resizeScript = document.createElement('script');
      resizeScript.src = 'https://unpkg.com/quill-image-resize-module@3.0.0/image-resize.min.js';
      
      resizeScript.onload = () => {
        // Register module
        try {
          window.Quill.register('modules/imageResize', window.ImageResize.default || window.ImageResize);
          console.log('✅ Image Resize module registered');
        } catch (e) {
          console.error('❌ Failed to register Image Resize:', e);
        }
        // ✅ FIX 4: Wait for fonts to load before enabling editors — prevents wrong split points
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
          setTimeout(() => setQuillLoaded(true), 100);
        });
      };
      
      resizeScript.onerror = () => {
        console.error('❌ Failed to load Image Resize module');
        // ✅ FIX 4: Same font-ready wait for error path
        (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
          setTimeout(() => setQuillLoaded(true), 100);
        });
      };
      
      document.body.appendChild(resizeScript);
    };
    
    document.body.appendChild(script);
  };

  loadQuill();
  fetchPages();
  fetchTopicDetails();

  return () => {
    Object.values(quillRefs.current).forEach(quill => {
      if (quill) {
        const container = quill.container;
        if (container && container.parentNode) {
          container.parentNode.innerHTML = '';
        }
      }
    });
  };
}, [topicId]);


  const fetchTopicDetails = async () => {
    try {
      const res = await fetch(`/api/author/topics/details?topic_id=${topicId}`);
      const data = await res.json();
      

      
      if (data.success) {
        setTopicTitle(data.topic?.name || '');
        setBookTitle(data.book?.title || '');
        setBookId(data.topic?.book_id);
      }
    } catch (error) {
      console.error('Error fetching topic details:', error);
    }
  };

  const fetchPages = async () => {
    const res = await fetch(`/api/author/pages?topic_id=${topicId}`);
    const data = await res.json();
    if (data.success) {
      setPages(data.data);
    }
  };

  const splitContentIntoPages = async (htmlContent) => {
    const pages = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${htmlContent}</div>`, 'text/html');
    const blocks = Array.from(doc.body.querySelector('div').children);

    let currentPageHTML = '';
    let currentHeight = 0;

    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
      const block = blocks[blockIdx];
      const tagName = block.tagName.toLowerCase();

      // Handle blocks containing images — measure actual rendered height.
      // Exclude ul/ol: lists are split li-by-li below so images inside <li> are handled there.
      if (block.querySelector('img') && tagName !== 'ul' && tagName !== 'ol') {
        const blockHTML = block.outerHTML;
        // Use getContentHeightAsync so we wait for image layout before reading scrollHeight
        const blockRenderedHeight = await getContentHeightAsync(blockHTML);

        if (currentHeight + blockRenderedHeight > EFFECTIVE_CONTENT_HEIGHT) {
          if (currentPageHTML.trim()) pages.push(currentPageHTML.trim());
          currentPageHTML = blockHTML;
          currentHeight = blockRenderedHeight;
        } else {
          currentPageHTML += blockHTML;
          currentHeight += blockRenderedHeight;
        }
        continue;
      }

      // Handle tables as single unit
      if (tagName === 'table') {
        const tableHTML = block.outerHTML;
        const tableHeight = getContentHeight(tableHTML);

        if (tableHeight > EFFECTIVE_CONTENT_HEIGHT) {
          if (currentPageHTML.trim()) pages.push(currentPageHTML.trim());
          currentPageHTML = '';
          currentHeight = 0;
          pages.push(tableHTML);
        } else if (currentHeight + tableHeight > EFFECTIVE_CONTENT_HEIGHT) {
          if (currentPageHTML.trim()) pages.push(currentPageHTML.trim());
          currentPageHTML = tableHTML;
          currentHeight = tableHeight;
        } else {
          currentPageHTML += tableHTML;
          currentHeight += tableHeight;
        }
        continue;
      }

      // Handle lists (ul/ol) — split li-by-li so we never break inside an <li>
      // getContentHeightAsync is used so images inside <li> are fully laid out before measuring
      if (tagName === 'ul' || tagName === 'ol') {
        let listAttrs = '';
        for (let attr of block.attributes) {
          listAttrs += ` ${attr.name}="${attr.value}"`;
        }

        const items = Array.from(block.querySelectorAll(':scope > li'));
        let listBuffer = '';

        for (let li of items) {
          const liHTML = li.outerHTML;
          const testListHTML = `<${tagName}${listAttrs}>${listBuffer}${liHTML}</${tagName}>`;
          const testHeight = await getContentHeightAsync(currentPageHTML + testListHTML);

          if (testHeight > EFFECTIVE_CONTENT_HEIGHT) {
            if (listBuffer) {
              const listHTML = `<${tagName}${listAttrs}>${listBuffer}</${tagName}>`;
              pages.push((currentPageHTML + listHTML).trim());
              currentPageHTML = '';
              currentHeight = 0;
              listBuffer = liHTML;
            } else {
              if (currentPageHTML.trim()) {
                pages.push(currentPageHTML.trim());
                currentPageHTML = '';
                currentHeight = 0;
              }
              listBuffer = liHTML;
            }
          } else {
            listBuffer += liHTML;
          }
        }

        if (listBuffer) {
          const listHTML = `<${tagName}${listAttrs}>${listBuffer}</${tagName}>`;
          currentPageHTML += listHTML;
          currentHeight = await getContentHeightAsync(currentPageHTML);
        }
        continue;
      }

      let blockAttrs = '';
      for (let attr of block.attributes) {
        blockAttrs += ` ${attr.name}="${attr.value}"`;
      }

      const blockHTML = `<${tagName}${blockAttrs}>${block.innerHTML}</${tagName}>`;
      const testHTML = currentPageHTML + blockHTML;
      const testHeight = getContentHeight(testHTML);

      if (testHeight > EFFECTIVE_CONTENT_HEIGHT) {
        if (currentPageHTML.trim()) {
          pages.push(currentPageHTML.trim());
          currentPageHTML = '';
          currentHeight = 0;
        }

        // Sentence-level splitting (supports . ! ? and Hindi ।)
        const sentences = block.innerHTML.split(/(?<=[.!?।])\s+/);
        let sentenceBuffer = '';

        for (let sentence of sentences) {
          if (!sentence.trim()) continue;

          const testSentence = sentenceBuffer
            ? `${sentenceBuffer} ${sentence}`
            : sentence;

          const testHTML = `<${tagName}${blockAttrs}>${testSentence}</${tagName}>`;
          const sentenceHeight = getContentHeight(currentPageHTML + testHTML);

          if (sentenceHeight > EFFECTIVE_CONTENT_HEIGHT) {
            if (sentenceBuffer) {
              const sentenceHTML = `<${tagName}${blockAttrs}>${sentenceBuffer}</${tagName}>`;
              const pageToSave = (currentPageHTML + sentenceHTML).trim();
              if (pageToSave) pages.push(pageToSave);
              currentPageHTML = '';
              currentHeight = 0;
              sentenceBuffer = sentence;
            } else {
              // Word-level splitting fallback
              const words = sentence.split(/\s+/);
              let wordBuffer = '';

              for (let word of words) {
                const testWord = wordBuffer ? `${wordBuffer} ${word}` : word;
                const testHTML = `<${tagName}${blockAttrs}>${testWord}</${tagName}>`;
                const wordHeight = getContentHeight(currentPageHTML + testHTML);

                if (wordHeight > EFFECTIVE_CONTENT_HEIGHT && wordBuffer) {
                  const wordHTML = `<${tagName}${blockAttrs}>${wordBuffer}</${tagName}>`;
                  pages.push((currentPageHTML + wordHTML).trim());
                  currentPageHTML = '';
                  currentHeight = 0;
                  wordBuffer = word;
                } else {
                  wordBuffer = testWord;
                }
              }

              if (wordBuffer) sentenceBuffer = wordBuffer;
            }
          } else {
            sentenceBuffer = testSentence;
          }
        }

        if (sentenceBuffer) {
          const finalHTML = `<${tagName}${blockAttrs}>${sentenceBuffer}</${tagName}>`;
          currentPageHTML += finalHTML;
          currentHeight = getContentHeight(currentPageHTML);
        }
      } else {
        currentPageHTML = testHTML;
        currentHeight = testHeight;
      }
    }

    if (currentPageHTML.trim() && currentPageHTML !== '<p><br></p>') {
      pages.push(currentPageHTML.trim());
    }

    return pages.length > 0 ? pages : [htmlContent];
  };

  // ── FORWARD REFLOW ───────────────────────────────────────────────────────
  // Pages before `index` are never touched. Content of page `index` + all
  // subsequent pages is merged, re-split, and written back from `index` onward.
  const forwardReflow = async (index, newContent, allPages) => {
    let tailContent = '';
    for (let i = index + 1; i < allPages.length; i++) {
      const c = allPages[i].content || '';
      if (c.trim() && c !== '<p><br></p>') tailContent += c;
    }

    const merged = newContent + tailContent;
    const splitResult = await splitContentIntoPages(merged);

    const newPages = allPages.slice(0, index).map(p => ({ ...p }));
    splitResult.forEach((pageContent, i) => {
      const existingAtPos = allPages[index + i];
      const base = Number.isFinite(allPages[0]?.pageNumber) ? allPages[0].pageNumber : 1;
      newPages.push({
        id: existingAtPos?.id || `page-${Date.now()}-${index}-${i}`,
        content: pageContent,
        existingPageId: existingAtPos?.existingPageId || null,
        pageNumber: existingAtPos?.pageNumber || (base + index + i)
      });
    });

    return { newPages, firstContent: splitResult[0] };
  };
  // ─────────────────────────────────────────────────────────────────────────

  const initQuill = (index) => {
    if (!window.Quill) return;

    const editorId = `editor-${index}`;
    
    if (initializedEditors.current.has(editorId)) {
      return;
    }

    const container = document.getElementById(editorId);
    
    if (!container) return;

    if (quillRefs.current[index]) {
      const parentDiv = container.parentNode;
      if (parentDiv) {
        const existingToolbar = parentDiv.querySelector('.ql-toolbar');
        if (existingToolbar) {
          existingToolbar.remove();
        }
      }
      container.innerHTML = '';
      delete quillRefs.current[index];
    } else {
      const parentDiv = container.parentNode;
      if (parentDiv) {
        const orphanedToolbars = parentDiv.querySelectorAll('.ql-toolbar');
        orphanedToolbars.forEach(toolbar => toolbar.remove());
      }
    }

     const quill = new window.Quill(`#${editorId}`, {
      theme: 'snow',
      modules: {
        toolbar: [
  [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
  [{ 'font': [] }],  // Font family selector
  [{ 'size': ['small', false, 'large', 'huge'] }],  // Font size
  ['bold', 'italic', 'underline', 'strike'],
  [{ 'color': [] }, { 'background': [] }],
  [{ 'script': 'sub'}, { 'script': 'super' }],  // Subscript/Superscript
  [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'list': 'check' }],  // Checklist
  [{ 'indent': '-1'}, { 'indent': '+1' }],  // Indent/outdent
  [{ 'direction': 'rtl' }],  // Text direction
  [{ 'align': [] }],
  ['blockquote', 'code-block'],  // Blockquote and code block
  ['link', 'image'],  // Video embedding
  ['clean']  // Remove formatting
],
 imageResize: {
    modules: ['Resize', 'DisplaySize', 'Toolbar']
  },

        clipboard: {
          matchVisual: true
        }
      },
      placeholder: 'Start typing or paste content...'
    });

    // ✅ FIX: Use livePagesRef so content is always fresh even after re-inits
    if (livePagesRef.current[index]?.content) {
      const content = livePagesRef.current[index].content;

      // Load initial HTML safely across Quill versions (convert signature differs).
      // If conversion fails or returns empty, fall back to direct HTML paste.
      try {
        let delta = null;

        try {
          delta = quill.clipboard.convert(content);
        } catch (error) {
          delta = quill.clipboard.convert({ html: content, text: content });
        }

        if (delta && Array.isArray(delta.ops) && delta.ops.length > 0) {
          quill.setContents(delta, 'silent');
        } else {
          quill.clipboard.dangerouslyPasteHTML(content, 'silent');
        }
      } catch (error) {
        quill.root.innerHTML = content;
      }
    }

    // addMatcher fires once PER ELEMENT during a paste operation.
    // Debouncing ensures only one reflow fires after the full paste lands,
    // preventing race conditions that cause empty/duplicated pages.
    let pasteReflowTimeout = null;
    quill.clipboard.addMatcher(Node.TEXT_NODE, (node, delta) => {
      const Delta = window.Quill.import('delta');
      const normalizedDelta = new Delta();

      delta.ops.forEach((op) => {
        if (typeof op.insert === 'string') {
          normalizedDelta.insert(normalizePastedWhitespace(op.insert), op.attributes);
          return;
        }

        normalizedDelta.insert(op.insert, op.attributes);
      });

      return normalizedDelta;
    });

    quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
      if (pasteReflowTimeout) clearTimeout(pasteReflowTimeout);
      pasteReflowTimeout = setTimeout(async () => {
        pasteReflowTimeout = null;
        const currentContent = quill.root.innerHTML;
        // Wait for all images to load so heights are measured correctly
        await preloadImages(currentContent);
        const contentHeight = getContentHeight(currentContent);

        if (contentHeight > EFFECTIVE_CONTENT_HEIGHT) {
          setSplitting(true);
          const currentPages = livePagesRef.current;
          const { newPages, firstContent } = await forwardReflow(
            index,
            currentContent,
            currentPages
          );

          quill.root.innerHTML = firstContent || '<p><br></p>';
          updatePageContent(index, firstContent || '<p><br></p>');
          updatePageStatus(quill, container);

          // Clear stale editor instances for all pages after index
          for (let i = index + 1; i < currentPages.length; i++) {
            initializedEditors.current.delete(`editor-${i}`);
            const c = document.getElementById(`editor-${i}`);
            if (c?.parentNode) {
              const tb = c.parentNode.querySelector('.ql-toolbar');
              if (tb) tb.remove();
            }
            delete quillRefs.current[i];
          }
          for (let i = currentPages.length; i < newPages.length; i++) {
            initializedEditors.current.delete(`editor-${i}`);
          }
          setLivePages(newPages);

          setTimeout(() => {
            setSplitting(false);
            const toast = document.createElement('div');
            const newPagesCount = newPages.length - index;
            toast.textContent = `✅ Content reflowed across ${newPagesCount} page${newPagesCount > 1 ? 's' : ''} (pages ${index + 1}–${newPages.length})!`;
            toast.style.cssText = `
              position:fixed;bottom:24px;right:24px;z-index:9999;
              background:#166534;color:white;padding:12px 20px;
              border-radius:8px;font-size:14px;font-weight:600;
              box-shadow:0 4px 12px rgba(0,0,0,0.2);transition:opacity 0.4s ease;
            `;
            document.body.appendChild(toast);
            setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
          }, 500);
        }
      }, 250); // debounce: wait until all paste elements are processed

      return delta;
    });

    // text-change — block overflow with undo + warning, 500 ms debounce
    let textChangeTimeout = null;
    quill.on('text-change', (delta, oldDelta, source) => {
      if (textChangeTimeout) clearTimeout(textChangeTimeout);

      textChangeTimeout = setTimeout(() => {
        const content = quill.root.innerHTML;

        // Use quill.root.scrollHeight — true rendered height with all Quill CSS
        // (font-size classes, bold, images, etc.) applied. No subtraction needed.
        if (quill.root.scrollHeight > CONTENT_HEIGHT) {
          // Undo the change that caused overflow
          quill.history.undo();

          // Show red warning toast
          const existing = document.getElementById('page-full-toast');
          if (existing) existing.remove();
          const toast = document.createElement('div');
          toast.id = 'page-full-toast';
          toast.textContent = '⚠️ Page is full! Please add a new page.';
          toast.style.cssText = `
            position:fixed;bottom:24px;right:24px;z-index:9999;
            background:#dc2626;color:white;padding:12px 20px;
            border-radius:8px;font-size:14px;font-weight:600;
            box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:opacity 0.4s ease;
          `;
          document.body.appendChild(toast);
          setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 400); }, 2500);
          return;
        }

        const contentHeight = getContentHeight(content);
        const fillPercentage = Math.min(
          100,
          Math.max(0, Math.round((contentHeight / EFFECTIVE_CONTENT_HEIGHT) * 100))
        );

        updatePageContent(index, content);
        updatePageStatus(quill, container);
      }, 500);
    });

    quillRefs.current[index] = quill;
    initializedEditors.current.add(editorId);

    // Ensure status is correct when editor is initialized with preloaded content
    // (e.g., pages generated after paste reflow where no immediate text-change fires).
    setTimeout(() => {
      updatePageStatus(quill, container);
    }, 0);
  };

  useEffect(() => {
    if (quillLoaded) {
      livePages.forEach((_, index) => {
        const editorId = `editor-${index}`;
        if (!initializedEditors.current.has(editorId)) {
          setTimeout(() => initQuill(index), 100 * index);
        }
      });
    }
  }, [quillLoaded, livePages.length]);

  const updatePageContent = (index, content) => {
    setLivePages(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], content };
      return updated;
    });
  };

  const getPageNumberBase = (pagesList) => {
    const first = pagesList?.[0]?.pageNumber;
    return Number.isFinite(first) ? first : 1;
  };

  const countWords = (html) => {
    if (typeof window === 'undefined') return 0;
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const text = temp.textContent || temp.innerText || '';
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  };

  const updatePageStatus = (quill, container) => {
    if (!quill || !container) return;

    const html = quill.root.innerHTML || '';
    const contentHeight = getContentHeight(html);
    const fillPercentage = Math.min(
      100,
      Math.max(0, Math.round((contentHeight / EFFECTIVE_CONTENT_HEIGHT) * 100))
    );

    const pageHeader = container.closest('.page-editor-container')?.querySelector('.page-header');
    const pageStatus = pageHeader?.querySelector('.page-status');

    if (pageHeader && pageStatus) {
      if (contentHeight > EFFECTIVE_CONTENT_HEIGHT) {
        pageHeader.style.background = '#fee2e2';
        pageStatus.textContent = '⚠️ Exceeds A4 page!';
        pageStatus.className = 'page-status ml-3 text-xs font-semibold text-red-600';
      } else if (fillPercentage >= 95) {
        pageHeader.style.background = '#fef3c7';
        pageStatus.textContent = `${fillPercentage}% filled`;
        pageStatus.className = 'page-status ml-3 text-xs font-semibold text-yellow-700';
      } else {
        pageHeader.style.background = '#f9fafb';
        pageStatus.textContent = `${fillPercentage}% filled`;
        pageStatus.className = 'page-status ml-3 text-xs font-semibold text-gray-600';
      }
    }
  };

  const addNewPage = () => {
    const newIndex = livePages.length;
    setLivePages(prev => {
      const base = getPageNumberBase(prev);
      const newPage = {
        id: `page-${Date.now()}`,
        content: '',
        existingPageId: null,
        pageNumber: base + prev.length
      };
      return [...prev, newPage];
    });
    setTimeout(() => {
      initQuill(newIndex);
      setSelectedPageIndex(newIndex);
    }, 200);
  };

  const insertPageAt = (afterIndex) => {
    const base = getPageNumberBase(livePages);
    const newPage = { id: `page-${Date.now()}`, content: '', existingPageId: null, pageNumber: base + afterIndex + 1 };
    const newPages = [
      ...livePages.slice(0, afterIndex + 1),
      newPage,
      ...livePages.slice(afterIndex + 1)
    ].map((page, index) => ({
      ...page,
      pageNumber: base + index
    }));
    // Clear all editors — stale-closure index in handlers becomes wrong after insertion
    Object.keys(quillRefs.current).forEach(key => {
      const container = document.getElementById(`editor-${key}`);
      if (container?.parentNode) {
        const toolbar = container.parentNode.querySelector('.ql-toolbar');
        if (toolbar) toolbar.remove();
      }
      delete quillRefs.current[key];
    });
    quillRefs.current = {};
    initializedEditors.current.clear();
    setLivePages(newPages);
    setSelectedPageIndex(afterIndex + 1);
  };

  const deletePage = (index) => {
    if (livePages.length === 1) {
      alert('Cannot delete the last page!');
      return;
    }

    const base = getPageNumberBase(livePages);
    const newPages = livePages
      .filter((_, i) => i !== index)
      .map((page, idx) => ({ ...page, pageNumber: base + idx }));

    // ✅ FIX: Clear ALL editors — editors at index > deleted have wrong
    // stale-closure index in their event handlers. Full reinit fixes this.
    Object.keys(quillRefs.current).forEach(key => {
      const container = document.getElementById(`editor-${key}`);
      if (container?.parentNode) {
        const toolbar = container.parentNode.querySelector('.ql-toolbar');
        if (toolbar) toolbar.remove();
      }
      delete quillRefs.current[key];
    });
    quillRefs.current = {};
    initializedEditors.current.clear();

    setLivePages(newPages);

    if (selectedPageIndex >= newPages.length) {
      setSelectedPageIndex(newPages.length - 1);
    }
  };

  const startInsertAtSavedIndex = (insertionIndex) => {
    Object.keys(quillRefs.current).forEach(key => {
      const quill = quillRefs.current[key];
      if (quill && quill.container) {
        const parent = quill.container.parentNode;
        if (parent) {
          parent.innerHTML = '';
        }
      }
    });

    quillRefs.current = {};
    initializedEditors.current.clear();

    setEditingPageId(null);
    setEditingPageNumber(null);
    setInsertAtSavedIndex(insertionIndex);
    setSelectedPageIndex(0);

    const startPageNumber = insertionIndex + 1;
    setLivePages([
      {
        id: `insert-${Date.now()}`,
        content: '',
        existingPageId: null,
        pageNumber: startPageNumber
      }
    ]);

    setTimeout(() => {
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      initQuill(0);
    }, 300);
  };

  const saveAllPages = async () => {
    setLoading(true);

    const updateExistingPage = async (id, content) => {
      const res = await fetch('/api/author/pages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: content || '' })
      });

      return res.json();
    };

    const createNewPage = async (content) => {
      const pageData = {
        topic_id: topicId,
        subtopic_id: null,
        content: content || ''
      };

      const res = await fetch('/api/author/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pageData)
      });

      return res.json();
    };

    const isNonEmptyContent = (content) => {
      return content && content.trim() !== '' && content !== '<p><br></p>';
    };

    if (Number.isFinite(insertAtSavedIndex) && insertAtSavedIndex >= 0) {
      const insertedContents = livePages
        .map(page => page.content)
        .filter(isNonEmptyContent)
        .map(content => content.trim());

      if (insertedContents.length === 0) {
        alert('No content to insert!');
        setLoading(false);
        return;
      }

      let savedCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      try {
        const trailingSavedPages = pages.slice(insertAtSavedIndex);
        const trailingSavedContents = trailingSavedPages.map(page => (page.content || '').trim());
        const mergedTrailingContents = [...insertedContents, ...trailingSavedContents];

        for (let i = 0; i < trailingSavedPages.length; i++) {
          const result = await updateExistingPage(trailingSavedPages[i].id, mergedTrailingContents[i]);
          if (result.success) {
            updatedCount++;
          } else {
            failedCount++;
          }
        }

        for (let i = trailingSavedPages.length; i < mergedTrailingContents.length; i++) {
          const result = await createNewPage(mergedTrailingContents[i]);
          if (result.success) {
            savedCount++;
          } else {
            failedCount++;
          }
        }
      } catch (error) {
        failedCount++;
      }

      if (savedCount > 0 || updatedCount > 0) {
        let message = '✅ Success!\n';
        if (savedCount > 0) message += `Created ${savedCount} new page(s)\n`;
        if (updatedCount > 0) message += `Updated ${updatedCount} page(s)\n`;
        if (failedCount > 0) message += `⚠️ Failed: ${failedCount} page(s)`;

        alert(message);
        await fetchPages();

        Object.values(quillRefs.current).forEach((quill, index) => {
          if (quill) {
            const container = document.getElementById(`editor-${index}`);
            if (container) container.innerHTML = '';
          }
        });

        quillRefs.current = {};
        initializedEditors.current.clear();
        setLivePages([{ id: `page-${Date.now()}`, content: '', existingPageId: null, pageNumber: 1 }]);
        setSelectedPageIndex(0);
        setEditingPageId(null);
        setEditingPageNumber(null);
        setInsertAtSavedIndex(null);

        setTimeout(() => initQuill(0), 300);
      } else {
        alert('❌ Failed to insert pages. Please try again.');
      }

      setLoading(false);
      return;
    }

    if (editingPageId && Number.isFinite(editingPageNumber) && editingPageNumber > 0) {
      const anchorLocalIndex = livePages.findIndex(p => p.existingPageId === editingPageId);
      const anchorIndex = anchorLocalIndex >= 0 ? anchorLocalIndex : 0;
      const anchorPage = livePages[anchorIndex];

      if (!anchorPage || !isNonEmptyContent(anchorPage.content)) {
        alert('Edited page content is empty. Add content before saving.');
        setLoading(false);
        return;
      }

      let savedCount = 0;
      let updatedCount = 0;
      let failedCount = 0;

      try {
        const anchorUpdate = await updateExistingPage(editingPageId, anchorPage.content.trim());
        if (anchorUpdate.success) {
          updatedCount++;
        } else {
          failedCount++;
        }

        const insertedContents = livePages
          .slice(anchorIndex + 1)
          .map(page => page.content)
          .filter(isNonEmptyContent)
          .map(content => content.trim());

        if (insertedContents.length > 0) {
          const anchorSavedIndex = editingPageNumber - 1;
          const trailingSavedPages = pages.slice(anchorSavedIndex + 1);
          const trailingSavedContents = trailingSavedPages.map(page => (page.content || '').trim());
          const mergedTrailingContents = [...insertedContents, ...trailingSavedContents];

          for (let i = 0; i < trailingSavedPages.length; i++) {
            const result = await updateExistingPage(trailingSavedPages[i].id, mergedTrailingContents[i]);
            if (result.success) {
              updatedCount++;
            } else {
              failedCount++;
            }
          }

          for (let i = trailingSavedPages.length; i < mergedTrailingContents.length; i++) {
            const result = await createNewPage(mergedTrailingContents[i]);
            if (result.success) {
              savedCount++;
            } else {
              failedCount++;
            }
          }
        }
      } catch (error) {
        failedCount++;
      }

      if (savedCount > 0 || updatedCount > 0) {
        let message = '✅ Success!\n';
        if (savedCount > 0) message += `Created ${savedCount} new page(s)\n`;
        if (updatedCount > 0) message += `Updated ${updatedCount} page(s)\n`;
        if (failedCount > 0) message += `⚠️ Failed: ${failedCount} page(s)`;

        alert(message);
        await fetchPages();
        setInsertAtSavedIndex(null);
      } else {
        alert('❌ Failed to save pages. Please try again.');
      }

      setLoading(false);
      return;
    }

    const pagesToSave = livePages
      .map(page => ({
        content: page.content,
        existingPageId: page.existingPageId
      }))
      .filter(page => page.content && page.content.trim() !== '' && page.content !== '<p><br></p>');

    if (pagesToSave.length === 0) {
      alert('No content to save!');
      setLoading(false);
      return;
    }

    let savedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;

    for (let page of pagesToSave) {
      try {
        if (page.existingPageId) {
          const data = await updateExistingPage(page.existingPageId, page.content.trim());
          if (data.success) {
            updatedCount++;
          } else {
            failedCount++;
          }
        } else {
          const data = await createNewPage(page.content.trim());
          if (data.success) {
            savedCount++;
          } else {
            failedCount++;
          }
        }
      } catch (error) {
        failedCount++;
      }
    }

    if (savedCount > 0 || updatedCount > 0) {
      let message = '✅ Success!\n';
      if (savedCount > 0) message += `Created ${savedCount} new page(s)\n`;
      if (updatedCount > 0) message += `Updated ${updatedCount} page(s)\n`;
      if (failedCount > 0) message += `⚠️ Failed: ${failedCount} page(s)`;

      alert(message);
      await fetchPages();
      setInsertAtSavedIndex(null);
      // router.push('/author/books');
    } else {
      alert('❌ Failed to save pages. Please try again.');
    }

    setLoading(false);
  };

  const loadExistingPage = (page) => {
    const pageIndex = pages.findIndex(p => p.id === page.id);
    setLivePages([{
      id: `page-${page.id}`,
      content: page.content,
      existingPageId: page.id,
      pageNumber: pageIndex >= 0 ? pageIndex + 1 : 1
    }]);
    setEditingPageId(page.id);
    setEditingPageNumber(pageIndex >= 0 ? pageIndex + 1 : 1);
    setInsertAtSavedIndex(null);
    setSelectedPageIndex(0);
    
    setTimeout(() => {
      initializedEditors.current.clear();
      Object.keys(quillRefs.current).forEach(key => {
        const container = document.getElementById(`editor-${key}`);
        if (container?.parentNode) {
          const toolbar = container.parentNode.querySelector('.ql-toolbar');
          if (toolbar) toolbar.remove();
        }
        delete quillRefs.current[key];
      });
      
      setTimeout(() => {
        initQuill(0);
      }, 100);
    }, 100);
  };

  const handleEditExistingPage = (page, pageIndex) => {
    if (!page || !page.content) {
      alert('Invalid page data');
      return;
    }

    Object.keys(quillRefs.current).forEach(key => {
      const quill = quillRefs.current[key];
      if (quill && quill.container) {
        const parent = quill.container.parentNode;
        if (parent) {
          parent.innerHTML = '';
        }
      }
    });
    quillRefs.current = {};
    initializedEditors.current.clear();

    setEditingPageId(page.id);
    setEditingPageNumber(pageIndex + 1);
    setInsertAtSavedIndex(null);
    setSelectedPageIndex(0);
    
    const newPage = {
      id: `edit-${Date.now()}`,
      content: page.content,
      existingPageId: page.id,
      pageNumber: pageIndex + 1
    };
    
    setLivePages([newPage]);

    // ✅ FIX: Use initQuill(0) instead of duplicate manual Quill creation.
    // initQuill already has clipboard.addMatcher (split on paste), enforceLimit,
    // text-change handler — all the features the manual code was missing.
    setTimeout(() => {
      if (topRef.current) {
        topRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      initQuill(0);
    }, 300);
  };

  const handleDeleteExistingPage = async (id) => {
    if (!confirm('Delete this page permanently?')) return;

    const res = await fetch(`/api/author/pages?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      fetchPages();
      alert('Page deleted successfully!');
    } else {
      alert('Failed to delete page');
    }
  };

  const createNewContent = () => {
    setLivePages([{ id: 'page-1', content: '', existingPageId: null, pageNumber: 1 }]);
    setEditingPageId(null);
    setEditingPageNumber(null);
    setInsertAtSavedIndex(null);
    setSelectedPageIndex(0);
    
    setTimeout(() => {
      initializedEditors.current.clear();
      Object.keys(quillRefs.current).forEach(key => {
        const container = document.getElementById(`editor-${key}`);
        if (container?.parentNode) {
          const toolbar = container.parentNode.querySelector('.ql-toolbar');
          if (toolbar) toolbar.remove();
        }
        delete quillRefs.current[key];
      });
      
      setTimeout(() => {
        initQuill(0);
      }, 100);
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8" ref={topRef}>
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <button onClick={() => router.push('/author/books')} className="text-indigo-600 hover:text-indigo-800">
                Books
              </button>
            </li>
            <li className="text-gray-400">/</li>
            <li>
              <span className="text-gray-600">{bookTitle}</span>
            </li>
            <li className="text-gray-400">/</li>
            <li className="text-gray-900 font-semibold">{topicTitle}</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-8">
          <h1 className="text-xl sm:text-3xl font-bold text-gray-900 mb-1">
            📖 {topicTitle}
          </h1>
          <p className="text-sm text-gray-600">
            Add pages directly to this topic
          </p>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left sidebar removed - editor takes full width */}

          {/* Editor (full width) */}
          <div className="lg:col-span-12">
            <div className="bg-white rounded-xl shadow-lg p-3 sm:p-6 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h2 className="text-base sm:text-xl font-semibold text-gray-900">
                  {editingPageId ? 'Edit Page' : 'Create New Pages'}
                </h2>
                {Number.isFinite(insertAtSavedIndex) && insertAtSavedIndex >= 0 && (
                  <div className="text-xs sm:text-sm font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                    Inserting new page(s) {insertAtSavedIndex === 0 ? 'before Page 1' : insertAtSavedIndex >= pages.length ? 'after last saved page' : `between Page ${insertAtSavedIndex} and Page ${insertAtSavedIndex + 1}`}
                  </div>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={addNewPage}
                    disabled={splitting}
                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition text-sm font-medium"
                  >
                    + Add Page
                  </button>
                  <button
                    onClick={saveAllPages}
                    disabled={loading || splitting}
                    className="flex-1 sm:flex-none px-3 sm:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition text-sm font-medium"
                  >
                    {loading ? 'Saving...' : 'Save All Pages'}
                  </button>
                </div>
              </div>

              {/* Pages Editor */}
              <div className="space-y-0">
                {livePages.map((page, index) => (
                  <React.Fragment key={page.id}>
                    {/* Scale wrapper: collapses height to match visual size, no scrollbar */}
                    <div style={{
                      width: '100%',
                      height: pageScale < 1 ? `${(PAGE_HEIGHT + 40) * pageScale}px` : 'auto',
                      overflow: 'hidden',
                      marginBottom: '12px',
                    }}>
                      <div
                        className="page-editor-container border border-gray-300 rounded-lg overflow-hidden"
                        style={pageScale < 1 ? { transform: `scale(${pageScale})`, transformOrigin: 'top left' } : {}}
                      >
                      <div className="page-header flex items-center justify-between px-4 py-3 bg-gray-50">
                        <div className="flex items-center">
                          <span className="text-sm font-semibold text-gray-900">
                            Page {page.pageNumber !== undefined ? page.pageNumber : index + 1}
                          </span>
                          <span className="page-status ml-3 text-xs font-semibold text-gray-600">
                            0% filled
                          </span>
                        </div>
                        {livePages.length > 1 && (
                          <button
                            onClick={() => deletePage(index)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <div
                        id={`editor-${index}`}
                        className="quill-editor"
                        style={{
                          minHeight: `${CONTENT_HEIGHT}px`,
                          maxHeight: `${CONTENT_HEIGHT}px`,
                          overflow: 'auto'
                        }}
                      />
                      </div>{/* end page-editor-container */}
                    </div>{/* end scale wrapper */}
                    {/* ── Insert page button between pages ── */}
                    <div className="flex items-center justify-center my-1 mb-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <button
                        onClick={() => insertPageAt(index)}
                        title="Insert blank page here"
                        className="mx-3 w-8 h-8 flex items-center justify-center rounded-full bg-white border-2 border-dashed border-gray-300 text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 transition text-lg font-bold leading-none"
                      >
                        +
                      </button>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Saved Pages Section */}
        <div className="mt-8 pb-12">
          <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-4">📚 Saved A4 Pages ({pages.length})</h2>

          {pages.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow-lg text-center text-gray-500 border border-gray-200">
              <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-base font-medium">No saved pages yet</p>
              <p className="text-sm mt-1">Create your first page to get started</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <div className="flex items-center justify-center my-1">
                <div className="flex-1 h-px bg-gray-200" />
                <button
                  onClick={() => startInsertAtSavedIndex(0)}
                  title="Insert before first saved page"
                  className={`mx-3 w-8 h-8 flex items-center justify-center rounded-full border-2 border-dashed transition text-lg font-bold leading-none ${
                    insertAtSavedIndex === 0
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                      : 'bg-white border-gray-300 text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  +
                </button>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              {pages.map((page, index) => (
                <React.Fragment key={page.id}>
                  <div 
                    className={`bg-white rounded-xl shadow border transition-all ${
                      editingPageId === page.id ? 'ring-2 ring-yellow-400 border-yellow-400' : 'border-gray-200'
                    }`}
                  >
                    <div className="p-3 sm:p-5">
                      {/* Single row: badge + words + editing tag + buttons */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full flex-shrink-0">
                          Page {index + 1}
                        </span>
                        <span className="text-xs text-gray-500">
                          {countWords(page.content || '')} words
                        </span>
                        {editingPageId === page.id && (
                          <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded flex-shrink-0">
                            ✏️ Editing
                          </span>
                        )}
                        <div className="flex gap-1.5 ml-auto flex-shrink-0">
                          <button 
                            onClick={() => handleEditExistingPage(page, index)}
                            disabled={editingPageId === page.id}
                            className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-xs font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                          >
                            {editingPageId === page.id ? 'Editing...' : '✏️ Edit'}
                          </button>
                          <button 
                            onClick={() => handleDeleteExistingPage(page.id)}
                            disabled={editingPageId === page.id}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-medium disabled:bg-gray-400 disabled:cursor-not-allowed transition"
                          >
                            🗑️ Delete
                          </button>
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 max-h-48 overflow-y-auto overflow-x-auto text-xs">
                        <div dangerouslySetInnerHTML={{ __html: page.content }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center my-1">
                    <div className="flex-1 h-px bg-gray-200" />
                    <button
                      onClick={() => startInsertAtSavedIndex(index + 1)}
                      title={index === pages.length - 1 ? 'Insert after last saved page' : `Insert between Page ${index + 1} and Page ${index + 2}`}
                      className={`mx-3 w-8 h-8 flex items-center justify-center rounded-full border-2 border-dashed transition text-lg font-bold leading-none ${
                        insertAtSavedIndex === index + 1
                          ? 'bg-emerald-100 border-emerald-500 text-emerald-700'
                          : 'bg-white border-gray-300 text-gray-400 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'
                      }`}
                    >
                      +
                    </button>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

      </div>

      <style jsx global>{`
        .page-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          gap: 20px;
          flex-wrap: wrap;
          padding: 0 12px;
          margin: 20px 0;
        }

        .page-editor-container {
          width: ${PAGE_WIDTH}px;
          flex-shrink: 0;
          height: ${PAGE_HEIGHT + 40}px;
          background: white;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          border-radius: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          transition: box-shadow 0.2s ease;
        }

        /* Ensure default text is black, but don't override inline color styles (so color picker still works) */
        .page-editor-container { color: #000000; }
        .ql-container:not([style*="color"]) { color: #000000; }
        .ql-editor:not([style*="color"]) { color: #000000; }

        /* Remove the old mobile media query — no special overrides needed */

        .page-header {
          height: ${HEADER_HEIGHT}px;
          padding: 12px ${CONTENT_PADDING}px;
          background: #f9fafb;
          border-bottom: 2px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: background 0.3s;
          flex-shrink: 0;
        }

        .ql-toolbar {
          flex-shrink: 0;
          border-bottom: 1px solid #e5e7eb !important;
          border-left: none !important;
          border-right: none !important;
          border-top: none !important;
        }

        .ql-container {
          height: ${CONTENT_HEIGHT}px !important;
          flex: none !important;
          border: none !important;
          overflow: hidden !important;
        }

        .ql-editor {
          padding: ${CONTENT_PADDING}px !important;
          overflow-y: auto !important;
          height: 100% !important;
          box-sizing: border-box !important;
          font-size: 16px;
          line-height: 1.55;
          font-family: 'Times New Roman', Times, serif;
          white-space: pre-wrap;
          tab-size: 4;
          -moz-tab-size: 4;
        }

        .page-footer {
          height: ${FOOTER_HEIGHT}px;
          padding: 12px 0;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          flex-shrink: 0;
        }

        .ql-editor p {
          margin-top: 0;
          margin-bottom: 1em;
        }

        .ql-editor h1,
        .ql-editor h2,
        .ql-editor h3,
        .ql-editor h4,
        .ql-editor h5,
        .ql-editor h6 {
          margin-top: 0.67em;
          margin-bottom: 0.67em;
          font-weight: 700;
          line-height: 1.2;
        }

        .ql-editor h1 {
          font-size: 2em;
        }

        .ql-editor h2 {
          font-size: 1.5em;
        }

        .ql-editor h3 {
          font-size: 1.17em;
        }

        .ql-editor ul, .ql-editor ol {
          margin-top: 0;
          margin-bottom: 1em;
        }

        .ql-editor li,
        .ql-editor blockquote,
        .ql-editor pre {
          line-height: 1.55;
        }

        .ql-editor *[style] {
          line-height: unset;
        }

        .ql-editor pre,
        .ql-editor code {
          font-family: 'Courier New', Courier, monospace;
        }

        /* Saved pages default text color */
        .saved-a4-content { color: #000000; }
        .saved-a4-content *:not([style*="color"]) { color: #000000; }
      `}</style>
    </div>
  );
}
