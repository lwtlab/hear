import assert from 'node:assert/strict';
export const REQUIRED_FUSES=Object.freeze({runAsNode:false,enableNodeOptionsEnvironmentVariable:false,enableNodeCliInspectArguments:false,enableEmbeddedAsarIntegrityValidation:true,onlyLoadAppFromAsar:true,grantFileProtocolExtraPrivileges:false});
export function productionDesktopConfig(base){
 assert.equal(base.appId,'net.thucydides.lwt.hear');assert.equal(base.productName,'AIHear');assert.equal(base.afterPack,'scripts/after-pack.js');
 for(const [key,value]of Object.entries(REQUIRED_FUSES))assert.equal(base.electronFuses?.[key],value,'Production fuse configuration required');
 assert(Array.isArray(base.files)&&Array.isArray(base.extraResources)&&Array.isArray(base.asarUnpack));return structuredClone(base);
}
export function validateFuseWire(wire){
 assert.equal(wire.version,'1');for(const [key,index]of Object.entries({runAsNode:0,enableNodeOptionsEnvironmentVariable:2,enableNodeCliInspectArguments:3,enableEmbeddedAsarIntegrityValidation:4,onlyLoadAppFromAsar:5,grantFileProtocolExtraPrivileges:7}))assert.equal(wire[index],REQUIRED_FUSES[key]?49:48,'Actual packaged fuse differs from production policy');
 return Object.fromEntries(Object.keys(REQUIRED_FUSES).map(key=>[key,REQUIRED_FUSES[key]]));
}
