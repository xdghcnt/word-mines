function init(wsServer, path) {
    const
        fs = require("fs"),
        randomColor = require('randomcolor'),
        app = wsServer.app,
        registry = wsServer.users,
        channel = "words-mines",
        testMode = process.argv[2] === "debug",
        PLAYERS_MIN = testMode ? 1 : 4;

    app.use("/words-mines", wsServer.static(`${__dirname}/public`));
    if (registry.config.appDir)
        app.use("/words-mines", wsServer.static(`${registry.config.appDir}/public`));
    registry.handleAppPage(path, `${__dirname}/public/app.html`);

    const defaultWords = JSON.parse(fs.readFileSync(`${registry.config.appDir}/moderated-words.json`));

    class GameState extends wsServer.users.RoomState {
        constructor(hostId, hostData, userRegistry) {
            super(hostId, hostData, userRegistry, registry.games.wordsMines.id, path);
            const appDir = registry.config.appDir || __dirname;
            const
                room = {
                    ...this.room,
                    inited: true,
                    hostId: hostId,
                    customWordsLimit: 1500,
                    spectators: new JSONSet(),
                    playerNames: {},
                    playerColors: {},
                    inactivePlayers: new JSONSet(),
                    onlinePlayers: new JSONSet(),
                    master: null,
                    guesPlayer: null,
                    readyToGuess: null,
                    wasGuesser: [],
                    players: new JSONSet(),
                    readyPlayers: new JSONSet(),
                    playerHints: new JSONSet(),
                    playerAcceptVotes: new JSONSet(),
                    playerScores: {},
                    scoreChanges: {},
                    teamsLocked: false,
                    timed: true,
                    word: null,
                    guessedWord: null,
                    hints: {},
                    rounds: 0,
                    phase: 0,
                    playerTime: 60,
                    teamTime: 60,
                    masterTime: 60,
                    revealTime: 25,
                    goal: 15,
                    wordsLevel: 1,
                    time: null,
                    paused: true,
                    playerAvatars: {},
                    playerLiked: null,
                    playerWin: null,
                    wasMaster: null,
                    wordGuessed: null,
                    wordAccepted: null,
                    managedVoice: true,
                    masterKicked: false,
                    noHints: false,
                    filtered: [],
                    blackEye: [],
                    isLiked: true,
                    circles: 1,
                    counter: 0,
                    buttonEnabled: true
                },
                state = {
                    roomWordsList: shuffleArray(defaultWords[room.wordsLevel]),
                    words: [],
                    closedHints: {},
                    closedWord: null,
                    bannedHints: {},
                    unbannedHints: {},
                };
            this.room = room;
            this.state = state;
            this.lastInteraction = new Date();
            let interval;
            const
                send = (target, event, data) => userRegistry.send(target, event, data),
                update = () => {
                    if (room.voiceEnabled)
                        processUserVoice();
                    send(room.onlinePlayers, "state", room);
                },
                processUserVoice = () => {
                    room.userVoice = {};
                    room.onlinePlayers.forEach((user) => {
                        if (!room.managedVoice || !room.teamsLocked || room.phase === 0)
                            room.userVoice[user] = true;
                        else if (room.players)
                            room.userVoice[user] = true;
                    });
                },
                updatePlayerState = () => {
                    [...room.onlinePlayers].forEach(playerId => {
                        if (room.players.has(playerId)) {
                            if (room.guesPlayer === playerId) {
                                if (room.phase !== 4) {
                                    send(playerId, "player-state", {
                                        closedHints: null, closedWord: null,
                                        bannedHints: null, unbannedHints: null
                                    });
                                }
                                else {
                                    send(playerId, "player-state", {
                                        closedHints: null, closedWord: null,
                                        bannedHints: null, unbannedHints: state.unbannedHints
                                    })
                                }
                            }
                            else if (room.master === playerId)
                                if (room.phase !== 4) {
                                    send(playerId, "player-state", {
                                        closedHints: null, closedWord: state.closedWord,
                                        bannedHints: null, unbannedHints: null
                                    });
                                } else {
                                    send(playerId, "player-state", {
                                        closedHints: null, closedWord: null,
                                        bannedHints: null, unbannedHints: state.unbannedHints
                                    })
                                }
                            else
                                send(playerId, "player-state", {
                                    closedHints: state.closedHints,
                                    closedWord: state.closedWord,
                                    bannedHints: state.bannedHints,
                                    unbannedHints: state.unbannedHints
                                });
                        } else {
                            if (room.blackEye.includes(playerId))
                                send(playerId, "player-state", {
                                    closedHints: state.closedHints,
                                    closedWord: state.closedWord,
                                    bannedHints: state.bannedHints,
                                    unbannedHints: state.unbannedHints
                                })
                            else { send(playerId, "player-state", { closedHints: null, closedWord: null }); }
                        }
                    });
                },
                getNextPlayer = () => {
                    const nextPlayerIndex = [...room.players].indexOf(room.master) + 1;
                    return [...room.players][(room.players.size === nextPlayerIndex) ? 0 : nextPlayerIndex];
                },
                processInactivity = (playerId, master) => {
                    if (room.inactivePlayers.has(playerId)) {
                        if (master)
                            room.masterKicked = true;
                        removePlayer(playerId);
                    } else
                        room.inactivePlayers.add(playerId);
                },
                startTimer = () => {
                    if (room.timed) {
                        clearInterval(interval);
                        if (room.phase === 1)
                            room.time = room.playerTime * 1000;
                        else if (room.phase === 2)
                            room.time = room.teamTime * 1000;
                        else if (room.phase === 3)
                            room.time = room.masterTime * 1000;
                        else if (room.phase === 4) {
                            if (room.wordGuessed)
                                room.time = room.revealTime * 1000;
                            else
                                room.time = 10 * 1000;
                        }
                        let time = new Date();
                        interval = setInterval(() => {
                            if (!room.paused) {
                                room.time -= new Date() - time;
                                time = new Date();
                                if (room.time <= 0) {
                                    clearInterval(interval);
                                    if (room.phase === 1) {
                                        if (room.readyPlayers.size === 1)
                                            endRound();
                                        else {
                                            [...room.players].forEach(playerId => {
                                                if (room.master !== playerId && !room.readyPlayers.has(playerId))
                                                    processInactivity(playerId);
                                            });
                                            startTeamPhase();
                                        }
                                    } else if (room.phase === 2) {
                                        endRound();
                                    } else if (room.phase === 3) {
                                        processInactivity(room.master);
                                        endRound();
                                    } else if (room.phase === 4) {
                                        if (!room.playerLiked && room.wordGuessed && room.isLiked) {
                                            changeScore(room.guesPlayer, -2);
                                        }
                                        startRound();
                                    }
                                    update();
                                }
                            } else time = new Date();
                        }, 100);
                    }
                },
                startGame = () => {
                    if (room.players.size >= PLAYERS_MIN) {
                        room.masterKicked = false;
                        room.readyToGuess = null;
                        room.guesPlayer = null;
                        room.wasGuesser = [];
                        room.counter = 0;
                        room.wasMaster = [];
                        room.playerWin = null;
                        room.playerScores = {};
                        room.scoreChanges = {};
                        room.paused = false;
                        room.teamsLocked = true;
                        room.master = [...room.players][0]
                        clearInterval(interval);
                        startRound(true);
                    } else {
                        room.paused = true;
                        room.teamsLocked = false;
                    }
                },
                endGame = () => {
                    room.paused = true;
                    room.wasGuesser = [];
                    room.wasMaster = [];
                    room.teamsLocked = false;
                    room.time = null;
                    room.phase = 0;
                    room.playerAcceptVotes.clear();
                    clearInterval(interval);
                    update();
                    updatePlayerState();
                },
                changeScore = (player, change) => {
                    room.playerScores[player] = room.playerScores[player] || 0;
                    room.playerScores[player] += change;
                    room.scoreChanges[player] = room.scoreChanges[player] || 0;
                    room.scoreChanges[player] += change;
                },
                endRound = () => {
                    room.phase = 4;
                    Object.keys(state.closedHints).forEach((player) => {
                        if (state.bannedHints[player]) {
                            changeScore(player, 3);
                        };
                        room.playerHints.add(player);
                    });
                    const hui = null;
                    if (room.wordGuessed && Object.keys(state.bannedHints).length == 0) {
                        changeScore(room.master, 5);
                        changeScore(room.guesPlayer, 5);
                    };
                    room.word = state.closedWord;
                    room.hints = state.closedHints;
                    room.wasMaster.push(room.master);
                    room.readyPlayers.clear();
                    room.playerAcceptVotes.clear();
                    startTimer();
                    update();
                    updatePlayerState();
                },
                stopGame = () => {
                    room.readyPlayers.clear();
                    room.paused = true;
                    room.teamsLocked = false;
                    room.phase = 0;
                    clearInterval(interval);
                    update();
                    updatePlayerState();
                },
                nextGuessPlayer = () => {
                    room.filtered = [...room.players].filter(it => {
                        return !room.wasGuesser.includes(it) && it !== room.master;
                    });
                    if (room.filtered.length == 0) {
                        room.wasGuesser = [];
                        room.filtered = [...room.players].filter(it => {
                            return !room.wasGuesser.includes(it) && it !== room.master;
                        });
                    };
                    room.guesPlayer = shuffleArray(room.filtered)[0];
                    room.wasGuesser.push(room.guesPlayer);
                },
                testNapidOra = (player) => {
                    if (!room.wasMaster.includes(player)) {
                        room.wasMaster.push(player);
                        return getNextPlayer();
                    }
                },
                startRound = (initial) => {
                    room.readyPlayers.clear();
                    room.noHints = false;
                    if (room.players.size >= PLAYERS_MIN) {
                        checkScores();
                        if (!room.playerWin || initial) {
                            if (!initial && !room.masterKicked)
                                room.master = getNextPlayer();
                            room.masterKicked = false;
                            room.wordAccepted = null;
                            room.wordGuessed = null;
                            room.playerLiked = null;
                            room.rounds++;
                            room.phase = 1;
                            room.hints = {};
                            state.bannedHints = {};
                            state.unbannedHints = {};
                            state.closedHints = {};
                            room.playerAcceptVotes.clear();
                            room.playerHints.clear();
                            room.scoreChanges = {};
                            room.word = state.closedWord = room.guessedWord = null;
                            nextGuessPlayer();
                            room.readyPlayers.add(room.master);
                            room.readyPlayers.add(room.guesPlayer);
                            state.closedWord = dealWord();
                            startTimer();
                            update();
                            updatePlayerState();
                        }
                    } else {
                        room.phase = 0;
                        room.teamsLocked = false;
                        update();
                    }
                },
                dealWord = () => {
                    if (state.words.length === 0)
                        state.words = [...state.roomWordsList];
                    return state.words.pop();
                },
                startTeamPhase = () => {
                    room.phase = 2;
                    room.readyPlayers.clear();
                    room.readyPlayers.add(room.master);
                    room.readyPlayers.add(room.guesPlayer);
                    room.playerHints = new JSONSet(shuffleArray([...room.playerHints]));
                    startTimer();
                    update();
                    updatePlayerState();
                },
                removePlayer = (playerId) => {
                    if (room.master === playerId)
                        room.master = getNextPlayer();
                    room.players.delete(playerId);
                    room.readyPlayers.delete(playerId);
                    if (room.spectators.has(playerId) || !room.onlinePlayers.has(playerId)) {
                        room.spectators.delete(playerId);
                        delete room.playerNames[playerId];
                        this.emit("user-kicked", playerId);
                    } else
                        room.spectators.add(playerId);
                    if (room.phase !== 0 && room.players.size < PLAYERS_MIN)
                        stopGame();
                    update();
                    updatePlayerState();
                },
                checkScores = () => {
                    const scores = [...room.players].map(playerId => room.playerScores[playerId] || 0).sort((a, b) => a - b).reverse();
                    const playerLeader = [...room.players].filter(playerId => room.playerScores[playerId] === scores[0])[0];
                    if ([...room.players][room.players.size - 1] == room.master) {
                        room.counter++
                        room.wasGuesser = room.wasMaster = [];
                        if (room.counter >= room.circles)
                            room.playerWin = playerLeader
                    }
                    if (room.playerWin)
                        endGame();
                },
                checkCanSetCustom = () => {
                    if (room.konfaMode || room.authUsers[room.hostId]?.subscribeLevel >= 1)
                        return true;
                    send(room.hostId, "subscribe-needed")
                    return false;
                },
                userJoin = (data) => {
                    const user = data.userId;
                    if (!room.playerNames[user])
                        room.spectators.add(user);
                    room.playerColors[user] = room.playerColors[user] || randomColor();
                    room.onlinePlayers.add(user);
                    room.playerNames[user] = data.userName.substr && data.userName.substr(0, 60);
                    if (data.avatarId) {
                        fs.stat(`${registry.config.appDir || __dirname}/public/avatars/${user}/${data.avatarId}.png`, (err) => {
                            if (!err) {
                                room.playerAvatars[user] = data.avatarId;
                                update()
                            }
                        });
                    }
                    update();
                    updatePlayerState();
                },
                userLeft = (user) => {
                    room.onlinePlayers.delete(user);
                    if (room.spectators.has(user))
                        delete room.playerNames[user];
                    room.spectators.delete(user);
                    if (room.onlinePlayers.size === 0)
                        stopGame();
                    update();
                },
                rerollRound = () => {
                    room.readyPlayers.clear();
                    room.noHints = false;
                    if (room.players.size >= PLAYERS_MIN) {
                        checkScores();
                        if (!room.playerWin || initial) {
                            room.masterKicked = false;
                            room.wordAccepted = null;
                            room.wordGuessed = null;
                            room.playerLiked = null;
                            room.phase = 1;
                            room.hints = {};
                            state.bannedHints = {};
                            state.unbannedHints = {};
                            state.closedHints = {};
                            room.playerAcceptVotes.clear();
                            room.playerHints.clear();
                            room.scoreChanges = {};
                            room.word = state.closedWord = room.guessedWord = null;
                            nextGuessPlayer();
                            room.readyPlayers.add(room.master);
                            room.readyPlayers.add(room.guesPlayer);
                            state.closedWord = dealWord();
                            startTimer();
                            update();
                            updatePlayerState();
                        }
                    } else {
                        room.phase = 0;
                        room.teamsLocked = false;
                        update();
                    }
                },
                userEvent = (user, event, data) => {
                    this.lastInteraction = new Date();
                    try {
                        if (this.eventHandlers[event])
                            this.eventHandlers[event](user, data[0], data[1], data[2]);
                    } catch (error) {
                        console.error(error);
                        registry.log(error.message);
                    }
                };
            this.unsetCustomWords = () => {
                this.room.packName = null;
                send(room.hostId, "subscribe-needed")
                this.updatePublicState();
            }
            this.updatePublicState = update;
            this.userJoin = userJoin;
            this.userLeft = userLeft;
            this.userEvent = userEvent;
            this.eventHandlers = {
                ...this.eventHandlers,
                "update-avatar": (user, id) => {
                    room.playerAvatars[user] = id;
                    update()
                },
                "toggle-lock": (user) => {
                    if (user === room.hostId && room.paused)
                        room.teamsLocked = !room.teamsLocked;
                    update();
                },
                "add-hint": (user, hint) => {
                    if (room.phase === 1 && room.players.has(user)
                        && room.master !== user && !room.readyPlayers.has(user) && hint) {
                        if (room.players.size >= PLAYERS_MIN) {
                            state.closedHints[user] = hint;
                            room.readyPlayers.add(user);
                            room.playerHints.add(user);
                            if (room.readyPlayers.size === room.players.size)
                                startTeamPhase();
                            else {
                                update();
                                updatePlayerState();
                            }
                        } else stopGame();
                    }
                },
                "toggle-hint-ban": (user, hintUser) => {
                    if (room.buttonEnabled) {
                        if (room.phase === 2 && room.players.has(user) && room.master
                            !== user && room.guesPlayer !== user && state.closedHints[hintUser]) {
                            room.buttonEnabled = false;
                            if (state.bannedHints[hintUser]) {
                                delete state.bannedHints[hintUser]
                                state.unbannedHints[hintUser] = user;
                            } else {
                                state.bannedHints[hintUser] = user;
                                delete state.unbannedHints[hintUser]
                            }
                            setTimeout(function () {
                                room.buttonEnabled = true;
                            }, 900);
                            update();
                            updatePlayerState();
                        }
                    }
                },
                "set-like": (user, likedUser) => {
                    if (room.phase === 4 && !room.playerLiked && room.wordGuessed
                        && user == room.guesPlayer && room.isLiked) {
                        room.playerLiked = likedUser;
                        changeScore(likedUser, 1);
                        if (room.time >= 5000)
                            room.time = 5000;
                        checkScores();
                        update();
                    };
                },
                "set-player-score": (user, data) => {
                    if (room.hostId === user && room.players.has(user) && !isNaN(parseInt(data.score))) {
                        room.playerScores[data.playerId] = parseInt(data.score);
                        update();
                        updatePlayerState();
                    }
                },
                "edit-code-word": (user, word) => {
                    if (room.phase === 1 && word && room.readyPlayers.has(user)) {
                        state.closedHints[user] = word;
                        update();
                        updatePlayerState();
                    }
                },
                "toggle-ready": (user) => {
                    if (room.players.has(user) && (room.phase === 4)) {
                        if (room.readyPlayers.has(user))
                            room.readyPlayers.delete(user);
                        else {
                            room.readyPlayers.add(user);
                            if (room.players.size === room.readyPlayers.size)
                                if (room.phase === 4)
                                    startRound();
                        }
                        update();
                    }
                },
                "toggle-pause": (user) => {
                    if (user === room.hostId) {
                        room.paused = !room.paused;
                        if (room.phase === 0)
                            startGame();
                    }
                    update();
                },
                "toggle-like-mod": (user) => {
                    if (user === room.hostId) {
                        room.isLiked = !room.isLiked;
                    }
                    update();
                },
                "circles-count": (user, data) => {
                    if (user === room.hostId) {
                        room.circles = data;
                    }
                    update();
                },
                "restart": (user) => {
                    if (user === room.hostId)
                        startGame();
                },
                "toggle-timed": (user) => {
                    if (user === room.hostId) {
                        room.timed = !room.timed;
                        if (!room.timed) {
                            room.time = null;
                            clearInterval(interval);
                        }
                    }
                    update();
                },
                "set-param": (user, type, value) => {
                    if (user === room.hostId && ~[
                        "masterTime",
                        "playerTime",
                        "revealTime",
                        "teamTime",
                        "wordsLevel",
                        "circles-count",
                        "goal"].indexOf(type)
                        && (type !== "wordsLevel" || (value <= 4 && value >= 1)) && !isNaN(parseInt(value)))
                        if (type === "circles-count")
                            room.circles = value
                        else if (type !== "wordsLevel")
                            room[type] = parseFloat(value);
                        else if (!room.packName) {
                            room.wordsLevel = parseFloat(value);
                            state.words = [];
                            this.state.roomWordsList = shuffleArray(defaultWords[room.wordsLevel]);
                        }
                    update();
                },
                "remove-player": (user, playerId) => {
                    if (playerId && user === room.hostId)
                        removePlayer(playerId);
                    update();
                },
                "give-host": (user, playerId) => {
                    if (playerId && user === room.hostId) {
                        room.hostId = playerId;
                        this.emit("host-changed", user, playerId);
                    }
                    update();
                },
                "give-eye": (user, playerId) => {
                    if (playerId && user === room.hostId && room.spectators.has(playerId)) {
                        if (!room.blackEye.includes(playerId))
                            room.blackEye.push(playerId)
                        else {
                            const i = room.blackEye.indexOf(playerId);
                            room.blackEye.splice(i, 1);
                        }
                        update();
                        updatePlayerState();
                    }
                },
                "players-join": (user) => {
                    if (!room.teamsLocked) {
                        room.spectators.delete(user);
                        room.players.add(user);
                        if (room.players.size === 1)
                            room.master = user;
                        update();
                        updatePlayerState();
                    }
                },
                "spectators-join": (user) => {
                    if (!room.teamsLocked) {
                        if (room.master === user)
                            room.master = getNextPlayer();
                        if (room.guesPlayer === user)
                            rerollRound()
                        room.players.delete(user);
                        room.spectators.add(user);
                        update();
                        updatePlayerState();
                    }
                },
                "word-guessed": (user, a) => {
                    if (user == room.master && room.phase == 2) {
                        room.wordGuessed = a;
                        endRound();
                    }
                },
                "setup-words": (user, packName, words) => {
                    if (checkCanSetCustom() && room.hostId === user && words.length <= 1500) {
                        if (words) {
                            state.words = [];
                            this.state.roomWordsList = shuffleArray(words);
                            room.packName = packName || "Пользовательский";
                            update();
                        }
                    }
                },
                "setup-words-preset": (user, packName) => {
                    if (checkCanSetCustom() && room.hostId === user) {
                        fs.readFile(`${appDir}/custom/${packName}.json`, "utf8", (err, str) => {
                            if (str) {
                                const data = JSON.parse(str);
                                state.words = [];
                                this.state.roomWordsList = shuffleArray(data.wordList);
                                room.packName = packName;
                                update();
                            }
                            if (err)
                                send(user, "message", JSON.stringify(err));
                        });
                    }
                },
                "unset-words": (user) => {
                    if (room.hostId === user) {
                        this.room.packName = null;
                        update();
                    }
                },
            };
        }

        disableKonfaMode() {
            super.disableKonfaMode();
            if (!(!this.room.packName || (this.room.authUsers[this.room.hostId]
                && (this.room.authUsers[this.room.hostId]?.subscribeLevel >= 1)))) {
                this.unsetCustomWords();
            }
        }

        getPlayerCount() {
            return Object.keys(this.room.playerNames).length;
        }

        getActivePlayerCount() {
            return this.room.onlinePlayers.size;
        }

        getLastInteraction() {
            return this.lastInteraction;
        }

        getSnapshot() {
            return {
                room: this.room,
                state: this.state,
                player: this.player
            };
        }

        setSnapshot(snapshot) {
            Object.assign(this.room, snapshot.room);
            Object.assign(this.state, snapshot.state);
            this.room.paused = true;
            this.room.inactivePlayers = new JSONSet(this.room.inactivePlayers);
            this.room.onlinePlayers = new JSONSet();
            this.room.spectators = new JSONSet();
            this.room.players = new JSONSet(this.room.players);
            this.room.readyPlayers = new JSONSet(this.room.readyPlayers);
            this.room.playerHints = new JSONSet(this.room.playerHints);
            this.room.playerAcceptVotes = new JSONSet();
            this.room.onlinePlayers.clear();
        }
    }

    function makeId() {
        let text = "";
        const possible = "abcdefghijklmnopqrstuvwxyz0123456789";

        for (let i = 0; i < 5; i++)
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        return text;
    }

    function shuffleArray(array) {
        let currentIndex = array.length, temporaryValue, randomIndex;
        while (0 !== currentIndex) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }

    function getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    class JSONSet extends Set {
        constructor(iterable) {
            super(iterable)
        }

        toJSON() {
            return [...this]
        }
    }

    registry.createRoomManager(path, GameState);
}

module.exports = init;

