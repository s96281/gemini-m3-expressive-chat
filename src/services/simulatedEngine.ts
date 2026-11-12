import {
  AIEngine,
  ConnectionTestResult,
  StreamCallbacks,
  StreamRequest,
  StreamResult,
} from './aiEngine';

function getPacingDelay(speed: 'fast' | 'natural' | 'relaxed' = 'natural'): number {
  switch (speed) {
    case 'fast':
      // 10-18ms
      return Math.floor(Math.random() * 9) + 10;
    case 'relaxed':
      // 55-85ms
      return Math.floor(Math.random() * 31) + 55;
    case 'natural':
    default:
      // 24-42ms
      return Math.floor(Math.random() * 19) + 24;
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onAbort = () => {
      if (timer) clearTimeout(timer);
      resolve();
    };
    timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function shouldTriggerReasoning(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    p.includes('think') ||
    p.includes('reason') ||
    p.includes('math') ||
    p.includes('puzzle') ||
    p.includes('logic') ||
    p.includes('algorithm') ||
    p.includes('complexity') ||
    p.includes('analyze') ||
    p.includes('proof') ||
    p.includes('solve')
  );
}

function getReasoningTrace(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('math') || p.includes('puzzle') || p.includes('logic')) {
    return `• Parsing problem statement and extracting given boundary constraints.\n• Formulating logical propositions and identifying invariant truth conditions.\n• Testing potential edge-case scenarios and eliminating contradictions.\n• Deriving canonical closed-form mathematical solution with step-by-step verification.`;
  }
  if (p.includes('complexity') || p.includes('algorithm')) {
    return `• Evaluating asymptotic resource scaling: Worst-case, Average-case, and Best-case bounds.\n• Analyzing call-stack recursion depth and auxiliary heap allocations: O(1) space invariant.\n• Comparing branch prediction characteristics and cache locality trade-offs.\n• Formulating rigorous Big-O complexity formalization: O(n log n) time and O(n) space.`;
  }
  return `• Deconstructing prompt semantics and contextual constraints.\n• Retrieving relevant foundational domain knowledge and principles.\n• Structuring multi-perspective evaluation and logical synthesis.\n• Verifying clarity, conciseness, and precision before response composition.`;
}

function generateResponseText(prompt: string, personaName = 'Assistant'): string {
  const p = prompt.toLowerCase();

  if (p.includes('space exploration')) {
    return `The hum of ion thrusters was the only companion in the quiet expanse between Jupiter and Saturn. Humanity’s outward journey had ceased being a dream of equations and had become a matter of endurance.\n\nFrom the observation cupola of the *Astraea*, the icy fractures of Europa shone like spun silver against the black velvet of the void. We had learned that survival required not just shields and fuel, but reverence for the silence of deep space. Every probe sent forward and every star cataloged brought us closer to understanding our origins among the stellar nurseries.`;
  }

  if (p.includes('relativity')) {
    return `Albert Einstein’s theory of relativity fundamentally reshaped our understanding of spacetime, gravitation, and cosmic velocity.\n\n### 1. Special Relativity (1905)\nSpecial relativity is founded on two core postulates:\n- The laws of physics are invariant across all inertial reference frames.\n- The speed of light in vacuum (\`c = 299,792,458 m/s\`) is constant regardless of source or observer motion.\n\nKey consequences include **time dilation** ($\Delta t' = \gamma \Delta t$) and **mass-energy equivalence** ($E = mc^2$).\n\n### 2. General Relativity (1915)\nGravity is not a Newtonian pulling force across distance, but rather the geometric curvature of 4-dimensional spacetime caused by mass and energy:\n$$G_{\mu\\nu} + \Lambda g_{\mu\\nu} = \\frac{8\\pi G}{c^4} T_{\mu\\nu}$$\n\nMass tells spacetime how to curve, and spacetime tells mass how to move.`;
  }

  if (p.includes('ancient rome')) {
    return `Ancient Rome began as an agrarian settlement on the banks of the Tiber River around the 8th century BCE and grew into one of the most formidable empires of antiquity.\n\nAt the height of the *Pax Romana*, the Roman Empire spanned three continents—from the Scottish Highlands to the sands of Mesopotamia. Its enduring legacy lives on in civil jurisprudence, architectural marvels such as the Colosseum and Pantheon, arched aqueducts, and the Romance languages that descended from vulgar Latin.`;
  }

  if (p.includes('fibonacci')) {
    return `Here is an optimal Python implementation of the Fibonacci sequence using constant space dynamic programming:\n\n\`\`\`python\ndef fibonacci(n: int) -> int:\n    if n <= 0:\n        return 0\n    elif n == 1:\n        return 1\n    a, b = 0, 1\n    for _ in range(2, n + 1):\n        a, b = b, a + b\n    return b\n\n# Example usage:\nprint([fibonacci(i) for i in range(10)])\n# Output: [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]\n\`\`\`\n\n### Complexity:\n- **Time Complexity**: $\mathcal{O}(n)$\n- **Auxiliary Space**: $\mathcal{O}(1)$`;
  }

  if (p.includes('closure')) {
    return `In JavaScript, a **closure** is created whenever a function retains access to its lexical scope, even when that function is executed outside that scope.\n\n\`\`\`javascript\nfunction createCounter(initialValue = 0) {\n  let count = initialValue;\n  return {\n    increment: () => ++count,\n    decrement: () => --count,\n    getValue: () => count,\n  };\n}\n\nconst counter = createCounter(10);\nconsole.log(counter.increment()); // 11\nconsole.log(counter.getValue());  // 11\n\`\`\`\n\nClosures are widely used for data encapsulation, function factories, and memoization.`;
  }

  if (p.includes('joke')) {
    return `Why do programmers prefer dark mode?\n\nBecause light attracts bugs!`;
  }

  if (p.includes('podcast')) {
    return `Here are creative and memorable titles for your podcast:\n\n1. **The Signal & The Echo**: Deep dives into ideas shaping our collective future.\n2. **Beyond the Blueprint**: Candid conversations on design, code, and architecture.\n3. **Curious Minds Unbound**: Exploration of breakthroughs at the intersection of science and humanity.\n4. **The Daily Synthesis**: Digestible insights on technology and creative crafts.`;
  }

  if (p.includes('poem')) {
    return `In the quiet fold of twilight’s glow,\nWhere silent whispers softly flow,\nThe stars awaken, spark by spark,\nTo paint constellations on the dark.\n\nTime pauses in the gentle night,\nA tapestry of silver light,\nAnd every heartbeat finds its peace,\nAs restless thoughts and shadows cease.`;
  }

  if (p.includes('dissertation') || p.includes('guide') || p.includes('comprehensive') || p.includes('artificial intelligence')) {
    return `### Comprehensive Architectural Overview\n\nArtificial intelligence systems operate across multi-tiered abstractions encompassing statistical pattern recognition, deep neural representations, and symbolic reasoning.\n\n#### 1. Foundational Architecture\nModern autoregressive transformer architectures utilize multi-head self-attention mechanisms to map contextual representations across long sequence horizons. Key advantages include:\n- Scalable matrix parallelization on accelerator clusters\n- Cross-entropy convergence on massive token corpora\n- Emergent in-context learning capabilities\n\n#### 2. Scalability and Reliability\nBuilding resilient AI applications demands deterministic state machines, reliable streaming protocols with graceful backpressure handling, and strict schema validation.\n\n#### 3. Continuous Verification\nVerification harnesses, automated integration suites, and empirical benchmarks ensure reproducible output fidelity and robust system health across deployments.`;
  }

  if (p.includes('3 lines') || p.includes('three lines')) {
    return `First line of concise reflection.\nSecond line detailing system progress.\nThird line confirming completion.`;
  }

  if (p.includes('hi') || p.includes('hello')) {
    return `Hello! How can I assist you with your projects, design systems, or technical inquiries today?`;
  }

  return `As your **${personaName}**, here is my analysis:\n\nRegarding: "${prompt}"\n\n1. **Core Insight**: Sustainable architectures prioritize clear boundaries, deterministic contracts, and responsive user feedback.\n2. **Implementation Strategy**: Build modular, self-contained components with rigorous type safety and responsive micro-interactions.\n3. **Recommendation**: Validate with automated test coverage and maintain continuous verification across all operational modes.`;
}

export class SimulatedEngine implements AIEngine {
  async streamChat(
    request: StreamRequest,
    callbacks: StreamCallbacks
  ): Promise<StreamResult> {
    const { prompt, personaName, simulatedSpeed = 'natural', thinkingPreset = 'auto', signal } = request;
    const speed = simulatedSpeed;
    const isReasoning =
      thinkingPreset === 'off'
        ? false
        : thinkingPreset === 'high' || shouldTriggerReasoning(prompt);

    let accumulatedReasoning = '';
    let accumulatedContent = '';
    const startTime = Date.now();
    let thinkingDuration = 0;

    // Phase 1: Reasoning generation if applicable
    if (isReasoning && !signal?.aborted) {
      const reasoningTrace = getReasoningTrace(prompt);
      const reasoningChunks = reasoningTrace.split(' ');

      for (let i = 0; i < reasoningChunks.length; i++) {
        if (signal?.aborted) break;

        const chunk = (i === 0 ? '' : ' ') + reasoningChunks[i];
        accumulatedReasoning += chunk;
        thinkingDuration = Date.now() - startTime;

        callbacks.onReasoning?.(chunk, accumulatedReasoning);
        callbacks.onThinkingDuration?.(thinkingDuration);

        // Pacing delay for reasoning tokens
        const d = getPacingDelay(speed);
        await delay(d, signal);
      }
      thinkingDuration = Date.now() - startTime;
      callbacks.onThinkingDuration?.(thinkingDuration);
    }

    // Phase 2: Main response token streaming
    if (!signal?.aborted) {
      const fullText = generateResponseText(prompt, personaName);
      // Split into word tokens preserving spacing
      const words = fullText.split(' ');

      for (let i = 0; i < words.length; i++) {
        if (signal?.aborted) break;

        const token = (i === 0 ? '' : ' ') + words[i];
        accumulatedContent += token;

        callbacks.onToken?.(token, accumulatedContent);

        const d = getPacingDelay(speed);
        await delay(d, signal);
      }
    }

    const finalResult: StreamResult = {
      content: accumulatedContent,
      reasoningContent: isReasoning ? accumulatedReasoning : undefined,
      thinkingDuration: isReasoning ? thinkingDuration : undefined,
    };

    callbacks.onComplete?.(finalResult);
    return finalResult;
  }

  async testConnection(): Promise<ConnectionTestResult> {
    await delay(12);
    return {
      success: true,
      message: 'Simulated engine active (Latency: 12ms)',
      latencyMs: 12,
    };
  }
}

export const simulatedEngine = new SimulatedEngine();
