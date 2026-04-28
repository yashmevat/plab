/**
 * Layout for the embedded book reader.
 *
 * The ONLY job of the inline <script> here is to capture postMessages that
 * arrive BEFORE React hydrates (e.g. parent site sends postMessage on the
 * iframe's 'load' event, which fires before React's useEffect runs).
 *
 * Those early messages are stored in window.__earlyAuthMessages[].
 * The page's useEffect drains this array immediately after it registers its
 * own listener, so no message is ever lost.
 */
export default function EmbedBookLayout({ children }) {
  return (
    <>
      {/* Early-capture script — runs as soon as the HTML is parsed, before any JS bundle */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
(function() {
  window.__earlyAuthMessages = [];
  window.addEventListener('message', function(e) {
    var d = e.data;
    if (d && typeof d === 'object' && (d.username || d.email)) {
      // Store the event so the React handler can replay it once registered
      window.__earlyAuthMessages.push({ data: d, origin: e.origin, source: e.source });
      console.log('[EarlyCapture] postMessage buffered:', d.username || d.email);
    }
  });
})();
          `.trim(),
        }}
      />
      {children}
    </>
  );
}
