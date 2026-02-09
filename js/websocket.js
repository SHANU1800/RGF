class WebSocketManager {
    constructor(roomCode) {
        this.roomCode = roomCode;
        this.ws = null;
        this.connected = false;
        this.listeners = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }
    
    connect() {
        const wsUrl = `${CONFIG.WS_URL}/ws/game/${this.roomCode}/`;
        console.log('Connecting to:', wsUrl);
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.connected = true;
            this.reconnectAttempts = 0;
            this.emit('connected');
        };
        
        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log('Received:', data);
                this.emit(data.type, data);
            } catch (error) {
                console.error('Failed to parse message:', error);
            }
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.emit('error', error);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.connected = false;
            this.emit('disconnected');
            this.attemptReconnect();
        };
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), 2000 * this.reconnectAttempts);
        } else {
            console.error('Max reconnect attempts reached');
            this.emit('connection_failed');
        }
    }
    
    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            console.log('Sent:', data);
        } else {
            console.warn('WebSocket not connected, cannot send:', data);
        }
    }
    
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
    
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    
    sendPing() {
        this.send({ type: 'ping', timestamp: Date.now() });
    }
    
    sendJoin(nickname, playerId, isHost) {
        this.send({ 
            type: 'join', 
            nickname,
            player_id: playerId,
            is_host: isHost
        });
    }
    
    sendStartGame() {
        this.send({ type: 'start_game' });
    }
    
    sendPlayerAction(action, data) {
        this.send({ type: 'player_action', action, data });
    }
    
    sendPlayerState(state) {
        this.send({
            type: 'player_state',
            player_id: localStorage.getItem('playerId'),
            state
        });
    }

    sendInput(input) {
        this.send({
            type: 'input',
            ...input
        });
    }

    sendToggleSlowMotion(enabled) {
        this.send({
            type: 'toggle_slow_motion',
            enabled
        });
    }
}
