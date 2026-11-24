// 빈 영역은 마우스 이벤트가 실제 바탕화면으로 통과하고,
// 아이콘 위에서만 인터랙션이 동작하도록 하는 핵심 로직.
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overIcon = !!el?.closest('.icon');
  window.customizer.setIgnoreMouse(!overIcon);
});

// 아이콘 클릭 → 타겟 실행
document.querySelectorAll('.icon').forEach((iconEl) => {
  iconEl.addEventListener('click', () => {
    const target = iconEl.dataset.target;
    const targetType = iconEl.dataset.targetType;
    window.customizer.openTarget(target, targetType);
  });
});
