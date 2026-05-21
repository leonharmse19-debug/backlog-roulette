// Backlog Roulette - wheel drawing, spin animation, and UI bindings
(function(){
	const defaults = ['Witcher 3','Cyberpunk','Hades','Hollow Knight','Elden Ring','Stardew Valley'];
	// Load saved games from localStorage if available, otherwise use defaults
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
	const ctx = canvas.getContext('2d');
	const spinBtn = document.getElementById('spin');
	const addForm = document.getElementById('add-form');
	const input = document.getElementById('game-input');
	const gameList = document.getElementById('game-list');
	const winnerModal = document.getElementById('winnerModal');
	const winnerTitle = document.getElementById('winnerTitle');
	const winnerImage = document.getElementById('winnerImage');
	const closeModal = document.getElementById('closeModal');

	// visual palette (alternating)
	const palette = [
		'#8a2be2',
		'#00e6d8',
		'#5b2fa6',
		'#00b3a0'
	];

	let rotation = 0; // radians
	let angularVelocity = 0; // radians/sec
	let animId = null;
	let lastTime = 0;

	function resizeCanvas(){
		const dpr = window.devicePixelRatio || 1;
		const rect = canvas.getBoundingClientRect();
		canvas.width = Math.max(1, Math.floor(rect.width * dpr));
		canvas.height = Math.max(1, Math.floor(rect.width * dpr));
		ctx.setTransform(dpr,0,0,dpr,0,0);
		draw();
	}

	function draw(){
		if(!ctx) return;
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

			// fill
			ctx.beginPath();
			ctx.moveTo(0,0);
			ctx.arc(0,0,radius,start,end);
			ctx.closePath();
			const color = palette[i % palette.length];
			// subtle gradient for neon feel
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

			// slice border
			ctx.strokeStyle = 'rgba(0,0,0,0.45)';
			ctx.lineWidth = 1;
			ctx.stroke();

			// label
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

		// pointer (top)
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
		const dt = Math.min(0.05, (ts - lastTime)/1000); // cap delta
		lastTime = ts;

		// improved friction model: steady exponential decay, stop when slow enough
		if(Math.abs(angularVelocity) > 0.02){
			rotation += angularVelocity * dt;
			// slightly stronger decay for a satisfying stop
			angularVelocity *= Math.pow(0.985, dt*60);
		} else {
			// when slow, stop cleanly and determine the winner from final rotation
			rotation += angularVelocity * dt; // final nudge
			angularVelocity = 0;
			cancelAnimationFrame(animId);
			animId = null;
			const winner = computeWinner();
			if(winner != null) announceWinner(winner);
			return;
		}

		draw();
		animId = requestAnimationFrame(animate);
	}

	function computeWinner(){
		if(games.length === 0) return null;
		const n = games.length;
		const slice = Math.PI*2 / n;
		// The canvas pointer sits at the top-center. In canvas coordinates that angle is 270deg (3*PI/2).
		const pointerCanvasAngle = 1.5 * Math.PI; // 3 * PI / 2
		// Convert the canvas pointer angle into wheel-local angle by subtracting the wheel rotation
		let wheelAngle = pointerCanvasAngle - rotation;
		// Normalize to [0, 2PI)
		wheelAngle = ((wheelAngle % (Math.PI*2)) + Math.PI*2) % (Math.PI*2);
		const index = Math.floor(wheelAngle / slice) % n;
		return games[index];
	}

	function announceWinner(name){
		if(!winnerModal) return;
		winnerTitle.textContent = name || '—';
		// use placehold.co to create a reliable dark-themed banner with the game's name
		const label = encodeURIComponent(name || 'Winner');
		// 640x360 dark background (#1a1a2e) with white text
		winnerImage.src = `https://placehold.co/640x360/1a1a2e/ffffff?text=${label}`;
		winnerImage.alt = name || 'Winner';
		// show modal
		winnerModal.classList.add('open');
		winnerModal.style.display = 'flex';
		winnerModal.setAttribute('aria-hidden','false');
		// focus close button for keyboard users
		if(closeModal) closeModal.focus();
		const content = winnerModal.querySelector('.modal-content');
		if(content) content.animate([
			{ transform: 'translateY(8px)', opacity: 0 },
			{ transform: 'translateY(0)', opacity: 1 }
		], { duration: 360, easing: 'cubic-bezier(.2,.9,.2,1)' });
	}

	function spin(){
		if(animId) return; // already spinning
		if(games.length === 0) return;
		// random initial velocity (radians/sec)
		const min = 8; // lower bound
		const max = 14; // upper bound
		angularVelocity = (Math.random() * (max - min) + min) * (Math.random() > 0.5 ? 1 : -1);
		lastTime = 0;
		animId = requestAnimationFrame(animate);
	}

	function addGame(title){
		const t = (title||'').trim();
		if(!t) return;
		games.push(t);
		renderList();
		draw();
		input.value = '';
		input.focus();
		// persist new game
		saveGames();
	}

	function renderList(){
		gameList.innerHTML = '';
		games.forEach((g,i)=>{
			const li = document.createElement('li');
			li.textContent = g;
			const remove = document.createElement('button');
			remove.textContent = '✕';
			remove.title = 'Remove';
			remove.style.marginLeft = '8px';
			remove.addEventListener('click', ()=>{
				games.splice(i,1);
				renderList();
				draw();
				// persist removal
				saveGames();
			});
			li.appendChild(remove);
			gameList.appendChild(li);
		});
	}

	// persist games array to localStorage
	function saveGames(){
		try{
			localStorage.setItem('backlogGames', JSON.stringify(games));
		}catch(e){
			// ignore storage errors (e.g., quota or disabled)
		}
	}

	// export games as JSON file for cross-PC transfer
	function exportGames(){
		try{
			const data = JSON.stringify(games, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = 'backlog-games.json';
			document.body.appendChild(a);
			a.click();
			a.remove();
			URL.revokeObjectURL(url);
		} catch(e){
			console.warn('Export failed', e);
		}
	}

	// import games from a JSON file (replaces current list)
	function importGamesFromFile(file){
		if(!file) return;
		const reader = new FileReader();
		reader.onload = function(e){
			try{
				const parsed = JSON.parse(String(e.target.result));
				if(Array.isArray(parsed)){
					games = parsed.slice();
					saveGames();
					renderList();
					draw();
				} else {
					alert('Invalid file format: expected a JSON array of game titles.');
				}
			} catch(err){
				alert('Failed to read file: ' + (err && err.message ? err.message : 'unknown'));
			}
		};
		reader.readAsText(file);
	}

	// helpers
	function wrapText(ctx, text, x, y, maxWidth, lineHeight){
		const words = text.split(/\s+/);
		let line = '';
		let yOffset = 0;
		for(let n=0;n<words.length;n++){
			const testLine = line + (line ? ' ' : '') + words[n];
			const metrics = ctx.measureText(testLine);
			if(metrics.width > maxWidth && n>0){
				ctx.fillText(line, x, y + yOffset);
				line = words[n];
				yOffset += lineHeight;
			} else {
				line = testLine;
			}
		}
		ctx.fillText(line, x, y + yOffset);
	}

	// tiny color shading helper
	function shadeColor(hex, percent){
		const c = hex.replace('#','');
		const num = parseInt(c,16);
		let r = (num >> 16) + percent;
		let g = ((num >> 8) & 0x00FF) + percent;
		let b = (num & 0x0000FF) + percent;
		r = Math.max(Math.min(255,r),0);
		g = Math.max(Math.min(255,g),0);
		b = Math.max(Math.min(255,b),0);
		return '#'+( (r<<16) | (g<<8) | b ).toString(16).padStart(6,'0');
	}

	// bindings
	window.addEventListener('resize', resizeCanvas);
	addForm.addEventListener('submit', (e)=>{
		e.preventDefault();
		addGame(input.value);
	});
	spinBtn.addEventListener('click', spin);

	// export/import bindings
	const exportBtn = document.getElementById('export-games');
	const importBtn = document.getElementById('import-games');
	const importFile = document.getElementById('import-file');
	if(exportBtn) exportBtn.addEventListener('click', exportGames);
	if(importBtn && importFile) importBtn.addEventListener('click', ()=> importFile.click());
	if(importFile) importFile.addEventListener('change', (e)=>{
		const f = e.target.files && e.target.files[0];
		if(f) importGamesFromFile(f);
		// reset input so the same file can be reselected later
		e.target.value = '';
	});

	// modal close behavior
	if(closeModal && winnerModal){
		closeModal.addEventListener('click', ()=>{
			winnerModal.classList.remove('open');
			winnerModal.style.display = 'none';
			winnerModal.setAttribute('aria-hidden','true');
		});
		// close when clicking outside content
		winnerModal.addEventListener('click', (e)=>{
			if(e.target === winnerModal){
				winnerModal.classList.remove('open');
				winnerModal.style.display = 'none';
				winnerModal.setAttribute('aria-hidden','true');
			}
		});
		// close on Escape
		document.addEventListener('keydown', (e)=>{
			if(e.key === 'Escape' && winnerModal.classList.contains('open')){
				winnerModal.classList.remove('open');
				winnerModal.style.display = 'none';
				winnerModal.setAttribute('aria-hidden','true');
			}
		});
	}

	// initial render
	renderList();
	resizeCanvas();
	// modal starts hidden (aria-hidden already set in markup)

})();

