/* Public compatibility contract: schema migrations never depend on UI version. */
(function(root){
 'use strict';
 const VERSION=Object.freeze({studio:'0.10.0',projectSchema:1,packageFormat:1,tduiApi:1,mpyAbi:'6.3'});
 function stamp(design){
  if(design.version!==VERSION.projectSchema)throw Error('Unsupported project schema. Open it with a compatible App Builder release.');
  const prior=design.provenance||{};
  design.provenance={...prior,createdWith:prior.createdWith||VERSION.studio,lastEditedWith:VERSION.studio};
  design.application={version:'0.1.0',...design.application};
  return design;
 }
 const api={VERSION,stamp};
 if(typeof module!=='undefined')module.exports=api;else root.TDVersion=api;
})(typeof window!=='undefined'?window:globalThis);
