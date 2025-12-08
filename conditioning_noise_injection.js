import { app } from "../../scripts/app.js";

// List of node class types to target for Seed Sync
const TARGET_NODES = [
    "ConditioningNoiseInjection", 
    "ConditioningNoiseInjectionPresets",
    "ConditioningNoiseInjectionDynamic"
];

// 1. WORKFLOW SYNC LOGIC
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

// 2. GRAPH MATH HELPER
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
    const points = []; 

    let current_time = 0.0;

    for (let i = 0; i < num_segments; i++) {
        const start = current_time;
        const end = current_time + chunk_size;
        
        const progress = (num_segments > 1) ? (i / (num_segments - 1)) : 0.0;
        const segment_strength = peak_strength * (1.0 - (progress * 0.9));
        const final_strength = segment_strength * strength_scale;

        points.push({ x: start, y: final_strength });
        points.push({ x: end, y: final_strength });
        current_time = end;
    }
    points.push({ x: current_time, y: 0 });
    points.push({ x: 1.0, y: 0 });

    return { points, maxY: 25.0 };
}

// 3. MAIN EXTENSION REGISTRATION
app.registerExtension({
    name: "ConditioningNoiseInjection.SyncAndGraph",
    
    // Logic A: Seed Syncing
    async setup() {
        const originalApiQueuePrompt = api.queuePrompt;
        api.queuePrompt = async function (number, { output, workflow }) {
            const params = findWorkflowParams(app);
            
            for (const nodeId in output) {
                const nodeData = output[nodeId];
                if (TARGET_NODES.includes(nodeData.class_type)) {
                    nodeData.inputs.seed_from_js = params.seed;
                    nodeData.inputs.batch_size_from_js = params.batchSize;
                }
            }
            return originalApiQueuePrompt.call(this, number, { output, workflow });
        };
    },

    // Logic B: Graph Visualization
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        
        if (nodeData.name === "ConditioningNoiseInjectionDynamic") {
            
            const onDrawForeground = nodeType.prototype.onDrawForeground;
            nodeType.prototype.onDrawForeground = function(ctx) {
                if (onDrawForeground) onDrawForeground.apply(this, arguments);

                const w_graph = this.widgets.find(w => w.name === "show_graph");
                if (!w_graph || !w_graph.value) {
                    if (this.size[1] > 200 && this.flags.collapsed !== true) {
                       // Optional shrink logic
                    }
                    return;
                }
				ctx.save();
                // Force Height
                const graphHeight = 120;
                const minNodeHeight = 320; 
                if (this.size[1] < minNodeHeight && this.flags.collapsed !== true) {
                    this.setSize([this.size[0], minNodeHeight]);
                }

                // Get Params
                const w_steps = this.widgets.find(w => w.name === "steps");
                const w_segs = this.widgets.find(w => w.name === "num_segments");
                const w_chaos = this.widgets.find(w => w.name === "chaos_factor");
                const w_scale = this.widgets.find(w => w.name === "strength_scale");

                if (!w_steps || !w_segs || !w_chaos || !w_scale) return;

                const data = calculateGraphData(w_steps.value, w_segs.value, w_chaos.value, w_scale.value);

                // Define Area
                const margin = 10;
                const areaX = margin;
                const areaY = this.size[1] - graphHeight - margin;
                const areaW = this.size[0] - (margin * 2);
                const areaH = graphHeight;

                // 1. Draw Background
                ctx.fillStyle = "#111";
                ctx.fillRect(areaX, areaY, areaW, areaH);
                ctx.strokeStyle = "#333";
                ctx.strokeRect(areaX, areaY, areaW, areaH);

                // 2. Draw Safe Zone
                const safeTime = 0.37;
                const safeStrength = 16.45;
                const maxY = data.maxY; // 25.0

                const safeW = areaW * safeTime;
                
                // Height is inverted on canvas. 
                // Calculate pixel height of the safe zone relative to max graph height
                const safeH = (safeStrength / maxY) * areaH;
                const safeY = (areaY + areaH) - safeH;

                ctx.fillStyle = "rgba(0, 255, 100, 0.05)"; 
                ctx.fillRect(areaX, safeY, safeW, safeH);

                // Draw Safe Zone Border
                ctx.strokeStyle = "rgba(0, 255, 100, 0.4)";
                ctx.setLineDash([4, 4]); 
                ctx.strokeRect(areaX, safeY, safeW, safeH);
                ctx.setLineDash([]); // Reset dash

                // Label Safe Zone
                ctx.fillStyle = "rgba(0, 255, 100, 0.8)";
                ctx.font = "9px Arial";
                ctx.textAlign = "left";
                ctx.textBaseline = "bottom";
                ctx.fillText("SAFE ZONE", areaX + 4, safeY - 2);

                // 3. Draw Grid (Steps)
                ctx.beginPath();
                ctx.strokeStyle = "#2a2a2a";
                ctx.lineWidth = 1;
                ctx.setLineDash([2, 4]); // Dashed grid
                const stepCount = w_steps.value;
                for(let i=1; i<stepCount; i++) {
                    const x = areaX + (areaW * (i / stepCount));
                    ctx.moveTo(x, areaY);
                    ctx.lineTo(x, areaY + areaH);
                }
                ctx.stroke();
                ctx.setLineDash([]); // Reset

                // 4. Draw Curve
                ctx.beginPath();
                ctx.strokeStyle = "#5577ff";
                ctx.lineWidth = 2;
                
                for(let i=0; i<data.points.length; i++) {
                    const p = data.points[i];
                    const px = areaX + (p.x * areaW);
                    const py = (areaY + areaH) - ((p.y / data.maxY) * areaH);
                    
                    if(i===0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.stroke();
                
                // 5. Axes Labels
                ctx.fillStyle = "rgba(200, 200, 200, 0.6)";
                ctx.font = "9px Arial";
                
                // Y-Axis Top (Max Strength)
                ctx.textAlign = "left";
                ctx.textBaseline = "top";
                ctx.fillText(`${data.maxY.toFixed(1)}`, areaX + 4, areaY + 4);

                // Y-Axis Bottom
                ctx.textBaseline = "bottom";
                ctx.fillText("0.0", areaX + 4, areaY + areaH - 4);

                // X-Axis End
                ctx.textAlign = "right";
                ctx.fillText("1.0", areaX + areaW - 4, areaY + areaH - 4);

                // Center Axis Label
                ctx.textAlign = "center";
                ctx.fillStyle = "rgba(200, 200, 200, 0.3)";
                ctx.fillText("PROGRESS (STEPS) \u2192", areaX + (areaW / 2), areaY + areaH - 4);
				ctx.restore();
            }
        }
    }
});