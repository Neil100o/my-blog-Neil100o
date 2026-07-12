(function() {
  var path = location.pathname;
  if (!path.startsWith('/whispers')) return;
  try {
    fetch('/api/log-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: path })
    });
  } catch (e) {}
})();
