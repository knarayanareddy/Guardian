// --- Tour Content ---
const tourSteps = [
    {
        title: "Phase 1-2: Data Ingestion",
        desc: "Guardian connects to Solana devnet and captures a cryptographic snapshot of your wallet balances and real-time market pricing.",
        logs: [
            { text: "guardian snapshot --all", prompt: true },
            { text: "Fetching prices: SOL, USDC, BONK... [OK]", prompt: false },
            { text: "Wallet: hLSr...9qq (0.45 SOL)", prompt: false }
        ]
    },
    {
        title: "Phase 4: Risk Analysis",
        desc: "Your data is analyzed by the deterministic Risk Engine. It evaluates triggers like 'LOW_SOL' or 'SUDDEN_PRICE_DROP' based on your configured thresholds.",
        logs: [
            { text: "Evaluating risk engine... [ACTIVE]", prompt: false },
            { text: "Trigger tripped: ⛽ [LOW SOL] 0 lamports", prompt: false },
            { text: "Recommended: refill_sol (priority: low)", prompt: false }
        ]
    },
    {
        title: "Phase 5/12: LLM Planning",
        desc: "The Risk Report is sent to Gemma4 (Local Ollama). The model generates a JSON-based strategy to mitigate risks while adhering to goals.",
        logs: [
            { text: "Calling LLM planner (gemma4:latest)...", prompt: false },
            { text: "Plan generated: none (requires refill)", prompt: false },
            { text: "Confidence: 100%", prompt: false }
        ]
    },
    {
        title: "Phase 6: Policy Guarding",
        desc: "Before execution, every plan must pass through the Policy Controller. HALLUCINATIONS ARE BLOCKED here by deterministic code checks.",
        logs: [
            { text: "Verifying plan against policy... [SHIELD]", prompt: false },
            { text: "Policy check: ALLOWED (0.45 SOL remaining)", prompt: false },
            { text: "Simulation audit: devnet_dry_run [OK]", prompt: false }
        ]
    },
    {
        title: "Phase 13: Observability",
        desc: "Every step is instrumented via OpenTelemetry. Successes, failures, and latency are exported to the SigNoz dashboard for audit.",
        logs: [
            { text: "Exporting OTel span: guardian.run [OK]", prompt: false },
            { text: "Metrics pushed to http://localhost:4318", prompt: false },
            { text: "Outcome: NO_ACTION_PLAN (run-2026-04-17)", prompt: false }
        ]
    }
];

let currentStep = 0;
let isTourActive = false;

const terminal = document.getElementById('terminal');

async function typeLine(line) {
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
        await new Promise(r => setTimeout(r, 15 + Math.random() * 20));
    }
}

async function runStepLogs(logs) {
    terminal.innerHTML = ""; // Clear for the step
    for (const log of logs) {
        await typeLine(log);
        await new Promise(r => setTimeout(r, 400));
    }
}

function updateTourUI() {
    const step = tourSteps[currentStep];
    document.getElementById('tour-title').textContent = step.title;
    document.getElementById('tour-desc').textContent = step.desc;
    document.getElementById('tour-step-indicator').textContent = `Phase ${currentStep + 1} of 5`;
    document.getElementById('prev-tour').disabled = currentStep === 0;
    
    const nextBtn = document.getElementById('next-tour');
    if (currentStep === tourSteps.length - 1) {
        nextBtn.textContent = "Finish Tour";
    } else {
        nextBtn.textContent = "Next Phase";
    }

    runStepLogs(step.logs);
}

// --- Background Loop ---
const backgroundLogs = [
    { text: "guardian daemon --status", prompt: true },
    { text: "All systems green. Monitoring devnet...", prompt: false },
    { text: "Check: 0x8a2f... [OK]", prompt: false },
];

async function startBackgroundLoop() {
    while (!isTourActive) {
        for (const line of backgroundLogs) {
            if (isTourActive) break;
            await typeLine(line);
            await new Promise(r => setTimeout(r, 2000));
        }
        if (!isTourActive) terminal.innerHTML = "";
    }
}

// --- Controls ---
document.getElementById('start-tour').addEventListener('click', () => {
    isTourActive = true;
    currentStep = 0;
    document.getElementById('tour-ui').classList.remove('hidden');
    document.getElementById('start-tour').style.display = 'none';
    updateTourUI();
});

document.getElementById('close-tour').addEventListener('click', () => {
    isTourActive = false;
    document.getElementById('tour-ui').classList.add('hidden');
    document.getElementById('start-tour').style.display = 'inline-block';
    terminal.innerHTML = "";
    startBackgroundLoop();
});

document.getElementById('next-tour').addEventListener('click', () => {
    if (currentStep < tourSteps.length - 1) {
        currentStep++;
        updateTourUI();
    } else {
        isTourActive = false;
        document.getElementById('tour-ui').classList.add('hidden');
        document.getElementById('start-tour').style.display = 'inline-block';
        terminal.innerHTML = "";
        startBackgroundLoop();
    }
});

document.getElementById('prev-tour').addEventListener('click', () => {
    if (currentStep > 0) {
        currentStep--;
        updateTourUI();
    }
});

// Interacting with mouse for background glow flair
document.addEventListener('mousemove', (e) => {
    const glow = document.querySelector('.hero-bg-glow');
    if (glow) {
        glow.style.left = `${50 + (e.clientX - window.innerWidth / 2) / 100}%`;
        glow.style.top = `${50 + (e.clientY - window.innerHeight / 2) / 100}%`;
    }
});

window.onload = () => {
    if (typeof mermaid !== 'undefined') {
        mermaid.initialize({ startOnLoad: true, theme: 'dark' });
    }
    startBackgroundLoop();
};
