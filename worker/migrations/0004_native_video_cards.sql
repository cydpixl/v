-- Refresh existing bot collections without changing messages from people.
-- Keep only entries with media files and normalize stored-file metadata.
UPDATE messages
SET attachment=json_set(attachment,'$.items',json(COALESCE((
 SELECT json_group_array(json_remove(json_set(item.value,
  '$.playback',CASE WHEN movie.object_key<>'' THEN 'hosted' ELSE COALESCE(json_extract(movie.data,'$.playback'),'direct') END,
  '$.height',json_extract(movie.data,'$.height'),
  '$.duration',json_extract(movie.data,'$.duration')
 ),'$.embedAllowed'))
 FROM json_each(messages.attachment,'$.items') AS item
 JOIN movies AS movie ON movie.id=json_extract(item.value,'$.id')
 WHERE COALESCE(json_extract(movie.data,'$.listed'),1)<>0
 AND (movie.object_key<>'' OR COALESCE(json_extract(movie.data,'$.playback'),'')<>'youtube')
),'[]')))
WHERE sender='vela-system-bot-v1' AND deleted=0
AND json_extract(attachment,'$.kind') IN ('bodycam-library','daily-dose-library');

UPDATE messages
SET text=CASE json_extract(attachment,'$.kind') WHEN 'bodycam-library' THEN 'Bodycam' ELSE 'Daily Dose of Internet' END
 || ' · ' || json_array_length(attachment,'$.items') || ' videos'
WHERE sender='vela-system-bot-v1' AND deleted=0
AND json_extract(attachment,'$.kind') IN ('bodycam-library','daily-dose-library');
