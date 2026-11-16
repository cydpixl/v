// Existing external library files do not occupy this Worker's R2 bucket.
// Raise Vela's application quota; R2 does not impose the former 8 GiB limit.
// This is a shared budget across chat files, expressions and uploaded movies.
// Monitor R2 usage/billing as it grows beyond Cloudflare's free allowance.
export const STORAGE_CAP=32*1024**3;
// Reserve another 2 GiB for chat attachments and expressions when the
// media library reaches its normal cap. No existing objects are removed.
export const MESSAGE_STORAGE_CAP=STORAGE_CAP+2*1024**3;
export const storageSQL="SELECT COALESCE((SELECT sum(size) FROM uploads),0)+COALESCE((SELECT sum(size) FROM chat_uploads WHERE expires>CAST(strftime('%s','now') AS INTEGER)*1000),0)+COALESCE((SELECT sum(size) FROM expressions),0)+COALESCE((SELECT sum(size) FROM movie_uploads WHERE expires>?),0)+COALESCE((SELECT sum(CAST(json_extract(data,'$.size') AS INTEGER)) FROM movies WHERE object_key<>''),0)";
