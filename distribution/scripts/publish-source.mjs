// Portable fallback when the installed Sites workflow helper is unavailable.
// The short-lived source credential is read from hidden stdin and never saved.
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import fs from 'node:fs';
const run=(args,env=process.env)=>{const p=spawnSync('git',args,{encoding:'utf8',env});if(p.status)throw new Error(p.stderr||p.stdout||'Git operation failed');return p.stdout.trim()};
if(process.stdin.isTTY)spawnSync('stty',['-echo'],{stdio:'inherit'});
console.log('Ready for source credential JSON on stdin (input is hidden).');
const lines=createInterface({input:process.stdin,terminal:false});
for await(const line of lines){try{const c=JSON.parse(line);if(!c.remote_url?.startsWith('https://git.chatgpt-team.site/')||!c.token||c.auth_mode!=='http_extra_header')throw new Error('Unsupported source credential');if(!fs.existsSync('.git'))run(['init','-b',c.branch]);run(['config','user.name','Codex']);run(['config','user.email','codex@local']);if(run(['remote']).split('\n').includes('origin'))run(['remote','set-url','origin',c.remote_url]);else run(['remote','add','origin',c.remote_url]);run(['add','.']);const files=run(['diff','--cached','--name-only']).split('\n');if(files.some(f=>f==='.env'||f.startsWith('.env.')&&f!=='.env.example'))throw new Error('Refusing to include environment secrets');if(files.some(Boolean))run(['commit','-m','Build PostgreSQL distribution workspace with claymorphism UI']);const commit=run(['rev-parse','HEAD']);run(['push','-u','origin',`HEAD:${c.branch}`],{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.extraHeader',GIT_CONFIG_VALUE_0:`Authorization: Bearer ${c.token}`});console.log(JSON.stringify({commit_sha:commit,source_pushed:true}));}catch(e){console.error(e.message);process.exitCode=1}finally{if(process.stdin.isTTY)spawnSync('stty',['echo'],{stdio:'inherit'});lines.close();break}}
