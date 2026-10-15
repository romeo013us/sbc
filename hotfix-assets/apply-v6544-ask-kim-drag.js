'use strict';
const fs = require('node:fs');
const path = require('node:path');
const MARKER = 'SBC_ASK_KIM_DRAGGABLE_V6544';
function once(source, oldText, newText, label) {
  const count = source.split(oldText).length - 1;
  if (count !== 1) throw new Error(MARKER + ': ' + label + ' anchor count ' + count);
  return source.replace(oldText, newText);
}
function apply(root) {
  const pub = path.join(root, 'public');
  const indexPath = path.join(pub, 'index.html');
  const modulePath = path.join(__dirname, 'sbc-ask-kim-drag-v6544.js');
  if (!fs.existsSync(indexPath) || !fs.existsSync(modulePath)) throw new Error(MARKER + ': required UI files are missing');
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!html.includes('/sbc-ask-kim-drag-v6544.js')) {
    html = once(html, '</body>', '<script src="/sbc-ask-kim-drag-v6544.js?v=65.1.43-kim-drag"></script>\n</body>', 'Ask Kim draggable UI script insertion');
  }
  fs.writeFileSync(indexPath, html);
  const swPath = path.join(pub, 'sw.js');
  if (fs.existsSync(swPath)) {
    let sw = fs.readFileSync(swPath, 'utf8');
    const cache = sw.match(/const CACHE='[^']+'/);
    if (cache) { sw = sw.replace(cache[0], "const CACHE='sbc-static-v65-1-44-kim-drag'"); fs.writeFileSync(swPath, sw); }
  }
  fs.copyFileSync(modulePath, path.join(pub, 'sbc-ask-kim-drag-v6544.js'));
  fs.copyFileSync(modulePath, path.join(root, 'hotfix-assets', 'sbc-ask-kim-drag-v6544.js'));
  fs.copyFileSync(__filename, path.join(root, 'hotfix-assets', 'apply-v6544-ask-kim-drag.js'));
  console.log('[' + MARKER + '] Ask Kim draggable panel patch applied.');
}
module.exports = { apply };
