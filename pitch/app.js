const container = document.getElementById('slides-container');
const dots = document.querySelectorAll('.dot');
const slides = document.querySelectorAll('.slide');

// --- Navigation ---

function scrollToSlide(index) {
    container.scrollTo({
        top: index * window.innerHeight,
        behavior: 'smooth'
    });
}

// --- Active State & Animations ---

const observerOptions = {
    threshold: 0.5
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            // Update active state on original slide
            slides.forEach(s => s.removeAttribute('data-active'));
            entry.target.setAttribute('data-active', 'true');

            // Update dots
            const index = Array.from(slides).indexOf(entry.target);
            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === index);
            });
        }
    });
}, observerOptions);

slides.forEach(slide => observer.observe(slide));

// --- Keyboard Navigation ---

window.addEventListener('keydown', (e) => {
    const currentIndex = Array.from(slides).findIndex(s => s.getAttribute('data-active') === 'true');
    
    if (e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') {
        if (currentIndex < slides.length - 1) scrollToSlide(currentIndex + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        if (currentIndex > 0) scrollToSlide(currentIndex - 1);
    }
});

// --- Mouse Glow Flair (matching landing page) ---
document.addEventListener('mousemove', (e) => {
    const glows = document.querySelectorAll('.glow');
    glows.forEach(glow => {
        const speed = 50;
        const x = (window.innerWidth - e.pageX * speed) / 100;
        const y = (window.innerHeight - e.pageY * speed) / 100;
        glow.style.transform = `translate(${x}px, ${y}px)`;
    });
});
