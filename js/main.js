let game;
const API_BASE = '/api';

window.addEventListener('DOMContentLoaded', async () => {
    // Get room code from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('code');
    
    if (!roomCode) {
        alert('No room specified. Please select a game first.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Get room data from localStorage (set by dashboard)
    const roomData = JSON.parse(localStorage.getItem(`room_${roomCode}`) || '{}');
    const gameSlug = roomData.game_slug || 'stickman-archers';
    
    if (!roomData.member_id) {
        alert('Player data not found. Please join the room from the dashboard.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    // Verify authentication
    try {
        const response = await fetch(`${API_BASE}/auth/me/`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            window.location.href = 'login.html';
            return;
        }
        
        const gamer = await response.json();
        localStorage.setItem('gamerId', gamer.gamer_id);
        localStorage.setItem('displayName', gamer.display_name || gamer.gamer_id);
    } catch (error) {
        console.error('Auth check failed:', error);
        window.location.href = 'login.html';
        return;
    }
    
    // Store in session for game reference
    sessionStorage.setItem('gameSlug', gameSlug);
    sessionStorage.setItem('roomCode', roomCode);
    
    game = new Game();
});

window.addEventListener('beforeunload', () => {
    if (game && game.ws) {
        game.ws.disconnect();
    }
});
