import {build} from 'esbuild';
await build({stdin:{contents:'export {createClient} from "@supabase/supabase-js";',resolveDir:process.cwd()},outfile:'assets/vendor/supabase.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
await build({entryPoints:['assets/workspace.js'],outfile:'assets/app.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'eof'});
