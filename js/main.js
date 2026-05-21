// Scroll back to top
const scrollButton = document.getElementById('scroll-button');
if (!scrollButton) throw new Error('Scroll button element not found');

let ticking = false;
document.addEventListener(
  'scroll',
  () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        scrollButton.classList.toggle('visible', window.scrollY >= 100);
        ticking = false;
      });
      ticking = true;
    }
  },
  { passive: true },
);

// Matrix - Particles.js;
window.onload = function () {
  Particles.init({
    selector: '.background',
  });
};
const particles = Particles.init({
  selector: '.background',
  color: ['#03dac6', '#ff0266', '#000000'],
  connectParticles: true,
  responsive: [
    {
      breakpoint: 768,
      options: {
        color: ['#faebd7', '#03dac6', '#ff0266'],
        maxParticles: 43,
        // connectParticles: false,
      },
    },
  ],
});
