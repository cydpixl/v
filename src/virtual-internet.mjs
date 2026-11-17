export const PLANS=[
 {id:'essential',name:'Essential',down:100,up:20,price:35},
 {id:'plus',name:'Plus',down:300,up:50,price:65},
 {id:'ultra',name:'Ultra',down:600,up:100,price:110},
 {id:'gig',name:'Gig',down:1000,up:200,price:170},
 {id:'5gig',name:'5 Gig',down:5000,up:1000,price:300}
];
const key=owner=>'vela.virtual.internet.'+owner;
export function readVirtualInternet(owner){
 let value;try{value=JSON.parse(localStorage.getItem(key(owner))||'null')}catch{}
 const credits=Number.isFinite(value?.credits)?Math.max(0,value.credits):2500;
 return {plan:PLANS.some(p=>p.id===value?.plan)?value.plan:null,credits,month:Math.max(1,Math.floor(value?.month||1)),history:Array.isArray(value?.history)?value.history.slice(0,30):[]};
}
function save(owner,value){localStorage.setItem(key(owner),JSON.stringify(value));window.dispatchEvent(new CustomEvent('vela-internet-changed',{detail:owner}));return value}
export const currentVirtualPlan=owner=>PLANS.find(p=>p.id===readVirtualInternet(owner).plan)||null;
export const simulatedMbps=owner=>currentVirtualPlan(owner)?.down||25;
export function buyVirtualPlan(owner,id){
 const plan=PLANS.find(p=>p.id===id);if(!plan)throw Error('Choose a valid plan.');
 const value=readVirtualInternet(owner);if(value.plan===id)return value;
 if(value.credits<plan.price)throw Error('Not enough demo credits for this plan.');
 value.credits-=plan.price;value.plan=id;value.history.unshift({text:'Changed to '+plan.name,amount:-plan.price,at:Date.now()});
 return save(owner,value);
}
export function addDemoCredits(owner){const value=readVirtualInternet(owner);value.credits+=500;value.history.unshift({text:'Added demo credits',amount:500,at:Date.now()});return save(owner,value)}
export function advanceDemoMonth(owner){
 const value=readVirtualInternet(owner),plan=PLANS.find(p=>p.id===value.plan);if(plan&&value.credits<plan.price)throw Error('Not enough demo credits to renew this plan.');
 if(plan){value.credits-=plan.price;value.history.unshift({text:plan.name+' monthly renewal',amount:-plan.price,at:Date.now()})}
 value.month++;return save(owner,value);
}
