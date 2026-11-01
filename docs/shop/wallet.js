/* Local simulation only. No Epic account, payment, or inventory API is called. */
(function(root){
  'use strict';
  const KEY='ashlan-sandbox-wallet-v1';
  const MAX=999999999;
  function createWallet(storage){
    function read(){
      try{
        const value=JSON.parse(storage.getItem(KEY)||'null');
        if(value&&Number.isSafeInteger(value.balance)&&value.balance>=0&&value.balance<=MAX&&Array.isArray(value.purchases))return {...value,purchases:value.purchases.filter(p=>p&&typeof p.id==='string'&&p.item&&typeof p.item.name==='string').slice(-2000)};
      }catch{}
      return {balance:0,purchases:[]};
    }
    function write(value){storage.setItem(KEY,JSON.stringify(value));return value;}
    function keys(item){return Array.isArray(item.ownershipKeys)&&item.ownershipKeys.length?item.ownershipKeys:[item.cosmeticId||item.track?.id||item.id];}
    function owns(item,value=read()){
      if(value.purchases.some(p=>p.id===item.id))return true;
      const owned=new Set(value.purchases.flatMap(p=>keys(p.item)));
      return keys(item).every(key=>owned.has(key));
    }
    function topUp(amount){
      if(![800,2400,4500,12500].includes(amount))throw Error('Choose a listed V-Bucks pack.');
      const value=read();if(value.balance+amount>MAX)throw Error('Your balance is at its limit.');
      return write({...value,balance:value.balance+amount});
    }
    function purchase(item){
      const value=read();
      if(!item||typeof item.id!=='string'||!Number.isSafeInteger(item.price)||item.price<0)throw Error('This item has no purchasable shop offer.');
      if(owns(item,value))throw Error('Already owned in your locker.');
      if(value.balance<item.price)throw Error('Add free V-Bucks to purchase this item.');
      if(value.purchases.length>=2000)throw Error('Your locker is full.');
      return write({balance:value.balance-item.price,purchases:[...value.purchases,{id:item.id,date:new Date().toISOString(),price:item.price,item:JSON.parse(JSON.stringify(item))}]});
    }
    return {read,topUp,purchase,owns,key:KEY};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={createWallet};
  else root.AshlanWallet={createWallet};
})(globalThis);
