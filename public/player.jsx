//import React from "react";
//import ReactDOM from "react-dom"
//import Avatar from '../avatar.jsx'

class PlayerHostControls extends React.Component {
    handleSetPlayerScore(id, evt) {
        evt.stopPropagation();
        popup.prompt({
            content: "Score",
            value: this.props.data.playerScores[id] && this.props.data.playerScores[id].score || "0"
        }, (evt) => evt.proceed && this.props.socket.emit("set-player-score", {
            playerId: id,
            score: evt.input_value
        }));
    }

    removePlayer(id, evt) {
        evt.stopPropagation();
        popup.confirm(
            { content: `Removing ${window.commonRoom.getPlayerName(id)}?` },
            (evt) => evt.proceed && this.props.socket.emit("remove-player", id)
        );
    }

    giveHost(id, evt) {
        evt.stopPropagation();
        popup.confirm(
            { content: `Give host ${window.commonRoom.getPlayerName(id)}?` },
            (evt) => evt.proceed && this.props.socket.emit("give-host", id));
    }

    giveEye(id, evt) {
        evt.stopPropagation();
        popup.confirm(
            { content: `Give eye ${window.commonRoom.getPlayerName(id)}?` },
            (evt) => evt.proceed && this.props.socket.emit("give-eye", id));
    }

    render() {
        const
            data = this.props.data,
            id = this.props.id,
            blackSlotButton = <i
                className={cs("material-icons", "host-button", { "black-slot-mark": data.hostId !== data.userId })}
                title={data.hostId === data.userId ? (!data.blackEye.includes(id)
                    ? "Give black slot" : "Remove black slot") : "Black slot"}
                onClick={(evt) => this.giveEye(id, evt)}>
                {!data.blackEye.indexOf(id) ? "visibility_off" : "visibility"}
            </i>;
        return (
            <div className="player-host-controls">
                {data.hostId === data.userId && data.players.includes(id) ?
                    (<i className="material-icons host-button change-player-score"
                        title="Change"
                        onClick={(evt) => this.handleSetPlayerScore(id, evt)}>
                        edit
                    </i>) : ""}
                {(data.hostId === data.userId && data.userId !== id) ? (
                    <i className="material-icons host-button"
                        title="Give host"
                        onClick={(evt) => this.giveHost(id, evt)}>
                        vpn_key
                    </i>) : ""}
                {(data.hostId === data.userId && data.userId !== id) ? (
                    <i className="material-icons host-button"
                        title="Remove"
                        onClick={(evt) => this.removePlayer(id, evt)}>
                        delete_forever
                    </i>) : ""}
                    {(data.spectators.includes(id) && data.hostId === data.userId) ? (
                    blackSlotButton
                ) : ""}
                {(data.hostId === id) ? (
                    <i className="material-icons host-button inactive"
                        title="Game host">
                        stars
                    </i>
                ) : ""}
            </div>
        )
    }
}

class Player extends React.Component {

    clickSaveAvatar() {
        window.commonRoom.handleClickSetImage('avatar');
    }


    render() {
        const { data, socket, id } = this.props;
        const { master, readyPlayers } = data;
        const isReady = readyPlayers.includes(id);
        const isMaster = id === master;

        return (
            <div className={cs("player", {
                ready: isReady && !isMaster,
                offline: !~data.onlinePlayers.indexOf(id),
                self: id === data.userId,
                master: isMaster,
                guesser: id === data.guesPlayer
            })} onTouchStart={(e) => e.target.focus()}>
                <div className="player-inner">
                    <div className="player-avatar-section"
                        onTouchStart={(e) => e.target.focus()}
                        onClick={() => (id === data.userId) && this.clickSaveAvatar()}>
                        <Avatar data={data} player={id} />
                        {id === data.userId ? (<i className="change-avatar-icon material-icons" title="Change avatar">
                            edit
                        </i>) : ""}
                    </div>
                    <div className="player-name-section">
                        <UserAudioMarker user={id} data={data} />
                        <span className="player-name">
                            <PlayerName data={data} id={id} />
                        </span>
                        &nbsp;
                        <PlayerHostControls id={id} data={data} socket={socket} />
                        <span className="spacer" />
                        <span className="score-cont">
                            <span className="score">
                                {data.playerScores[id] || 0}
                            </span>
                        </span>
                    </div>
                </div>
            </div>
        );
    }
}

class PlayerList extends React.Component {

    joinPlayersClick(evt) {
        evt.stopPropagation();
        if (!this.props.data.teamsLocked)
            this.props.socket.emit("players-join");
    }

    render() {
        const
            socket = this.props.socket,
            data = this.props.data;
        return (
            <div className="player-list-section">
                <div className="player-list">
                    {data.players.map((id => (
                        <Player key={id} data={data} id={id} socket={socket} />
                    )))}
                    {!data.players.includes(data.userId) && (
                        <div
                            className="player join-button"
                            onClick={(evt) => this.joinPlayersClick(evt)}
                        >
                            <div className="player-inner">
                                <div className="player-avatar-section">
                                    <div className="avatar" />
                                </div>
                                <div className="player-name-section">
                                    <span className="player-name">
                                        {t('Enter')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    }
}

class Spectator extends React.Component {
    render() {
        const
            data = this.props.data,
            socket = this.props.socket,
            id = this.props.id;
        const blackSlotButton = <i
            className={cs("material-icons", "host-button", { "black-slot-mark": data.hostId !== data.userId })}
            title={data.hostId === data.userId ? (!data.blackEye.includes(id)
                ? "Give black slot" : "Remove black slot") : "Black slot"}
            onClick={(evt) => this.giveEye(id, evt)}>
            {!data.blackEye.indexOf(id) ? "visibility" : "visibility"}
        </i>;
        return (
            <span className={cs("spectator", { self: id === data.userId })}>
                &nbsp;{data.voiceEnabled ? <UserAudioMarker user={id} data={data} /> : "●"}&nbsp;
                <span className="spectator-name"><PlayerName data={data} id={id} /></span>
                {(data.blackEye.includes(id)) ? (
                    <span className="black-slot-button">&nbsp;{blackSlotButton}</span>
                ) : ""}
                &nbsp;
                <PlayerHostControls id={id} data={data} socket={socket} />
            </span>
        )
    }
}

class SpectatorList extends React.Component {
    joinSpectatorsClick(evt) {
        evt.stopPropagation();
        if (!this.props.data.teamsLocked)
            this.props.socket.emit("spectators-join");
    }

    render() {
        const
            data = this.props.data,
            socket = this.props.socket,
            empty = !data.spectators.length;
        return (
            <div className="spectator-placeholder">
                <div className={cs('spectators-section')}>
                    <div
                        className={cs("spectators", { empty: empty })}
                        onClick={(evt) => this.joinSpectatorsClick(evt)}
                    >
                        {t('Spectators')}:{empty && ' ...'}
                        {data.spectators.map((id => (
                            <Spectator key={id} data={data} id={id} socket={socket} />
                        )))}
                    </div>
                </div>
            </div>
        )
    }
}
