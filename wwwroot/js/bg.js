(() => {
    if (window.__arcadeBgInitialized) {
        return;
    }
    window.__arcadeBgInitialized = true;

    const c = document.getElementById('bg');
    const x = c.getContext('2d');
    let w, h, dpr, pts = [], mx = 0, my = 0;
    const N = 60;           // Partikelanzahl
    const R = 90;           // Verbindungsreichweite

    function resize() {
        dpr = Math.max(1, window.devicePixelRatio || 1);
        w = c.width = innerWidth * dpr;
        h = c.height = innerHeight * dpr;
        c.style.width = innerWidth + 'px';
        c.style.height = innerHeight + 'px';
        x.setTransform(1, 0, 0, 1, 0, 0);
        x.scale(dpr, dpr);
    }

    function reset() {
        pts = Array.from({ length: N }, () => ({
            x: Math.random() * innerWidth,
            y: Math.random() * innerHeight,
            vx: (Math.random() * 2 - 1) * 0.4,
            vy: (Math.random() * 2 - 1) * 0.4
        }));
    }

    function step() {
        x.clearRect(0, 0, innerWidth, innerHeight);

        // sanfter Farbverlauf im Backdrop
        const g = x.createRadialGradient(innerWidth * 0.7, -60, 50, innerWidth * 0.7, -60, Math.max(innerWidth, innerHeight));
        g.addColorStop(0, 'rgba(65,212,131,0.08)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, innerWidth, innerHeight);

        for (let p of pts) {
            p.x += p.vx; p.y += p.vy;

            // leichte Parallax-Richtung zur Maus
            p.x += (mx - innerWidth / 2) * 0.0004;
            p.y += (my - innerHeight / 2) * 0.0004;

            if (p.x < -20) p.x = innerWidth + 20; else if (p.x > innerWidth + 20) p.x = -20;
            if (p.y < -20) p.y = innerHeight + 20; else if (p.y > innerHeight + 20) p.y = -20;
        }

        // Verbindungen
        for (let i = 0; i < N; i++) {
            for (let j = i + 1; j < N; j++) {
                const a = pts[i], b = pts[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                if (dist < R) {
                    x.strokeStyle = `rgba(65,212,131,${(1 - dist / R) * 0.15})`;
                    x.lineWidth = 1;
                    x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.stroke();
                }
            }
        }

        // Punkte
        for (let p of pts) {
            x.fillStyle = 'rgba(233,241,255,.7)';
            x.beginPath(); x.arc(p.x, p.y, 1.6, 0, Math.PI * 2); x.fill();
        }

        requestAnimationFrame(step);
    }

    window.addEventListener('resize', () => { resize(); reset(); });
    window.addEventListener('pointermove', e => { mx = e.clientX; my = e.clientY; });
    resize(); reset(); step();
})();
