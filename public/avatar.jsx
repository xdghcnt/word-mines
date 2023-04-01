//import React from "react";
//import ReactDOM from "react-dom"

class Avatar extends React.Component {
    render() {
        const
            avatar = window.commonRoom.getPlayerAvatarURL(this.props.player),
            hasAvatar = !!avatar;
        return (
            <div className={cs("avatar", {"has-avatar": hasAvatar})}
                 style={{
                     "background-image": hasAvatar
                         ? `url(${avatar})`
                         : `none`,
                     "background-color": hasAvatar
                         ? `transparent`
                         : this.props.data.playerColors[this.props.player]
                 }}>
                {!hasAvatar ? (
                    <i className="material-icons avatar-stub">
                        person
                    </i>
                ) : ""}
            </div>
        );
    }
}
