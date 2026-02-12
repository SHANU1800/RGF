// Detect environment - use relative URLs in Docker (nginx proxies), direct URLs locally
const isDocker = window.location.port === '3000' || window.location.port === '80' || window.location.port === '';
const API_HOST = isDocker ? '' : 'http://localhost:8000';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const wsHost = window.location.port === '3000' ? 'localhost:8000' : window.location.host;
const WS_HOST = `${wsProtocol}://${wsHost}`;

const CONFIG = {
    API_URL: API_HOST,
    WS_URL: WS_HOST,
    AUTHORITATIVE_MODE: true,
    INPUT_SEND_MS: 50,
    ENABLE_LOCAL_STICKMAN_AI: false,
    SNAPSHOT_SMOOTH_RATE: 12,
    GAME_WIDTH: 6000,
    GAME_HEIGHT: 900,
    CAMERA_VIEW_WIDTH: 1600,
    CAMERA_VIEW_HEIGHT: 900,
    // Ground is still at y=700 but we now have multiple floor levels for platforming
    GROUND_Y: 700,
    GRAVITY: 2800,
    JUMP_FORCE: -900,
    WALL_JUMP_FORCE_X: 560,
    WALL_JUMP_FORCE_Y: -860,
    WALL_DETECT_DIST: 16,
    WALL_ATTACH_HEIGHT: 260,
    WALL_ATTACH_TOP_MARGIN: 18,
    WALL_SLIDE_SPEED: 220,
    WALL_JUMP_LOCK_TIME: 0.16,
    LEDGE_GRAB_X_DIST: 18,
    LEDGE_GRAB_Y_WINDOW: 24,
    LEDGE_HAND_HEIGHT_RATIO: 0.34,
    LEDGE_HANG_Y_RATIO: 0.36,
    LEDGE_HANG_MAX: 0.9,
    LEDGE_CLIMB_INSET: 8,
    LEDGE_DROP_VY: 160,
    LEDGE_MIN_FALL_SPEED: 80,
    MOVE_SPEED: 380,
    MOVE_ACCEL: 2400,
    MOVE_DECEL: 3200,
    AIR_CONTROL: 0.55,
    MAX_FALL_SPEED: 1400,
    STAMINA_MAX: 100,
    STAMINA_REGEN_PER_SEC: 26,
    STAMINA_REGEN_DELAY_MS: 450,
    STAMINA_SPRINT_DRAIN_PER_SEC: 20,
    STAMINA_BLOCK_DRAIN_PER_SEC: 14,
    STAMINA_SPRINT_START_THRESHOLD: 6,
    STAMINA_BLOCK_START_THRESHOLD: 8,
    STAMINA_JUMP_COST: 24,
    STAMINA_HEAVY_ATTACK_COST: 30,
    CROUCH_HEIGHT: 56,
    SLIDE_DURATION: 0.42,
    SLIDE_SPEED_MIN: 230,
    SLIDE_BOOST_SPEED: 520,
    SLIDE_FRICTION: 2450,
    CROUCH_MOVE_MULTIPLIER: 0.58,
    SPRINT_MOVE_MULTIPLIER: 1.45,
    COYOTE_TIME_MS: 120,
    JUMP_BUFFER_MS: 120,
    PLAYER_WIDTH: 40,
    PLAYER_HEIGHT: 80,
    ARROW_SPEED: 900,
    ARROW_GRAVITY: 1200,
    ARROW_HIT_RADIUS: 3,
    HEAD_WIDTH_RATIO: 0.50,
    HEAD_HEIGHT_RATIO: 0.28,
    BODY_TOP_OFFSET_RATIO: 0.24,
    SWORD_ATTACK_HIT_WINDOW: {
        slash: { start: 0.18, end: 0.72 },
        upper_slash: { start: 0.24, end: 0.74 },
        lower_slash: { start: 0.20, end: 0.70 },
        pierce: { start: 0.28, end: 0.84 },
    },
    SWORD_ATTACK_HIT_SHAPE: {
        slash: { range_x: 90.0, y_min: -52.0, y_max: 52.0 },
        upper_slash: { range_x: 84.0, y_min: -112.0, y_max: -10.0 },
        lower_slash: { range_x: 86.0, y_min: 10.0, y_max: 112.0 },
        pierce: { range_x: 116.0, y_min: -26.0, y_max: 26.0 },
    },
    TICK_RATE: 60,
    // World geometry: y increases downward
    FLOORS: [
        { y: 700, height: 40, x1: 0, x2: 6000 },             // Base ground
        { y: 520, height: 22, x1: 140, x2: 1460 },            // Wide mid platform
        { y: 380, height: 18, x1: 360, x2: 1240 },            // Upper mid platform
        { y: 250, height: 16, x1: 640, x2: 960 },             // Top central ledge
        { y: 520, height: 22, x1: 2540, x2: 3860 },           // Wide far platform
        { y: 380, height: 18, x1: 2760, x2: 3540 },           // Upper far platform
        { y: 250, height: 16, x1: 3040, x2: 3360 },           // Top far ledge
        { y: 520, height: 22, x1: 4540, x2: 5860 },           // Wide deep-right platform
        { y: 380, height: 18, x1: 4760, x2: 5540 },           // Upper deep-right platform
        { y: 250, height: 16, x1: 5040, x2: 5360 },           // Top deep-right ledge
        { y: 380, height: 14, x1: 30, x2: 230, render: false },     // RED castle flat roof
        { y: 380, height: 12, x1: 230, x2: 254, render: false },     // RED stair 1
        { y: 420, height: 12, x1: 230, x2: 278, render: false },     // RED stair 2
        { y: 460, height: 12, x1: 230, x2: 302, render: false },     // RED stair 3
        { y: 500, height: 12, x1: 230, x2: 326, render: false },     // RED stair 4
        { y: 540, height: 12, x1: 230, x2: 350, render: false },     // RED stair 5
        { y: 580, height: 12, x1: 230, x2: 374, render: false },     // RED stair 6
        { y: 620, height: 12, x1: 230, x2: 398, render: false },     // RED stair 7
        { y: 660, height: 12, x1: 230, x2: 422, render: false },     // RED stair 8
        { y: 380, height: 14, x1: 5770, x2: 5970, render: false },   // BLUE castle flat roof
        { y: 380, height: 12, x1: 5746, x2: 5770, render: false },   // BLUE stair 1
        { y: 420, height: 12, x1: 5722, x2: 5770, render: false },   // BLUE stair 2
        { y: 460, height: 12, x1: 5698, x2: 5770, render: false },   // BLUE stair 3
        { y: 500, height: 12, x1: 5674, x2: 5770, render: false },   // BLUE stair 4
        { y: 540, height: 12, x1: 5650, x2: 5770, render: false },   // BLUE stair 5
        { y: 580, height: 12, x1: 5626, x2: 5770, render: false },   // BLUE stair 6
        { y: 620, height: 12, x1: 5602, x2: 5770, render: false },   // BLUE stair 7
        { y: 660, height: 12, x1: 5578, x2: 5770, render: false }    // BLUE stair 8
    ],
    // Active Ragdoll System
    RAGDOLL_ALWAYS_ACTIVE: true,              // Players are ragdolls from spawn (MDickie-style)
    RAGDOLL_MOTOR_STRENGTH: 0.8,              // How strongly ragdoll tries to stand/balance (0-1)
    RAGDOLL_MOTOR_SPEED: 320,                 // Horizontal movement speed for ragdoll motors
    RAGDOLL_JUMP_IMPULSE: 850,                // Jump force for ragdoll
    RAGDOLL_BALANCE_STRENGTH: 0.6,            // Angular correction to stay upright (0-1)
    RAGDOLL_STILLNESS_THRESHOLD: 2.0,         // Velocity below which counts as still (px/s)
    RAGDOLL_RESPAWN_TIMEOUT: 3.0,             // Seconds of inactivity before auto-respawn
    ARROW_SEVER_DAMAGE_MIN: 35,               // Minimum arrow damage to sever limb
    SEVERED_LEG_SPEED_PENALTY: 0.5,           // Movement multiplier with one leg
    ENABLE_MANUAL_SURRENDER: true,            // Allow manual respawn with R key
};
