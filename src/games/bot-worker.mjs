import {botAction} from './arcade-bots.mjs';
self.onmessage=({data})=>{try{self.postMessage({key:data.key,action:botAction(data.state,data.uid,data.difficulty)})}catch(error){self.postMessage({key:data.key,error:error.message})}};
