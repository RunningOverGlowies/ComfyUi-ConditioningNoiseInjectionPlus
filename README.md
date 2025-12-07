# ComfyUi-ConditioningNoiseInjectionPresets

**Advanced Conditioning Noise Injection for ComfyUI.**

<img width="719" height="657" alt="node" src="https://github.com/user-attachments/assets/b207b65a-02f2-49b5-af94-f7c33c18a2eb" />


I was having great success with chaining multiple [ConditioningNoiseInjection](https://github.com/BigStationW/ComfyUi-ConditioningNoiseInjection) nodes for seed variance so I quickly vibed these nodes to simulate complex chaining of noise injection. 

This extension provides tools to inject controlled random noise into your Positive or Negative conditioning. This creates variations in texture, composition, and seed variance without changing your core prompt. 

Originally, achieving these gradients required chaining multiple nodes together manually. This suite introduces **Virtual Chaining**—simulating complex stacks of nodes instantly with high performance and zero graph clutter.

---

## 1. The Presets Node
**`ConditioningNoiseInjectionPresets`**

Best for users who want curated, "tried-and-true" effects without tweaking math.

*   **Curated Recipes:** Includes specific noise schedules tuned for **9-step** (Turbo/Lightning) and **12-step** workflows.
*   **Vibe-Based Selection:** Presets range from "Subtle Polish" (texture enhancement) to "Nuclear Chaos" (major compositional hallucinations).
*   **Flattened Timeline:** The node analyzes the recipe and slices the generation timeline into distinct segments, calculating the perfect summed strength for every micro-step of the generation.

---

## 2. The Dynamic Node
**`ConditioningNoiseInjectionDynamic`**

Best for users who want total control. This node procedurally generates a custom decay curve based on your inputs.

### The "Chaos Factor"
Instead of setting manual thresholds, you use the **Chaos Factor** slider. This controls two variables simultaneously to maintain mathematical coherence:
1.  **Peak Strength:** How "loud" the initial noise blast is.
2.  **Duration:** How deep into the generation timeline the noise persists.

| Chaos Factor | Effect | Internal Math (Approx) |
| :--- | :--- | :--- |
| **0.0 - 0.2** | **Subtle Polish** | Peak ~3.0 | Lasts ~15% of steps |
| **0.4 - 0.6** | **Balanced Shift** | Peak ~11.0 | Lasts ~35% of steps |
| **0.8 - 1.0** | **Nuclear Chaos** | Peak ~20.0 | Lasts ~60% of steps |

### Parameters
*   **Steps:** Input your intended step count (e.g., 12). The node uses this to align the curve grid to actual sampling steps.
*   **Num Segments:** How many "simulated nodes" to chain.
    *   *Low (2):* Creates a sharp, high-contrast "Step Down" effect.
    *   *High (5+):* Creates a smooth, natural gradient decay.
*   **Strength Scale:** A global multiplier. Set to `0.0` to bypass the node.
