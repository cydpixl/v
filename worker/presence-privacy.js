export const privateStatus=status=>status==='dnd'||status==='invisible';
export function publicPresence(person,viewer){
 if(!person||person.uid===viewer||!privateStatus(person.presence||person.status))return person;
 return {...person,...('presence'in person?{presence:'offline'}:{status:'offline'}),last_seen:0,last_read:0};
}
