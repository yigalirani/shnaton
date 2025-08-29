// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { spawn,exec } = await import('node:child_process');

function makeFilter() {
  let count = 0;
  return function (txt) {
    const lines = txt.split('\n').filter(x => x.includes('Linting code'));
    const ans = [];
    for (const line of lines) {
      count++;
      const filename = line.split('Linting code for ').at(-1);
      ans.push(`${count} ${filename}`);
    }
    return ans.join('\n');
  };
}

const filterit = makeFilter();

const timing = 'set TIMING=1&';
//const timing = '';
const cmd = timing + 'npx --prefix ./tools/eslint eslint . --debug --config ./tools/eslint/eslint_config.mjs --color';

const child = spawn(cmd, { shell: true });

child.stdout.on('data', (data) => {
  process.stdout.write(data);
});

child.stderr.on('data', (data) => {
  const filtered = filterit(data.toString());
  if (filtered) console.error(filtered);
});

child.on('close', (code) => {
  console.log(`process exited with code ${code}`);
});


//exec('npx --prefix ./tools/eslint  eslint . --config ./tools/eslint/eslint_config.mjs eslint --inspect-config')