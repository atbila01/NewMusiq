import { useEffect, useState } from "react";
import Icon from "./Icon";
import ListenerComments from "./ListenerComments";
import { usePlayer } from "@experience/lib/player";
import { AddToPlaylist, LikeButton } from "./SongItem";
import { useApi } from "@experience/lib/profile";
const formatTime=s=>`${Math.floor(Math.max(0,s||0)/60)}:${String(Math.floor(Math.max(0,s||0))%60).padStart(2,"0")}`;
function TrackLyrics({track,time}) {
 const api=useApi(); const [data,setData]=useState(null);
 useEffect(()=>{let active=true;setData(null);api(`/tracks/${track.id}/lyrics`).then(r=>r.json()).then(d=>{if(active)setData(d);}).catch(()=>{});return()=>{active=false;};},[api,track.id]);
 if(!data)return null;
 if(data.lines?.length){const index=data.lines.reduce((a,l,i)=>l.t<=time?i:a,-1);return <div className="lyrics-lines">{data.lines.map((l,i)=><p key={i} className={i===index?"active":""}>{l.text}</p>)}</div>;}
 return data.text ? <div className="lyrics-lines"><p>Lyrics</p>{data.text.split(/\r?\n/).map((line,i)=><p key={i}>{line}</p>)}</div> : <p className="rp-muted">Lyrics are not available for this release.</p>;
}
export default function PlayerBar(){
 const player=usePlayer();const track=player.track;const [expanded,setExpanded]=useState(false);
 useEffect(()=>{const open=()=>setExpanded(true);window.addEventListener("nm-open-player",open);return()=>window.removeEventListener("nm-open-player",open);},[]);
 if(!track)return <div className="player-bottom-bar browse-bar" data-testid="player-empty"><div className="browse-copy"><p className="player-kicker">Your music home</p><strong>Choose a song to start listening</strong><span>Explore a region or find music in your library.</span></div></div>;
 const duration=player.duration||0;const time=Math.min(player.time,duration||player.time);
 return <div className={`player-bottom-bar ${expanded?"expanded":""}`} data-testid="player-bar">
 {expanded&&<button className="collapse-player" aria-label="Collapse player" onClick={()=>setExpanded(false)}>⌄</button>}
 <div className="bottom-song-summary"><div className="mini-album">{track.cover?<img src={track.cover} alt="Track artwork"/>:<span>♪</span>}</div><div className="track-heading"><p>{track.preview?"Preview":"Now playing"}</p><button className="expand-player-title" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}>{track.title}</button><span>{track.artist_name}</span></div>{track.item&&<div className="bar-actions"><LikeButton item={track.item}/><AddToPlaylist item={track.item}/></div>}</div>
 <div className="transport"><button aria-label="Restart track" onClick={()=>player.seek(0)}><Icon name="previous"/></button><button className="play-pause" aria-label={player.isPlaying?"Pause":"Play"} onClick={player.toggle}><Icon name={player.isPlaying?"pause":"play"}/></button></div>
 <div className="timeline"><input aria-label="Song progress" type="range" min="0" max={duration||0} step="0.1" value={time} onChange={e=>player.seek(Number(e.target.value))}/><div><span>{formatTime(time)}</span><span>{formatTime(duration)}</span></div></div>
 {player.error&&<p role="alert" className="status">{player.error}</p>}
 {expanded&&<div className="expanded-lyrics release-details"><h2>{track.title}</h2><p>{track.artist_name}</p>{track.item?.kind==="track"&&<TrackLyrics track={track} time={time}/>}<ListenerComments/></div>}
 </div>;
}
