/** R4 volume surfaces: fixed pigment bands and coherent pixel-scale material.
 * Functions consume presence density; they cannot invent occupied geometry.
 */
export type MaterialVolumeFamily='gas_mass'|'mist_bank'|'dust_swarm';
export type VolumeInk=readonly[number,number,number];
export const VOLUME_INKS:Record<MaterialVolumeFamily,readonly VolumeInk[]>={
 gas_mass:[[27,37,34],[45,57,50],[67,81,69],[95,111,92],[124,140,114],[61,116,96]],
 mist_bank:[[43,57,54],[66,86,79],[96,116,105],[128,143,128],[161,171,151],[73,131,109]],
 dust_swarm:[[43,46,39],[75,79,64],[110,113,90],[148,144,114],[179,169,135],[83,134,106]],
};
export function volumeGrain(x:number,y:number,seed:number):number {
 let n=Math.imul(Math.floor(x/3)+seed,374761393)^Math.imul(Math.floor(y/2)+17,668265263);
 n=Math.imul(n^(n>>>13),1274126177);return(n>>>0)%13;
}
/** Stable identity belongs to a fragment, never to a moving screen-space grid. */
export function dustIdentity(index:number,seed:number):number {
 let n=Math.imul(index+31,374761393)^Math.imul(seed+73,668265263);
 n=Math.imul(n^(n>>>13),1274126177);return (n>>>0)/4294967296;
}
