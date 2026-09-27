---
title: "LLM-Pruner: On the Structural Pruning of Large Language Models"
paper: "LLM-Pruner: On the Structural Pruning of Large Language Models"
paper_authors: "Xinyin Ma, Gongfan Fang, Xinchao Wang"
venue: "NeurIPS 2023"
date: 2025-06-03
tags: [Pruning, Compression, LoRA]
summary: "A task-agnostic structural pruner that finds coupled structures, scores them with gradient information, and recovers quality with LoRA: about 3 hours and 50K samples."
paper_url: "https://arxiv.org/abs/2305.11627"
source_url: "https://github.com/vlgiitr/papers_we_read/blob/master/summaries/LLM_pruner.md"
source_name: "VLG papers_we_read"
cover: "/assets/blogs/Discovery_stage.png"
---
{% raw %}
## Summary

This paper introduces a method named **LLM-Pruner**, which aims to ensure LLMs retain their multi-task solving and language generation abilities even after compression. This is done by removing coupled structures (based on connections between neurons) using gradient information; the pruned LLM is then trained on a limited dataset to help recover its original abilities.

## Contributions

- Introduces a dependency-aware pruning strategy that automatically groups and prunes coupled structures to preserve functionality.
- Proposes a two-level importance estimation method (vector- and element-wise) using first- and second-order gradients.
- Implements a three-stage pruning pipeline: **Discovery** (dependency detection), **Estimation** (group scoring), and **Recovery** (LoRA-based fine-tuning).
- Achieves fast and low-cost pruning: ~3 hours using only 50K public samples.
- Does not require manual architecture-specific design or labeled data.

## Method

### 1. Discovery stage

This step identifies groups of interdependent structures within the LLM. It ensures coupled structures are pruned in unison, as partial pruning leads to an increase in parameter size and misaligned representations.

<figure class="fig" style="--w: 480px">
  <img src="/assets/blogs/Discovery_stage.png" alt="Dependency discovery across coupled structures in an LLM" loading="lazy">
</figure>

Considering any neuron within the LLM as the initial trigger, it can activate neurons that depend on it. These newly triggered neurons then serve as the next triggers, identifying their own dependents. This iterative process continues until no new neurons are detected.

### 2. Estimation stage

Here we estimate the importance of each group. To assign such a score, the model is given access to a limited external dataset. All groups are then ranked by importance and pruned according to a pre-defined pruning ratio. Group importance can be computed in two ways.

**Vector-wise importance.**

$$L(W_i) = \Delta \mathcal{L}(\mathcal{D}) = \mathcal{L}_{W_i}(\mathcal{D}) - \mathcal{L}_{W_i = 0}(\mathcal{D}) = \frac{\partial \mathcal{L}^{\top}(\mathcal{D})}{\partial W_i} W_i - \frac{1}{2} W_i^{\top} H W_i + \mathcal{O}(\lVert W_i \rVert^3)$$

A group is represented as $$\mathcal{G} = \{W_i\}_{i=1}^{M}$$, where $$M$$ is the number of coupled structures in one group and $$W_i$$ is the weight for each structure. $$H$$ is the Hessian matrix and $$\mathcal{L}$$ is the next-token prediction loss.

The first term is typically neglected because the model has converged on the training dataset, where $$\frac{\partial \mathcal{L}^{\top}}{\partial W_i} \approx 0$$. However, since $$\mathcal{D}$$ (the limited external dataset) is not drawn from the original training data, $$\frac{\partial \mathcal{L}^{\top}}{\partial W_i} \not\approx 0$$. This is a desirable property for determining importance, since computing the second term is impractical due to its complexity.

**Element-wise importance.** For an even finer ranking we can compute the importance of each element of $$W_i$$ instead of the approximation above:

$$L(W_i^k) = \mathcal{L}_{W_i^k}(\mathcal{D}) - \mathcal{L}_{W_i^k = 0}(\mathcal{D}) \approx \frac{\partial \mathcal{L}(\mathcal{D})}{\partial W_i^k} W_i^k - \frac{1}{2} \sum_{j=1}^{N} \left( \frac{\partial \mathcal{L}(\mathcal{D}_j)}{\partial W_i^k} W_i^k \right)^2 + \mathcal{O}(\lVert W_i^k \rVert^3)$$

Group importance can then be aggregated with any of four operations:

1. Summation
2. Production (product of all elements)
3. Max
4. Last only (the importance of the last executing structure in the group)

### 3. Recovery stage

Since we are working with limited data while trying to recover the model's original performance, it is necessary to minimize the number of learnable parameters. LoRA is used in post-training for this, and its formulation ensures no extra parameters are introduced at inference.

## Results

<figure class="fig" style="--w: 400px">
  <img src="/assets/blogs/Pruner_1.png" alt="Zero-shot results for LLM-Pruner on LLaMA-7B" loading="lazy">
</figure>

- Tested on LLaMA-7B, Vicuna-7B, and ChatGLM-6B.
- Benchmarks: 7 zero-shot classification datasets plus WikiText2/PTB for language modeling.
- 20% pruning retains ~95% of zero-shot performance after LoRA tuning.
- Yields ~20% memory and ~15% latency reduction.
- Outperforms baseline methods: random, L2 norm, and channel-only pruning.
- Best results come from second-order importance plus block pruning (MLP and attention heads).
- Dependency grouping is crucial; without it, performance degrades significantly.
- Pruning beyond 50% leads to notable performance loss.
- Pruned models may show occasional repetitive or incoherent outputs.

<figure class="fig" style="--w: 400px">
  <img src="/assets/blogs/Pruner_2.png" alt="Example generations from pruned models" loading="lazy">
</figure>

## Two-Cents

LLM-Pruner presents an efficient, task-agnostic pruning method for large language models that preserves performance with minimal data and compute, making it highly practical. There is still scope for improvement, such as low-rank Hessian approximations and adaptive pruning across layers, since uniform pruning can over-compress critical layers.

## Resources

- [Research Paper](https://arxiv.org/abs/2305.11627)
- [Seminar](https://www.youtube.com/watch?v=S7og1mTFImw)
- [Codebase](https://github.com/horseee/LLM-Pruner)
{% endraw %}
