/**
 * ELOS Theme Init - تهيئة فورية للثيم
 * يجب تضمينه في head قبل أي CSS لمنع الوميض
 * v1.0
 */
(function() {
  // جلب الثيم من URL أو localStorage
  var params = new URLSearchParams(window.location.search);
  var theme = params.get('theme') ||
              localStorage.getItem('elos-theme') ||
              localStorage.getItem('elos_theme') ||
              'dark';

  // تطبيق فوري على html
  var html = document.documentElement;
  if (theme === 'light') {
    html.classList.add('light-theme', 'light-mode');
    html.setAttribute('data-theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
  }
})();
