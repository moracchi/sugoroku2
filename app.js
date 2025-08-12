// ゲーム状態管理
class SugorokuGame {
    constructor() {
        this.players = [
            { name: 'けんちゃん', color: '#4285F4', position: 0, id: 'ken', avatar: 'け', totalRolls: 0, totalValue: 0, skips: 0, doubleNext: false },
            { name: 'パパ', color: '#EA4335', position: 0, id: 'papa', avatar: 'パ', totalRolls: 0, totalValue: 0, skips: 0, doubleNext: false },
            { name: 'ママ', color: '#34A853', position: 0, id: 'mama', avatar: 'マ', totalRolls: 0, totalValue: 0, skips: 0, doubleNext: false }
        ];
        
        this.boardSize = 36;
        this.currentPlayerIndex = 0;
        this.gameStarted = false;
        this.gameEnded = false;
        this.turnNumber = 0;
        this.consecutiveHighRolls = 0;
        this.currentMysteryEffect = null;
        this.isProcessing = false;
        this.isEndGameBgmActive = false; // BGM切り替えフラグ
        
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
        
        this.init();
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
                if (this.isProcessing) return; // ルーレット回転中は無視
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
                 if (this.isProcessing) return; // 処理中は無視
                 rollDiceBtn.click();
            }
        });
    }
    
    setupAudio() {
        this.bgm1 = document.getElementById('bgm1');
        this.bgm2 = document.getElementById('bgm2');
        this.currentBGM = null;
        this.sounds = Object.fromEntries([...document.querySelectorAll('audio[id^="normalRoll"], audio[id^="highRoll"], audio[id^="lowRoll"], audio[id^="criticalHit"], audio[id^="move"], audio[id^="collision"], audio[id^="returnStart"], audio[id^="mysteryBox"], audio[id^="rocket"], audio[id^="sad"], audio[id^="lucky"], audio[id^="sleep"], audio[id^="wind"], audio[id^="swap"], audio[id^="bomb"], audio[id^="money"], audio[id^="blackhole"], audio[id^="storm"], audio[id^="fortune"], audio[id^="tragedy"], audio[id^="win"], audio[id^="firework"], audio[id^="anticipation"], audio[id^="doubleBonus"]')].map(audio => [audio.id, audio]));
        this.updateVolume();
    }
    
    updateVolume() {
        if (this.bgm1) this.bgm1.volume = this.volume * 0.3;
        if (this.bgm2) this.bgm2.volume = this.volume * 0.3;
        Object.values(this.sounds).forEach(sound => sound.volume = this.volume);
    }
    
    updateBGM() {
        if (!this.audioEnabled.bgm || !this.gameStarted || this.gameEnded) {
            this.currentBGM?.pause();
            this.currentBGM = null;
            document.getElementById('bgmStatus').textContent = '停止中';
            return;
        }

        if (!this.isEndGameBgmActive && this.players.some(p => p.position >= 30)) {
            this.isEndGameBgmActive = true;
        }

        const targetBgm = this.isEndGameBgmActive ? this.bgm2 : this.bgm1;

        if (this.currentBGM !== targetBgm) {
            this.currentBGM?.pause();
            this.currentBGM = targetBgm;
            this.currentBGM.currentTime = 0;
            this.currentBGM.play().catch(e => console.log('BGM再生エラー:', e));
        } else if (this.currentBGM && this.currentBGM.paused) {
            this.currentBGM.play().catch(e => console.log('BGM再生エラー:', e));
        }
        
        document.getElementById('bgmStatus').textContent = this.isEndGameBgmActive ? '終盤' : '通常';
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
        this.isEndGameBgmActive = false; // BGMフラグをリセット
        this.currentPlayerIndex = 0; this.turnNumber = 0; this.consecutiveHighRolls = 0;
        this.players.forEach(p => { p.position = 0; p.totalRolls = 0; p.totalValue = 0; p.skips = 0; p.doubleNext = false; });
        
        document.getElementById('startBtn').style.display = 'inline-block';
        document.getElementById('resetBtn').style.display = 'none';
        document.getElementById('rollDiceBtn').disabled = true;
        document.getElementById('diceResult').style.display = 'none';
        
        ['winModal', 'mysteryBoxModal', 'settingsModal'].forEach(id => document.getElementById(id).classList.add('hidden'));
        
        this.currentBGM?.pause();
        this.currentBGM = null;
        document.getElementById('bgmStatus').textContent = '停止中';
        
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
        
        const dice = document.getElementById('dice');
        dice.classList.add('rolling');
        this.playSound('anticipation');
        const rollAnimation = setInterval(() => { dice.querySelector('.dice-face').textContent = Math.floor(Math.random() * 6) + 1; }, 100);
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        clearInterval(rollAnimation);
        dice.classList.remove('rolling');
        
        let baseDiceValue = Math.floor(Math.random() * 6) + 1;
        let finalDiceValue = baseDiceValue;
        dice.querySelector('.dice-face').textContent = baseDiceValue;
        
        currentPlayer.totalRolls++; currentPlayer.totalValue += baseDiceValue;
        
        if (baseDiceValue === 6) { this.playSound('criticalHit'); } 
        else if (baseDiceValue >= 4) { this.playSound('highRoll'); } 
        else { this.playSound('lowRoll'); }
        
        this.addLog(`${currentPlayer.name}が${baseDiceValue}を出しました！`);
        
        let bonuses = [];
        if (currentPlayer.doubleNext) { finalDiceValue *= 2; currentPlayer.doubleNext = false; bonuses.push('サイコロ2倍'); this.playSound('doubleBonus'); }
        
        if (bonuses.length > 0) this.addLog(`${bonuses.join('、')}適用！最終値: ${finalDiceValue}`, 'important');
        
        document.getElementById('diceValue').textContent = finalDiceValue;
        document.getElementById('diceResult').style.display = 'block';
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        await this.movePlayer(currentPlayer, finalDiceValue);
    }
    
    async movePlayer(player, steps) {
        const originalPosition = player.position;
        const newPosition = Math.min(this.boardSize, originalPosition + steps);
        
        this.playSound('move');
        for (let i = originalPosition + 1; i <= newPosition; i++) {
            player.position = i;
            this.updatePlayerPieces();
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        this.addLog(`${player.name}が${newPosition}に移動しました。`);
        this.updateUI();
        await this.checkSquareEvents(player);
    }

    async checkSquareEvents(player) {
        // BGMの状態を更新
        this.updateBGM();

        const pos = player.position;
        if (pos === this.boardSize) { this.endGame(player); return; }
        
        const playersInSameSquare = this.players.filter(p => p.position === pos && p !== player);
        if (playersInSameSquare.length > 0) { await this.handleCollision(pos); return; }
        
        if (this.gimmickSquares[pos]) { await this.handleGimmick(player, pos); return; }
        if (this.mysteryBoxPositions.includes(pos)) { this.openMysteryBox(player); return; }
        
        // どのイベントにも該当しなかった場合、次のターンへ進む
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
                return; // ターンを進めない
            case 'skip': player.skips++; this.addLog(`${player.name}は次回1回休み。`); break;
            case 'swap': await this.swapPlayerPositions(player); break;
            case 'start': player.position = 0; this.addLog(`${player.name}はスタートへ。`); break;
            case 'all_back':
                this.players.forEach(p => { if (p.position > 0) p.position = Math.max(0, p.position - 1); });
                this.addLog('全員が1マス後退！'); break;
            case 'random_big':
                await this.movePlayerByEffect(player, Math.random() < 0.5 ? 3 : -3);
                shouldContinueTurn = true; break;
            default: // +n, -n
                await this.movePlayerByEffect(player, parseInt(gimmick.effect));
                shouldContinueTurn = true; break;
        }
        
        this.updatePlayerPieces();
        if (this.gameEnded) return;

        if (shouldContinueTurn) {
             await this.checkSquareEvents(player); // ギミック移動後もイベントチェック
        } else {
             this.nextTurn();
        }
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
        this.isProcessing = true; // ルーレット回転中は他の操作を禁止
        this.playSound('mysteryBox'); this.addLog(`${player.name}がミステリーボックスを発見！`, 'important');
        
        const modal = document.getElementById('mysteryBoxModal');
        const rouletteContainer = document.querySelector('.roulette-container');
        const roulette = document.getElementById('roulette');
        const rouletteItems = roulette.querySelectorAll('.roulette-item');
        const resultEl = document.getElementById('mysteryResult');
        
        // 前回の結果表示スタイルをクリア
        rouletteContainer.classList.remove('result-decided');
        rouletteItems.forEach(item => item.classList.remove('highlighted'));
        
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

                // 結果表示用のスタイルを適用
                rouletteContainer.classList.add('result-decided');
                const winnerItem = rouletteItems[effectIndex];
                winnerItem.classList.add('highlighted');
                // アニメーション用にカスタムプロパティを設定
                const itemRotation = 60 * effectIndex;
                winnerItem.style.setProperty('--rotation-angle', `${itemRotation}deg`);


                document.getElementById('mysteryEffectText').textContent = effect.name;
                resultEl.style.display = 'block';
                this.currentMysteryEffect = { player, effect };
                this.isProcessing = false; // 結果表示後、操作可能に
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
                this.players.forEach(p => {
                    if (p !== player && p.position > 0) {
                        p.position--;
                        stolenSteps++;
                    }
                });
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
                return; // ターンを進めない
        }
        
        this.updatePlayerPieces();
        if (this.gameEnded) return;
        
        if (shouldContinueTurn) {
            await this.checkSquareEvents(player);
        } else {
            this.nextTurn();
        }
    }
    
    nextTurn() {
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 3;
        if (this.currentPlayerIndex === 0) this.turnNumber++;
        
        document.getElementById('rollDiceBtn').disabled = false;
        document.getElementById('diceResult').style.display = 'none';
        this.isProcessing = false;
        this.updateUI();
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
        
        let statsHTML = '<h4>ゲーム統計</h4>';
        this.players.forEach(p => {
            const avg = p.totalRolls > 0 ? (p.totalValue / p.totalRolls).toFixed(1) : '0';
            statsHTML += `<div class="stat-row"><span style="color:${p.color};">${p.name}</span><span>平均${avg} (${p.totalRolls}回)</span></div>`;
        });
        statsHTML += `<div class="stat-row"><span>総ターン数</span><span>${this.turnNumber}</span></div>`;
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