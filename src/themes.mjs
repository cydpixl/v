export const THEMES=Object.freeze([
 {id:'graphite',name:'Graphite',description:'Soft charcoal',bg:'#18191d',panel:'#121316',raised:'#25262c',accent:'#9baefb',text:'#e8e9ed'},
 {id:'midnight',name:'Midnight',description:'Deep blue',bg:'#111825',panel:'#0d1320',raised:'#1c2738',accent:'#91b6ff',text:'#e8edf8'},
 {id:'paper',name:'Paper',description:'Clean and light',bg:'#f7f8fa',panel:'#eef0f4',raised:'#ffffff',accent:'#4763ba',text:'#202634'},
 {id:'pine',name:'Pine',description:'Quiet green',bg:'#161e1c',panel:'#101815',raised:'#21302a',accent:'#a0ceb0',text:'#e5eee8'},
 {id:'obsidian',name:'Obsidian',description:'True black',bg:'#08090b',panel:'#050607',raised:'#15171c',accent:'#c4cbd9',text:'#eef0f5'},
 {id:'amethyst',name:'Amethyst',description:'Smoky violet',bg:'#1b1725',panel:'#12101b',raised:'#2a2439',accent:'#c5acf5',text:'#eee8f8'},
 {id:'rose',name:'Rose',description:'Warm blush',bg:'#24191e',panel:'#191015',raised:'#36252d',accent:'#f1acbf',text:'#f7e9ef'},
 {id:'ocean',name:'Ocean',description:'Inky teal',bg:'#101e24',panel:'#0a151b',raised:'#1c3039',accent:'#85d4df',text:'#e2f0f4'},
 {id:'ember',name:'Ember',description:'Warm charcoal',bg:'#211a16',panel:'#16110e',raised:'#33271f',accent:'#efbc91',text:'#f4ede5'},
 {id:'coffee',name:'Coffee',description:'Soft espresso',bg:'#201c1b',panel:'#151211',raised:'#312b29',accent:'#d7bca4',text:'#f0eae4'},
 {id:'lavender',name:'Lavender',description:'Pale lilac',bg:'#f5f2fa',panel:'#eae5f1',raised:'#ffffff',accent:'#7355a6',text:'#30273d',light:true},
 {id:'sand',name:'Sand',description:'Warm daylight',bg:'#faf6ef',panel:'#f0e8db',raised:'#fffdf8',accent:'#8d5f38',text:'#3b3026',light:true},
]);
export const normalizeTheme=id=>THEMES.some(theme=>theme.id===id)?id:id==='light'?'paper':id==='dark'?'midnight':'graphite';
