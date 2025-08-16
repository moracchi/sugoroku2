// ゲーム状態管理
class SugorokuGame {
    constructor() {
        // プレイヤーデータ構造に統計情報を追加
        this.players = [
            { name: 'けんちゃん', color: '#4285F4', position: 0, id: 'ken', avatar: 'け', ...this.getInitialStats() },
            { name: 'パパ', color: '#EA4335', position: 0, id: 'papa', avatar: 'パ', ...this.getInitialStats() },
            { name: 'ママ', color: '#34A853', position: 0, id: 'mama', avatar: 'マ', ...this.getInitialStats() }
        ];
        
        this.boardSize = 36;
        this.currentPlayerIndex = 0;
        this.gameStarted = false;
        this.gameEnded = false;
        this.turnNumber = 0;
        this.isProcessing = false; // アクション中の多重操作防止フラグ
        
        this.mysteryBoxPositions = [4, 8, 13, 16, 19, 22, 25, 27, 29, 31, 33, 35];
        this.gimmickSquares = {
            5: { name: 'ロケットダッシュ', effect: '+3', sound: 'rocket' },
            7: { name: '忘れ物', effect: '-2', sound: 'sad' },
            11: { name: 'ラッキーセブン', effect: 'extra_turn', sound: 'lucky' },
            12: { name: '運命の分かれ道', effect: 'random_big', sound: 'fortune' },
            14: { name: 'お昼寝タイム', effect: 'skip', sound: 'sleep' },
            17: { name: '追い風', effect: '+2', sound: 'wind' },
            20: { name: '場所交換', effect: 'swap', sound: 'swap' },
            23: { name: '爆弾', effect: '-3', sound: 'bomb' },
            26: { name: 'お小遣いゲット', effect: '+1', sound: 'money' },
            30: { name: 'ブラックホール', effect: 'start', sound: 'blackhole' },
            32: { name: '大嵐', effect: 'all_back', sound: 'storm' }
        };
        
        this.mysteryBoxEffects = [
            { name: 'ロケット！5マス進む', value: '+5', sound: 'rocket' },
            { name: '悲劇…スタートに戻る', value: 'start', sound: 'returnStart' },
            { name: '全員から1マス吸収', value: 'steal_steps', sound: 'lucky' },
            { name: '最下位と場所を交換', value: 'swap_last', sound: 'swap' },
            { name: 'ひとやすみ。1回休み', value: 'skip_1', sound: 'sleep' },
            { name: 'もう一度サイコロ！', value: 'extra_turn', sound: 'fortune' }
        ];
        
        this.audioEnabled = { bgm: true, se: true };
        this.volume = 0.5;
        this.isReachState = false;
        
        this.init();
    }
    
    getInitialStats() {
        return {
            totalRolls: 0, totalValue: 0, skips: 0, doubleNext: false,
            sixesRolled: 0, mysteriesOpened: 0, gimmicksHit: 0
        };
    }
    
    init() {
        this.createBoard();
        this.setupEventListeners();
        this.setupAudio();
        this.updateUI();
    }
    
    createBoard() {
        const container = document.getElementById('squaresContainer');
        container.innerHTML = '';
        
        for (let i = 0; i <= this.boardSize; i++) {
            const square = document.createElement('div');
            square.className = 'square';
            square.dataset.position = i;
            
            if (i === 0) {
                square.classList.add('start');
                square.innerHTML = '<div class="square-number">スタート</div>';
            } else if (i === this.boardSize) {
                square.classList.add('goal');
                square.innerHTML = '<div class="square-number">ゴール</div>';
            } else {
                square.innerHTML = `<div class="square-number">${i}</div>`;
                if (this.mysteryBoxPositions.includes(i)) {
                    square.classList.add('mystery');
                    square.innerHTML += '<div class="square-title">ミステリー</div>';
                } else if (this.gimmickSquares[i]) {
                    square.classList.add('gimmick');
                    square.innerHTML += `<div class="square-title">${this.gimmickSquares[i].name}</div>`;
                }
            }
            container.appendChild(square);
        }
        this.updatePlayerPieces();
    }
    
    updatePlayerPieces() {
        document.querySelectorAll('.player-piece, .player-pieces-multiple').forEach(el => el.remove());
        
        const squareGroups = {};
        this.players.forEach(player => {
            if (!squareGroups[player.position]) squareGroups[player.position] = [];
            squareGroups[player.position].push(player);
        });
        
        Object.entries(squareGroups).forEach(([position, playersInSquare]) => {
            const square = document.querySelector(`[data-position="${position}"]`);
            if (!square) return;
            
            const createPiece = (player) => {
                const piece = document.createElement('div');
                piece.className = `player-piece ${player.id}`;
                piece.style.backgroundColor = player.color;
                piece.textContent = player.avatar;
                return piece;
            };

            if (playersInSquare.length === 1) {
                square.appendChild(createPiece(playersInSquare[0]));
            } else {
                const multiContainer = document.createElement('div');
                multiContainer.className = 'player-pieces-multiple';
                playersInSquare.forEach(player => multiContainer.appendChild(createPiece(player)));
                square.appendChild(multiContainer);
            }
        });
    }
    
    setupEventListeners() {
        document.getElementById('startBtn').addEventListener('click', () => this.startGame());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('rollDiceBtn').addEventListener('click', () => this.rollDice());
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettingsBtn').addEventListener('click', () => this.closeSettings());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('applyMysteryBtn').addEventListener('click', () => this.applyMysteryEffect());
        
        document.getElementById('bgmToggle').addEventListener('change', (e) => { this.audioEnabled.bgm = e.target.checked; this.updateBGM(); });
        document.getElementById('seToggle').addEventListener('change', (e) => { this.audioEnabled.se = e.target.checked; });
        document.getElementById('volumeSlider').addEventListener('input', (e) => { this.volume = e.target.value / 100; this.updateVolume(); });
        
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'Space' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            
            const mysteryModal = document.getElementById('mysteryBoxModal');
            if (!mysteryModal.classList.contains('hidden') && document.getElementById('mysteryResult').style.display !== 'none') {
                if (this.isProcessing) return;
                document.getElementById('applyMysteryBtn').click(); return;
            }
            const winModal = document.getElementById('winModal');
            if (!winModal.classList.contains('hidden')) {
                document.getElementById('playAgainBtn').click(); return;
            }
            const settingsModal = document.getElementById('settingsModal');
            if (!settingsModal.classList.contains('hidden')) {
                document.getElementById('closeSettingsBtn').click(); return;
            }
            const rollDiceBtn = document.getElementById('rollDiceBtn');
            if (!rollDiceBtn.disabled) {
                 if (this.isProcessing) return;
                 rollDiceBtn.click();
            }
        });
    }
    
    setupAudio() {
        this.bgm1 = document.getElementById('bgm1');
        this.bgm2 = document.getElementById('bgm2');
        this.currentBGM = null;
        const audioIds = ["normalRoll", "highRoll", "lowRoll", "criticalHit", "move", "collision", "returnStart", "mysteryBox", "rocket", "sad", "lucky", "sleep", "wind", "swap", "bomb", "money", "blackhole", "storm", "fortune", "tragedy", "win", "firework", "anticipation", "doubleBonus", "reach"];
        this.sounds = {};
        audioIds.forEach(id => this.sounds[id] = document.getElementById(id));
        this.updateVolume();
    }
    
    updateVolume() {
        if (this.bgm1) this.bgm1.volume = this.volume * 0.3;
        if (this.bgm2) this.bgm2.volume = this.volume * 0.3;
        Object.values(this.sounds).forEach(sound => sound.volume = this.volume);
    }
    
    updateBGM(forceMusic = null) {
        if (this.currentBGM) { this.currentBGM.pause(); this.currentBGM = null; }
        if (!this.audioEnabled.bgm || !this.gameStarted || this.gameEnded) {
            document.getElementById('bgmStatus').textContent = '停止中';
            return;
        }

        let bgm = forceMusic;
        let statusText = '通常';
        if (!bgm) {
            const isEndGame = this.players.some(player => player.position >= this.boardSize - 10);
            bgm = (this.isReachState || isEndGame) ? this.bgm2 : this.bgm1;
            statusText = (this.isReachState || isEndGame) ? '終盤' : '通常';
        } else {
             statusText = 'リーチ';
        }
        
        bgm.currentTime = 0;
        bgm.play().catch(e => console.log('BGM再生エラー:', e));
        this.currentBGM = bgm;
        document.getElementById('bgmStatus').textContent = statusText;
    }
    
    playSound(soundName) {
        if (!this.audioEnabled.se || !this.sounds[soundName]) return;
        this.sounds[soundName].currentTime = 0;
        this.sounds[soundName].play().catch(e => console.log(`効果音[${soundName}]再生エラー:`, e));
    }
    
    startGame() {
        this.gameStarted = true;
        this.turnNumber = 1;
        document.getElementById('startBtn').style.display = 'none';
        document.getElementById('resetBtn').style.display = 'inline-block';
        document.getElementById('rollDiceBtn').disabled = false;
        this.updateBGM();
        this.updateUI();
        this.addLog('ゲームが始まりました！けんちゃんからスタートです。', 'important');
    }
    
    resetGame() {
        this.gameStarted = false; this.gameEnded = false; this.isProcessing = false;
        this.currentPlayerIndex = 0; this.turnNumber = 0;
        this.players.forEach(p => Object.assign(p, { position: 0, ...this.getInitialStats() }));
        
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('resetBtn').style.display = 'none';
        document.getElementById('rollDiceBtn').disabled = true;
        document.getElementById('diceResult').style.display = 'none';
        
        ['winModal', 'mysteryBoxModal', 'settingsModal'].forEach(id => document.getElementById(id).classList.add('hidden'));
        
        if (this.currentBGM) { this.currentBGM.pause(); this.currentBGM = null; }
        
        this.updatePlayerPieces(); this.updateUI(); this.clearLog(); this.addLog('ゲーム開始を待っています...');
    }
    
    async rollDice() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        document.getElementById('rollDiceBtn').disabled = true;
        
        const currentPlayer = this.players[this.currentPlayerIndex];
        if (currentPlayer.skips > 0) {
            currentPlayer.skips--; this.playSound('sleep');
            this.addLog(`${currentPlayer.name}は1回休みです。`);
            this.nextTurn(); return;
        }
        
        const dice = document.getElementById('diceCube');
        dice.classList.add('rolling');
        this.playSound('anticipation');
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        dice.classList.remove('rolling');
        
        let baseDiceValue = Math.floor(Math.random() * 6) + 1;
        this.setDiceFace(baseDiceValue);

        let finalDiceValue = baseDiceValue;
        
        currentPlayer.totalRolls++; currentPlayer.totalValue += baseDiceValue;
        if(baseDiceValue === 6) currentPlayer.sixesRolled++;
        
        if (baseDiceValue === 6) { this.playSound('criticalHit'); } 
        else if (baseDiceValue >= 4) { this.playSound('highRoll'); } 
        else { this.playSound('lowRoll'); }
        
        this.addLog(`${currentPlayer.name}が${baseDiceValue}を出しました！`);
        
        if (currentPlayer.doubleNext) { finalDiceValue *= 2; currentPlayer.doubleNext = false; this.addLog(`サイコロ2倍適用！最終値: ${finalDiceValue}`, 'important'); this.playSound('doubleBonus'); }
        
        document.getElementById('diceValue').textContent = finalDiceValue;
        document.getElementById('diceResult').style.display = 'block';

        this.showPrediction(currentPlayer.position, finalDiceValue);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        document.getElementById('prediction-highlight').classList.add('hidden');
        await this.movePlayer(currentPlayer, finalDiceValue);
    }

    setDiceFace(value) {
        const cube = document.getElementById('diceCube');
        const rotations = {
            1: 'rotateX(0deg) rotateY(0deg)',
            2: 'rotateX(0deg) rotateY(-90deg)',
            3: 'rotateX(90deg) rotateY(0deg)',
            4: 'rotateX(-90deg) rotateY(0deg)',
            5: 'rotateX(0deg) rotateY(90deg)',
            6: 'rotateX(180deg) rotateY(0deg)',
        };
        cube.style.transform = `translateZ(-50px) ${rotations[value]}`;
    }

    showPrediction(startPos, steps) {
        const targetPos = Math.min(this.boardSize, startPos + steps);
        const targetSquare = document.querySelector(`.square[data-position="${targetPos}"]`);
        if (!targetSquare) return;
        
        const highlight = document.getElementById('prediction-highlight');
        highlight.style.width = `${targetSquare.offsetWidth}px`;
        highlight.style.height = `${targetSquare.offsetHeight}px`;
        highlight.style.left = `${targetSquare.offsetLeft}px`;
        highlight.style.top = `${targetSquare.offsetTop}px`;
        highlight.classList.remove('hidden');
    }
    
    async movePlayer(player, steps) {
        const originalPosition = player.position;
        const newPosition = Math.min(this.boardSize, originalPosition + steps);
        
        for (let i = originalPosition + 1; i <= newPosition; i++) {
            player.position = i;
            this.playSound('move');
            const piece = document.querySelector(`.player-piece.${player.id}`);
            if(piece) piece.classList.add('moving');
            this.updatePlayerPieces();
            await new Promise(resolve => setTimeout(resolve, 200));
            if(piece) piece.classList.remove('moving');
        }
        
        this.addLog(`${player.name}が${newPosition}に移動しました。`);
        this.updateUI();
        await this.checkSquareEvents(player);
    }

    async checkSquareEvents(player) {
        const pos = player.position;
        if (pos === this.boardSize) { this.endGame(player); return; }
        
        const playersInSameSquare = this.players.filter(p => p.position === pos && p !== player);
        if (playersInSameSquare.length > 0) { await this.handleCollision(pos); return; }
        
        if (this.gimmickSquares[pos]) { player.gimmicksHit++; await this.handleGimmick(player, pos); return; }
        if (this.mysteryBoxPositions.includes(pos)) { player.mysteriesOpened++; this.openMysteryBox(player); return; }
        
        this.nextTurn();
    }
    
    async handleCollision(position) {
        const playersInSquare = this.players.filter(p => p.position === position);
        this.playSound('collision'); this.showCollisionEffect(position);
        
        const shuffled = [...playersInSquare].sort(() => 0.5 - Math.random());
        const winner = shuffled[0];
        const losers = shuffled.slice(1);
        
        this.addLog(`${position}マスで衝突発生！ ${winner.name}が残り、他はスタートへ！`, 'important');
        
        for (const loser of losers) {
            loser.position = 0;
            this.playSound('returnStart');
            await new Promise(r => setTimeout(r, 500));
        }
        this.updatePlayerPieces();
        this.nextTurn();
    }
    
    showCollisionEffect(position) {
        const square = document.querySelector(`[data-position="${position}"]`);
        const effects = document.getElementById('collisionEffects');
        const explosion = effects.querySelector('.explosion');
        if (!square || !explosion) return;
        
        const rect = square.getBoundingClientRect();
        explosion.style.left = `${rect.left + rect.width / 2 - 50}px`;
        explosion.style.top = `${rect.top + rect.height / 2 - 50}px`;
        effects.classList.add('active'); explosion.classList.add('active');
        setTimeout(() => { effects.classList.remove('active'); explosion.classList.remove('active'); }, 800);
    }
    
    async handleGimmick(player, position) {
        const gimmick = this.gimmickSquares[position];
        this.playSound(gimmick.sound);
        this.addLog(`${player.name}が「${gimmick.name}」マスに！`, 'important');
        
        let shouldContinueTurn = false;
        switch (gimmick.effect) {
            case 'extra_turn':
                this.addLog(`${player.name}はもう一度サイコロを振れます！`);
                this.isProcessing = false;
                document.getElementById('rollDiceBtn').disabled = false;
                return;
            case 'skip': player.skips++; this.addLog(`${player.name}は次回1回休み。`); break;
            case 'swap': await this.swapPlayerPositions(player); break;
            case 'start': player.position = 0; this.addLog(`${player.name}はスタートへ。`); break;
            case 'all_back':
                this.players.forEach(p => { if (p.position > 0) p.position = Math.max(0, p.position - 1); });
                this.addLog('全員が1マス後退！'); break;
            case 'random_big':
                await this.movePlayerByEffect(player, Math.random() < 0.5 ? 3 : -3);
                shouldContinueTurn = true; break;
            default:
                await this.movePlayerByEffect(player, parseInt(gimmick.effect));
                shouldContinueTurn = true; break;
        }
        
        this.updatePlayerPieces();
        if (this.gameEnded) return;

        if (shouldContinueTurn) await this.checkSquareEvents(player);
        else this.nextTurn();
    }
    
    async swapPlayerPositions(currentPlayer) {
        const others = this.players.filter(p => p !== currentPlayer);
        if (others.length === 0) return;
        const target = others[Math.floor(Math.random() * others.length)];
        [currentPlayer.position, target.position] = [target.position, currentPlayer.position];
        this.addLog(`${currentPlayer.name}と${target.name}の位置が交換！`);
    }
    
    async movePlayerByEffect(player, steps) {
        const oldPos = player.position;
        const newPos = Math.max(0, Math.min(this.boardSize, oldPos + steps));
        this.addLog(`${player.name}が${Math.abs(steps)}マス${steps > 0 ? '進む' : '戻る'}！`);
        
        let path = Array.from({length: Math.abs(newPos-oldPos)}, (_, k) => oldPos + (k+1)*Math.sign(newPos-oldPos));
        for (const pos of path) {
            player.position = pos;
            this.updatePlayerPieces();
            await new Promise(r => setTimeout(r, 200));
        }
        if (player.position === this.boardSize) this.endGame(player);
    }
    
    openMysteryBox(player) {
        this.isProcessing = true;
        this.playSound('mysteryBox'); this.addLog(`${player.name}がミステリーボックスを発見！`, 'important');
        
        const modal = document.getElementById('mysteryBoxModal');
        const roulette = document.getElementById('roulette');
        const resultEl = document.getElementById('mysteryResult');
        
        resultEl.style.display = 'none';
        roulette.style.transition = 'none';
        roulette.style.transform = 'rotate(0deg)';
        modal.classList.remove('hidden');
        
        setTimeout(() => {
            roulette.style.transition = 'transform 3s ease-out';
            const finalRotation = (5 + Math.random() * 5) * 360 + Math.random() * 360;
            roulette.style.transform = `rotate(${finalRotation}deg)`;
            
            setTimeout(() => {
                const effectIndex = Math.floor((finalRotation % 360) / 60);
                const effect = this.mysteryBoxEffects[effectIndex];
                document.getElementById('mysteryEffectText').textContent = effect.name;
                resultEl.style.display = 'block';
                this.currentMysteryEffect = { player, effect };
                this.isProcessing = false;
            }, 3000);
        }, 100);
    }
    
    async applyMysteryEffect() {
        if (!this.currentMysteryEffect || this.isProcessing) return;
        this.isProcessing = true;

        const { player, effect } = this.currentMysteryEffect;
        document.getElementById('mysteryBoxModal').classList.add('hidden');
        
        this.playSound(effect.sound);
        this.addLog(`ミステリー効果: ${effect.name}！`, 'important');

        let shouldContinueTurn = false;
        switch (effect.value) {
            case '+5':
                await this.movePlayerByEffect(player, 5);
                shouldContinueTurn = true;
                break;
            case 'start':
                player.position = 0;
                break;
            case 'steal_steps':
                let stolenSteps = 0;
                this.players.forEach(p => { if (p !== player && p.position > 0) { p.position--; stolenSteps++; } });
                if(stolenSteps > 0) this.addLog(`他のプレイヤーから合計${stolenSteps}マスを吸収！`);
                await this.movePlayerByEffect(player, stolenSteps);
                shouldContinueTurn = true;
                break;
            case 'swap_last':
                const otherPlayers = this.players.filter(p => p !== player);
                if (otherPlayers.length > 0) {
                    const lastPlayer = otherPlayers.sort((a, b) => a.position - b.position)[0];
                    if (lastPlayer.position < player.position) {
                        this.addLog(`最下位の${lastPlayer.name}と場所を交換！`);
                        [player.position, lastPlayer.position] = [lastPlayer.position, player.position];
                    } else {
                        this.addLog('自分が最下位なので何も起きなかった！');
                    }
                }
                break;
            case 'skip_1':
                player.skips = 1;
                this.addLog(`${player.name}は次回1回休み。`);
                break;
            case 'extra_turn':
                this.addLog(`${player.name}はもう一度サイコロを振れます！`);
                this.isProcessing = false;
                document.getElementById('rollDiceBtn').disabled = false;
                return;
        }
        
        this.updatePlayerPieces();
        if (this.gameEnded) return;
        
        if (shouldContinueTurn) await this.checkSquareEvents(player);
        else this.nextTurn();
    }
    
    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
        if (this.currentPlayerIndex === 0) this.turnNumber++;
        
        document.getElementById('rollDiceBtn').disabled = false;
        document.getElementById('diceResult').style.display = 'none';
        this.isProcessing = false;
        this.updateUI();
        this.checkReach();
    }
    
    checkReach() {
        const currentPlayer = this.players[this.currentPlayerIndex];
        const isPlayerInReach = currentPlayer.position > this.boardSize - 7;
        
        if (isPlayerInReach && !this.isReachState) {
            this.isReachState = true;
            this.addLog(`${currentPlayer.name}がゴールまであと少し！リーチ！`, 'important');
            this.playSound('reach');
            this.updateBGM(this.bgm2);
        } else if (!this.players.some(p => p.position > this.boardSize - 7)) {
            this.isReachState = false;
        }
        
        this.players.forEach(player => {
             const card = document.getElementById(`player-${player.id}`);
             card.classList.toggle('reach', player.position > this.boardSize - 7);
        });
    }
    
    endGame(winner) {
        if (this.gameEnded) return;
        this.gameEnded = true; this.isProcessing = true;
        this.playSound('win'); this.playSound('firework');
        if (this.currentBGM) this.currentBGM.pause();
        this.addLog(`${winner.name}がゴール！勝利です！🎉`, 'important');
        
        const modal = document.getElementById('winModal');
        document.getElementById('winnerAvatar').style.backgroundColor = winner.color;
        document.getElementById('winnerAvatar').textContent = winner.avatar;
        document.getElementById('winnerName').textContent = winner.name;
        
        let statsHTML = '<h4>ゲーム統計</h4><div class="final-stats-grid">';
        this.players.forEach(p => {
            const avg = p.totalRolls > 0 ? (p.totalValue / p.totalRolls).toFixed(1) : '0';
            statsHTML += `
                <div style="color:${p.color}; grid-column: 1 / -1; font-weight: bold; margin-top: 8px;">${p.name}</div>
                <div class="stat-label">平均の出目</div><div class="stat-value">${avg}</div>
                <div class="stat-label">6が出た回数</div><div class="stat-value">${p.sixesRolled}回</div>
                <div class="stat-label">ギミックマス</div><div class="stat-value">${p.gimmicksHit}回</div>
                <div class="stat-label">ミステリーマス</div><div class="stat-value">${p.mysteriesOpened}回</div>
            `;
        });
        statsHTML += `<div style="grid-column: 1 / -1; border-top: 1px solid var(--color-border); margin-top: 8px; padding-top: 8px;"></div>
        <div class="stat-label">総ターン数</div><div class="stat-value">${this.turnNumber}</div>`;
        statsHTML += '</div>';
        document.getElementById('finalStats').innerHTML = statsHTML;
        
        modal.classList.remove('hidden');
        document.getElementById('rollDiceBtn').disabled = true;
    }
    
    updateUI() {
        document.getElementById('turnNumber').textContent = this.turnNumber;
        document.getElementById('currentPlayer').textContent = this.gameStarted ? this.players[this.currentPlayerIndex].name : '-';
        
        this.players.forEach((player, index) => {
            const card = document.getElementById(`player-${player.id}`);
            if (!card) return;
            card.classList.toggle('active', index === this.currentPlayerIndex && this.gameStarted && !this.gameEnded);
            const avg = player.totalRolls > 0 ? (player.totalValue / player.totalRolls).toFixed(1) : '0';
            card.querySelector('.position').textContent = player.position;
            card.querySelector('.average').textContent = avg;
        });
    }
    
    addLog(message, type = 'normal') {
        const logContainer = document.getElementById('logContainer');
        const entry = document.createElement('p');
        const timestamp = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.className = `log-entry ${type} new`;
        entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${message}`;
        
        const isScrolledToBottom = logContainer.scrollHeight - logContainer.clientHeight <= logContainer.scrollTop + 1;
        logContainer.appendChild(entry);
        if (isScrolledToBottom) logContainer.scrollTop = logContainer.scrollHeight;
        
        setTimeout(() => entry.classList.remove('new'), 3000);
        if (logContainer.children.length > 50) logContainer.removeChild(logContainer.firstChild);
    }
    
    clearLog() { document.getElementById('logContainer').innerHTML = ''; }
    openSettings() { document.getElementById('settingsModal').classList.remove('hidden'); }
    closeSettings() { document.getElementById('settingsModal').classList.add('hidden'); }
}

document.addEventListener('DOMContentLoaded', () => { window.sugorokuGame = new SugorokuGame(); });
window.addEventListener('error', (e) => { console.error('Unhandled Game Error:', e.message, e.filename, e.lineno); });