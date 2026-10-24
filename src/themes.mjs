export const THEMES=Object.freeze([
 {id:'graphite',name:'Graphite',description:'Soft charcoal',bg:'#18191d',panel:'#121316',raised:'#25262c',accent:'#9baefb',text:'#e8e9ed'},
 {id:'midnight',name:'Midnight',description:'Deep blue',bg:'#111825',panel:'#0d1320',raised:'#1c2738',accent:'#91b6ff',text:'#e8edf8'},
 {id:'paper',name:'Paper',description:'Clean and light',bg:'#f7f8fa',panel:'#eef0f4',raised:'#ffffff',accent:'#4763ba',text:'#202634'},
 {id:'pine',name:'Pine',description:'Quiet green',bg:'#161e1c',panel:'#101815',raised:'#21302a',accent:'#a0ceb0',text:'#e5eee8'},
]);
export const normalizeTheme=id=>THEMES.some(theme=>theme.id===id)?id:id==='light'?'paper':id==='dark'?'midnight':'graphite';
