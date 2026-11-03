// Single resolver for the usage view source file.
//
// The local rewrite lives in usage-ui.local.cjs while upstream keeps
// usage-ui.cjs untouched, so upstream patches stay mergeable. Every consumer
// (App sidecar, IDE adapter tools, gates, README renderer) must read the same
// file; when the local file is absent — an older install — fall back to the
// upstream baseline instead of failing.
import {existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here=dirname(fileURLToPath(import.meta.url));

export function usageViewPath(){
  const local=join(here,'usage-ui.local.cjs');
  return existsSync(local)?local:join(here,'usage-ui.cjs');
}

export function usageViewExpression(source){
  const marker='module.exports = ';
  return `(${source.slice(source.indexOf(marker)+marker.length).trim().replace(/;$/,'')})`;
}
