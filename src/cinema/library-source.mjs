// Catalog entries need an actual media source; YouTube embeds are not library files.
export const canPlayInVela = item => !!item && item.listed !== false && item.playback !== 'youtube';

export function libraryMovie(row) {
 const item = {...JSON.parse(row.data), id:row.id, ownerUid:row.owner};
 // A stored file takes precedence over legacy provider metadata.
 if (row.object_key) item.playback = 'hosted';
 return item;
}
