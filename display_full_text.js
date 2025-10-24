document.querySelectorAll('*').forEach(el => {
  el.style.textOverflow = 'clip';
  el.style.overflow = 'visible';
  el.style.whiteSpace = 'normal';
});
