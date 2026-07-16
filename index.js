// Theme Toggle Functionality
const themeToggleBtn = document.getElementById('themeToggle');
const mobileThemeToggleBtn = document.getElementById('mobileThemeToggle');

function updateThemeIcons(isDark) {
  const sunIcons = document.querySelectorAll('.sun-icon');
  const moonIcons = document.querySelectorAll('.moon-icon');
  sunIcons.forEach(icon => icon.style.display = isDark ? 'none' : 'block');
  moonIcons.forEach(icon => icon.style.display = isDark ? 'block' : 'none');
}

function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcons(isDark);
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', toggleTheme);
}
if (mobileThemeToggleBtn) {
  mobileThemeToggleBtn.addEventListener('click', toggleTheme);
}

// Initialize theme icons state
const currentTheme = localStorage.getItem('theme');
const initialIsDark = currentTheme === 'dark' || (!currentTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
updateThemeIcons(initialIsDark);

// Mobile menu toggle
const mobileMenuBtn = document.getElementById('mobileMenuBtn');
const mobileNav = document.getElementById('mobileNav');

if (mobileMenuBtn && mobileNav) {
  mobileMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    mobileNav.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (mobileNav.classList.contains('open')) {
      const isClickInsideBtn = mobileMenuBtn.contains(e.target);
      const isClickInsideNav = mobileNav.contains(e.target);
      
      if (!isClickInsideBtn) {
        if (!isClickInsideNav || e.target.tagName === 'A' || e.target.closest('a')) {
          mobileNav.classList.remove('open');
        }
      }
    }
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