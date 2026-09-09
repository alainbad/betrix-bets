export const NUMBERS=[1,2,5,10,20,50],CHIPS=[10,25,50,100,500];
export const WHEEL=Array.from({length:40},(_,i)=>i%2===0?1:i<20?2:i<30?5:i<36?10:i===37?20:50);
export function rand(n){const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n}
export function outcome(){const index=rand(40),boostNumber=NUMBERS[rand(6)],boost=[2,3,5][rand(3)];return{index,number:WHEEL[index],boostNumber,boost}}
export function settle(bets,result){for(const [key,amount]of Object.entries(bets))if(!NUMBERS.includes(Number(key))||!Number.isSafeInteger(amount)||amount<0)throw Error('Invalid bet');const total=Object.values(bets).reduce((s,n)=>s+n,0);if(total>100000)throw Error('Maximum total bet is 100,000 credits');const multiplier=result.number===result.boostNumber?result.boost:1,winBet=bets[result.number]||0,payout=winBet*(1+result.number*multiplier);return{stake:total,payout,profit:payout-total,multiplier,winBet}}
