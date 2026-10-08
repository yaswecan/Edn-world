import {networkInterfaces} from 'node:os';
import {isIPv4} from 'node:net';

export function lanAddress({address,interfaces=networkInterfaces()}={}) {
 const privateIPv4=value=>{
  if(!isIPv4(value))return false;
  const [a,b]=value.split('.').map(Number);
  return a===10||(a===172&&b>=16&&b<=31)||(a===192&&b===168);
 };
 const candidates=[...new Set(Object.entries(interfaces)
  .filter(([name])=>address||!/^(lo|utun|tun|tap|awdl|llw|bridge|docker|veth)/i.test(name))
  .flatMap(([,entries])=>entries||[])
  .filter(entry=>!entry.internal&&privateIPv4(entry.address))
  .map(entry=>entry.address))];
 if(address){
  if(!candidates.includes(address))throw Error('Le partage exige une adresse IPv4 privée présente sur cet ordinateur.');
  return address;
 }
 if(!candidates.length)throw Error('Aucun réseau local détecté. Connectez cet ordinateur au Wi-Fi des élèves, puis relancez npm run dev:lan.');
 if(candidates.length>1)throw Error(`Plusieurs réseaux détectés : ${candidates.join(', ')}. Choisissez celui des élèves avec npm run dev:lan -- --lan-host=ADRESSE_IP.`);
 return candidates[0];
}
