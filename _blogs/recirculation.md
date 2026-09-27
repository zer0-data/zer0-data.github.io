---
title: "Recirculation"
paper: "Recirculation"
paper_authors: "Michael C. Mozer, Shoaib Ahmed Siddiqui, Danny Sawyer, Sunny Sanyal, Rosanne Liu"
venue: "arXiv 2026"
date: 2026-09-28
tags: [Inference-time methods, Recurrence, State tracking]
summary: "A training-free tweak that leaks a sliver of a deep-layer activation back into a shallow layer at every step, turning a feedforward transformer into something closer to a recurrent state tracker."
paper_url: "https://arxiv.org/abs/2608.17981"
---
{% raw %}
## Summary

Transformers have a quiet design problem. They are feedforward machines being asked to do a job that is fundamentally sequential. When you read a sentence, you keep a running picture of what is going on. You update that picture one step at a time. This running picture is called a **belief state**. A transformer struggles to do this. Its only axis for step-by-step computation is *depth*, meaning the number of stacked layers. So the number of times it can update its state is capped by how many layers it has. Once it runs out of layers, it runs out of updating room.

This limitation causes a very concrete failure. The paper calls it a **contextualization error**. Take the word "bank". Early in the network, its representation is a blur of both meanings, the river edge 🌊 and the money place 💰. Deeper layers use the surrounding words to pick the right meaning. If someone earlier mentioned a fishing pole, a deep layer settles on "river bank".

Here is the catch. That resolved meaning lives *deep* in the stack. When the model later starts writing its answer, the *shallow* layers do that early work. Those shallow layers only see the original blurry "bank". Information cannot flow back downward in a feedforward network. So the model just talked about fishing at a river, and then confidently tells you there is probably an ATM there. It actually knew the correct meaning. It simply could not reach back down to the layer where that meaning was stored.

An earlier paper (Racing Thoughts) showed a surgical fix. You take the disambiguated "bank" from a deep layer. You copy it back down to a shallow layer. Contextualization errors then drop by 60%. But that fix targets one hand-picked token at a time. **Recirculation** asks a bolder question. What if we do this everywhere, at every position, automatically? And what if we do it gently instead of forcefully?

Gently is the key word. Replacing a shallow embedding with a deep one would break things. The model was never trained to receive such a strong jolt of feedback, so its representations would fall out of distribution. Recirculation instead *leaks* only a small fraction of the deep-layer activation back down to a shallow layer. Picture stirring a tiny spoonful of finished soup back into the pot while it is still cooking 🍲. It is not enough to overwhelm the pot. It is enough to carry forward flavor that would otherwise be lost. That small leak enriches the shallow representation without breaking it. Best of all, it works on a fully trained, off-the-shelf model. No weights are changed.

One more question is worth answering. Why should leaking a deep feature into a shallow layer mean anything at all? The reason is the **residual stream**. In a transformer, every layer reads from and writes to the same shared workspace. You can think of it as a common blackboard. Because all layers write to the same blackboard, a given feature tends to point in the same direction no matter which layer produced it. A "moisture" feature means moisture whether it was written early or late. So feeding the resolved "bank" back down lights up the right features, like moisture and river, that the raw blurry token never activated on its own. No fancy translation layer is needed to make the deep signal readable by the shallow layer.

## Contributions

- Introduces **recirculation**. This is a training-free, inference-time change to a pretrained transformer. It mixes a deep-layer activation back into a shallow layer at each step. This improves the model's ability to track state.
- Clearly separates recirculation from **looped transformers**. Looping repeats layers, so it only adds recurrence in depth. Recirculation adds recurrence in *both* depth and input step. That difference is what lets a single layer hold both the old state and the new state, like a proper dynamical system.
- Shows the method needs only three settings. These are the mixture weight α, the source layer, and the destination layer. No gradient training is required to see real gains.
- Proposes **adaptive recirculation**. Here the whole model stays frozen. Only a tiny helper network is trained. This helper predicts token-specific mixing amounts. It matches full fine-tuning while leaving the base model untouched.
- Frames the overall idea as **"model-design affordances"**. The point is to let the trained network reveal how it wants to be modified. This is the opposite of guessing an architecture change and then paying to train it.

## Method

The core operation is a simple weighted average. After the model processes step *t*, the value written to the destination layer *d* becomes:

$$\boldsymbol{z}_{t+1,t,d} = \alpha\, f(\boldsymbol{z}_{t,t,s} \mid d,t) + \beta\, \boldsymbol{z}_{t,t,d}$$

Here *s* is the source layer, which is deep. *d* is the destination layer, which is shallow. α and β are the mixing weights. The paper sets β equal to 1−α, so the two weights always add up to 1. *f* is a rescaling step.

Why the rescaling step? Activation magnitudes tend to grow as you go deeper. A raw deep vector would therefore be much larger than the shallow one. It would dominate the average and drown out the shallow signal. To prevent this, they shrink the source vector so it has the same length (L₂ norm) as the destination vector:

$$f(\boldsymbol{z}\mid d,t) = \frac{\lVert \boldsymbol{z}_{t,t,d}\rVert_2}{\lVert \boldsymbol{z}\rVert_2}\, \boldsymbol{z}$$

The most important idea in the paper is the difference between **looping** and **recirculation**. The cleanest way to see it is to "unroll" a recurrent connection. Imagine a connection from layer 6 back to layer 3. You can lay this out on paper in two different ways.

- **Looped transformer.** You unroll in *depth only*. This just gives you a deeper feedforward network with shared weights. To track a state update, the new state has to sit one layer *deeper* than the old one. So you keep climbing the stack. Eventually you hit the ceiling again. The depth limit is not solved.
- **Recirculation.** You unroll in *depth and step*. Now the same layer can hold both the old state and the new state. State can stay in place. It can persist across many input steps. This is exactly what a recurrent network does. In fact, if you let the number of iterations grow without limit, recirculation turns into a true recurrent network.

There is a real cost to this. Because state updates are now truly sequential, recirculation **cannot be run in parallel during prefill**. Prefill is the phase where the model reads the prompt. During normal word-by-word *generation* the cost is tiny. Two stacks run side by side, and modern hardware handles that well. But a long prompt has to be read one token at a time, which can be slow.

For **adaptive recirculation**, they keep the model frozen. They fix the source and destination layers. They then learn only α and β. They test six versions in total. These range from fixed values, to learned single numbers, to learned per-feature vectors, and finally to full fine-tuning. The winner is a small helper network. It looks at each token's source and destination embeddings. It then outputs a custom set of mixing weights for that specific token. In short, the model gets to decide how much to recirculate, token by token and feature by feature.

## Results

- **Perplexity.** They test Gemma3 at 1B, 4B, and 12B sizes across ten language datasets. Basic recirculation lowers perplexity on 9 of the 10. The 1B and 4B models improve by up to about 16%. The 12B model improves by up to about 35%. The one failure is lambada, which has very short sequences. That fits their finding that recirculation helps more on longer text.
- **Not just temperature.** They check a boring alternative explanation. Maybe recirculation only sharpens the output distribution. Temperature tuning alone lowers perplexity by 8.48%. Recirculation alone lowers it by 14.21%. Doing both gives 19.55%. The two effects roughly add up. So recirculation is doing something extra, not just adjusting temperature.
- **Not just looping.** Training-free looping does not give reliable gains on Gemma3. It only helps at large model sizes. Recirculation helps across all sizes. This confirms the two methods work on different principles.
- **Which tokens matter.** The benefit is largest for nearby tokens and slowly fades over distance, with a small effect still visible 256 tokens away. Content words help most. These are adverbs, adjectives, verbs, and plural nouns. Function words help least. These are determiners, pronouns, and numerals. This pattern is good evidence that the effect is really about tracking meaning. Recirculating the very first tokens can even hurt the 1B model. That makes sense, since there is no state to carry forward yet at the start.
- **Downstream tasks.** Gains on single-token multiple-choice tasks are modest, helping on 6 of 8 datasets. Gains on generative tasks are larger. Instruction-following error drops by about 25% for the 4B model and about 75% for the 12B model. On **GSM8k** math problems, recirculation improves both pass@1 and pass@128. That means it helps the model both pick the right answer and generate more correct answers overall.
- **Adaptive recirculation.** This gives a mean 23.0% perplexity reduction, up from 8.5% for the basic version. It even matches full fine-tuning, at 23.0% versus 21.6%, without changing the model. On GSM8k it cuts error by 8.8% (pass@1) and 20.9% (pass@128). One caveat. The gains depend a lot on the small dataset used to train the helper network. A clean set like the MMLU test split works well. Noisier sets can actually hurt.

## Two-Cents

This is a lovely paper, and the framing is the best part. The "model-design affordances" idea is genuinely fresh. The claim is that a trained network already encodes how it wants to be modified. A cheap inference-time tweak can reveal that preference. You can then use it to guide training later if you wish. This reframes a lot of tedious architecture search as simply listening to the model. The looping-versus-recirculation distinction is also a clean idea. Unrolling in depth alone gives looping. Unrolling in depth and step gives recirculation. That clarifies a corner of the recurrence literature that is usually confusing.

The honest caveats are large though. The prefill cost is the elephant in the room. Killing parallelism on long prompts is painful. Long prompts are exactly where state tracking matters most. The proposed fix, called blockwise recirculation, is only suggested and not yet tested. The gains also look suspiciously friendly to Gemma. Gemma3 improves by around 5%, while other model families improve by less than 0.5%. The authors flag this but do not resolve it. So it is unclear how much of the win comes from the method itself versus quirks of Gemma. The hyperparameters also change from task to task, and there is no automatic way to pick them yet.

There are clear future directions, and the paper lists several. One is running more recirculation iterations, which moves the method closer to a true recurrent network. Another is using several source-to-destination paths at once, which might carry state at different levels of abstraction. A third is blockwise prefill to win back some parallelism. The deepest open question is bigger than any single fix. Does "listen to the model" generalize beyond this one trick with the residual stream? If it does, that is a research program, not just a paper.

## Resources

- [Research Paper](https://arxiv.org/abs/2608.17981)
- [HTML version](https://arxiv.org/html/2608.17981v1)
- [Racing Thoughts](https://arxiv.org/abs/2508.09648) (the motivating paper on contextualization errors)
{% endraw %}
