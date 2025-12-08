import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// List of node class types to target
const TARGET_NODES = [
    "ConditioningNoiseInjection", 
    "ConditioningNoiseInjectionPresets",
	"ConditioningNoiseInjectionDynamic",
];

function findWorkflowParams(app) {
    const graph = app.graph;
    let foundSeed = 0;
    let foundBatchSize = 1;
    let foundSampler = false;

    function getBatchSizeFromNode(node) {
        if (node.widgets) {
            const batchWidget = node.widgets.find(w => w.name === "batch_size");
            if (batchWidget) return batchWidget.value;
        }
        return 1;
    }

    function getSourceNodeByInput(targetNode, inputName) {
        const input = targetNode.inputs?.find(i => i.name === inputName);
        if (input && input.link) {
            const link = graph.links[input.link];
            if (link) return graph._nodes_by_id[link.origin_id];
        }
        return null;
    }

    // Scan for Sampler
    for (const node of graph._nodes) {
        const nodeType = node.type || node.constructor.type;
        
        // Custom Advanced Sampler
        if (nodeType === "SamplerCustomAdvanced") {
            foundSampler = true;
            const noiseNode = getSourceNodeByInput(node, "noise");
            if (noiseNode) {
                const seedWidget = noiseNode.widgets?.find(w => w.name === "seed" || w.name === "noise_seed");
                if (seedWidget) foundSeed = seedWidget.value;
            }
            const latentNode = getSourceNodeByInput(node, "latent_image");
            if (latentNode) foundBatchSize = getBatchSizeFromNode(latentNode);
            break;
        }

        // Standard KSampler
        if (nodeType === "KSampler" || nodeType === "KSamplerAdvanced") {
            const hasModel = node.inputs?.find(i => i.name === "model" && i.link);
            if (hasModel) {
                foundSampler = true;
                const seedWidget = node.widgets?.find(w => w.name === "seed" || w.name === "noise_seed");
                if (seedWidget) foundSeed = seedWidget.value;
                const latentNode = getSourceNodeByInput(node, "latent_image");
                if (latentNode) foundBatchSize = getBatchSizeFromNode(latentNode);
                break;
            }
        }
    }
    return { seed: foundSeed, batchSize: foundBatchSize };
}

app.registerExtension({
    name: "ConditioningNoiseInjection.Sync",
    async setup() {
        const originalApiQueuePrompt = api.queuePrompt;

        api.queuePrompt = async function (number, { output, workflow }) {
            const params = findWorkflowParams(app);
            
            for (const nodeId in output) {
                const nodeData = output[nodeId];
                // Check if this node is one of our target types
                if (TARGET_NODES.includes(nodeData.class_type)) {
                    nodeData.inputs.seed_from_js = params.seed;
                    nodeData.inputs.batch_size_from_js = params.batchSize;
                }
            }
            return originalApiQueuePrompt.call(this, number, { output, workflow });
        };
    }
});

// Helper: The Maths (Must match Python exactly)
function calculateGraphData(steps, num_segments, chaos_factor, strength_scale) {
    const step_len = 1.0 / Math.max(1, steps);
    const min_duration = step_len * 1.5;
    const max_duration = 0.60;
    
    let target_duration = min_duration + (max_duration - min_duration) * chaos_factor;
    target_duration = Math.min(target_duration, 1.0);

    const min_peak = 2.0;
    const max_peak = 20.0;
    const peak_strength = min_peak + (max_peak - min_peak) * chaos_factor;

    const chunk_size = target_duration / num_segments;
    const points = []; // Array of {x, y}

    let current_time = 0.0;

    for (let i = 0; i < num_segments; i++) {
        const start = current_time;
        const end = current_time + chunk_size;
        
        const progress = (num_segments > 1) ? (i / (num_segments - 1)) : 0.0;
        const segment_strength = peak_strength * (1.0 - (progress * 0.9));
        const final_strength = segment_strength * strength_scale;

        // Add start and end points for this segment to draw lines
        points.push({ x: start, y: final_strength });
        points.push({ x: end, y: final_strength });

        current_time = end;
    }
    // Tail
    points.push({ x: current_time, y: 0 });
    points.push({ x: 1.0, y: 0 });

    return { points, maxY: 25.0 }; // Fixed Y scale for consistency
}

app.registerExtension({
    name: "ConditioningNoiseInjection.GraphVis",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "ConditioningNoiseInjectionDynamic") {
            
            // 1. Hook into onDrawForeground to paint the graph
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                if (onDrawForeground) onDrawForeground.apply(this, arguments);

                // Find widget values
                const w_graph = this.widgets.find(w => w.name === "show_graph");
                if (!w_graph || !w_graph.value) {
                    // If graph is off, try to shrink node back to normal size
                    if (this.size[1] > 200) this.setSize([this.size[0], 200]);
                    return;
                }

                // If graph is ON, force minimum height
                const graphHeight = 120;
                const minNodeHeight = 320; 
                if (this.size[1] < minNodeHeight) {
                    this.setSize([this.size[0], minNodeHeight]);
                }

                // Get Params
                const w_steps = this.widgets.find(w => w.name === "steps");
                const w_segs = this.widgets.find(w => w.name === "num_segments");
                const w_chaos = this.widgets.find(w => w.name === "chaos_factor");
                const w_scale = this.widgets.find(w => w.name === "strength_scale");

                if (!w_steps || !w_segs || !w_chaos || !w_scale) return;

                // Calc Data
                const data = calculateGraphData(w_steps.value, w_segs.value, w_chaos.value, w_scale.value);

                // Setup Drawing Area (Bottom of node)
                const margin = 10;
                const areaX = margin;
                const areaY = this.size[1] - graphHeight - margin;
                const areaW = this.size[0] - (margin * 2);
                const areaH = graphHeight;

                // Draw Background
                ctx.fillStyle = "#111";
                ctx.fillRect(areaX, areaY, areaW, areaH);
                ctx.strokeStyle = "#333";
                ctx.strokeRect(areaX, areaY, areaW, areaH);

                // Draw Step Grid
                ctx.beginPath();
                ctx.strokeStyle = "#2a2a2a";
                ctx.lineWidth = 1;
                const stepCount = w_steps.value;
                for(let i=1; i<stepCount; i++) {
                    const x = areaX + (areaW * (i / stepCount));
                    ctx.moveTo(x, areaY);
                    ctx.lineTo(x, areaY + areaH);
                }
                ctx.stroke();

                // Draw Curve
                ctx.beginPath();
                ctx.strokeStyle = "#5577ff";
                ctx.lineWidth = 2;
                
                // Map Data to Pixels
                // X: 0.0 -> 1.0 maps to areaX -> areaX + areaW
                // Y: 0.0 -> 25.0 maps to areaY + areaH -> areaY
                
                for(let i=0; i<data.points.length; i++) {
                    const p = data.points[i];
                    const px = areaX + (p.x * areaW);
                    const py = (areaY + areaH) - ((p.y / data.maxY) * areaH);
                    
                    if(i===0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                
                // Close path for fill (optional aesthetic)
                ctx.stroke();
                
                // Draw Peak Value Text
                ctx.fillStyle = "#666";
                ctx.font = "10px Arial";
                ctx.fillText("Max Strength: 25.0", areaX + 5, areaY + 12);
                ctx.fillText("0.0", areaX + 5, areaY + areaH - 5);
            }
        }
    }
});
