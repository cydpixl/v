// Existing external library files do not occupy this Worker's R2 bucket.
export const STORAGE_CAP=8*1024**3;
// Keep upload capacity for messages and expressions when media fills the shared cap.
export const MESSAGE_STORAGE_CAP=STORAGE_CAP+175_000_000;
export const storageSQL="SELECT COALESCE((SELECT sum(size) FROM uploads),0)+COALESCE((SELECT sum(size) FROM chat_uploads WHERE expires>CAST(strftime('%s','now') AS INTEGER)*1000),0)+COALESCE((SELECT sum(size) FROM expressions),0)+COALESCE((SELECT sum(size) FROM movie_uploads WHERE expires>?),0)+COALESCE((SELECT sum(CAST(json_extract(data,'$.size') AS INTEGER)) FROM movies WHERE object_key<>''),0)";
