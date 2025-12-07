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

### The Sync (`JavaScript`)
The extension uses an allowlist approach to monitor your queue. Whether you use the original **Manual Node** or the new **Preset Node**, the script intercepts the prompt execution and injects the KSampler's `seed` and `batch_size` directly into the node. This ensures your noise pattern always matches your generation seed.
