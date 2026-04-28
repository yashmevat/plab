'use client';
import { useEffect, useRef } from 'react';

export default function CKEditorComponent({ value, onChange, onReady }) {
  const editorRef = useRef(null);
  const isLoadedRef = useRef(false);

  useEffect(() => {
    if (isLoadedRef.current) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.ckeditor.com/4.22.1/full/ckeditor.js'; // Changed to FULL
    script.async = true;
    
    script.onload = () => {
      if (window.CKEDITOR && editorRef.current) {
        if (window.CKEDITOR.instances['editor']) {
          window.CKEDITOR.instances['editor'].destroy(true);
        }

        const editor = window.CKEDITOR.replace('editor', {
          height: 400,
          toolbar: [
            { name: 'document', items: ['Source', '-', 'Preview'] },
            { name: 'clipboard', items: ['Cut', 'Copy', 'Paste', 'PasteText', 'PasteFromWord', '-', 'Undo', 'Redo'] },
            { name: 'editing', items: ['Find', 'Replace', '-', 'SelectAll'] },
            '/',
            { name: 'basicstyles', items: ['Bold', 'Italic', 'Underline', 'Strike', 'Subscript', 'Superscript', '-', 'RemoveFormat'] },
            { name: 'paragraph', items: ['NumberedList', 'BulletedList', '-', 'Outdent', 'Indent', '-', 'Blockquote', '-', 'JustifyLeft', 'JustifyCenter', 'JustifyRight', 'JustifyBlock'] },
            { name: 'links', items: ['Link', 'Unlink'] },
            { name: 'insert', items: ['Image', 'Table', 'HorizontalRule', 'SpecialChar', 'PageBreak'] },
            '/',
            { name: 'styles', items: ['Styles', 'Format', 'Font', 'FontSize'] },
            { name: 'colors', items: ['TextColor', 'BGColor'] },
            { name: 'tools', items: ['Maximize'] }
          ],
          extraPlugins: 'pagebreak',
          removePlugins: 'elementspath',
          resize_enabled: false
        });

        editor.setData(value || '');

        editor.on('change', function() {
          if (onChange) {
            onChange(editor.getData());
          }
        });

        if (onReady) {
          onReady(editor);
        }

        isLoadedRef.current = true;
        console.log('✅ CKEditor loaded successfully with PageBreak plugin');
      }
    };

    script.onerror = () => {
      console.error('❌ Failed to load CKEditor');
    };

    document.body.appendChild(script);

    return () => {
      if (window.CKEDITOR && window.CKEDITOR.instances['editor']) {
        window.CKEDITOR.instances['editor'].destroy(true);
      }
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  useEffect(() => {
    if (window.CKEDITOR && window.CKEDITOR.instances['editor'] && isLoadedRef.current) {
      const currentData = window.CKEDITOR.instances['editor'].getData();
      if (currentData !== value) {
        window.CKEDITOR.instances['editor'].setData(value || '');
      }
    }
  }, [value]);

  return (
    <textarea
      ref={editorRef}
      id="editor"
      name="content"
      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
      defaultValue={value}
    />
  );
}
