const terminalLines = [
    { text: "guardian status --all", prompt: true },
    { text: "Analyzing portfolio risk... [DONE]", prompt: false },
    { text: "Risk Level: NONE (Portfolio healthy)", prompt: false },
    { text: "guardian run --dry-run", prompt: true },
    { text: "Taking wallet snapshot... [OK]", prompt: false },
    { text: "Evaluating Policy: (max_swap_20_sol) ... [PASSED]", prompt: false },
    { text: "Executing Simulation... [SUCCESS]", prompt: false },
    { text: "Receipt Build: 0x4f8e...33ea", prompt: false },
    { text: "Ready for autonomous daemon mode.", prompt: false },
];

const terminal = document.getElementById('terminal');

async function typeTerminal() {
    for (const line of terminalLines) {
        const div = document.createElement('div');
        div.className = 'line';
        
        if (line.prompt) {
            const span = document.createElement('span');
            span.className = 'prompt';
            span.textContent = '$ ';
            div.appendChild(span);
        }

        terminal.appendChild(div);
        
        for (let i = 0; i < line.text.length; i++) {
            div.innerHTML += line.text[i];
            terminal.scrollTop = terminal.scrollHeight;
            await new Promise(r => setTimeout(r, 20 + Math.random() * 30));
        }
        
        await new Promise(r => setTimeout(r, 800));
    }
}

// Interacting with mouse for background glow flair
document.addEventListener('mousemove', (e) => {
    const glow = document.querySelector('.hero-bg-glow');
    if (glow) {
        const x = e.clientX;
        const y = e.clientY;
        // Subtle parallax effect on the glow
        glow.style.left = `${50 + (x - window.innerWidth / 2) / 100}%`;
        glow.style.top = `${50 + (y - window.innerHeight / 2) / 100}%`;
    }
});

window.onload = () => {
    typeTerminal();
};
