//import React from "react";
//import ReactDOM from "react-dom"
//import Avatar from '../avatar.jsx'


class ProgressBar extends React.Component {
    componentDidMount() {
        this.timerSound = new Audio("/words-mines/tick.mp3");
        this.timerSound.volume = 0.4;
        const { timed, time } = this.props.data;
        if (timed && time !== null) {
            this.updateTimer(time);
        }
        this.props.setPhase2(() => this.progressBarUpdate(0, 100));
    }

    updateTimer(time) {
        const data = this.props.data
        const timeTotal = {
            1: data.playerTime,
            2: data.teamTime,
            3: data.masterTime,
            4: data.revealTime,
        }[data.phase] * 1000;
        this.progressBarUpdate(timeTotal - time, timeTotal);
    }

    progressBarUpdate(x, outOf) {
        let firstHalfAngle = 180,
            secondHalfAngle = 0;

        // caluclate the angle
        let drawAngle = x / outOf * 360;

        // calculate the angle to be displayed if each half
        if (drawAngle <= 180) {
            firstHalfAngle = drawAngle;
        } else {
            secondHalfAngle = drawAngle - 180;
        }

        // set the transition
        if (document.querySelector(".rtb-slice1"))
            document.querySelector(".rtb-slice1").style.transform = `rotate(${firstHalfAngle}deg)`;
        if (document.querySelector(".rtb-slice2"))
            document.querySelector(".rtb-slice2").style.transform = `rotate(${secondHalfAngle}deg)`;
    }

    render() {
        const { data, setTime } = this.props;

        clearTimeout(this.timerTimeout);
        if (data.phase !== 0 && data.timed) {
            let timeStart = new Date();
            this.timerTimeout = setTimeout(() => {
                if (data.timed && !data.paused) {
                    let prevTime = data.time,
                        time = prevTime - (new Date - timeStart);
                    setTime(time);
                    this.updateTimer(time);
                    if (![2, 4].includes(data.phase) && data.timed && time < 5000
                        && ((Math.floor(prevTime / 1000) - Math.floor(time / 1000)) > 0) && !parseInt(localStorage.muteSounds))
                        this.timerSound.play();
                }
                if (!data.timed)
                    this.updateTimer(0);
            }, 1000);
        }

        return data.timed ? (
            <div className="round-track-bar">
                <div className="rtb-clip1">
                    <div className="rtb-slice1" />
                </div>
                <div className="rtb-clip2">
                    <div className="rtb-slice2" />
                </div>
                <div className="rtb-content">
                    <span className="timer-time">
                        {(new Date(data.phase === 2
                            ? data.gameTimeLeft
                            : (!data.teamWin && data.phase !== 3)
                                ? data.time : 0)).toUTCString().match(/(\d\d:\d\d )/)?.[0].trim()}
                    </span>
                </div>
            </div>

        ) : ""
    }
}

class ReadyBtn extends React.Component {

    toggleReady() {
        this.props.socket.emit("toggle-ready");
    }

    render() {
        const { isReady } = this.props;
        return (
            <span
                className={cs('ready-button', { isReady })}
                onClick={() => this.toggleReady()}
            >
                <i className="material-icons">fast_forward</i>
            </span>
        )
    }
}

class Title extends React.Component {
    render() {
        return (
            <div className="title">
                {this.props.text}
            </div>
        )
    }
}

class ClosedWord extends React.Component {
    render() {
        const { text, mistake } = this.props;
        return (
            <div className={cs("closed-word", { mistake, back: !mistake && text == null })}>
                {(text != null || mistake)
                    ? <div>{window.hyphenate(text ? text : `(${t("empty")})`)}</div>
                    : <div className="card-logo"> X X X </div>}
                {this.props.children}
            </div>
        )
    }
}

//TODO: don't let spectators input
class HintForm extends React.Component {
    addHint() {
        this.props.socket.emit("add-hint", document.getElementById("hint-input").value);
    }

    onKeyDown(evt) {
        !evt.stopPropagation() && evt.key === "Enter" && this.addHint()
    }

    render() {
        const { data } = this.props;
        const { userId, closedWord, master, rounds, guesPlayer } = data;
        return (
            <div className="hint-form">
                <div className="hint-cont">
                    <div
                        className="card hint input"
                        style={Messy.getStyle(rounds + '_' + 'input')}
                    >
                        <input
                            id="hint-input"
                            type="text"
                            autoComplete="off"
                            autoFocus="true"
                            onKeyDown={(evt) => this.onKeyDown(evt)}
                        />
                        <div className="br-corner">
                            <div
                                className="add-command-button"
                                onClick={() => this.addHint()}
                            >
                                <i className="material-icons">send</i>
                            </div>
                        </div>
                    </div>
                </div>
                <ClosedWord text={closedWord} />

            </div>
        )
    }
}

class MasterTarget extends React.Component {
    render() {
        const { data } = this.props;
        const { master, closedWord } = data;
        return (
            <div className="master-target">
                <ClosedWord text={closedWord} />
            </div>
        )
    }
}

class ClosedWordForm extends React.Component {
    guessWord() {
        this.props.socket.emit("guess-word", document.getElementById("closed-word-input").value);
    }

    onKeyDown(evt) {
        !evt.stopPropagation() && evt.key === "Enter" && this.guessWord()
    }

    render() {
        const { data } = this.props;
        const { userId } = data;

        return (
            <div className="card closed-word">
                <input
                    id="closed-word-input"
                    type="text"
                    autoComplete="off"
                    autoFocus="true"
                    onKeyDown={(evt) => this.onKeyDown(evt)}
                />
                <div className="bl-corner">
                    <Avatar data={data} player={userId} />
                </div>
                <div className="br-corner">
                    <div
                        className="add-command-button"
                        onClick={() => this.guessWord()}
                    >
                        <i className="material-icons">send</i>
                    </div>
                </div>
            </div>
        )
    }
}


//TODO: add points and other data
class ClosedWordResult extends React.Component {
    render() {
        const { data } = this.props;
        const { wordGuessed, guessedWord, wordAccepted, word, master } = data;

        if (wordGuessed || wordAccepted) {
            return (
                <ClosedWord text={wordGuessed ? word : guessedWord}>


                    <div className="bl-corner">
                        <Avatar data={data} player={master} />
                    </div>
                </ClosedWord>
            )
        }
        return (
            <div className="closed-word-result">
                <ClosedWord text={word} />

            </div>
        )
    }
}

class StatusBar extends React.Component {
    wordGuessed(a) {
        this.props.socket.emit("word-guessed", a);
    }
    render() {

        const { data, socket, setTime, setPhase2 } = this.props;
        const {
            phase, players, playerWin, timed, time, userId,
            master, readyPlayers, playerNames, wordGuessed, wordAccepted, playerAcceptVotes, noHints, guesPlayer, scoreChanges
        } = data;
        const playerAccepted = playerAcceptVotes.includes(userId);
        const isMaster = userId === master;
        const isGuesser = userId === data.guesPlayer;
        const isReady = readyPlayers.includes(userId);
        const isPlayer = players.includes(userId);
        const enoughText = (players.length > 2)
            ? t('Host can start game')
            : t('Not enough players (minimum 3)');

        let content
        let subtitle = null
        let hasReady = false
        let hasAccept = false
        if (phase === 0 && !playerWin) {
            content = <MasterTarget data={data} />;
            subtitle = enoughText;
        } else if (phase === 1) {
            if (isMaster || isGuesser) {
                content = <MasterTarget data={data} />;
                subtitle = t("Wait for players to write their hints");
            } else if (isReady) {
                content = <MasterTarget data={data} />;
                subtitle = t("Wait for players to write their hints");
            } else if (isPlayer) {
                content = <HintForm data={data} socket={socket} />;
                subtitle = t("Write your hint");
            } else {
                content = <MasterTarget data={data} />;
                subtitle = t("Wait for players to write their hints");
            }
        } else if (phase === 2) {
            if (isMaster) {
                content = <MasterTarget data={data} />;
                subtitle = t("Wait for players to delete duplicates");
            } else if (isGuesser) {
                content = <MasterTarget data={data} />;
                subtitle = "Отгадайте слово не наступая на мины";
            } else {
                content = <MasterTarget data={data} />;
                subtitle = t("Delete duplicates");
            }
        } else if (phase === 3) {
            if (isMaster) {
                content = <ClosedWordForm data={data} socket={socket} />;
                subtitle = t("Now try guess the original word");
            } else {
                content = <MasterTarget data={data} />;
                subtitle = t('Now ') + window.commonRoom.getPlayerName(master) + t(' should guess original word');
            }
        } else if (phase === 4) {
            content = <ClosedWordResult data={data} />;
            subtitle = t("Next round");
            hasReady = isPlayer;
            hasAccept = !wordGuessed && !wordAccepted && !noHints;
        } else if (phase === 0 && playerWin) {
            content = <div className="player-win">
                <Title text={t('The winner is') + ' ' + window.commonRoom.getPlayerName(playerWin) + '!'} />
            </div>;
            subtitle = enoughText;
        }

        return (

            <div className="status-bar-wrap">
                <div className="status-bar">
                    <div className="aligner">
                        <div className="active players">
                            {master ? <div className="master">
                                <div className="role">
                                    <Avatar data={data} player={master} />
                                    <div className="roleTitle"><PlayerName data={data} id={master} /></div>
                                </div>
                                <div className="nickNameLock">
                                    <div className="role-action">загадывает</div>
                                    {scoreChanges[master] && (<div className="nickCorner">
                                        <div className="score-change">
                                            {'+' + scoreChanges[master]}
                                        </div>
                                    </div>)}
                                </div>
                            </div> : ""}
                            <div className={cs("Realtimer", {
                                playerWin
                            })}>
                                {data.phase !== 0 && timed && !playerWin
                                    ? <ProgressBar data={data} setPhase2={setPhase2} setTime={setTime} /> :
                                    !playerWin
                                        ? <img src="/words-mines/mina.png"></img>
                                        : <Avatar data={data} player={playerWin} />
                                }
                            </div>
                            {guesPlayer || data.phase == 0 || data.phase == 4 ? <div className="guessPlayer">
                                <div className="role">
                                    <div className="roleTitle"><PlayerName data={data} id={guesPlayer} /></div>
                                    <Avatar data={data} player={guesPlayer} />
                                </div>
                                <div className="nickNameLock">
                                    {scoreChanges[master] && (<div className="nickCorner">
                                        <div className="score-change">
                                            {'+' + scoreChanges[master]}
                                        </div>
                                    </div>)}
                                    <div className="role-action">отгадывает</div>

                                </div>
                            </div> : ""}
                        </div>
                        {content}
                    </div>
                    {data.userId == data.master && data.phase == 2 && <div class="masterButtons">
                        <div onClick={() => this.wordGuessed(true)} class="wordGuessedButton">Слово угадано!</div>
                        <div onClick={() => this.wordGuessed(false)} class="wordNotGuessedButton">Слово не угадано!</div>
                    </div>}
                    {subtitle && <div className="subtitle">
                        {subtitle}
                        {hasReady && <ReadyBtn isReady={isReady} socket={socket} />}
                    </div>}

                </div>
            </div>
        )
    }
}

