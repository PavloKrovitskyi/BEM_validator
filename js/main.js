// Scroll back to top
const scrollButton = document.getElementById('scroll-button');
if (!scrollButton) throw new Error('Scroll button element not found');

let ticking = false;
document.addEventListener('scroll', () => {
  if (!ticking) {
    requestAnimationFrame(() => {
      scrollButton.classList.toggle('visible', window.scrollY >= 100);
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });