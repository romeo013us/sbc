/* SBC V48.6 compatibility shim. Interaction is owned by kim-dock-v48.8.js. */
(function(){
  'use strict';
  window.initKimDockV486 = function(){ return window.initKimDockV488 ? window.initKimDockV488() : false; };
})();
