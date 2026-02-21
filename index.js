// Mobile menu toggle (optional - for future implementation)
const mobileMenuBtn = document.getElementById('mobileMenuBtn');

if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener('click', () => {
    // Mobile menu functionality can be added here
    console.log('Mobile menu clicked');
  });
}

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});