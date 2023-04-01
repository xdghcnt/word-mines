class ScoreChange extends React.Component {
    render() {
        const { change } = this.props;
        if (change === undefined) {
            return null;
        } else {
            const changeText = ((change > 0) ? '+' : '') + change;
            return (
                <span class="score-change">
                    {changeText}
                </span>
            );
        }
    }
}

class Hint extends React.Component {
    handleEditCodeWord() {
        const { data, player } = this.props;
        const word = data.closedHints[player];
        popup.prompt({ content: "Edit command", value: word }, (evt) => {
            if (evt.proceed && evt.input_value.trim())
                this.props.socket.emit("edit-code-word", evt.input_value);
        });
    }

    toggleHintBan(user) {
        this.props.socket.emit("toggle-hint-ban", user);
    }

    setLike(user) {
        this.props.socket.emit("set-like", user);
    }

    render() {
        const { data, player, index } = this.props;
        const { bannedHints, unbannedHints, hints, closedHints, playerLiked, userId, master, phase,
            wordGuessed, scoreChanges, rounds, players } = data;
        const banned = bannedHints?.[player];
        const unbanned = unbannedHints?.[player];
        const isMaster = userId === master;
        const isGuesser = userId === data.guesPlayer;
        const origText = hints[player] || (closedHints && closedHints[player]);
        const text = origText ? window.hyphenate(origText) : null;

        const corners = [];
        if (!isGuesser || playerLiked || (phase === 4 && !wordGuessed)) {
            corners.push(
                <div className="bl-corner">
                    <Avatar data={data} player={player} />
                    <div className="NickNameHerlock">
                        <PlayerName data={data} id={player} />
                    </div>
                </div>
            )
        }

        if (phase == 1 && userId == player) {
            corners.push(
                <div className="tr-corner">
                    {(phase === 1)
                        ? <i className="material-icons host-button edit-word-button"
                            title="Edit"
                            onClick={() => this.handleEditCodeWord()}>
                            &nbsp;edit
                        </i>
                        : ""}
                </div>
            )
        }

        if (phase === 2 || (phase === 4 && banned)) {
            const showWarnAvatars = (!isMaster && !isGuesser && players.includes(userId)) || phase === 4;
            corners.push(
                <div className="tr-corner">
                    <div
                        className="ban-hint-button" onClick={() => this.toggleHintBan(player)}
                    >
                        {(showWarnAvatars && banned)
                            ? <Avatar data={data} player={banned} />
                            : ""}
                        {(showWarnAvatars && unbanned)
                            ? <Avatar data={data} player={unbanned} />
                            : ""}
                        <img className="mina" src="/words-mines/mina.png"></img>
                    </div>
                </div>
            )
        }
        if (
            playerLiked === player
            || (phase === 4 && !banned && isGuesser && playerLiked == null && wordGuessed)
        ) {
            corners.push(
                <div className="tr-corner">
                    <div
                        className="set-like-button"
                        onClick={() => this.setLike(player)}
                    >
                        <i className="material-icons">{
                            playerLiked === player ? "favorite" : "favorite_outline"
                        }</i>
                    </div>
                </div>
            )
            const delta = scoreChanges[player];
            if (delta) {
                const changeText = ((delta > 0) ? '+' : '') + delta;
                corners.push(
                    <div className="tl-corner">
                        <div className="score-change">
                            {changeText}
                        </div>
                    </div>
                )
            }
        }


        return (
            <div
                className={cs("card hint", { banned: !!banned })}
                style={Messy.getStyle(rounds + '_' + index)}
            >
                {corners}
                {text != null
                    ? <div className={cs("hint-text", { banned: !banned })}>{text.split(" ").map(word => <div>{word}</div>)}</div>
                    : <div className="card-logo"
                        style={Messy.getLogoStyle(rounds + '_' + index)} />}

            </div>
        )
    }
}

class Hints extends React.Component {
    render() {
        const { data, socket } = this.props;
        return (
            <div className="words">
                {data.playerHints.map((player, i) => (
                    <Hint player={player} data={data} socket={socket} key={i} index={i} />
                ))}
            </div>
        );
    }
}

class Messy {
    static genZigzag() {
        let x = 0;
        const points = [{ x, y: Math.random() }];
        const avgSpikes = 20;
        while (x < 1) {
            x += Math.random() / avgSpikes;
            x = Math.min(x, 1);
            points.push({ x, y: Math.random() });
        }
        return points;
    }

    static frac2perc({ x, y }, top) {
        const maxDent = 0.03;
        const xDent = (top) ? x : 1 - x;
        const yDent = (top) ? maxDent * y : 1 - maxDent * y;
        const n2text = (n) => (n * 100).toFixed(1) + '%';
        return n2text(xDent) + ' ' + n2text(yDent);
    }

    static genPath() {
        const percentages = [
            ...this.genZigzag().map(p => this.frac2perc(p, true)),
            ...this.genZigzag().map(p => this.frac2perc(p, false)),
        ];
        const path = `polygon(${percentages.join()})`;
        return path;
    }

    static genTransform() {
        return `rotate(${(Math.random() - 0.5) * 6}deg)`;
    }

    static genLogoTransform() {
        return `rotate(${((Math.random() - 0.5) * 50) - 7}deg)`;
    }

    static getBackgroundPosition() {
        return `${(Math.random() - 0.5) * 200}% ${(Math.random() - 0.5) * 200}%`;
    }

    static cache = {}
    static cacheLogo = {}

    static getStyle(key) {
        return {};
    }

    static getLogoStyle(key) {
        if (!this.cacheLogo.hasOwnProperty(key)) {
            this.cacheLogo[key] = {
                transform: this.genLogoTransform()
            }
        }
        return this.cacheLogo[key];
    }

}
