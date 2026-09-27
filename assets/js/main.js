(function () {
    'use strict';

    var root = document.documentElement;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
    var lerp = function (a, b, t) { return a + (b - a) * t; };
    var mouse = { x: -1, y: -1, active: false };

    window.addEventListener('pointermove', function (e) {
        mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    }, { passive: true });
    document.addEventListener('pointerleave', function () { mouse.active = false; });

    // ================================================================ basics
    var year = document.getElementById('year');
    if (year) year.textContent = new Date().getFullYear();

    var clocks = document.querySelectorAll('[data-clock]');
    function tickClock() {
        var t;
        try {
            t = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }).format(new Date());
        } catch (e) { return; }
        clocks.forEach(function (c) { c.textContent = c.closest('.nav') ? 'IST ' + t : t; });
    }
    if (clocks.length) { tickClock(); setInterval(tickClock, 15000); }

    // ================================================================ theme
    var themeListeners = [];
    function onThemeChange(fn) { themeListeners.push(fn); }
    function fireTheme() { themeListeners.forEach(function (fn) { fn(); }); }
    var themeBtn = document.querySelector('.theme-toggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', function () {
            var current = root.getAttribute('data-theme') ||
                (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
            var next = current === 'dark' ? 'light' : 'dark';
            root.setAttribute('data-theme', next);
            try { localStorage.setItem('theme', next); } catch (e) {}
            fireTheme();
        });
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);

    // ================================================================ mobile menu
    var menuBtn = document.querySelector('.menu-toggle');
    var navLinks = document.getElementById('nav-links');
    function setMenu(open) {
        if (!menuBtn || !navLinks) return;
        navLinks.classList.toggle('open', open);
        root.classList.toggle('menu-open', open);
        menuBtn.setAttribute('aria-expanded', String(open));
        menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
    if (menuBtn) {
        menuBtn.addEventListener('click', function () { setMenu(!navLinks.classList.contains('open')); });
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });
    }

    // ================================================================ page transitions
    document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href]');
        if (!a || reduceMotion) return;
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (a.target === '_blank' || a.hasAttribute('download')) return;
        var url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return;
        if (url.pathname === location.pathname && url.hash) return; // in-page anchor
        if (/\.(pdf|jpg|png|zip)$/i.test(url.pathname)) return;
        e.preventDefault();
        setMenu(false);
        root.classList.add('leaving');
        setTimeout(function () { location.href = url.href; }, 520);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) root.classList.remove('leaving'); });

    // ================================================================ reveal on scroll
    var revealEls = [].slice.call(document.querySelectorAll('[data-reveal]'));
    revealEls.forEach(function (el) {
        var sibs = [].filter.call(el.parentElement.children, function (c) { return c.hasAttribute('data-reveal'); });
        var i = sibs.indexOf(el);
        if (i > 0) el.style.setProperty('--d', Math.min(i * 0.08, 0.4) + 's');
    });
    if ('IntersectionObserver' in window && !reduceMotion) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
            });
        }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
        revealEls.forEach(function (el) { io.observe(el); });
    } else {
        revealEls.forEach(function (el) { el.classList.add('in'); });
    }

    // ================================================================ count-up
    var counters = document.querySelectorAll('[data-count]');
    if (counters.length && 'IntersectionObserver' in window && !reduceMotion) {
        var cio = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                cio.unobserve(en.target);
                var el = en.target, end = parseFloat(el.getAttribute('data-count')) || 0, t0 = performance.now();
                (function step(now) {
                    var t = Math.min((now - t0) / 1400, 1);
                    el.textContent = Math.round(end * (1 - Math.pow(1 - t, 4)));
                    if (t < 1) requestAnimationFrame(step);
                })(t0);
            });
        }, { threshold: 0.5 });
        counters.forEach(function (c) { c.textContent = '0'; cio.observe(c); });
    }

    // ================================================================ filters
    document.querySelectorAll('[data-filter-group]').forEach(function (group) {
        var target = document.querySelector('[data-filter-target="' + group.getAttribute('data-filter-group') + '"]');
        if (!target) return;
        var buttons = group.querySelectorAll('.filter');
        buttons.forEach(function (b) {
            b.setAttribute('aria-pressed', String(b.classList.contains('active')));
            b.addEventListener('click', function () {
                var f = b.getAttribute('data-filter');
                buttons.forEach(function (x) {
                    x.classList.toggle('active', x === b);
                    x.setAttribute('aria-pressed', String(x === b));
                });
                [].forEach.call(target.children, function (item) {
                    var show = f === 'all' || item.getAttribute('data-type') === f;
                    item.classList.toggle('is-hidden', !show);
                    if (show) item.classList.add('in');
                });
            });
        });
    });

    // ================================================================ BibTeX
    document.querySelectorAll('.bibtex-btn').forEach(function (btn, i) {
        var panel = btn.closest('.pub').querySelector('.bibtex-panel');
        if (!panel) return;
        panel.id = 'bibtex-' + (i + 1);
        btn.setAttribute('aria-controls', panel.id);
        btn.setAttribute('aria-expanded', 'false');
        btn.addEventListener('click', function () {
            var open = panel.hasAttribute('hidden');
            panel.toggleAttribute('hidden', !open);
            btn.setAttribute('aria-expanded', String(open));
            btn.querySelector('.arr').textContent = open ? '−' : '+';
        });
    });
    document.querySelectorAll('.copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var text = btn.parentElement.querySelector('.bibtex-block').textContent;
            var done = function () {
                btn.classList.add('copied'); btn.textContent = 'Copied';
                setTimeout(function () { btn.classList.remove('copied'); btn.textContent = 'Copy'; }, 1800);
            };
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(done, function () {});
            } else {
                var ta = document.createElement('textarea');
                ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                document.body.appendChild(ta); ta.select();
                try { document.execCommand('copy'); done(); } catch (e) {}
                ta.remove();
            }
        });
    });

    // ================================================================ pointer effects (desktop)
    var cursor = document.querySelector('.cursor');
    var cursorLabel = cursor && cursor.querySelector('.cursor-label');
    var cur = { x: -100, y: -100 };
    if (finePointer && !reduceMotion && cursor) {
        root.classList.add('has-cursor');
        document.addEventListener('pointerover', function (e) {
            var t = e.target.closest && e.target.closest('a, button, [data-cursor]');
            var label = t && t.getAttribute('data-cursor');
            cursor.classList.toggle('hover', !!t && !label);
            cursor.classList.toggle('label', !!label);
            if (label) cursorLabel.textContent = label;
        });
        document.documentElement.addEventListener('mouseleave', function () { cursor.classList.add('hidden'); });
        document.documentElement.addEventListener('mouseenter', function () { cursor.classList.remove('hidden'); });

        // magnetic buttons
        document.querySelectorAll('[data-magnetic]').forEach(function (el) {
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
                el.style.transform = 'translate(' + dx * 0.25 + 'px,' + dy * 0.35 + 'px)';
            });
            el.addEventListener('pointerleave', function () {
                el.style.transition = 'transform 0.6s cubic-bezier(0.22,1,0.36,1), color 0.4s, border-color 0.4s';
                el.style.transform = '';
                setTimeout(function () { el.style.transition = ''; }, 600);
            });
        });

        // photo tilt
        document.querySelectorAll('[data-tilt]').forEach(function (el) {
            el.addEventListener('pointermove', function (e) {
                var r = el.getBoundingClientRect();
                var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
                el.style.transform = 'perspective(900px) rotateY(' + px * 8 + 'deg) rotateX(' + -py * 8 + 'deg)';
            });
            el.addEventListener('pointerleave', function () { el.style.transform = ''; });
        });

        // project card fill origin follows the pointer
        document.addEventListener('pointermove', function (e) {
            var card = e.target.closest && e.target.closest('.proj');
            if (!card) return;
            var r = card.getBoundingClientRect();
            card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
            card.style.setProperty('--my', (e.clientY - r.top) + 'px');
        }, { passive: true });
    }

    // publication hover preview
    var preview = document.querySelector('.preview');
    var prev = { x: 0, y: 0, on: false };
    if (preview && finePointer) {
        var pv = preview.querySelector('.preview-venue'), pt = preview.querySelector('.preview-text');
        var pi = preview.querySelector('.preview-img');
        document.querySelectorAll('.pub-row[data-preview-text]').forEach(function (row) {
            row.addEventListener('pointerenter', function () {
                pv.textContent = row.getAttribute('data-preview-venue');
                pt.textContent = row.getAttribute('data-preview-text');
                if (pi) {
                    var src = row.getAttribute('data-preview-img');
                    preview.classList.toggle('has-img', !!src);
                    if (src) pi.src = src;
                }
                if (!prev.on) { prev.x = mouse.x; prev.y = mouse.y; }
                prev.on = true; preview.classList.add('show');
            });
            row.addEventListener('pointerleave', function () { prev.on = false; preview.classList.remove('show'); });
        });
    }

    // ================================================================ blog posts: math, contents, progress
    var prose = document.querySelector('[data-prose]');
    var tocItems = [];
    if (prose) {
        // KaTeX (loaded with defer on post pages only); kramdown emits \( \) and \[ \] delimiters.
        var renderMath = function () {
            if (!window.renderMathInElement) return false;
            window.renderMathInElement(prose, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '\\[', right: '\\]', display: true },
                    { left: '\\(', right: '\\)', display: false }
                ],
                throwOnError: false
            });
            return true;
        };
        if (!renderMath()) window.addEventListener('load', renderMath);

        // Contents list from the post's headings, with the current section highlighted.
        var toc = document.querySelector('[data-toc]');
        var heads = prose.querySelectorAll('h2, h3');
        heads.forEach(function (h, i) {
            if (!h.id) h.id = 's-' + (i + 1) + '-' + h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            if (!toc) return;
            var li = document.createElement('li');
            li.className = h.tagName === 'H3' ? 'toc-sub' : '';
            var a = document.createElement('a');
            a.href = '#' + h.id; a.textContent = h.textContent;
            li.appendChild(a); toc.appendChild(li);
            tocItems.push({ h: h, a: a });
        });
        if (toc && !tocItems.length) toc.closest('.toc').style.display = 'none';
    }
    var readBar = document.querySelector('.read-progress');

    // ================================================================ scroll-driven effects
    var nav = document.getElementById('nav');
    var lastY = window.scrollY;
    var statement = document.querySelector('[data-words]');
    var words = [];
    if (statement && !reduceMotion) {
        // Split text into word spans, keeping highlighted spans intact.
        var frag = document.createDocumentFragment();
        [].slice.call(statement.childNodes).forEach(function (node) {
            if (node.nodeType === 3) {
                node.textContent.split(/(\s+)/).forEach(function (part) {
                    if (!part) return;
                    if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                    var s = document.createElement('span'); s.className = 'w'; s.textContent = part;
                    frag.appendChild(s); words.push(s);
                });
            } else {
                node.classList.add('w'); frag.appendChild(node); words.push(node);
            }
        });
        statement.textContent = '';
        statement.appendChild(frag);
    }
    var timelines = document.querySelectorAll('[data-timeline]');

    // horizontal gallery
    var hs = document.querySelector('[data-hscroll]');
    var hsTrack = hs && hs.querySelector('[data-hs-track]');
    var hsCount = hs && hs.querySelector('[data-hs-count]');
    var hsBar = hs && hs.querySelector('[data-hs-bar]');
    var hsDist = 0, hsOn = false;
    function setupHS() {
        if (!hs) return;
        hsOn = window.innerWidth >= 900 && !reduceMotion;
        hs.classList.toggle('hs-on', hsOn);
        if (!hsOn) { hs.style.height = ''; hsTrack.style.transform = ''; return; }
        hsTrack.style.transform = 'none';
        hsDist = Math.max(0, hsTrack.scrollWidth - window.innerWidth + 48);
        hs.style.height = (window.innerHeight + hsDist) + 'px';
    }

    function onScroll() {
        var y = window.scrollY, vh = window.innerHeight;
        // nav: frosted after scrolling, tucked away while scrolling down
        if (nav) {
            nav.classList.toggle('scrolled', y > 20);
            if (!root.classList.contains('menu-open')) nav.classList.toggle('tucked', y > 500 && y > lastY + 2);
            if (y < lastY - 2) nav.classList.remove('tucked');
        }
        // statement words light up as it scrolls through the viewport
        if (words.length) {
            var r = statement.getBoundingClientRect();
            var p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
            var lit = p * words.length;
            for (var i = 0; i < words.length; i++) words[i].style.opacity = clamp(lit - i, 0.14, 1);
        }
        // timeline rail draws itself
        timelines.forEach(function (t) {
            var r = t.getBoundingClientRect();
            t.style.setProperty('--tl', clamp((vh * 0.65 - r.top) / r.height, 0, 1).toFixed(3));
        });
        // pinned horizontal gallery
        if (hsOn) {
            var hr = hs.getBoundingClientRect();
            var hp = hsDist ? clamp(-hr.top / hsDist, 0, 1) : 0;
            hsTrack.style.transform = 'translate3d(' + (-hp * hsDist).toFixed(1) + 'px,0,0)';
            var n = hsTrack.children.length - 1;
            var idx = Math.min(n, Math.round(hp * (n - 1)) + 1);
            if (hsCount) hsCount.textContent = (idx < 10 ? '0' : '') + idx;
            if (hsBar) hsBar.parentElement.parentElement.style.setProperty('--hs', hp.toFixed(3));
        }
        // reading progress + active contents entry on blog posts
        if (prose) {
            var pr = prose.getBoundingClientRect();
            if (readBar) readBar.style.transform = 'scaleX(' + clamp((vh * 0.3 - pr.top) / pr.height, 0, 1).toFixed(4) + ')';
            var current = null;
            tocItems.forEach(function (t) { if (t.h.getBoundingClientRect().top < vh * 0.3) current = t; });
            tocItems.forEach(function (t) { t.a.classList.toggle('active', t === current); });
        }
        lastY = y;
    }
    var scrollQueued = false;
    window.addEventListener('scroll', function () {
        if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(function () { scrollQueued = false; onScroll(); }); }
    }, { passive: true });
    var resizeT;
    window.addEventListener('resize', function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(function () { setupHS(); onScroll(); }, 150);
    });
    setupHS(); onScroll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setupHS(); onScroll(); });
    window.addEventListener('load', function () { setupHS(); onScroll(); });

    // ================================================================ per-frame loop (cursor, preview, kinetic band)
    var band = document.querySelector('[data-band]');
    var bandX = 0, bandVel = 0, bandDir = 1, prevScroll = window.scrollY;
    function frame() {
        if (root.classList.contains('has-cursor')) {
            cur.x = lerp(cur.x, mouse.x, 0.2); cur.y = lerp(cur.y, mouse.y, 0.2);
            cursor.style.transform = 'translate3d(' + cur.x + 'px,' + cur.y + 'px,0)';
        }
        if (preview && prev.on) {
            prev.x = lerp(prev.x, mouse.x, 0.14); prev.y = lerp(prev.y, mouse.y, 0.14);
            var px = Math.min(prev.x + 24, window.innerWidth - 360);
            preview.style.transform = 'translate3d(' + px + 'px,' + (prev.y + 24) + 'px,0)';
        }
        if (band && !reduceMotion) {
            var sy = window.scrollY, dv = sy - prevScroll; prevScroll = sy;
            if (Math.abs(dv) > 0.5) bandDir = dv > 0 ? 1 : -1;
            bandVel = lerp(bandVel, Math.min(Math.abs(dv) * 0.6, 30), 0.1);
            bandX -= (0.6 + bandVel) * bandDir;
            var third = band.scrollWidth / 3;
            if (bandX <= -third) bandX += third;
            if (bandX > 0) bandX -= third;
            band.style.transform = 'translate3d(' + bandX.toFixed(1) + 'px,0,0)';
        }
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // ================================================================ hero: sparse attention field
    var canvas = document.querySelector('[data-attn-field]');
    if (canvas) attentionField(canvas);

    function attentionField(cv) {
        var ctx = cv.getContext('2d');
        var hero = cv.parentElement;
        var VOCAB = ['query', 'key', 'value', 'token', 'cache', 'sparse', 'attend', 'softmax', 'context', '128k',
            'prune', 'sink', 'block', 'LSH', 'hash', 'remask', 'diffuse', 'SLERP', 'flash', 'ring', 'chunk',
            'evict', 'summary', 'anchor', 'KV', 'head', 'layer', 'RoPE', 'window', 'stride', 'recall', 'needle',
            'decode', 'prefill', 'logits', 'mask', 'kernel', 'FLOPs', 'latency', 'top-k', 'MDLM', 'entropy'];
        var K = 8;
        var W = 0, H = 0, dpr = 1, tokens = [], t = 0, running = false, visible = true;
        var q = { x: 0, y: 0 }, target = { x: 0, y: 0 }, lastMouse = -1e9;
        var colors = {};
        var hud = {
            q: hero.querySelector('[data-hud="q"]'), k: hero.querySelector('[data-hud="k"]'),
            n: hero.querySelector('[data-hud="n"]'), s: hero.querySelector('[data-hud="s"]')
        };
        var frameN = 0;

        function readColors() {
            var cs = getComputedStyle(root);
            colors.ink = cs.getPropertyValue('--ink').trim() || '#f0eee8';
            colors.accent = cs.getPropertyValue('--accent').trim() || '#7ce0ae';
            colors.bg = cs.getPropertyValue('--bg').trim() || '#0b0b0b';
        }

        function build() {
            var r = cv.getBoundingClientRect();
            W = r.width; H = r.height;
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            var fs = W < 700 ? 11 : 13;
            ctx.font = '500 ' + fs + 'px "JetBrains Mono", ui-monospace, monospace';
            ctx.textBaseline = 'middle';
            tokens = [];
            var rowH = fs * 2.5, gap = fs * 1.6, seed = 7;
            var rand = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
            for (var y = rowH * 0.8; y < H; y += rowH) {
                var x = -rand() * 40;
                while (x < W) {
                    var word = VOCAB[Math.floor(rand() * VOCAB.length)];
                    var w = ctx.measureText(word).width;
                    tokens.push({ x: x, y: y, w: w, cx: x + w / 2, text: word, ph: rand() * Math.PI * 2 });
                    x += w + gap + rand() * gap;
                }
            }
            if (hud.n) hud.n.textContent = tokens.length;
            if (hud.k) hud.k.textContent = K;
            if (hud.s) hud.s.textContent = ((1 - K / tokens.length) * 100).toFixed(1) + '%';
            q.x = target.x = W * 0.68; q.y = target.y = H * 0.45;
        }

        function draw() {
            var sigma = Math.max(W, H) * 0.13, s2 = 2 * sigma * sigma;
            var top = [];
            ctx.clearRect(0, 0, W, H);

            // base tokens
            ctx.fillStyle = colors.ink;
            for (var i = 0; i < tokens.length; i++) {
                var tk = tokens[i];
                var dx = tk.cx - q.x, dy = tk.y - q.y;
                var score = Math.exp(-(dx * dx + dy * dy) / s2) * (0.85 + 0.15 * Math.sin(t * 1.3 + tk.ph));
                tk.s = score;
                ctx.globalAlpha = 0.07 + 0.03 * Math.sin(t + tk.ph) + score * 0.5;
                ctx.fillText(tk.text, tk.x, tk.y);
                // keep a running top-k
                if (top.length < K || score > top[top.length - 1].s) {
                    var j = top.length < K ? top.length : K - 1;
                    top[j] = tk;
                    while (j > 0 && top[j].s > top[j - 1].s) { var tmp = top[j]; top[j] = top[j - 1]; top[j - 1] = tmp; j--; }
                }
            }

            // attention sink: first token always gets a sliver of attention
            var sink = tokens[0];
            if (sink) {
                ctx.globalAlpha = 0.22; ctx.strokeStyle = colors.ink; ctx.lineWidth = 1;
                ctx.setLineDash([3, 5]);
                ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(sink.cx, sink.y); ctx.stroke();
                ctx.setLineDash([]);
            }

            // top-k edges and selected tokens
            var sum = 0; top.forEach(function (tk) { sum += tk.s; });
            ctx.strokeStyle = colors.accent;
            top.forEach(function (tk, rank) {
                var wN = sum ? tk.s / sum : 0;
                ctx.globalAlpha = 0.25 + wN * 2.2;
                ctx.lineWidth = 0.8 + wN * 6;
                ctx.beginPath();
                var mx = (q.x + tk.cx) / 2, my = (q.y + tk.y) / 2 - 30;
                ctx.moveTo(q.x, q.y); ctx.quadraticCurveTo(mx, my, tk.cx, tk.y);
                ctx.stroke();
                ctx.globalAlpha = 0.9;
                ctx.lineWidth = 1;
                ctx.strokeRect(tk.x - 5, tk.y - 11, tk.w + 10, 22);
                ctx.fillStyle = colors.accent;
                ctx.globalAlpha = 1;
                ctx.fillText(tk.text, tk.x, tk.y);
                if (rank < 3) {
                    ctx.globalAlpha = 0.8;
                    ctx.font = ctx.font.replace(/\d+px/, '9px');
                    ctx.fillText((wN * 100).toFixed(0) + '%', tk.x + tk.w + 9, tk.y - 10);
                    ctx.font = ctx.font.replace(/\d+px/, (W < 700 ? 11 : 13) + 'px');
                }
            });

            // the query
            ctx.globalAlpha = 1; ctx.fillStyle = colors.accent;
            ctx.beginPath(); ctx.arc(q.x, q.y, 4.5, 0, Math.PI * 2); ctx.fill();
            ctx.globalAlpha = 0.45; ctx.strokeStyle = colors.accent; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(q.x, q.y, 16 + Math.sin(t * 3) * 3, 0, Math.PI * 2); ctx.stroke();
            ctx.globalAlpha = 0.9; ctx.fillStyle = colors.ink;
            ctx.fillText('q', q.x + 12, q.y + 16);
            ctx.globalAlpha = 1;

            if (hud.q && frameN++ % 6 === 0) hud.q.textContent = '(' + Math.round(q.x) + ', ' + Math.round(q.y) + ')';
        }

        function loop(now) {
            if (!running) return;
            t = now / 1000;
            var r = cv.getBoundingClientRect();
            var inside = mouse.active && mouse.y >= r.top && mouse.y <= r.bottom;
            if (inside) { target.x = mouse.x - r.left; target.y = mouse.y - r.top; lastMouse = now; }
            else if (now - lastMouse > 2500) {
                // idle: the query wanders on a slow Lissajous path
                target.x = W * (0.62 + 0.26 * Math.sin(t * 0.33));
                target.y = H * (0.48 + 0.3 * Math.sin(t * 0.47 + 1));
            }
            q.x = lerp(q.x, target.x, 0.09); q.y = lerp(q.y, target.y, 0.09);
            draw();
            requestAnimationFrame(loop);
        }
        function start() { if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(loop); } }
        function stop() { running = false; }

        readColors(); build();
        onThemeChange(function () { setTimeout(function () { readColors(); if (reduceMotion) draw(); }, 30); });
        var rt;
        window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { build(); if (reduceMotion) draw(); }, 150); });
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { build(); if (reduceMotion) draw(); });

        if (reduceMotion) {
            draw();
            hero.addEventListener('pointermove', function (e) {
                var r = cv.getBoundingClientRect();
                q.x = e.clientX - r.left; q.y = e.clientY - r.top; draw();
            });
            return;
        }
        if ('IntersectionObserver' in window) {
            new IntersectionObserver(function (en) {
                visible = en[0].isIntersecting; if (visible) start(); else stop();
            }).observe(cv);
        }
        document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
        start();
    }
})();
