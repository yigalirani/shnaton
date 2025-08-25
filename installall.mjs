import { exec } from 'node:child_process';

async function  runit(cmd){
  
  await exec(cmd,(error, stdout, stderr)=>{
    console.log(cmd)
    console.log(stdout)
    console.error(stderr)
  })
}
async function main(){
  await runit('cd tools/eslint && npm install')
  await runit('cd tools/esbuild && npm install')
  await  runit('npm install')
}
main()