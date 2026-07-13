(function() {
  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeUrl(value) {
    var url = String(value || '').trim();
    if (url.startsWith('/')) return url;
    try {
      var parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
    } catch (e) {
      return '';
    }
  }

  function renderInline(value) {
    var text = escapeHtml(value);
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, source) {
      var url = safeUrl(source);
      if (!url) return '';
      return '<img src="' + escapeHtml(url) + '" alt="' + alt + '" loading="lazy" style="max-width:100%;height:auto;border-radius:12px;margin:1rem 0;" />';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function(_, label, source) {
      var url = safeUrl(source);
      if (!url) return label;
      return '<a href="' + escapeHtml(url) + '" rel="noopener noreferrer">' + label + '</a>';
    });
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
    return text;
  }

  function renderMarkdown(markdown) {
    var lines = String(markdown || '').replace(/\r\n?/g, '\n').split('\n');
    var output = [];
    var paragraph = [];
    var listType = '';
    var inCode = false;
    var codeLines = [];

    function flushParagraph() {
      if (!paragraph.length) return;
      output.push('<p>' + paragraph.map(renderInline).join('<br />') + '</p>');
      paragraph = [];
    }

    function closeList() {
      if (!listType) return;
      output.push('</' + listType + '>');
      listType = '';
    }

    for (var index = 0; index < lines.length; index += 1) {
      var line = lines[index];
      if (/^```/.test(line)) {
        flushParagraph();
        closeList();
        if (inCode) {
          output.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
          codeLines = [];
          inCode = false;
        } else {
          inCode = true;
        }
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        continue;
      }
      if (!line.trim()) {
        flushParagraph();
        closeList();
        continue;
      }

      var heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        closeList();
        var level = heading[1].length;
        output.push('<h' + level + '>' + renderInline(heading[2]) + '</h' + level + '>');
        continue;
      }

      var quote = line.match(/^>\s?(.*)$/);
      if (quote) {
        flushParagraph();
        closeList();
        output.push('<blockquote>' + renderInline(quote[1]) + '</blockquote>');
        continue;
      }

      var unordered = line.match(/^[-*+]\s+(.+)$/);
      var ordered = line.match(/^\d+\.\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        var nextType = unordered ? 'ul' : 'ol';
        if (listType !== nextType) {
          closeList();
          listType = nextType;
          output.push('<' + listType + '>');
        }
        output.push('<li>' + renderInline((unordered || ordered)[1]) + '</li>');
        continue;
      }

      if (/^---+$/.test(line.trim())) {
        flushParagraph();
        closeList();
        output.push('<hr />');
        continue;
      }

      paragraph.push(line);
    }

    if (inCode) output.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
    flushParagraph();
    closeList();
    return output.join('\n');
  }

  function clearLegacyAccessKeys() {
    sessionStorage.removeItem('sk_');
    localStorage.removeItem('sk_');
  }

  function fetchJson(url, options) {
    var requestOptions = Object.assign({ credentials: 'same-origin' }, options || {});
    return fetch(url, requestOptions).then(function(response) {
      return response.json().catch(function() { return {}; }).then(function(data) {
        if (!response.ok) {
          var error = new Error(data.error || 'Request failed');
          error.status = response.status;
          throw error;
        }
        return data;
      });
    });
  }

  clearLegacyAccessKeys();
  window.SecretSpace = {
    escapeHtml: escapeHtml,
    safeUrl: safeUrl,
    renderMarkdown: renderMarkdown,
    fetchJson: fetchJson
  };
})();
