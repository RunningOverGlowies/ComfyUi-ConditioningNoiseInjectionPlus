# ComfyUi-ConditioningNoiseInjectionPresets

<img width="475" height="622" alt="node" src="https://github.com/user-attachments/assets/c8dc25a8-0dfe-4812-b81d-44695970a090" />

I was having great success with chaining multiple [ConditioningNoiseInjection](https://github.com/BigStationW/ComfyUi-ConditioningNoiseInjection) nodes for seed variance so I quickly vibed this **Presets Node** to simulate complex chaining of noise injection. 

This node allows you to apply advanced noise schedules—like gradients, steep decays, or specific texture injections—without the clutter of physically chaining multiple nodes together.

## Features

*   **Curated Presets:** Includes recipes specifically tuned for **9-step** (Turbo/Lightning) and **12-step** workflows, ranging from "Subtle Polish" to "Nuclear Chaos."
*   **Virtual Chaining:** Simulates the mathematical effect of stacking up to 4 noise layers instantly.
*   **Strength Slider:** A global multiplier to easily dial the selected preset's intensity up or down.
*   **Auto-Sync:** The included JavaScript extension automatically detects the **Seed** and **Batch Size** from your active KSampler. No manual wiring required.

## How It Works

### The Logic (`ConditioningNoiseInjectionPresets`)
Instead of processing noise sequentially (Node A $\to$ Node B $\to$ Node C), this node **flattens the timeline**.

1.  **Time Slicing:** It analyzes the selected recipe and slices the generation timeline (0.0 to 1.0) into distinct non-overlapping segments.
2.  **Strength Summation:** It calculates the total active noise strength for each segment instantly.
3.  **Result:** You get a perfectly calculated noise schedule that changes per-step with the performance cost of a single node.

---

# New: Dynamic Node (`ConditioningNoiseInjectionDynamic`)

This procedurally generates a custom noise decay curve based on your specific requirements, eliminating the need to search for the perfect preset.

### Key Logic: "Polish vs. Chaos"

Instead of manually setting thresholds, you define the behavior using a **Chaos Factor**. This single slider controls two variables simultaneously to maintain mathematical coherence:

1.  **Peak Strength (Vertical):** How loud is the initial noise blast?
2.  **Duration (Horizontal):** How deep into the generation timeline does the noise persist?

| Chaos Factor | Effect | Math Internals (Approx) |
| :--- | :--- | :--- |
| **0.0 - 0.2** | **Subtle Polish** | Peak ~3.0 | Lasts ~15% of steps |
| **0.4 - 0.6** | **Balanced Shift** | Peak ~11.0 | Lasts ~35% of steps |
| **0.8 - 1.0** | **Nuclear Chaos** | Peak ~20.0 | Lasts ~60% of steps |

### Parameters

*   **Steps:** Input your KSampler step count (e.g., `9` or `12`). This ensures the generated curve aligns perfectly with actual sampling steps.
*   **Num Segments:** How many "simulated nodes" to chain.
    *   *Low (2):* Creates a sharp "Step Down" effect.
    *   *High (5+):* Creates a smooth gradient decay.
*   **Chaos Factor:** The master control for intensity (see table above).
*   **Strength Scale:** A final multiplier. Set to `0.0` to bypass the node completely.
