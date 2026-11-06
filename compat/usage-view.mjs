// Single resolver for the usage view source file.
//
// The canonical usage dashboard lives in compat/usage-ui.cjs.
// Every consumer (App sidecar, IDE adapter, tools, gates, README renderer)
// reads through this single resolver.
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));

export function usageViewPath(){
  return join(here,'usage-ui.cjs');
}

export function usageViewExpression(source){
  const marker='module.exports = ';
  return `(${source.slice(source.indexOf(marker)+marker.length).trim().replace(/;$/,'')})`;
}
