export const CURATED_PLAYLISTS=[
 {id:'after-hours',name:'After Hours',description:'Slow-burn R&B and late-night favorites.',match:track=>/r&b|soul/i.test(track.genre||'')||/weeknd|sza|ocean|bryson|brent|drake|partynextdoor/i.test(track.artist)},
 {id:'alternative',name:'Alternative Essentials',description:'Guitars, big feelings, and songs worth turning up.',match:track=>/rock|alternative|punk/i.test(track.genre||'')||/paramore|blink|goo goo|deftones|linkin|radiohead|nirvana|evanescence|arctic/i.test(track.artist)},
 {id:'golden-hour',name:'Golden Hour',description:'Bright melodies for the long way home.',match:track=>/pop|dance/i.test(track.genre||'')&&!/hip.hop|rap/i.test(track.genre||'')},
 {id:'on-repeat',name:'On Repeat',description:'A little of everything from your shared collection.',match:()=>true},
 {id:'rap-rotation',name:'Rap Rotation',description:'A selection from the hip-hop side of your library.',match:track=>/hip.hop|rap/i.test(track.genre||'')||/kendrick|kanye|drake|travis|tyler|cole|carti|future|asap/i.test(track.artist)},
 {id:'slow-sunday',name:'Slow Sunday',description:'Take a breath. Let the next song come to you.',match:track=>/folk|singer|acoustic|country/i.test(track.genre||'')||/lana|clairo|laufey|beabadoobee|billie|mazzy|cigarettes|bon iver/i.test(track.artist)}
];
export function curatedTracks(id,library){const item=CURATED_PLAYLISTS.find(item=>item.id===id);if(!item)return [];const tracks=library.filter(item.match);return id==='on-repeat'?tracks.filter((_,index)=>index%3===1).slice(0,40):tracks.slice(0,45)}
