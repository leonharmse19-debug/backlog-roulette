// Backlog Roulette - wheel drawing, spin animation, and UI bindings
(function(){
  const defaults = ['Witcher 3','Cyberpunk','Hades','Hollow Knight','Elden Ring','Stardew Valley'];

  // load saved games from localStorage
  let games;
  try{
    const saved = localStorage.getItem('backlogGames');
    if(saved){
      const parsed = JSON.parse(saved);
      games = Array.isArray(parsed) ? parsed : [...defaults];
    } else {
      games = [...defaults];
    }
  } catch(e){
    games = [...defaults];
  }

  const canvas = document.getElementById('wheel');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const spinBtn = document.getElementById('spin');
  const addForm = document.getElementById('add-form');
  const input = document.getElementById('game-input');
  const gameList = document.getElementById('game-list');
  const winnerModal = document.getElementById('winnerModal');
  const winnerTitle = document.getElementById('winnerTitle');
  const winnerImage = document.getElementById('winnerImage');
  const closeModal = document.getElementById('closeModal');

  const palette = ['#8a2be2','#00e6d8','#5b2fa6','#00b3a0'];

  let rotation = 0;
  let angularVelocity = 0;
  let animId = null;
  let lastTime = 0;

  // timed spin variables
  let spinStart = null;
  let spinDuration = 0;
  let spinInitVel = 0;

  function resizeCanvas(){
    if(!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.width * dpr));
    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
  }

  function draw(){
    if(!ctx || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    const cx = w/2;
    const cy = h/2;
    const radius = Math.min(w,h)/2 - 8;

    ctx.clearRect(0,0,w,h);

    const n = Math.max(1,games.length);
    const slice = Math.PI * 2 / n;

    ctx.save();
    ctx.translate(cx,cy);
    ctx.rotate(rotation);

    for(let i=0;i<n;i++){
      const start = i * slice;
      const end = start + slice;

      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0,0,radius,start,end);
      ctx.closePath();

      const color = palette[i % palette.length];
      const g = ctx.createLinearGradient(
        Math.cos((start+end)/2)*radius*0.2,
        Math.sin((start+end)/2)*radius*0.2,
        Math.cos((start+end)/2)*radius,
        Math.sin((start+end)/2)*radius
      );
      g.addColorStop(0, shadeColor(color, -12));
      g.addColorStop(1, color);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      const mid = start + slice/2;
      ctx.rotate(mid);
      ctx.translate(radius * 0.65, 0);
      ctx.rotate(Math.PI/2);
      ctx.fillStyle = 'rgba(8,10,12,0.95)';
      ctx.font = '600 14px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = games[i] || '';
      wrapText(ctx, label, 0, 0, radius*0.5, 14);
      ctx.restore();
    }

    ctx.restore();

    // center hub
    ctx.beginPath();
    ctx.arc(cx,cy,Math.max(20, radius*0.12),0,Math.PI*2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // pointer
    ctx.beginPath();
    ctx.moveTo(cx - 12, cy - radius - 6);
    ctx.lineTo(cx + 12, cy - radius - 6);
    ctx.lineTo(cx, cy - radius + 18);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
  }

  function animate(ts){
    if(!lastTime) lastTime = ts;
    const dt = Math.min(0.05, (ts - lastTime)/1000);
    lastTime = ts;

    if(spinStart !== null){
      const elapsed = (ts - spinStart) / 1000;
      if(elapsed < spinDuration){
        const finalAbs = 0.02;
        const ratio = finalAbs / Math.max(1e-6, Math.abs(spinInitVel));
        const decay = Math.pow(ratio, elapsed / spinDuration);
        angularVelocity = spinInitVel * decay;
        rotation += angularVelocity * dt;
        draw();
        animId = requestAnimationFrame(animate);
        return;
      } else {
        angularVelocity = 0;
        spinStart = null;
        animId = null;
        draw();
        const winner = computeWinner();
        if(winner != null) announceWinner(winner);
        return;
      }
    }

    if(Math.abs(angularVelocity) > 0.02){
      rotation += angularVelocity * dt;
      angularVelocity *= Math.pow(0.985, dt*60);
      draw();
      animId = requestAnimationFrame(animate);
    } else if(animId){
      angularVelocity = 0;
      animId = null;
      draw();
      const winner = computeWinner();
      if(winner != null) announceWinner(winner);
    }
  }

  function computeWinner(){
    if(games.length === 0) return null;
    const n = games.length;
    const slice = Math.PI*2 / n;
    const pointerCanvasAngle = 1.5 * Math.PI;
    let wheelAngle = pointerCanvasAngle - rotation;
    wheelAngle = ((wheelAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
    const index = Math.floor(wheelAngle / slice) % n;
    return games[index];
  }

  function announceWinner(name){
    if(!winnerModal) return;
    winnerTitle.textContent = name || '—';
    const label = encodeURIComponent(name || 'Winner');
    winnerImage.src = `https://placehold.co/640x360/1a1a2e/ffffff?text=${label}`;
    winnerImage.alt = name || 'Winner';
    winnerModal.classList.add('open');
    winnerModal.style.display = 'flex';
    winnerModal.setAttribute('aria-hidden','false');
    if(closeModal) closeModal.focus();
    const content = winnerModal.querySelector('.modal-content');
    if(content) content.animate([
      { transform: 'translateY(8px)', opacity: 0 },
      { transform: 'translateY(0)', opacity: 1 }
    ], { duration: 360, easing: 'cubic-bezier(.2,.9,.2,1)' });
  }

  function spin(){
    if(animId) return;
    if(games.length === 0) return;
    const min = 8; const max = 14;
    const dir = (Math.random() > 0.5) ? 1 : -1;
    spinInitVel = (Math.random() * (max - min) + min) * dir;
    spinDuration = Math.random() * (15 - 10) + 10; // seconds
    spinStart = null;
    lastTime = 0;
    animId = requestAnimationFrame((ts)=>{ spinStart = ts; animate(ts); });
  }

  function addGame(title){
    const t = (title||'').trim();
    if(!t) return;
    games.push(t);
    renderList(); draw(); input.value = ''; input.focus(); saveGames();
  }

  function renderList(){
    if(!gameList) return;
    gameList.innerHTML = '';
    games.forEach((g,i)=>{
      const li = document.createElement('li');
      li.textContent = g;
      const remove = document.createElement('button');
      remove.textContent = '✕'; remove.title = 'Remove'; remove.style.marginLeft = '8px';
      remove.addEventListener('click', ()=>{ games.splice(i,1); renderList(); draw(); saveGames(); });
      li.appendChild(remove);
      gameList.appendChild(li);
    });
  }

  function saveGames(){ try{ localStorage.setItem('backlogGames', JSON.stringify(games)); } catch(e){} }

  function exportGames(){
    try{ const data = JSON.stringify(games, null, 2); const blob = new Blob([data], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'backlog-games.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); } catch(e){ console.warn('Export failed', e); }
  }

  function importGamesFromFile(file){
    if(!file) return; const reader = new FileReader();
    reader.onload = function(e){ try{ const parsed = JSON.parse(String(e.target.result)); if(Array.isArray(parsed)){ games = parsed.slice(); saveGames(); renderList(); draw(); } else { alert('Invalid file format: expected a JSON array of game titles.'); } } catch(err){ alert('Failed to read file: ' + (err && err.message ? err.message : 'unknown')); } };
    reader.readAsText(file);
  }

  function wrapText(ctx, text, x, y, maxWidth, lineHeight){
    const words = text.split(/\s+/); let line = ''; let yOffset = 0;
    for(let n=0;n<words.length;n++){ const testLine = line + (line ? ' ' : '') + words[n]; const metrics = ctx.measureText(testLine); if(metrics.width > maxWidth && n>0){ ctx.fillText(line, x, y + yOffset); line = words[n]; yOffset += lineHeight; } else { line = testLine; } }
    ctx.fillText(line, x, y + yOffset);
  }

  function shadeColor(hex, percent){
    const c = hex.replace('#',''); const num = parseInt(c,16);
    let r = (num >> 16) + percent; let g = ((num >> 8) & 0x00FF) + percent; let b = (num & 0x0000FF) + percent;
    r = Math.max(Math.min(255,r),0); g = Math.max(Math.min(255,g),0); b = Math.max(Math.min(255,b),0);
    return '#'+( (r<<16) | (g<<8) | b ).toString(16).padStart(6,'0');
  }

  // bindings
  window.addEventListener('resize', resizeCanvas);
  if(addForm) addForm.addEventListener('submit', (e)=>{ e.preventDefault(); addGame(input.value); });
  if(spinBtn) spinBtn.addEventListener('click', spin);

  const exportBtn = document.getElementById('export-games');
  const importBtn = document.getElementById('import-games');
  const importFile = document.getElementById('import-file');
  if(exportBtn) exportBtn.addEventListener('click', exportGames);
  if(importBtn && importFile) importBtn.addEventListener('click', ()=> importFile.click());
  if(importFile) importFile.addEventListener('change', (e)=>{ const f = e.target.files && e.target.files[0]; if(f) importGamesFromFile(f); e.target.value = ''; });

  if(closeModal && winnerModal){
    closeModal.addEventListener('click', ()=>{ winnerModal.classList.remove('open'); winnerModal.style.display = 'none'; winnerModal.setAttribute('aria-hidden','true'); });
    winnerModal.addEventListener('click', (e)=>{ if(e.target === winnerModal){ winnerModal.classList.remove('open'); winnerModal.style.display = 'none'; winnerModal.setAttribute('aria-hidden','true'); } });
    document.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && winnerModal.classList.contains('open')){ winnerModal.classList.remove('open'); winnerModal.style.display = 'none'; winnerModal.setAttribute('aria-hidden','true'); } });
  }

  // initial
  renderList(); resizeCanvas();

})();
