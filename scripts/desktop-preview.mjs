// Keep the user-facing desktop preview stable while other chats edit the app.
// Development servers on other ports retain Vite's normal live updates.
export function desktopPreview(){
 return {
  name:'vela-stable-desktop-preview',
  apply:'serve',
  config(config){
   if(Number(config.server?.port)===5188&&process.env.VELA_LIVE_RELOAD!=='1')return {server:{hmr:false}};
  }
 };
}
