---
title: "Keyless Attention: Value-Space Routing and Value-Only Caching"
paper: "Keyless Attention: Value-Space Routing and Value-Only Caching for Efficient Transformers"
paper_authors: "Xin Gao"
venue: "arXiv 2026"
date: 2026-09-27
tags: [KV cache, Efficient attention, Architecture]
summary: "Delete the key projection, route attention through the values, and cache values only: an exact 50% KV-cache cut that matches standard attention on 4 of 5 models."
paper_url: "https://arxiv.org/abs/2606.21848"
---
{% raw %}
## Summary

To follow this paper you need one quick refresher on how attention works. Inside a transformer, every token is turned into three separate vectors. These are the **query** (Q), the **key** (K), and the **value** (V). The idea is a bit like a search engine. The query is what a token is "looking for". The keys are like labels on all the other tokens. The values are the actual content those tokens carry. The model compares a query against every key to decide how much to focus on each token. It then pulls in a weighted blend of the values based on that focus. So keys handle *routing* (who to look at) and values handle *retrieval* (what to grab).

Now the problem. When a model generates text one word at a time, it does not want to redo all this work for every past token at every step. So it saves the keys and values of past tokens in memory. This store is called the **KV cache**. The cache is convenient, but it is greedy. It grows longer with every token generated. For long inputs, the KV cache can end up taking more memory than the model's own weights. It has become the main bottleneck for running large models on long text.

A lot of prior work tries to shrink this cache after the fact. Some methods compress it. Some throw away less useful tokens. Some share keys and values across attention heads. This paper asks a more radical question. What if we do not need the keys at all?

That is the whole idea of **Keyless Attention**. It deletes the key projection completely. There is no key vector and no key cache. Instead of comparing the query against a separate key, it compares the query directly against the *value*. The value now does double duty. It is used both to decide where to look and to supply the content. Since there are no keys to store, the cache holds values only. The authors call this a **Value-Only Cache**. It cuts the cache memory in half, exactly 50%, with no approximation and no compression tricks.

There is a neat human analogy behind this. When you recall something from memory, you do not keep two separate copies of every past thought, one copy for finding it and another for reading it. You search your memories directly. Standard attention keeps two copies of each past token, a key copy and a value copy. That looks wasteful, and this paper argues it is.

The surprising part is that removing keys does not make the model worse. Across five models the keyless version matches or beats the standard version on perplexity in 4 out of 5, and it does so while using half the cache.

## Contributions

- Introduces **Keyless Attention** with a **Value-Only Cache**. It computes attention scores straight between queries and values. The key projection is removed. This cuts KV cache memory and access cost by exactly 50%, with no approximation, no quantization, and no pruning.
- Introduces **value-space routing** and **Depth-m Attention Factorization**. Standard attention is a depth-2 version of a more general family. Keyless Attention is a depth-m version. The paper studies the m=3 case, which uses the same number of weight matrices as standard attention.
- Proves a **theoretical equivalence**. Under mild conditions, a keyless layer can produce the exact same attention scores as a standard layer. So the keys are mathematically redundant. Their job can be absorbed into the query projection.
- Provides **broad empirical validation**. It tests five models and four architectures (GPT-2 280M, GPT-2 557M, Pythia 410M, Qwen2 1.5B, Llama 3.2 1B). Keyless Attention matches or beats standard attention on perplexity in 4 of 5 models and on 4 of 5 downstream tasks.

## Method

Standard scaled dot-product attention looks like this:

$$\operatorname{Attn}(X) = \operatorname{softmax}\left(\frac{QK^{\top}}{\sqrt{d_k}}\right)V$$

Here Q, K, and V come from multiplying the input X by three learned matrices, one for each. The softmax turns raw similarity scores into focus weights that add up to 1.

The starting insight is to look at what the keys actually do. The attention score depends on the product $$W^Q(W^K)^\top$$. The authors call this combined matrix $$\Omega$$ (omega). $$\Omega$$ is really the thing that decides routing. The key matrix on its own has no fixed meaning. It only needs to produce vectors that pair up usefully with queries. So the natural question is this. Can we get the same $$\Omega$$ without a dedicated key matrix, by routing through the value space instead? That gives Keyless Attention:

$$\operatorname{Attention}(Q, V) = \operatorname{softmax}\left(\frac{QV^{\top}}{\sqrt{d_k}}\right)V$$

Notice the same V appears twice. It sets the scores and it supplies the output.

**Depth-m factorization.** This is the paper's general framing. You can build $$\Omega$$ out of different numbers of matrices. The number of matrices in the chain is the "depth" m.

- QVV(2) uses two matrices, one for the query and one for the value. It has one fewer matrix than standard attention.
- QVV(3) splits the query into two matrices, so $$W^Q = W^{Q_1}W^{Q_2}$$. Now it has the same number of matrices and parameters as standard attention. The second query matrix, $$W^{Q_2}$$, is called the **value-routing projection**. Its job is to reshape the query so it lines up with the value space. This is the main version the paper recommends.
- QVV(m) generalizes the idea to any depth.

A nice practical detail. At inference time the query matrices can be multiplied together into one matrix ahead of time. So a deeper factorization costs nothing extra when the model runs. The keys are gone, so there is less to compute and less to store.

**Value-space routing.** This is the conceptual heart. In standard attention, routing happens in a separate key space that has no direct link to the content. In Keyless Attention, routing happens in the value space itself. The score between two tokens now uses the very same value vector that will later be pulled into the output. This forces a specific bias into the model. It learns to attend to tokens whose actual *content* is relevant, not tokens that merely match in some side channel. The authors argue this is a more meaningful routing signal.

**Gradient entanglement.** This is the paper's explanation for why keyless models overfit less. In standard attention, the key matrix and the value matrix are trained independently. Their gradients do not touch each other. The key matrix is free to specialize quickly to patterns in the training set. That is fast, but it can hurt generalization. In Keyless Attention, the routing matrix $$W^{Q_2}$$ and the value matrix $$W^V$$ are tied together through training. Updating one changes the target for the other. The authors call this **gradient entanglement**. Their claim is that this coupling acts like a built-in regularizer. It stops the routing part from over-memorizing the training data. This lines up with the reduced overfitting they see in experiments.

**Value-Only Cache during generation.** During word-by-word generation, the model only stores value vectors from past steps. When a new token arrives, its query is compared against all stored values, and the output is a weighted blend of those values. No keys are ever built or saved. The authors also show the method plugs into existing cache-saving tricks like Multi-Query and Grouped-Query Attention, so the savings stack on top of each other.

## Results

- **Language modeling (GPT-2).** At 12 layers, keyless QVV(3) is nearly identical to standard attention (perplexity 33.84 vs 33.71). At 36 layers, keyless actually wins on every metric (perplexity 33.26 vs 33.50). It also overfits much less as the model gets deeper. So the method scales more gracefully with depth.
- **Downstream tasks (GPT-2 557M).** On five zero-shot commonsense benchmarks, keyless matches or beats standard on 4 of 5. It gains notably on HellaSwag and StoryCloze. It is comparable on BoolQ and ARC-Challenge. It loses a couple of points on SciQ, hinting at a small trade-off on factual recall. All of this comes with 50% less cache.
- **Depth ablation.** Comparing QVV(2), QVV(3), QVV(4), and the standard variants, QVV(3) hits the best balance. QVV(2) is slightly worse. QVV(4) is about the same as QVV(3) but needs an extra matrix, so it is not worth it. Adding a ReLU in the middle (QVV(4ReLU)) hurts, which supports the idea that the *linear* factorization is what provides the helpful regularization. More depth helps a little, with shrinking returns.
- **Cross-architecture.** The five models span three position-encoding schemes, two residual designs, and two head-grouping strategies. Keyless wins on perplexity in 4 of 5, with the largest gain on Pythia 410M (perplexity 39.22 vs 40.99). The 50% cache cut holds exactly in every case. A consistent pattern shows up too. After the best epoch, keyless models degrade more slowly than standard ones, meaning they resist overfitting better.
- **Inference speed.** Because the two query matrices fuse into one, keyless adds no extra projection cost. It matches or slightly exceeds standard decode throughput at every context length tested. It stores only values, so it uses half the cache memory (for example 0.118 GB vs 0.236 GB at 8192 tokens). The authors note the real speed payoff should grow at larger batch sizes, where memory bandwidth, not compute, becomes the limit.

## Two-Cents

This is a satisfying paper because it questions something almost everyone took for granted. Q, K, and V have felt sacred since the original transformer. Showing that K is mathematically redundant, and then confirming it holds up across five real architectures, is a clean and confident result. The value-space routing idea is elegant. Tying "where to look" and "what to grab" into one shared space is intuitive, and the gradient entanglement story gives a plausible reason for the reduced overfitting. The depth-m framing is also a nice bonus. It reframes attention design as having a tunable knob (factorization depth) that nobody was really touching.

The honest limitations are worth stating clearly. All experiments run on WikiText-103 with a fairly small token budget, and the models are on the smaller side. The paper's headline benefit is long-context inference, yet there is no evaluation on genuinely long-context or industrial workloads. That is exactly where the cache bottleneck bites hardest, so the missing test is the important one. The overfitting-reduction claim is also partly explained by the small dataset. Deeper models overfit more on limited data, so a built-in regularizer will naturally shine there. It is not obvious the same edge would hold at large scale with abundant data. The gradient entanglement explanation is a reasonable hypothesis, but the authors themselves leave a proper mechanistic analysis to future work.

Promising directions are clear. The most valuable next step is a real long-context and large-scale evaluation, since that is the whole selling point. The latent Value-Only Cache variant, which adds a low-rank bottleneck, looks like a natural way to push memory savings past 50% when combined with the keyless design. And treating factorization depth m as a first-class hyperparameter could be interesting well beyond this paper. Overall, a small idea with a big claim, well supported at small scale, and waiting for the large-scale test that would make it convincing.

## Resources

- [Research Paper](https://arxiv.org/abs/2606.21848)
- [HTML version](https://arxiv.org/html/2606.21848v1)
- Related: [Slim Attention](https://arxiv.org/abs/2503.05840) (another route to cutting KV cache by 50%)
{% endraw %}
